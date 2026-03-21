import { describe, it, expect, vi } from 'vitest'
import { EditorStore } from '../EditorStore'
import { EditorCore } from '../EditorCore'
import { PluginRegistry } from '../PluginRegistry'
import { ScreenCardPlugin } from '../plugins/ScreenCardPlugin'
import type { CardRecord, EditorRecords, RuntimeState } from '../types'

function makeCard(overrides: Partial<CardRecord> = {}): CardRecord {
  return {
    id: 'card_1',
    type: 'screen',
    title: 'Test Card',
    x: 100,
    y: 100,
    width: 200,
    height: 150,
    zIndex: 1,
    visible: true,
    locked: false,
    favorite: false,
    createdAt: 0,
    updatedAt: 0,
    capabilities: {
      selectable: true,
      focusable: true,
      movable: true,
      resizable: true,
      exportable: true,
      downloadable: true,
      viewCode: true,
      liveOverlay: false,
    },
    ...overrides,
  }
}

function createEditor(cards: CardRecord[] = [makeCard()]) {
  const records: EditorRecords = {
    document: { id: 'doc_1', title: 'Test', createdAt: 0, updatedAt: 0, version: 1 },
    cards: Object.fromEntries(cards.map((c) => [c.id, c])),
    provenance: {},
    revisions: {},
    bindings: {},
  }
  const runtime: RuntimeState = {
    camera: {
      x: 0,
      y: 0,
      scale: 1,
      viewportWidth: 1000,
      viewportHeight: 800,
      minScale: 0.05,
      maxScale: 4,
    },
    selection: { selectedIds: [] },
    interaction: { tool: 'select', mode: 'idle', spacePanActive: false },
    ui: { contextMenu: { open: false, screenX: 0, screenY: 0 }, dimensionBadgeVisible: false },
    preview: { active: false, cardFrames: {} },
    snap: { enabled: false, mode: 'off', thresholdPx: 6, guides: [], bypass: false },
  }
  const plugins = new PluginRegistry()
  plugins.register(new ScreenCardPlugin())
  return new EditorCore({ store: new EditorStore({ records, runtime }), plugins })
}

describe('EditorCore', () => {
  describe('card queries', () => {
    it('getCard returns a card by id', () => {
      const editor = createEditor()
      expect(editor.getCard('card_1')?.title).toBe('Test Card')
    })

    it('getCard returns undefined for missing id', () => {
      const editor = createEditor()
      expect(editor.getCard('nope')).toBeUndefined()
    })

    it('getVisibleCards returns only visible cards', () => {
      const editor = createEditor([
        makeCard({ id: 'a', visible: true }),
        makeCard({ id: 'b', visible: false }),
      ])
      expect(editor.getVisibleCards().map((c) => c.id)).toEqual(['a'])
    })
  })

  describe('selection', () => {
    it('selectCard sets selection', () => {
      const editor = createEditor()
      editor.selectCard('card_1')
      expect(editor.getRuntime().selection.selectedIds).toEqual(['card_1'])
    })

    it('selectCard with additive adds to selection', () => {
      const editor = createEditor([makeCard({ id: 'a' }), makeCard({ id: 'b' })])
      editor.selectCard('a')
      editor.selectCard('b', true)
      expect(editor.getRuntime().selection.selectedIds).toEqual(['a', 'b'])
    })

    it('clearSelection empties selection and clears focus', () => {
      const editor = createEditor()
      editor.selectCard('card_1')
      editor.focusCard('card_1')
      editor.clearSelection()
      expect(editor.getRuntime().selection.selectedIds).toEqual([])
      expect(editor.getRuntime().selection.focusedId).toBeUndefined()
    })

    it('does not select non-selectable cards', () => {
      const editor = createEditor([
        makeCard({ id: 'locked', capabilities: { ...makeCard().capabilities, selectable: false } }),
      ])
      editor.selectCard('locked')
      expect(editor.getRuntime().selection.selectedIds).toEqual([])
    })
  })

  describe('focus', () => {
    it('focusCard sets focusedId and selects', () => {
      const editor = createEditor()
      editor.focusCard('card_1')
      expect(editor.getRuntime().selection.focusedId).toBe('card_1')
      expect(editor.getRuntime().selection.selectedIds).toContain('card_1')
      expect(editor.getRuntime().ui.dimensionBadgeVisible).toBe(true)
    })

    it('exitFocus clears focus but keeps selection', () => {
      const editor = createEditor()
      editor.focusCard('card_1')
      editor.exitFocus()
      expect(editor.getRuntime().selection.focusedId).toBeUndefined()
      expect(editor.getRuntime().selection.selectedIds).toContain('card_1')
    })
  })

  describe('card CRUD', () => {
    it('createCards adds cards', () => {
      const editor = createEditor([])
      const card = makeCard({ id: 'new_1' })
      editor.createCards([card])
      expect(editor.getCard('new_1')).toBeDefined()
    })

    it('deleteCards removes cards and clears from selection', () => {
      const editor = createEditor()
      editor.selectCard('card_1')
      editor.deleteCards(['card_1'])
      expect(editor.getCard('card_1')).toBeUndefined()
      expect(editor.getRuntime().selection.selectedIds).toEqual([])
    })

    it('moveCards updates position', () => {
      const editor = createEditor()
      editor.moveCards(['card_1'], 10, 20)
      const card = editor.getCard('card_1')!
      expect(card.x).toBe(110)
      expect(card.y).toBe(120)
    })

    it('moveCards respects locked', () => {
      const editor = createEditor([makeCard({ id: 'locked', locked: true })])
      editor.moveCards(['locked'], 10, 20)
      expect(editor.getCard('locked')!.x).toBe(100)
    })

    it('duplicateCards creates copies and selects them', () => {
      const editor = createEditor()
      const newIds = editor.duplicateCards(['card_1'])
      expect(newIds).toHaveLength(1)
      expect(editor.getCard(newIds[0])?.title).toBe('Test Card Copy')
      expect(editor.getRuntime().selection.selectedIds).toEqual(newIds)
    })

    it('toggleFavorite flips favorite state', () => {
      const editor = createEditor()
      expect(editor.getCard('card_1')!.favorite).toBe(false)
      editor.toggleFavorite('card_1')
      expect(editor.getCard('card_1')!.favorite).toBe(true)
      editor.toggleFavorite('card_1')
      expect(editor.getCard('card_1')!.favorite).toBe(false)
    })
  })

  describe('history', () => {
    it('undo reverts a recorded transaction', () => {
      const editor = createEditor()
      editor.moveCards(['card_1'], 50, 50, { history: 'record', label: 'move' })
      expect(editor.getCard('card_1')!.x).toBe(150)

      editor.history.undo()
      expect(editor.getCard('card_1')!.x).toBe(100)
    })

    it('redo re-applies after undo', () => {
      const editor = createEditor()
      editor.moveCards(['card_1'], 50, 50, { history: 'record', label: 'move' })
      editor.history.undo()
      editor.history.redo()
      expect(editor.getCard('card_1')!.x).toBe(150)
    })
  })

  describe('camera', () => {
    it('panBy shifts camera position', () => {
      const editor = createEditor()
      editor.panBy(10, 20)
      expect(editor.getRuntime().camera.x).toBe(10)
      expect(editor.getRuntime().camera.y).toBe(20)
    })

    it('zoomTo changes scale', () => {
      const editor = createEditor()
      editor.zoomTo(2)
      expect(editor.getRuntime().camera.scale).toBe(2)
    })

    it('zoomTo clamps to max', () => {
      const editor = createEditor()
      editor.zoomTo(100)
      expect(editor.getRuntime().camera.scale).toBe(4)
    })

    it('getZoomPercent reflects scale', () => {
      const editor = createEditor()
      editor.zoomTo(1.5)
      expect(editor.getZoomPercent()).toBe(150)
    })
  })

  describe('context menu', () => {
    it('openContextMenu sets state', () => {
      const editor = createEditor()
      editor.openContextMenu('card_1', { x: 200, y: 300 })
      const cm = editor.getRuntime().ui.contextMenu
      expect(cm.open).toBe(true)
      expect(cm.targetCardId).toBe('card_1')
      expect(cm.screenX).toBe(200)
    })

    it('closeContextMenu clears state', () => {
      const editor = createEditor()
      editor.openContextMenu('card_1', { x: 0, y: 0 })
      editor.closeContextMenu()
      expect(editor.getRuntime().ui.contextMenu.open).toBe(false)
    })
  })

  describe('layout', () => {
    it('alignSelected aligns left edges', () => {
      const editor = createEditor([makeCard({ id: 'a', x: 100 }), makeCard({ id: 'b', x: 200 })])
      editor.selectCards(['a', 'b'])
      editor.alignSelected('left')
      expect(editor.getCard('a')!.x).toBe(100)
      expect(editor.getCard('b')!.x).toBe(100)
    })

    it('nudgeSelected moves selected cards', () => {
      const editor = createEditor()
      editor.selectCard('card_1')
      editor.nudgeSelected(5, 10)
      expect(editor.getCard('card_1')!.x).toBe(105)
      expect(editor.getCard('card_1')!.y).toBe(110)
    })
  })

  describe('intents', () => {
    it('emitIntent dispatches through intent bus', () => {
      const editor = createEditor()
      const listener = vi.fn()
      editor.intents.subscribe(listener)
      editor.emitIntent({ type: 'view-code', cardId: 'card_1' })
      expect(listener).toHaveBeenCalledWith({ type: 'view-code', cardId: 'card_1' })
    })
  })

  describe('getCardsIntersectingRect', () => {
    it('finds cards inside a rect', () => {
      const editor = createEditor([
        makeCard({ id: 'a', x: 50, y: 50, width: 100, height: 100 }),
        makeCard({ id: 'b', x: 500, y: 500, width: 100, height: 100 }),
      ])
      const hits = editor.getCardsIntersectingRect({ x: 0, y: 0, width: 200, height: 200 })
      expect(hits).toEqual(['a'])
    })
  })
})
