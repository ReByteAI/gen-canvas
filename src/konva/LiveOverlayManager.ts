import { worldToScreen } from '../core/geometry'
import type { EditorCore } from '../core/EditorCore'
import type { CardRecord, CameraState, ResolvedContent } from '../core/types'

/** Minimum screen-space area (px^2) before a live overlay is shown */
const MIN_SCREEN_AREA = 120 * 120

export interface LiveOverlayManagerOptions {
  /** Minimum screen-space area before live iframe is mounted. Default: 14400 (120x120) */
  minScreenArea?: number
}

interface MountedOverlay {
  cardId: string
  iframe: HTMLIFrameElement
  wrapper: HTMLDivElement
}

export class LiveOverlayManager {
  private editor: EditorCore
  private parentContainer: HTMLElement
  private overlays = new Map<string, MountedOverlay>()
  private minScreenArea: number

  constructor(
    editor: EditorCore,
    parentContainer: HTMLElement,
    opts: LiveOverlayManagerOptions = {},
  ) {
    this.editor = editor
    this.parentContainer = parentContainer
    this.minScreenArea = opts.minScreenArea ?? MIN_SCREEN_AREA
  }

  /**
   * Called every render frame. Syncs live overlay iframes to the current camera/card state.
   * Mounts new overlays, removes stale ones, and repositions existing ones.
   */
  update(): void {
    const runtime = this.editor.getRuntime()
    const camera = runtime.camera
    const cards = this.editor.getVisibleCards()

    // Don't show overlays during drag/resize/pan for performance
    const suppressOverlays =
      runtime.interaction.mode === 'dragging-card' ||
      runtime.interaction.mode === 'resizing-card' ||
      runtime.interaction.mode === 'panning'

    const wantedIds = new Set<string>()

    if (!suppressOverlays) {
      for (const card of cards) {
        if (!card.contentRef || !card.contentType) continue
        if (card.contentType === 'image') continue // images render in Konva

        const screenRect = this.getScreenRect(card, camera)
        const screenArea = screenRect.width * screenRect.height

        if (screenArea >= this.minScreenArea) {
          wantedIds.add(card.id)
        }
      }
    }

    // Remove overlays that are no longer wanted
    for (const [cardId, overlay] of this.overlays) {
      if (!wantedIds.has(cardId)) {
        overlay.wrapper.remove()
        this.overlays.delete(cardId)
      }
    }

    // Mount or update wanted overlays
    for (const cardId of wantedIds) {
      const card = this.editor.getCard(cardId)
      if (!card || !card.contentRef || !card.contentType) continue

      const screenRect = this.getScreenRect(card, camera)
      let overlay = this.overlays.get(cardId)

      if (!overlay) {
        overlay = this.mount(card)
        this.overlays.set(cardId, overlay)
      }

      // Position wrapper at card's screen rect
      const w = overlay.wrapper
      w.style.left = `${screenRect.x}px`
      w.style.top = `${screenRect.y}px`
      w.style.width = `${screenRect.width}px`
      w.style.height = `${screenRect.height}px`
      w.style.zIndex = `${50 + card.zIndex}`

      // Scale the iframe: render at world size, CSS-scale to screen size
      const frame = this.editor.getCardFrame(card.id)
      if (frame) {
        const scaleX = screenRect.width / frame.width
        const scaleY = screenRect.height / frame.height
        overlay.iframe.style.width = `${frame.width}px`
        overlay.iframe.style.height = `${frame.height}px`
        overlay.iframe.style.transform = `scale(${scaleX}, ${scaleY})`
        overlay.iframe.style.transformOrigin = 'top left'
      }

      // Only focused card gets pointer events — all others pass through to canvas
      const isFocused = runtime.selection.focusedId === cardId
      w.style.pointerEvents = isFocused ? 'auto' : 'none'
    }
  }

  /** Check if a card currently has a live overlay mounted */
  hasOverlay(cardId: string): boolean {
    return this.overlays.has(cardId)
  }

  /** Destroy all overlays and clean up */
  destroy(): void {
    for (const [, overlay] of this.overlays) {
      overlay.wrapper.remove()
    }
    this.overlays.clear()
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private mount(card: CardRecord): MountedOverlay {
    const wrapper = document.createElement('div')
    wrapper.style.position = 'absolute'
    wrapper.style.overflow = 'hidden'
    wrapper.style.borderRadius = '10px'
    wrapper.style.pointerEvents = 'none'
    wrapper.dataset.cardOverlay = card.id

    const iframe = document.createElement('iframe')
    iframe.style.width = '100%'
    iframe.style.height = '100%'
    iframe.style.border = 'none'
    iframe.style.borderRadius = '10px'
    iframe.style.background = '#fff'
    iframe.style.pointerEvents = 'none'
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups')
    iframe.title = card.title

    // Resolve content through the provider
    if (card.contentRef && card.contentType) {
      const resolved = this.editor.content.resolve(card.contentRef, card.contentType)
      if (resolved instanceof Promise) {
        resolved.then((content) => this.applyContent(iframe, content))
      } else {
        this.applyContent(iframe, resolved)
      }
    }

    wrapper.appendChild(iframe)
    this.parentContainer.appendChild(wrapper)

    return { cardId: card.id, iframe, wrapper }
  }

  private applyContent(iframe: HTMLIFrameElement, content: ResolvedContent): void {
    switch (content.type) {
      case 'html':
        iframe.srcdoc = content.html
        break
      case 'url':
        iframe.src = content.url
        break
      case 'image':
        iframe.srcdoc = `<html><body style="margin:0"><img src="${content.src}" style="width:100%;height:100%;object-fit:cover"></body></html>`
        break
    }
  }

  private getScreenRect(card: CardRecord, camera: CameraState) {
    const frame = this.editor.getCardFrame(card.id) ?? {
      x: card.x,
      y: card.y,
      width: card.width,
      height: card.height,
    }
    const topLeft = worldToScreen({ x: frame.x, y: frame.y }, camera)
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: frame.width * camera.scale,
      height: frame.height * camera.scale,
    }
  }
}
