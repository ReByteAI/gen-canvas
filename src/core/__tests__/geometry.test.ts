import { describe, it, expect } from 'vitest'
import {
  clamp,
  screenToWorld,
  worldToScreen,
  worldRectToScreen,
  rectContainsPoint,
  rectIntersects,
  rectUnion,
  rectFromPoints,
  fitRectToViewport,
  zoomCameraAtPoint,
} from '../geometry'
import type { CameraState } from '../types'

const camera: CameraState = {
  x: 0,
  y: 0,
  scale: 1,
  viewportWidth: 1000,
  viewportHeight: 800,
  minScale: 0.05,
  maxScale: 4,
}

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })
  it('clamps to min', () => {
    expect(clamp(-1, 0, 10)).toBe(0)
  })
  it('clamps to max', () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })
})

describe('screenToWorld / worldToScreen', () => {
  it('identity at scale 1 and offset 0', () => {
    const p = { x: 100, y: 200 }
    expect(screenToWorld(p, camera)).toEqual(p)
    expect(worldToScreen(p, camera)).toEqual(p)
  })

  it('accounts for camera offset', () => {
    const cam = { ...camera, x: 50, y: 100 }
    expect(screenToWorld({ x: 0, y: 0 }, cam)).toEqual({ x: 50, y: 100 })
    expect(worldToScreen({ x: 50, y: 100 }, cam)).toEqual({ x: 0, y: 0 })
  })

  it('accounts for zoom', () => {
    const cam = { ...camera, scale: 2 }
    expect(screenToWorld({ x: 200, y: 100 }, cam)).toEqual({ x: 100, y: 50 })
    expect(worldToScreen({ x: 100, y: 50 }, cam)).toEqual({ x: 200, y: 100 })
  })

  it('round-trips correctly', () => {
    const cam = { ...camera, x: 30, y: -20, scale: 1.5 }
    const p = { x: 400, y: 300 }
    const world = screenToWorld(p, cam)
    const screen = worldToScreen(world, cam)
    expect(screen.x).toBeCloseTo(p.x)
    expect(screen.y).toBeCloseTo(p.y)
  })
})

describe('worldRectToScreen', () => {
  it('transforms rect at scale 2', () => {
    const cam = { ...camera, scale: 2 }
    const result = worldRectToScreen({ x: 10, y: 20, width: 100, height: 50 }, cam)
    expect(result).toEqual({ x: 20, y: 40, width: 200, height: 100 })
  })
})

describe('rectContainsPoint', () => {
  const rect = { x: 10, y: 10, width: 100, height: 50 }

  it('returns true for point inside', () => {
    expect(rectContainsPoint(rect, { x: 50, y: 30 })).toBe(true)
  })
  it('returns true for point on edge', () => {
    expect(rectContainsPoint(rect, { x: 10, y: 10 })).toBe(true)
  })
  it('returns false for point outside', () => {
    expect(rectContainsPoint(rect, { x: 5, y: 5 })).toBe(false)
  })
})

describe('rectIntersects', () => {
  it('detects overlap', () => {
    const a = { x: 0, y: 0, width: 100, height: 100 }
    const b = { x: 50, y: 50, width: 100, height: 100 }
    expect(rectIntersects(a, b)).toBe(true)
  })
  it('detects no overlap', () => {
    const a = { x: 0, y: 0, width: 50, height: 50 }
    const b = { x: 100, y: 100, width: 50, height: 50 }
    expect(rectIntersects(a, b)).toBe(false)
  })
  it('detects edge-touching as overlap', () => {
    const a = { x: 0, y: 0, width: 50, height: 50 }
    const b = { x: 50, y: 0, width: 50, height: 50 }
    expect(rectIntersects(a, b)).toBe(true)
  })
})

describe('rectUnion', () => {
  it('returns zero rect for empty array', () => {
    expect(rectUnion([])).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })
  it('computes union of two rects', () => {
    const rects = [
      { x: 10, y: 20, width: 100, height: 50 },
      { x: 50, y: 10, width: 200, height: 100 },
    ]
    expect(rectUnion(rects)).toEqual({ x: 10, y: 10, width: 240, height: 100 })
  })
})

describe('rectFromPoints', () => {
  it('normalizes when b > a', () => {
    expect(rectFromPoints({ x: 10, y: 20 }, { x: 110, y: 70 })).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    })
  })
  it('normalizes when a > b', () => {
    expect(rectFromPoints({ x: 110, y: 70 }, { x: 10, y: 20 })).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    })
  })
})

describe('fitRectToViewport', () => {
  it('centers and scales a rect', () => {
    const rect = { x: 100, y: 100, width: 400, height: 200 }
    const result = fitRectToViewport(rect, camera, 64)
    // Scale should fit 400x200 into (1000-128)x(800-128) = 872x672
    // scaleX = 872/400 = 2.18, scaleY = 672/200 = 3.36 → min = 2.18
    expect(result.scale).toBeCloseTo(2.18, 1)
  })

  it('does not exceed maxScale', () => {
    const rect = { x: 0, y: 0, width: 10, height: 10 }
    const result = fitRectToViewport(rect, camera, 64)
    expect(result.scale).toBeLessThanOrEqual(camera.maxScale)
  })
})

describe('zoomCameraAtPoint', () => {
  it('keeps the pointed-at world position stable', () => {
    const screenPoint = { x: 500, y: 400 }
    const worldBefore = screenToWorld(screenPoint, camera)
    const newCam = zoomCameraAtPoint(camera, 2, screenPoint)
    const worldAfter = screenToWorld(screenPoint, newCam)
    expect(worldAfter.x).toBeCloseTo(worldBefore.x)
    expect(worldAfter.y).toBeCloseTo(worldBefore.y)
  })

  it('clamps to minScale', () => {
    const result = zoomCameraAtPoint(camera, 0.001, { x: 0, y: 0 })
    expect(result.scale).toBe(camera.minScale)
  })

  it('clamps to maxScale', () => {
    const result = zoomCameraAtPoint(camera, 100, { x: 0, y: 0 })
    expect(result.scale).toBe(camera.maxScale)
  })
})
