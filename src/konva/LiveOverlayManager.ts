import { worldToScreen } from '../core/geometry'
import type { EditorCore } from '../core/EditorCore'
import type { CardRecord, CameraState, ResolvedContent } from '../core/types'

interface MountedOverlay {
  cardId: string
  iframe: HTMLIFrameElement
  wrapper: HTMLDivElement
}

/**
 * Manages a single live iframe overlay for the focused card.
 *
 * Browse mode: no iframes, no DOM overlays. Cards render as Konva previews.
 * Focus mode (double-click): mounts one iframe for the focused card so the
 * user can interact with the live content. Destroyed on focus exit.
 */
export class LiveOverlayManager {
  private editor: EditorCore
  private parentContainer: HTMLElement
  private activeOverlay: MountedOverlay | null = null

  constructor(editor: EditorCore, parentContainer: HTMLElement) {
    this.editor = editor
    this.parentContainer = parentContainer
  }

  /**
   * Called every render frame. Mounts/unmounts the focused card iframe.
   */
  update(): void {
    const runtime = this.editor.getRuntime()
    const focusedId = runtime.selection.focusedId

    // No focused card → remove any existing overlay
    if (!focusedId) {
      this.unmountOverlay()
      return
    }

    const card = this.editor.getCard(focusedId)
    if (!card || !card.contentRef || !card.contentType || card.contentType === 'image') {
      this.unmountOverlay()
      return
    }

    // Hide during drag/resize so canvas events work
    if (
      runtime.interaction.mode === 'dragging-card' ||
      runtime.interaction.mode === 'resizing-card'
    ) {
      if (this.activeOverlay) {
        this.activeOverlay.wrapper.style.visibility = 'hidden'
      }
      return
    }

    // Mount if not already mounted for this card
    if (!this.activeOverlay || this.activeOverlay.cardId !== focusedId) {
      this.unmountOverlay()
      this.activeOverlay = this.mount(card)
    }

    // Position and scale
    const camera = runtime.camera
    const screenRect = this.getScreenRect(card, camera)
    const frame = this.editor.getCardFrame(card.id)
    const w = this.activeOverlay.wrapper

    w.style.left = `${screenRect.x}px`
    w.style.top = `${screenRect.y}px`
    w.style.width = `${screenRect.width}px`
    w.style.height = `${screenRect.height}px`
    w.style.visibility = 'visible'
    w.style.zIndex = `${1000 + card.zIndex}`

    if (frame) {
      const scaleX = screenRect.width / frame.width
      const scaleY = screenRect.height / frame.height
      this.activeOverlay.iframe.style.width = `${frame.width}px`
      this.activeOverlay.iframe.style.height = `${frame.height}px`
      this.activeOverlay.iframe.style.transform = `scale(${scaleX}, ${scaleY})`
      this.activeOverlay.iframe.style.transformOrigin = 'top left'
    }
  }

  /** Check if a card currently has a visible live overlay */
  hasOverlay(cardId: string): boolean {
    return (
      this.activeOverlay !== null &&
      this.activeOverlay.cardId === cardId &&
      this.activeOverlay.wrapper.style.visibility !== 'hidden'
    )
  }

  /** Destroy everything */
  destroy(): void {
    this.unmountOverlay()
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private unmountOverlay(): void {
    if (this.activeOverlay) {
      this.activeOverlay.wrapper.remove()
      this.activeOverlay = null
    }
  }

  private mount(card: CardRecord): MountedOverlay {
    const wrapper = document.createElement('div')
    wrapper.style.position = 'absolute'
    wrapper.style.overflow = 'hidden'
    wrapper.style.borderRadius = '10px'
    wrapper.style.pointerEvents = 'auto'
    wrapper.dataset.cardOverlay = card.id

    const iframe = document.createElement('iframe')
    iframe.style.width = '100%'
    iframe.style.height = '100%'
    iframe.style.border = 'none'
    iframe.style.borderRadius = '10px'
    iframe.style.background = '#fff'
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups')
    iframe.title = card.title

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
