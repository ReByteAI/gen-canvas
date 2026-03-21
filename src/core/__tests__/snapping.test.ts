import { describe, it, expect } from 'vitest'
import {
  snapValue,
  snapRectMoveToObjects,
  snapResizeToObjects,
  combineSnapResults,
  snapNumberToGrid,
} from '../snapping'

describe('snapValue', () => {
  it('snaps when within threshold', () => {
    const result = snapValue(102, [100, 200], 5)
    expect(result.snapped).toBe(100)
    expect(result.delta).toBe(-2)
    expect(result.matched).toBe(100)
  })

  it('does not snap when outside threshold', () => {
    const result = snapValue(110, [100, 200], 5)
    expect(result.delta).toBe(0)
    expect(result.matched).toBeUndefined()
  })

  it('picks closest reference', () => {
    const result = snapValue(151, [100, 150, 200], 5)
    expect(result.matched).toBe(150)
  })
})

describe('snapNumberToGrid', () => {
  it('snaps to nearest grid line', () => {
    expect(snapNumberToGrid(13, 8)).toBe(16)
    expect(snapNumberToGrid(11, 8)).toBe(8)
    expect(snapNumberToGrid(0, 8)).toBe(0)
  })
})

describe('snapRectMoveToObjects', () => {
  it('snaps to a nearby reference rect edge', () => {
    const moving = { x: 102, y: 50, width: 100, height: 80 }
    const reference = [{ x: 0, y: 0, width: 100, height: 100 }]
    // moving left edge (102) near reference right edge (100)
    const result = snapRectMoveToObjects(moving, reference, 5)
    expect(result.dx).toBe(-2) // snap left edge to 100
    expect(result.guides.length).toBeGreaterThan(0)
  })

  it('returns zero delta when no snap candidates', () => {
    const moving = { x: 500, y: 500, width: 100, height: 80 }
    const reference = [{ x: 0, y: 0, width: 100, height: 100 }]
    const result = snapRectMoveToObjects(moving, reference, 5)
    expect(result.dx).toBe(0)
    expect(result.dy).toBe(0)
  })
})

describe('snapResizeToObjects', () => {
  it('snaps the active east edge', () => {
    const rect = { x: 0, y: 0, width: 198, height: 100 }
    const reference = [{ x: 200, y: 0, width: 100, height: 100 }]
    // east edge is at 198, reference left edge at 200
    const result = snapResizeToObjects(rect, 'e', reference, 5)
    expect(result.dx).toBe(2)
  })

  it('does not snap unrelated edges', () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 }
    const reference = [{ x: 200, y: 200, width: 100, height: 100 }]
    const result = snapResizeToObjects(rect, 'e', reference, 5)
    expect(result.dx).toBe(0)
    expect(result.dy).toBe(0)
  })
})

describe('combineSnapResults', () => {
  const obj = { dx: 2, dy: 0, guides: [{ axis: 'x' as const, value: 100, start: 0, end: 200 }] }
  const grid = { dx: 1, dy: 3, guides: [] }

  it('off mode returns zero', () => {
    expect(combineSnapResults('off', obj, grid)).toEqual({ dx: 0, dy: 0, guides: [] })
  })

  it('objects mode returns object result', () => {
    expect(combineSnapResults('objects', obj, grid)).toEqual(obj)
  })

  it('grid mode returns grid result', () => {
    expect(combineSnapResults('grid', obj, grid)).toEqual(grid)
  })

  it('both mode prefers object snap when non-zero', () => {
    const result = combineSnapResults('both', obj, grid)
    expect(result.dx).toBe(2) // from object
    expect(result.dy).toBe(3) // from grid (object was 0)
  })
})
