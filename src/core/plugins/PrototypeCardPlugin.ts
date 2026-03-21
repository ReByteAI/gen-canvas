import { ScreenCardPlugin } from './ScreenCardPlugin'
import type { CardRecord, EditorAPI, OverlaySpec, RenderDescriptor } from '../types'

export class PrototypeCardPlugin extends ScreenCardPlugin {
  override readonly type = 'prototype'

  override getRenderDescriptor(card: CardRecord): RenderDescriptor {
    return {
      kind: 'prototype-preview',
      src:
        card.previewThumbnailUrl ?? (card.content?.kind === 'image' ? card.content.src : undefined),
      title: card.title,
      icon: 'prototype',
    }
  }

  override getOverlay(card: CardRecord, _editor: EditorAPI): OverlaySpec | null {
    if (!card.capabilities.liveOverlay) return null
    return {
      kind: 'iframe',
      cardId: card.id,
      payload: { src: card.meta?.liveUrl },
    }
  }
}
