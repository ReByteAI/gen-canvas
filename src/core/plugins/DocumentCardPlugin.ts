import { ScreenCardPlugin } from './ScreenCardPlugin'
import type { CardRecord, EditorAPI, OverlaySpec, RenderDescriptor } from '../types'

export class DocumentCardPlugin extends ScreenCardPlugin {
  override readonly type = 'document'

  override getRenderDescriptor(card: CardRecord): RenderDescriptor {
    return {
      kind: 'document-preview',
      src: card.thumbnailRef ?? (card.contentType === 'image' ? card.contentRef : undefined),
      title: card.title,
      icon: 'document',
    }
  }

  override getOverlay(card: CardRecord, _editor: EditorAPI): OverlaySpec | null {
    if (!card.capabilities.liveOverlay) return null
    return {
      kind: 'html',
      cardId: card.id,
      payload: { documentId: card.meta?.documentId },
    }
  }
}
