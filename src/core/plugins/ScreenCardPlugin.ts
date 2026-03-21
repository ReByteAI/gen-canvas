import type {
  CardPlugin,
  CardRecord,
  EditorAPI,
  MenuItemSpec,
  OverlaySpec,
  Point,
  Rect,
  RenderDescriptor,
  ResizeHandle,
} from '../types'

const ALL_HANDLES: ResizeHandle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

function clampSize(value: number, min: number): number {
  return Math.max(min, value)
}

export class ScreenCardPlugin implements CardPlugin<CardRecord> {
  readonly type: CardRecord['type'] = 'screen'

  getBounds(card: CardRecord): Rect {
    return { x: card.x, y: card.y, width: card.width, height: card.height }
  }

  getRenderDescriptor(card: CardRecord): RenderDescriptor {
    return {
      kind: 'image-preview',
      src:
        card.previewThumbnailUrl ?? (card.content?.kind === 'image' ? card.content.src : undefined),
      title: card.title,
      icon: 'screen',
    }
  }

  getOverlay(_card: CardRecord, _editor: EditorAPI): OverlaySpec | null {
    return null
  }

  getResizePolicy() {
    return {
      enabled: true,
      minWidth: 160,
      minHeight: 120,
      allowedHandles: ALL_HANDLES,
    }
  }

  applyResize(card: CardRecord, handle: ResizeHandle, delta: Point): CardRecord {
    let { x, y, width, height } = card
    const minWidth = 160
    const minHeight = 120

    if (handle.includes('e')) width = clampSize(width + delta.x, minWidth)
    if (handle.includes('s')) height = clampSize(height + delta.y, minHeight)

    if (handle.includes('w')) {
      const nextWidth = clampSize(width - delta.x, minWidth)
      const applied = width - nextWidth
      x += applied
      width = nextWidth
    }

    if (handle.includes('n')) {
      const nextHeight = clampSize(height - delta.y, minHeight)
      const applied = height - nextHeight
      y += applied
      height = nextHeight
    }

    return { ...card, x, y, width, height }
  }

  getMenuItems(card: CardRecord, _editor: EditorAPI): MenuItemSpec[] {
    return [
      {
        id: 'copy',
        kind: 'action',
        label: 'Copy',
        shortcut: '\u2318C',
        action: (editor) => editor.duplicateCards([card.id]),
      },
      {
        id: 'copy-as',
        kind: 'submenu',
        label: 'Copy as',
        children: [
          {
            id: 'copy-as-json',
            kind: 'action',
            label: 'JSON',
            action: (editor) => {
              const current = editor.getCard(card.id)
              if (!current) return
              navigator.clipboard.writeText(JSON.stringify(current, null, 2))
            },
          },
          {
            id: 'copy-as-title',
            kind: 'action',
            label: 'Title',
            action: () => {
              navigator.clipboard.writeText(card.title)
            },
          },
        ],
      },
      { id: 'menu-sep-1', kind: 'separator' },
      {
        id: 'focus',
        kind: 'action',
        label: 'Focus',
        shortcut: 'F',
        action: (editor) => editor.focusCard(card.id),
      },
      {
        id: 'favorite',
        kind: 'action',
        label: card.favorite ? 'Unfavorite' : 'Favourite',
        shortcut: '\u21E7F',
        action: (editor) => editor.toggleFavorite(card.id),
      },
      { id: 'menu-sep-2', kind: 'separator' },
      {
        id: 'view-code',
        kind: 'action',
        label: 'View Code',
        shortcut: '\u21E7C',
        disabled: !card.capabilities.viewCode,
        action: (editor) => editor.emitIntent({ type: 'view-code', cardId: card.id }),
      },
      {
        id: 'export',
        kind: 'submenu',
        label: 'Export',
        children: [
          {
            id: 'export-png',
            kind: 'action',
            label: 'PNG',
            disabled: !card.capabilities.exportable,
            action: (editor) =>
              editor.emitIntent({ type: 'export-card', cardId: card.id, format: 'png' }),
          },
          {
            id: 'export-svg',
            kind: 'action',
            label: 'SVG',
            disabled: !card.capabilities.exportable,
            action: (editor) =>
              editor.emitIntent({ type: 'export-card', cardId: card.id, format: 'svg' }),
          },
          {
            id: 'export-json',
            kind: 'action',
            label: 'JSON',
            disabled: !card.capabilities.exportable,
            action: (editor) =>
              editor.emitIntent({ type: 'export-card', cardId: card.id, format: 'json' }),
          },
        ],
      },
      {
        id: 'download',
        kind: 'action',
        label: 'Download',
        shortcut: '\u21E7D',
        disabled: !card.capabilities.downloadable,
        action: (editor) => editor.emitIntent({ type: 'download-card', cardId: card.id }),
      },
    ]
  }

  canFocus(card: CardRecord): boolean {
    return card.capabilities.focusable
  }
}
