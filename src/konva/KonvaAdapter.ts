import Konva from 'konva'
import { screenToWorld } from '../core/geometry'
import { resolveCardRect } from '../core/cardFrames'
import { PreviewCache } from '../core/PreviewRenderer'
import type { EditorCore } from '../core/EditorCore'
import { ToolStateMachine } from '../core/ToolStateMachine'
import { LiveOverlayManager } from './LiveOverlayManager'
import type { HitTarget, Point, RecordId, ResizeHandle } from '../core/types'

type MaybeNode = Konva.Node | null | undefined

export type CanvasTheme = 'light' | 'dark'

interface ThemePalette {
  canvasBg: string
  cardFill: string
  cardStroke: string
  titleText: string
  focusBtnBg: string
  focusBtnIcon: string
  loadingText: string
  starColor: string
  // Selection (shared)
  selectionStroke: string
  resizeHandleFill: string
  resizeHandleStroke: string
  dimBadgeBg: string
  dimBadgeText: string
  multiSelectStroke: string
  marqueeStroke: string
  marqueeFill: string
  snapGuide: string
}

const DARK_PALETTE: ThemePalette = {
  canvasBg: '#111418',
  cardFill: '#1d232b',
  cardStroke: '#2f3944',
  titleText: '#d6dde8',
  focusBtnBg: '#2a2f38',
  focusBtnIcon: '#8b95a5',
  loadingText: '#555d6b',
  starColor: '#f7c948',
  selectionStroke: '#6ea8fe',
  resizeHandleFill: '#6ea8fe',
  resizeHandleStroke: '#dce8ff',
  dimBadgeBg: '#4754ff',
  dimBadgeText: '#fff',
  multiSelectStroke: '#8bb9ff',
  marqueeStroke: '#6ea8fe',
  marqueeFill: 'rgba(106, 168, 254, 0.08)',
  snapGuide: '#ff5ec4',
}

const LIGHT_PALETTE: ThemePalette = {
  canvasBg: '#f5f5f4',
  cardFill: '#ffffff',
  cardStroke: '#e7e5e4',
  titleText: '#44403c',
  focusBtnBg: '#f5f5f4',
  focusBtnIcon: '#78716c',
  loadingText: '#a8a29e',
  starColor: '#f59e0b',
  selectionStroke: '#3b82f6',
  resizeHandleFill: '#3b82f6',
  resizeHandleStroke: '#bfdbfe',
  dimBadgeBg: '#3b82f6',
  dimBadgeText: '#fff',
  multiSelectStroke: '#60a5fa',
  marqueeStroke: '#3b82f6',
  marqueeFill: 'rgba(59, 130, 246, 0.08)',
  snapGuide: '#ec4899',
}

export class KonvaAdapter {
  private editor!: EditorCore
  private tools!: ToolStateMachine
  private liveOverlays!: LiveOverlayManager
  private previewCache!: PreviewCache

  private stage!: Konva.Stage
  private bgLayer!: Konva.Layer
  private contentLayer!: Konva.Layer
  private overlayLayer!: Konva.Layer

  private worldGroup!: Konva.Group
  private overlayWorldGroup!: Konva.Group

  private unsubscribe?: () => void
  private initialAnimationDone = false
  private imageCache = new Map<string, HTMLImageElement>()

  private palette: ThemePalette = DARK_PALETTE

  mount(args: { container: HTMLDivElement; editor: EditorCore; theme?: CanvasTheme }): void {
    this.editor = args.editor
    this.tools = new ToolStateMachine(args.editor)
    this.palette = args.theme === 'light' ? LIGHT_PALETTE : DARK_PALETTE

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
    this.liveOverlays = new LiveOverlayManager(this.editor, args.container)
    this.previewCache = new PreviewCache(() => this.render())
    this.bindEvents()

    this.unsubscribe = this.editor.store.subscribe(() => {
      this.render()
    })

    this.render()
    this.playEntranceAnimation()
  }

  private playEntranceAnimation(): void {
    const groups = this.worldGroup.getChildren() as Konva.Group[]
    if (groups.length === 0) {
      this.initialAnimationDone = true
      return
    }

    // Sort by position: top-left to bottom-right for stagger order
    const sorted = [...groups].sort((a, b) => {
      const ay = a.y() + a.x() * 0.3
      const by = b.y() + b.x() * 0.3
      return ay - by
    })

    const staggerMs = 60
    const durationMs = 400

    for (let i = 0; i < sorted.length; i++) {
      const group = sorted[i]
      const finalY = group.y()

      // Start state: invisible, shifted down, slightly scaled
      group.opacity(0)
      group.y(finalY + 40)
      group.scaleX(0.96)
      group.scaleY(0.96)

      const delay = i * staggerMs
      setTimeout(() => {
        new Konva.Tween({
          node: group,
          duration: durationMs / 1000,
          opacity: 1,
          y: finalY,
          scaleX: 1,
          scaleY: 1,
          easing: Konva.Easings.EaseOut,
        }).play()
      }, delay)
    }

    // Mark done after all animations complete
    const totalMs = sorted.length * staggerMs + durationMs
    setTimeout(() => {
      this.initialAnimationDone = true
    }, totalMs)
  }

  setTheme(theme: CanvasTheme): void {
    this.palette = theme === 'light' ? LIGHT_PALETTE : DARK_PALETTE
    this.previewCache.clear()
    this.render()
  }

  getTheme(): CanvasTheme {
    return this.palette === LIGHT_PALETTE ? 'light' : 'dark'
  }

  unmount(): void {
    this.unsubscribe?.()
    this.liveOverlays?.destroy()
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
    // Don't rebuild nodes during entrance animation — tweens would be destroyed
    if (!this.initialAnimationDone && this.worldGroup?.getChildren().length > 0) return

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

    // Mount/unmount focused card iframe AFTER canvas renders.
    // Only the focused card gets a live iframe — all others are Konva previews.
    this.liveOverlays.update()
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
        fill: this.palette.canvasBg,
      }),
    )
  }

  private renderCards(cards: ReturnType<EditorCore['getVisibleCards']>): void {
    this.worldGroup.destroyChildren()
    const p = this.palette

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
          fill: p.cardFill,
          stroke: p.cardStroke,
          strokeWidth: 1,
          cornerRadius: 10,
          shadowBlur: 8,
          shadowOpacity: 0.08,
        }),
      )

      // Resolve a preview image for the card.
      // For HTML cards: render via the preview pipeline (HTML → hidden iframe → rasterize → PNG)
      // For image cards: resolve through content provider
      // For URL cards: use thumbnailRef if available
      let imageUrl: string | undefined

      if (card.contentType === 'html' && card.contentRef) {
        // Try to get a rasterized preview of the HTML content
        try {
          const resolved = this.editor.content.resolve(card.contentRef, 'html')
          if (!(resolved instanceof Promise) && resolved.type === 'html') {
            const cacheKey = `${card.id}:${card.contentRef}`
            imageUrl = this.previewCache.request(cacheKey, {
              html: resolved.html,
              width: Math.round(frameRect.width),
              height: Math.round(frameRect.height),
            })
          }
        } catch {
          // fallback below
        }
      }

      // Fallback: resolve thumbnailRef or image contentRef through provider
      if (!imageUrl) {
        const refToResolve =
          card.thumbnailRef ?? (card.contentType === 'image' ? card.contentRef : undefined)
        if (refToResolve) {
          try {
            const resolved = this.editor.content.resolve(refToResolve, 'image')
            if (!(resolved instanceof Promise) && resolved.type === 'image') {
              imageUrl = resolved.src
            }
          } catch {
            // no preview available
          }
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
      } else if (card.contentRef && card.contentType === 'html') {
        // Preview not ready yet — show loading indicator
        group.add(
          new Konva.Text({
            x: frameRect.width / 2,
            y: frameRect.height / 2 - 10,
            text: 'Rendering preview\u2026',
            fontSize: 13,
            fill: p.loadingText,
            align: 'center',
            offsetX: 60,
          }),
        )
      }

      group.add(
        new Konva.Text({
          x: 12,
          y: -24,
          text: `${this.iconForType(card.type)} ${card.title}`,
          fontSize: 14,
          fill: p.titleText,
          fontStyle: '600',
        }),
      )

      // Focus button — shown for cards with interactive content (html/url)
      if (
        card.capabilities.focusable &&
        card.contentRef &&
        (card.contentType === 'html' || card.contentType === 'url')
      ) {
        const btnSize = 20
        const btnX = frameRect.width - btnSize - 8
        const btnY = -28

        // Button background
        group.add(
          new Konva.Rect({
            x: btnX - 4,
            y: btnY - 2,
            width: btnSize + 8,
            height: btnSize + 4,
            fill: p.focusBtnBg,
            cornerRadius: 6,
            attrs: { editorRole: 'focus-button', cardId: card.id },
          }),
        )

        // Play/expand icon
        group.add(
          new Konva.Text({
            x: btnX,
            y: btnY,
            text: '\u25B6',
            fontSize: 14,
            fill: p.focusBtnIcon,
            attrs: { editorRole: 'focus-button', cardId: card.id },
          }),
        )
      }

      if (card.favorite) {
        group.add(
          new Konva.Text({
            x: frameRect.width - 26,
            y: 8,
            text: '\u2605',
            fontSize: 16,
            fill: p.starColor,
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
    const p = this.palette

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
          stroke: p.selectionStroke,
          strokeWidth: 2 / runtime.camera.scale,
          cornerRadius: 10,
        }),
      )

      if (!isFocused) continue

      // Resize handles
      const handles = this.handlePositions(frameRect)
      for (const [handle, pt] of Object.entries(handles) as [ResizeHandle, Point][]) {
        this.overlayWorldGroup.add(
          new Konva.Rect({
            x: pt.x - 4 / runtime.camera.scale,
            y: pt.y - 4 / runtime.camera.scale,
            width: 8 / runtime.camera.scale,
            height: 8 / runtime.camera.scale,
            fill: p.resizeHandleFill,
            stroke: p.resizeHandleStroke,
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
            fill: p.dimBadgeBg,
            cornerRadius: 16 / runtime.camera.scale,
          }),
        )
        label.add(
          new Konva.Text({
            text: `${Math.round(frameRect.width)} \u00D7 ${Math.round(frameRect.height)}`,
            fill: p.dimBadgeText,
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
          stroke: p.multiSelectStroke,
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
          fill: p.marqueeFill,
          stroke: p.marqueeStroke,
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
            stroke: p.snapGuide,
            strokeWidth: 1.5 / runtime.camera.scale,
            dash: [6 / runtime.camera.scale, 4 / runtime.camera.scale],
          }),
        )
      } else {
        this.overlayWorldGroup.add(
          new Konva.Line({
            points: [guide.start, guide.value, guide.end, guide.value],
            stroke: p.snapGuide,
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
        deltaX: evt.evt.deltaX,
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
      if (attrs.editorRole === 'focus-button') {
        return {
          kind: 'focus-button',
          cardId: attrs.cardId as RecordId,
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
