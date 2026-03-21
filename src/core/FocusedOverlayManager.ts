import { worldRectToScreen } from './geometry'
import type { EditorCore } from './EditorCore'
import type { OverlaySpec, Rect } from './types'

export interface FocusedOverlayResolution {
  overlay: OverlaySpec
  screenRect: Rect
}

export interface FocusedOverlayOptions {
  minScale?: number
  hideDuringPan?: boolean
  hideDuringTransform?: boolean
  hideWhenContextMenuOpen?: boolean
}

export function resolveFocusedOverlay(
  editor: EditorCore,
  opts: FocusedOverlayOptions = {},
): FocusedOverlayResolution | null {
  const {
    minScale = 0.35,
    hideDuringPan = true,
    hideDuringTransform = true,
    hideWhenContextMenuOpen = true,
  } = opts

  const runtime = editor.getRuntime()
  const card = editor.getFocusedCard()
  if (!card) return null

  if (runtime.camera.scale < minScale) return null
  if (hideWhenContextMenuOpen && runtime.ui.contextMenu.open) return null

  if (hideDuringPan && runtime.interaction.mode === 'panning') return null

  if (
    hideDuringTransform &&
    (runtime.interaction.mode === 'dragging-card' || runtime.interaction.mode === 'resizing-card')
  ) {
    return null
  }

  const plugin = editor.plugins.get(card.type)
  const overlay = plugin.getOverlay?.(card, editor)
  if (!overlay) return null

  const frame = editor.getCardFrame(card.id)
  if (!frame) return null

  return {
    overlay,
    screenRect: worldRectToScreen(frame, runtime.camera),
  }
}
