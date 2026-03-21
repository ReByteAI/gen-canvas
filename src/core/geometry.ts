import type { CameraState, Point, Rect } from './types'

export function rectFromPoints(a: Point, b: Point): Rect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const width = Math.abs(b.x - a.x)
  const height = Math.abs(b.y - a.y)
  return { x, y, width, height }
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export function screenToWorld(p: Point, camera: CameraState): Point {
  return {
    x: camera.x + p.x / camera.scale,
    y: camera.y + p.y / camera.scale,
  }
}

export function worldToScreen(p: Point, camera: CameraState): Point {
  return {
    x: (p.x - camera.x) * camera.scale,
    y: (p.y - camera.y) * camera.scale,
  }
}

export function worldRectToScreen(rect: Rect, camera: CameraState): Rect {
  const topLeft = worldToScreen({ x: rect.x, y: rect.y }, camera)
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: rect.width * camera.scale,
    height: rect.height * camera.scale,
  }
}

export function rectContainsPoint(rect: Rect, p: Point): boolean {
  return p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height
}

export function rectIntersects(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  )
}

export function rectUnion(rects: Rect[]): Rect {
  if (rects.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  const minX = Math.min(...rects.map((r) => r.x))
  const minY = Math.min(...rects.map((r) => r.y))
  const maxX = Math.max(...rects.map((r) => r.x + r.width))
  const maxY = Math.max(...rects.map((r) => r.y + r.height))

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

export function fitRectToViewport(rect: Rect, camera: CameraState, padding = 64): CameraState {
  const usableWidth = Math.max(1, camera.viewportWidth - padding * 2)
  const usableHeight = Math.max(1, camera.viewportHeight - padding * 2)

  const scaleX = usableWidth / rect.width
  const scaleY = usableHeight / rect.height
  const nextScale = clamp(Math.min(scaleX, scaleY), camera.minScale, camera.maxScale)

  const nextX = rect.x + rect.width / 2 - camera.viewportWidth / (2 * nextScale)
  const nextY = rect.y + rect.height / 2 - camera.viewportHeight / (2 * nextScale)

  return {
    ...camera,
    x: nextX,
    y: nextY,
    scale: nextScale,
  }
}

export function zoomCameraAtPoint(
  camera: CameraState,
  nextScaleRaw: number,
  screenPoint: Point,
): CameraState {
  const nextScale = clamp(nextScaleRaw, camera.minScale, camera.maxScale)
  const worldBefore = screenToWorld(screenPoint, camera)

  return {
    ...camera,
    scale: nextScale,
    x: worldBefore.x - screenPoint.x / nextScale,
    y: worldBefore.y - screenPoint.y / nextScale,
  }
}
