import Konva from 'konva'
import { screenToWorld } from '../core/geometry'
import { resolveCardRect } from '../core/cardFrames'
import type { EditorCore } from '../core/EditorCore'
import { ToolStateMachine } from '../core/ToolStateMachine'
import type { HitTarget, Point, RecordId, ResizeHandle } from '../core/types'

type MaybeNode = Konva.Node | null | undefined

export class KonvaAdapter {
  private editor!: EditorCore
  private tools!: ToolStateMachine

  private stage!: Konva.Stage
  private bgLayer!: Konva.Layer
  private contentLayer!: Konva.Layer
  private overlayLayer!: Konva.Layer

  private worldGroup!: Konva.Group
  private overlayWorldGroup!: Konva.Group

  private unsubscribe?: () => void
  private imageCache = new Map<string, HTMLImageElement>()

  mount(args: { container: HTMLDivElement; editor: EditorCore }): void {
    this.editor = args.editor
    this.tools = new ToolStateMachine(args.editor)

    const width = args.container.clientWidth
    const height = args.container.clientHeight

    this.stage = new Konva.Stage({
      container: args.container,
      width,
      height,
    })

    this.bgLayer = new Konva.Layer()
    this.contentLayer = new Konva.Layer()
    this.overlayLayer = new Konva.Layer()

    this.worldGroup = new Konva.Group()
    this.overlayWorldGroup = new Konva.Group()

    this.contentLayer.add(this.worldGroup)
    this.overlayLayer.add(this.overlayWorldGroup)

    this.stage.add(this.bgLayer)
    this.stage.add(this.contentLayer)
    this.stage.add(this.overlayLayer)

    this.editor.setViewportSize(width, height)
    this.bindEvents()

    this.unsubscribe = this.editor.store.subscribe(() => {
      this.render()
    })

    this.render()
  }

  unmount(): void {
    this.unsubscribe?.()
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.stage?.destroy()
  }

  resize(width: number, height: number): void {
    this.stage.width(width)
    this.stage.height(height)
    this.editor.setViewportSize(width, height)
    this.render()
  }

  render(): void {
    const runtime = this.editor.getRuntime()
    const cards = this.editor.getVisibleCards()

    const scale = runtime.camera.scale
    const offsetX = -runtime.camera.x * scale
    const offsetY = -runtime.camera.y * scale

    this.worldGroup.position({ x: offsetX, y: offsetY })
    this.worldGroup.scale({ x: scale, y: scale })

    this.overlayWorldGroup.position({ x: offsetX, y: offsetY })
    this.overlayWorldGroup.scale({ x: scale, y: scale })

    this.renderBackground()
    this.renderCards(cards)
    this.renderSelectionOverlay()

    this.bgLayer.batchDraw()
    this.contentLayer.batchDraw()
    this.overlayLayer.batchDraw()
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private renderBackground(): void {
    this.bgLayer.destroyChildren()

    this.bgLayer.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: this.stage.width(),
        height: this.stage.height(),
        fill: '#111418',
      }),
    )
  }

  private renderCards(cards: ReturnType<EditorCore['getVisibleCards']>): void {
    this.worldGroup.destroyChildren()

    for (const card of cards.sort((a, b) => a.zIndex - b.zIndex)) {
      const frameRect = resolveCardRect(this.editor, card)

      const group = new Konva.Group({
        x: frameRect.x,
        y: frameRect.y,
        attrs: { editorRole: 'card-body', cardId: card.id },
      })

      group.add(
        new Konva.Rect({
          x: 0,
          y: 0,
          width: frameRect.width,
          height: frameRect.height,
          fill: '#1d232b',
          stroke: '#2f3944',
          strokeWidth: 1,
          cornerRadius: 10,
          shadowBlur: 8,
          shadowOpacity: 0.08,
        }),
      )

      // Resolve an image URL for the card preview.
      // Try thumbnailRef first, then contentRef for image-type cards.
      // All refs go through the content provider to get actual URLs.
      let imageUrl: string | undefined
      const refToResolve =
        card.thumbnailRef ?? (card.contentType === 'image' ? card.contentRef : undefined)
      if (refToResolve) {
        try {
          const resolved = this.editor.content.resolve(refToResolve, 'image')
          if (!(resolved instanceof Promise) && resolved.type === 'image') {
            imageUrl = resolved.src
          }
        } catch {
          // ref not resolvable — no preview
        }
      }
      if (imageUrl) {
        const img = this.getImage(imageUrl)
        if (img) {
          group.add(
            new Konva.Image({
              image: img,
              x: 0,
              y: 0,
              width: frameRect.width,
              height: frameRect.height,
              cornerRadius: 10,
            }),
          )
        }
      }

      group.add(
        new Konva.Text({
          x: 12,
          y: -24,
          text: `${this.iconForType(card.type)} ${card.title}`,
          fontSize: 14,
          fill: '#d6dde8',
          fontStyle: '600',
        }),
      )

      if (card.favorite) {
        group.add(
          new Konva.Text({
            x: frameRect.width - 26,
            y: 8,
            text: '\u2605',
            fontSize: 16,
            fill: '#f7c948',
          }),
        )
      }

      this.worldGroup.add(group)
    }
  }

  private renderSelectionOverlay(): void {
    this.overlayWorldGroup.destroyChildren()

    const runtime = this.editor.getRuntime()
    const selected = this.editor.getSelectedCards()

    // Per-card selection outlines
    for (const card of selected) {
      const frameRect = resolveCardRect(this.editor, card)
      const isFocused = runtime.selection.focusedId === card.id

      this.overlayWorldGroup.add(
        new Konva.Rect({
          x: frameRect.x,
          y: frameRect.y,
          width: frameRect.width,
          height: frameRect.height,
          stroke: '#6ea8fe',
          strokeWidth: 2 / runtime.camera.scale,
          cornerRadius: 10,
        }),
      )

      if (!isFocused) continue

      // Resize handles
      const handles = this.handlePositions(frameRect)
      for (const [handle, p] of Object.entries(handles) as [ResizeHandle, Point][]) {
        this.overlayWorldGroup.add(
          new Konva.Rect({
            x: p.x - 4 / runtime.camera.scale,
            y: p.y - 4 / runtime.camera.scale,
            width: 8 / runtime.camera.scale,
            height: 8 / runtime.camera.scale,
            fill: '#6ea8fe',
            stroke: '#dce8ff',
            strokeWidth: 1 / runtime.camera.scale,
            attrs: { editorRole: 'resize-handle', cardId: card.id, handle },
          }),
        )
      }

      // Dimension badge
      if (runtime.ui.dimensionBadgeVisible) {
        const label = new Konva.Label({
          x: frameRect.x + frameRect.width / 2,
          y: frameRect.y + frameRect.height + 18 / runtime.camera.scale,
          opacity: 1,
        })
        label.add(
          new Konva.Tag({
            fill: '#4754ff',
            cornerRadius: 16 / runtime.camera.scale,
          }),
        )
        label.add(
          new Konva.Text({
            text: `${Math.round(frameRect.width)} \u00D7 ${Math.round(frameRect.height)}`,
            fill: '#fff',
            fontSize: 12 / runtime.camera.scale,
            padding: 8 / runtime.camera.scale,
          }),
        )
        this.overlayWorldGroup.add(label)
      }
    }

    // Multi-selection bounds
    const selectionBounds = this.editor.getSelectionBounds()
    if (selected.length > 1 && selectionBounds) {
      this.overlayWorldGroup.add(
        new Konva.Rect({
          x: selectionBounds.x,
          y: selectionBounds.y,
          width: selectionBounds.width,
          height: selectionBounds.height,
          stroke: '#8bb9ff',
          strokeWidth: 1.5 / runtime.camera.scale,
          dash: [8 / runtime.camera.scale, 6 / runtime.camera.scale],
          cornerRadius: 12 / runtime.camera.scale,
        }),
      )
    }

    // Marquee rect
    const marquee = runtime.interaction.marqueeRect
    if (marquee && runtime.interaction.mode === 'marquee-select') {
      this.overlayWorldGroup.add(
        new Konva.Rect({
          x: marquee.x,
          y: marquee.y,
          width: marquee.width,
          height: marquee.height,
          fill: 'rgba(106, 168, 254, 0.08)',
          stroke: '#6ea8fe',
          strokeWidth: 1 / runtime.camera.scale,
          dash: [6 / runtime.camera.scale, 4 / runtime.camera.scale],
        }),
      )
    }

    // Snap guide lines
    for (const guide of runtime.snap.guides) {
      if (guide.axis === 'x') {
        this.overlayWorldGroup.add(
          new Konva.Line({
            points: [guide.value, guide.start, guide.value, guide.end],
            stroke: '#ff5ec4',
            strokeWidth: 1.5 / runtime.camera.scale,
            dash: [6 / runtime.camera.scale, 4 / runtime.camera.scale],
          }),
        )
      } else {
        this.overlayWorldGroup.add(
          new Konva.Line({
            points: [guide.start, guide.value, guide.end, guide.value],
            stroke: '#ff5ec4',
            strokeWidth: 1.5 / runtime.camera.scale,
            dash: [6 / runtime.camera.scale, 4 / runtime.camera.scale],
          }),
        )
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private handlePositions(rect: { x: number; y: number; width: number; height: number }) {
    const midX = rect.x + rect.width / 2
    const midY = rect.y + rect.height / 2
    const right = rect.x + rect.width
    const bottom = rect.y + rect.height

    return {
      nw: { x: rect.x, y: rect.y },
      n: { x: midX, y: rect.y },
      ne: { x: right, y: rect.y },
      e: { x: right, y: midY },
      se: { x: right, y: bottom },
      s: { x: midX, y: bottom },
      sw: { x: rect.x, y: bottom },
      w: { x: rect.x, y: midY },
    }
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  private bindEvents(): void {
    const dispatch = (_type: string, evt: Konva.KonvaEventObject<any>) => {
      const screen = this.getPointerScreen()
      const world = screenToWorld(screen, this.editor.getRuntime().camera)
      const target = this.resolveHitTarget(evt.target)
      const me = evt.evt as MouseEvent

      return {
        screen,
        world,
        target,
        button: me.button ?? 0,
        shift: me.shiftKey ?? false,
        meta: me.metaKey || me.ctrlKey || false,
        alt: me.altKey ?? false,
      }
    }

    this.stage.on('mousedown touchstart', (evt) => {
      const d = dispatch('pointer_down', evt)
      this.tools.handle({ type: 'pointer_down', ...d })
    })

    this.stage.on('mousemove touchmove', (evt) => {
      const d = dispatch('pointer_move', evt)
      this.tools.handle({ type: 'pointer_move', ...d })
    })

    this.stage.on('mouseup touchend', (evt) => {
      const d = dispatch('pointer_up', evt)
      this.tools.handle({ type: 'pointer_up', screen: d.screen, world: d.world, button: d.button })
    })

    this.stage.on('dblclick dbltap', (evt) => {
      const d = dispatch('double_click', evt)
      this.tools.handle({
        type: 'double_click',
        screen: d.screen,
        world: d.world,
        target: d.target,
      })
    })

    this.stage.on('wheel', (evt) => {
      evt.evt.preventDefault()
      const d = dispatch('wheel', evt)
      this.tools.handle({
        type: 'wheel',
        screen: d.screen,
        world: d.world,
        deltaY: evt.evt.deltaY,
        ctrlKey: evt.evt.ctrlKey,
      })
    })

    this.stage.on('contextmenu', (evt) => {
      evt.evt.preventDefault()
      const d = dispatch('context_menu', evt)
      this.tools.handle({
        type: 'context_menu',
        screen: d.screen,
        world: d.world,
        target: d.target,
      })
    })

    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
  }

  private onKeyDown = (evt: KeyboardEvent) => {
    this.tools.handle({
      type: 'key_down',
      key: evt.key,
      shift: evt.shiftKey,
      meta: evt.metaKey || evt.ctrlKey,
      alt: evt.altKey,
    })
  }

  private onKeyUp = (evt: KeyboardEvent) => {
    this.tools.handle({
      type: 'key_up',
      key: evt.key,
    })
  }

  private getPointerScreen(): Point {
    return this.stage.getPointerPosition() ?? { x: 0, y: 0 }
  }

  private resolveHitTarget(node: MaybeNode): HitTarget {
    let current = node
    while (current) {
      const attrs = current.getAttrs?.() ?? {}
      if (attrs.editorRole === 'resize-handle') {
        return {
          kind: 'resize-handle',
          cardId: attrs.cardId as RecordId,
          handle: attrs.handle as ResizeHandle,
        }
      }
      if (attrs.editorRole === 'card-body') {
        return {
          kind: 'card',
          cardId: attrs.cardId as RecordId,
        }
      }
      current = current.getParent()
    }
    return { kind: 'empty' }
  }

  private iconForType(type: string): string {
    switch (type) {
      case 'prototype':
        return '\uD83C\uDF10'
      case 'document':
        return '\uD83D\uDCC4'
      case 'group':
        return '\uD83D\uDDC2'
      default:
        return '\u229F'
    }
  }

  private getImage(src: string): HTMLImageElement | undefined {
    const cached = this.imageCache.get(src)
    if (cached) return cached

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = src
    img.onload = () => this.render()
    this.imageCache.set(src, img)
    return undefined
  }
}
