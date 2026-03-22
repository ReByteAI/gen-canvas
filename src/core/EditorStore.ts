import type {
  EditorRecords,
  RuntimeState,
  StoreChange,
  StoreListener,
  StoreSnapshot,
} from './types'

const SCHEMA_VERSION = 1

function deepClone<T>(value: T): T {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value))
}

export class EditorStore {
  private records: EditorRecords
  private runtime: RuntimeState
  private listeners = new Set<StoreListener>()

  private txDepth = 0
  private pendingChange: StoreChange = {
    changedRecordIds: [],
    changedRuntimeKeys: [],
  }

  constructor(args: { records: EditorRecords; runtime: RuntimeState }) {
    this.records = deepClone(args.records)
    this.runtime = deepClone(args.runtime)
  }

  getRecords(): EditorRecords {
    return this.records
  }

  getRuntime(): RuntimeState {
    return this.runtime
  }

  getCard(id: string) {
    return this.records.cards[id]
  }

  updateRecords(mutator: (draft: EditorRecords) => void): void {
    mutator(this.records)
    this.markRecordsChanged(['__all__'])
  }

  updateRuntime(mutator: (draft: RuntimeState) => void, changedKeys: string[] = ['__all__']): void {
    mutator(this.runtime)
    // Create new top-level reference so useSyncExternalStore detects the change
    this.runtime = { ...this.runtime }
    this.markRuntimeChanged(changedKeys)
  }

  transact<T>(fn: () => T): T {
    this.txDepth += 1
    try {
      return fn()
    } finally {
      this.txDepth -= 1
      if (this.txDepth === 0) {
        this.flush()
      }
    }
  }

  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  exportSnapshot(): StoreSnapshot {
    return {
      schemaVersion: SCHEMA_VERSION,
      records: deepClone(this.records),
    }
  }

  importSnapshot(snapshot: StoreSnapshot): void {
    if (snapshot.schemaVersion !== SCHEMA_VERSION) {
      throw new Error(
        `Unsupported snapshot version ${snapshot.schemaVersion}; expected ${SCHEMA_VERSION}`,
      )
    }

    this.records = deepClone(snapshot.records)
    this.markRecordsChanged(['__all__'])
    this.flush()
  }

  private markRecordsChanged(ids: string[]) {
    this.pendingChange.changedRecordIds.push(...ids)
    if (this.txDepth === 0) this.flush()
  }

  private markRuntimeChanged(keys: string[]) {
    this.pendingChange.changedRuntimeKeys.push(...keys)
    if (this.txDepth === 0) this.flush()
  }

  private flush() {
    const hasChanges =
      this.pendingChange.changedRecordIds.length > 0 ||
      this.pendingChange.changedRuntimeKeys.length > 0

    if (!hasChanges) return

    const change: StoreChange = {
      changedRecordIds: Array.from(new Set(this.pendingChange.changedRecordIds)),
      changedRuntimeKeys: Array.from(new Set(this.pendingChange.changedRuntimeKeys)),
    }

    this.pendingChange = {
      changedRecordIds: [],
      changedRuntimeKeys: [],
    }

    for (const listener of this.listeners) {
      listener(change)
    }
  }
}
