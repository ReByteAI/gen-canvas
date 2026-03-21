import type { HistoryEntry } from './types'

export class HistoryManager {
  private undoStack: HistoryEntry[] = []
  private redoStack: HistoryEntry[] = []

  push(entry: HistoryEntry): void {
    this.undoStack.push(entry)
    this.redoStack = []
  }

  undo(): void {
    const entry = this.undoStack.pop()
    if (!entry) return
    entry.undo()
    this.redoStack.push(entry)
  }

  redo(): void {
    const entry = this.redoStack.pop()
    if (!entry) return
    entry.redo()
    this.undoStack.push(entry)
  }

  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }
}
