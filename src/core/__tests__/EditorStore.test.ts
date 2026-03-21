import { describe, it, expect, vi } from 'vitest'
import { EditorStore } from '../EditorStore'
import type { EditorRecords, RuntimeState } from '../types'

function makeRecords(): EditorRecords {
  return {
    document: { id: 'doc_1', title: 'Test', createdAt: 0, updatedAt: 0, version: 1 },
    cards: {},
    provenance: {},
    revisions: {},
    bindings: {},
  }
}

function makeRuntime(): RuntimeState {
  return {
    camera: {
      x: 0,
      y: 0,
      scale: 1,
      viewportWidth: 800,
      viewportHeight: 600,
      minScale: 0.05,
      maxScale: 4,
    },
    selection: { selectedIds: [] },
    interaction: { tool: 'select', mode: 'idle', spacePanActive: false },
    ui: { contextMenu: { open: false, screenX: 0, screenY: 0 }, dimensionBadgeVisible: false },
    preview: { active: false, cardFrames: {} },
    snap: { enabled: true, mode: 'objects', thresholdPx: 6, guides: [], bypass: false },
  }
}

describe('EditorStore', () => {
  it('stores and retrieves records', () => {
    const store = new EditorStore({ records: makeRecords(), runtime: makeRuntime() })
    expect(store.getRecords().document.title).toBe('Test')
  })

  it('deep clones on construction', () => {
    const records = makeRecords()
    const store = new EditorStore({ records, runtime: makeRuntime() })
    records.document.title = 'Mutated'
    expect(store.getRecords().document.title).toBe('Test')
  })

  it('updateRecords mutates and notifies', () => {
    const store = new EditorStore({ records: makeRecords(), runtime: makeRuntime() })
    const listener = vi.fn()
    store.subscribe(listener)

    store.updateRecords((r) => {
      r.document.title = 'Updated'
    })

    expect(store.getRecords().document.title).toBe('Updated')
    expect(listener).toHaveBeenCalledOnce()
  })

  it('updateRuntime mutates and notifies', () => {
    const store = new EditorStore({ records: makeRecords(), runtime: makeRuntime() })
    const listener = vi.fn()
    store.subscribe(listener)

    store.updateRuntime(
      (rt) => {
        rt.camera.scale = 2
      },
      ['camera'],
    )

    expect(store.getRuntime().camera.scale).toBe(2)
    expect(listener).toHaveBeenCalledOnce()
    expect(listener.mock.calls[0][0].changedRuntimeKeys).toContain('camera')
  })

  it('transact batches notifications', () => {
    const store = new EditorStore({ records: makeRecords(), runtime: makeRuntime() })
    const listener = vi.fn()
    store.subscribe(listener)

    store.transact(() => {
      store.updateRecords((r) => {
        r.document.title = 'A'
      })
      store.updateRecords((r) => {
        r.document.title = 'B'
      })
      store.updateRuntime(
        (rt) => {
          rt.camera.x = 10
        },
        ['camera'],
      )
    })

    expect(listener).toHaveBeenCalledOnce()
    expect(store.getRecords().document.title).toBe('B')
    expect(store.getRuntime().camera.x).toBe(10)
  })

  it('exportSnapshot / importSnapshot round-trips', () => {
    const store = new EditorStore({ records: makeRecords(), runtime: makeRuntime() })
    store.updateRecords((r) => {
      r.document.title = 'Snapshot'
    })

    const snap = store.exportSnapshot()
    store.updateRecords((r) => {
      r.document.title = 'Changed'
    })
    store.importSnapshot(snap)

    expect(store.getRecords().document.title).toBe('Snapshot')
  })

  it('importSnapshot rejects wrong schema version', () => {
    const store = new EditorStore({ records: makeRecords(), runtime: makeRuntime() })
    const snap = store.exportSnapshot()
    snap.schemaVersion = 999

    expect(() => store.importSnapshot(snap)).toThrow('Unsupported snapshot version')
  })

  it('unsubscribe stops notifications', () => {
    const store = new EditorStore({ records: makeRecords(), runtime: makeRuntime() })
    const listener = vi.fn()
    const unsub = store.subscribe(listener)

    store.updateRecords((r) => {
      r.document.title = 'A'
    })
    expect(listener).toHaveBeenCalledOnce()

    unsub()
    store.updateRecords((r) => {
      r.document.title = 'B'
    })
    expect(listener).toHaveBeenCalledOnce()
  })
})
