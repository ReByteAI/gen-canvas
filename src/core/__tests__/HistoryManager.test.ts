import { describe, it, expect, vi } from 'vitest'
import { HistoryManager } from '../HistoryManager'

function entry(label: string) {
  const undo = vi.fn()
  const redo = vi.fn()
  return { entry: { label, undo, redo, timestamp: Date.now() }, undo, redo }
}

describe('HistoryManager', () => {
  it('starts empty', () => {
    const h = new HistoryManager()
    expect(h.canUndo()).toBe(false)
    expect(h.canRedo()).toBe(false)
  })

  it('undo calls the entry undo function', () => {
    const h = new HistoryManager()
    const e = entry('move')
    h.push(e.entry)
    h.undo()
    expect(e.undo).toHaveBeenCalledOnce()
    expect(h.canUndo()).toBe(false)
    expect(h.canRedo()).toBe(true)
  })

  it('redo calls the entry redo function', () => {
    const h = new HistoryManager()
    const e = entry('move')
    h.push(e.entry)
    h.undo()
    h.redo()
    expect(e.redo).toHaveBeenCalledOnce()
    expect(h.canUndo()).toBe(true)
    expect(h.canRedo()).toBe(false)
  })

  it('new push clears redo stack', () => {
    const h = new HistoryManager()
    h.push(entry('a').entry)
    h.undo()
    expect(h.canRedo()).toBe(true)
    h.push(entry('b').entry)
    expect(h.canRedo()).toBe(false)
  })

  it('clear empties both stacks', () => {
    const h = new HistoryManager()
    h.push(entry('a').entry)
    h.push(entry('b').entry)
    h.undo()
    h.clear()
    expect(h.canUndo()).toBe(false)
    expect(h.canRedo()).toBe(false)
  })
})
