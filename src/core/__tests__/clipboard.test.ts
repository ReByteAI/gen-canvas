import { describe, it, expect } from 'vitest'
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

function createEditor(cards: CardRecord[] = []) {
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

describe('Clipboard', () => {
  it('hasClipboard returns false initially', () => {
    const editor = createEditor([makeCard({ id: 'a' })])
    expect(editor.hasClipboard()).toBe(false)
  })

  it('copySelected populates clipboard', () => {
    const editor = createEditor([makeCard({ id: 'a' })])
    editor.selectCard('a')
    editor.copySelected()
    expect(editor.hasClipboard()).toBe(true)
  })

  it('pasteClipboard creates new cards with offset', () => {
    const editor = createEditor([makeCard({ id: 'a', x: 100, y: 100 })])
    editor.selectCard('a')
    editor.copySelected()
    const newIds = editor.pasteClipboard()

    expect(newIds).toHaveLength(1)
    const pasted = editor.getCard(newIds[0])!
    expect(pasted.x).toBe(140) // 100 + 40 offset
    expect(pasted.y).toBe(140)
    expect(pasted.id).not.toBe('a')
  })

  it('paste selects the new cards', () => {
    const editor = createEditor([makeCard({ id: 'a' })])
    editor.selectCard('a')
    editor.copySelected()
    const newIds = editor.pasteClipboard()

    expect(editor.getRuntime().selection.selectedIds).toEqual(newIds)
  })

  it('paste with empty clipboard returns empty', () => {
    const editor = createEditor([makeCard({ id: 'a' })])
    expect(editor.pasteClipboard()).toEqual([])
  })

  it('multi-card copy/paste preserves relative positions', () => {
    const editor = createEditor([
      makeCard({ id: 'a', x: 100, y: 100 }),
      makeCard({ id: 'b', x: 300, y: 200 }),
    ])
    editor.selectCards(['a', 'b'])
    editor.copySelected()
    const newIds = editor.pasteClipboard()

    const a2 = editor.getCard(newIds[0])!
    const b2 = editor.getCard(newIds[1])!
    // Relative distance should be preserved: b.x - a.x = 200, b.y - a.y = 100
    expect(b2.x - a2.x).toBe(200)
    expect(b2.y - a2.y).toBe(100)
  })

  it('paste is undoable', () => {
    const editor = createEditor([makeCard({ id: 'a' })])
    editor.selectCard('a')
    editor.copySelected()
    const newIds = editor.pasteClipboard()
    expect(editor.getCard(newIds[0])).toBeDefined()

    editor.history.undo()
    expect(editor.getCard(newIds[0])).toBeUndefined()
  })
})

describe('selectAll', () => {
  it('selects all visible selectable cards', () => {
    const editor = createEditor([
      makeCard({ id: 'a', visible: true }),
      makeCard({ id: 'b', visible: true }),
      makeCard({ id: 'c', visible: false }),
    ])
    editor.selectAll()
    expect(editor.getRuntime().selection.selectedIds).toEqual(['a', 'b'])
  })
})
