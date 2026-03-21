import { worldRectToScreen } from '../core/geometry'
import { resolveFocusedOverlay } from '../core/FocusedOverlayManager'
import { resolveCardRect } from '../core/cardFrames'
import type { EditorCore } from '../core/EditorCore'
import type { CardRecord, MenuItemSpec, OverlaySpec, Rect } from '../core/types'

export function getSingleSelectedCard(editor: EditorCore): CardRecord | undefined {
  const cards = editor.getSelectedCards()
  return cards.length === 1 ? cards[0] : undefined
}

export function getContextMenuItems(editor: EditorCore): MenuItemSpec[] {
  const runtime = editor.getRuntime()
  const targetCardId = runtime.ui.contextMenu.targetCardId
  if (!targetCardId) return []

  const card = editor.getCard(targetCardId)
  if (!card) return []

  const plugin = editor.plugins.get(card.type)
  return plugin.getMenuItems(card, editor)
}

export function getFocusedOverlay(editor: EditorCore): OverlaySpec | null {
  const card = editor.getFocusedCard()
  if (!card) return null

  const plugin = editor.plugins.get(card.type)
  return plugin.getOverlay?.(card, editor) ?? null
}

export function getFocusedOverlayScreenRect(editor: EditorCore): Rect | null {
  const card = editor.getFocusedCard()
  if (!card) return null

  const frame = editor.getCardFrame(card.id)
  if (!frame) return null
  return worldRectToScreen(frame, editor.getRuntime().camera)
}

export function getFocusedOverlayResolution(editor: EditorCore) {
  return resolveFocusedOverlay(editor)
}

export function getResolvedSelectedCardRect(editor: EditorCore): Rect | undefined {
  const card = getSingleSelectedCard(editor)
  if (!card) return undefined
  return resolveCardRect(editor, card)
}
