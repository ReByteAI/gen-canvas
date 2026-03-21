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

describe('Grouping', () => {
  it('groupSelected creates a group card with bindings', () => {
    const editor = createEditor([
      makeCard({ id: 'a', x: 100, y: 100 }),
      makeCard({ id: 'b', x: 300, y: 200 }),
    ])
    editor.selectCards(['a', 'b'])
    const groupId = editor.groupSelected()

    expect(groupId).toBeTruthy()
    const group = editor.getCard(groupId!)!
    expect(group.type).toBe('group')

    const children = editor.getGroupChildren(groupId!)
    expect(children.sort()).toEqual(['a', 'b'].sort())
  })

  it('groupSelected requires at least 2 cards', () => {
    const editor = createEditor([makeCard({ id: 'a' })])
    editor.selectCard('a')
    expect(editor.groupSelected()).toBeNull()
  })

  it('groupSelected selects the new group', () => {
    const editor = createEditor([makeCard({ id: 'a' }), makeCard({ id: 'b' })])
    editor.selectCards(['a', 'b'])
    const groupId = editor.groupSelected()

    expect(editor.getRuntime().selection.selectedIds).toEqual([groupId])
  })

  it('ungroupSelected removes group and bindings, selects children', () => {
    const editor = createEditor([makeCard({ id: 'a' }), makeCard({ id: 'b' })])
    editor.selectCards(['a', 'b'])
    const groupId = editor.groupSelected()!

    editor.selectCards([groupId])
    editor.ungroupSelected()

    expect(editor.getCard(groupId)).toBeUndefined()
    expect(editor.getCard('a')).toBeDefined()
    expect(editor.getCard('b')).toBeDefined()
    expect(editor.getGroupChildren(groupId)).toEqual([])

    const selected = editor.getRuntime().selection.selectedIds.sort()
    expect(selected).toEqual(['a', 'b'].sort())
  })

  it('moving a group moves its children', () => {
    const editor = createEditor([
      makeCard({ id: 'a', x: 100, y: 100 }),
      makeCard({ id: 'b', x: 200, y: 200 }),
    ])
    editor.selectCards(['a', 'b'])
    const groupId = editor.groupSelected()!

    editor.moveCards([groupId], 50, 50, { history: 'ignore' })

    expect(editor.getCard('a')!.x).toBe(150)
    expect(editor.getCard('a')!.y).toBe(150)
    expect(editor.getCard('b')!.x).toBe(250)
    expect(editor.getCard('b')!.y).toBe(250)
  })

  it('deleting a group deletes its children', () => {
    const editor = createEditor([makeCard({ id: 'a' }), makeCard({ id: 'b' })])
    editor.selectCards(['a', 'b'])
    const groupId = editor.groupSelected()!

    editor.deleteCards([groupId])

    expect(editor.getCard(groupId)).toBeUndefined()
    expect(editor.getCard('a')).toBeUndefined()
    expect(editor.getCard('b')).toBeUndefined()
  })

  it('group/ungroup is undoable', () => {
    const editor = createEditor([makeCard({ id: 'a' }), makeCard({ id: 'b' })])
    editor.selectCards(['a', 'b'])
    const groupId = editor.groupSelected()!

    expect(editor.getCard(groupId)).toBeDefined()
    editor.history.undo()
    expect(editor.getCard(groupId)).toBeUndefined()
    expect(editor.getCard('a')).toBeDefined()
  })
})
