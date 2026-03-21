import type { CardRecord, EditorAPI, Rect } from './types'

export function cardToRect(card: CardRecord): Rect {
  return {
    x: card.x,
    y: card.y,
    width: card.width,
    height: card.height,
  }
}

export function resolveCardRect(editor: EditorAPI, card: CardRecord): Rect {
  return editor.getCardFrame(card.id) ?? cardToRect(card)
}
