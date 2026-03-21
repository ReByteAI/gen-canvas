import type { GuideLine, Point, Rect, ResizeHandle, SnapMode } from './types'

interface SnapLine {
  axis: 'x' | 'y'
  value: number
  start: number
  end: number
}

interface RectLines {
  x: SnapLine[]
  y: SnapLine[]
}

function makeVerticalLine(x: number, top: number, bottom: number): SnapLine {
  return { axis: 'x', value: x, start: top, end: bottom }
}

function makeHorizontalLine(y: number, left: number, right: number): SnapLine {
  return { axis: 'y', value: y, start: left, end: right }
}

export function getRectSnapLines(rect: Rect): RectLines {
  const left = rect.x
  const centerX = rect.x + rect.width / 2
  const right = rect.x + rect.width

  const top = rect.y
  const centerY = rect.y + rect.height / 2
  const bottom = rect.y + rect.height

  return {
    x: [
      makeVerticalLine(left, top, bottom),
      makeVerticalLine(centerX, top, bottom),
      makeVerticalLine(right, top, bottom),
    ],
    y: [
      makeHorizontalLine(top, left, right),
      makeHorizontalLine(centerY, left, right),
      makeHorizontalLine(bottom, left, right),
    ],
  }
}

export function expandGuide(lineA: SnapLine, lineB: SnapLine): GuideLine {
  if (lineA.axis === 'x') {
    return {
      axis: 'x',
      value: lineA.value,
      start: Math.min(lineA.start, lineB.start),
      end: Math.max(lineA.end, lineB.end),
    }
  }

  return {
    axis: 'y',
    value: lineA.value,
    start: Math.min(lineA.start, lineB.start),
    end: Math.max(lineA.end, lineB.end),
  }
}

export function snapValue(
  candidate: number,
  references: number[],
  thresholdWorld: number,
): { snapped: number; delta: number; matched?: number } {
  let bestDelta = 0
  let bestMatch: number | undefined = undefined
  let bestDist = Infinity

  for (const ref of references) {
    const dist = Math.abs(ref - candidate)
    if (dist <= thresholdWorld && dist < bestDist) {
      bestDist = dist
      bestDelta = ref - candidate
      bestMatch = ref
    }
  }

  return {
    snapped: candidate + bestDelta,
    delta: bestDelta,
    matched: bestMatch,
  }
}

export function snapNumberToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize
}

export function snapPointToGrid(point: Point, gridSize: number): Point {
  return {
    x: snapNumberToGrid(point.x, gridSize),
    y: snapNumberToGrid(point.y, gridSize),
  }
}

export function snapRectMoveToObjects(
  rect: Rect,
  referenceRects: Rect[],
  thresholdWorld: number,
): { dx: number; dy: number; guides: GuideLine[] } {
  const candidateLines = getRectSnapLines(rect)

  const refLinesX: SnapLine[] = []
  const refLinesY: SnapLine[] = []

  for (const refRect of referenceRects) {
    const lines = getRectSnapLines(refRect)
    refLinesX.push(...lines.x)
    refLinesY.push(...lines.y)
  }

  const xReferences = refLinesX.map((l) => l.value)
  const yReferences = refLinesY.map((l) => l.value)

  let bestX: { delta: number; candidateLine: SnapLine; referenceLine: SnapLine } | undefined
  let bestY: { delta: number; candidateLine: SnapLine; referenceLine: SnapLine } | undefined

  for (const candidateLine of candidateLines.x) {
    const result = snapValue(candidateLine.value, xReferences, thresholdWorld)
    if (result.matched == null) continue
    const refLine = refLinesX.find((l) => l.value === result.matched)
    if (!refLine) continue

    if (!bestX || Math.abs(result.delta) < Math.abs(bestX.delta)) {
      bestX = { delta: result.delta, candidateLine, referenceLine: refLine }
    }
  }

  for (const candidateLine of candidateLines.y) {
    const result = snapValue(candidateLine.value, yReferences, thresholdWorld)
    if (result.matched == null) continue
    const refLine = refLinesY.find((l) => l.value === result.matched)
    if (!refLine) continue

    if (!bestY || Math.abs(result.delta) < Math.abs(bestY.delta)) {
      bestY = { delta: result.delta, candidateLine, referenceLine: refLine }
    }
  }

  const guides: GuideLine[] = []
  if (bestX) guides.push(expandGuide(bestX.candidateLine, bestX.referenceLine))
  if (bestY) guides.push(expandGuide(bestY.candidateLine, bestY.referenceLine))

  return {
    dx: bestX?.delta ?? 0,
    dy: bestY?.delta ?? 0,
    guides,
  }
}

export function snapRectMoveToGrid(
  rect: Rect,
  gridSize: number,
): { dx: number; dy: number; guides: GuideLine[] } {
  const snappedX = snapNumberToGrid(rect.x, gridSize)
  const snappedY = snapNumberToGrid(rect.y, gridSize)

  return {
    dx: snappedX - rect.x,
    dy: snappedY - rect.y,
    guides: [],
  }
}

function resizeActiveXValue(rect: Rect, handle: ResizeHandle): number | null {
  if (handle.includes('w')) return rect.x
  if (handle.includes('e')) return rect.x + rect.width
  return null
}

function resizeActiveYValue(rect: Rect, handle: ResizeHandle): number | null {
  if (handle.includes('n')) return rect.y
  if (handle.includes('s')) return rect.y + rect.height
  return null
}

function resizeXGuideCandidate(rect: Rect, handle: ResizeHandle): SnapLine | null {
  const value = resizeActiveXValue(rect, handle)
  if (value == null) return null
  return makeVerticalLine(value, rect.y, rect.y + rect.height)
}

function resizeYGuideCandidate(rect: Rect, handle: ResizeHandle): SnapLine | null {
  const value = resizeActiveYValue(rect, handle)
  if (value == null) return null
  return makeHorizontalLine(value, rect.x, rect.x + rect.width)
}

export function snapResizeToObjects(
  rect: Rect,
  handle: ResizeHandle,
  referenceRects: Rect[],
  thresholdWorld: number,
): { dx: number; dy: number; guides: GuideLine[] } {
  const refLinesX: SnapLine[] = []
  const refLinesY: SnapLine[] = []

  for (const refRect of referenceRects) {
    const lines = getRectSnapLines(refRect)
    refLinesX.push(...lines.x)
    refLinesY.push(...lines.y)
  }

  const guides: GuideLine[] = []
  let dx = 0
  let dy = 0

  const xCandidate = resizeXGuideCandidate(rect, handle)
  if (xCandidate) {
    const result = snapValue(
      xCandidate.value,
      refLinesX.map((l) => l.value),
      thresholdWorld,
    )
    if (result.matched != null) {
      const refLine = refLinesX.find((l) => l.value === result.matched)
      if (refLine) {
        guides.push(expandGuide(xCandidate, refLine))
        dx = result.delta
      }
    }
  }

  const yCandidate = resizeYGuideCandidate(rect, handle)
  if (yCandidate) {
    const result = snapValue(
      yCandidate.value,
      refLinesY.map((l) => l.value),
      thresholdWorld,
    )
    if (result.matched != null) {
      const refLine = refLinesY.find((l) => l.value === result.matched)
      if (refLine) {
        guides.push(expandGuide(yCandidate, refLine))
        dy = result.delta
      }
    }
  }

  return { dx, dy, guides }
}

export function snapResizeToGrid(
  rect: Rect,
  handle: ResizeHandle,
  gridSize: number,
): { dx: number; dy: number; guides: GuideLine[] } {
  let dx = 0
  let dy = 0

  const activeX = resizeActiveXValue(rect, handle)
  const activeY = resizeActiveYValue(rect, handle)

  if (activeX != null) dx = snapNumberToGrid(activeX, gridSize) - activeX
  if (activeY != null) dy = snapNumberToGrid(activeY, gridSize) - activeY

  return { dx, dy, guides: [] }
}

export function combineSnapResults(
  mode: SnapMode,
  objectResult: { dx: number; dy: number; guides: GuideLine[] } | null,
  gridResult: { dx: number; dy: number; guides: GuideLine[] } | null,
): { dx: number; dy: number; guides: GuideLine[] } {
  if (mode === 'off') return { dx: 0, dy: 0, guides: [] }
  if (mode === 'objects') return objectResult ?? { dx: 0, dy: 0, guides: [] }
  if (mode === 'grid') return gridResult ?? { dx: 0, dy: 0, guides: [] }

  // mode === 'both': objects take priority
  const dx = objectResult && objectResult.dx !== 0 ? objectResult.dx : (gridResult?.dx ?? 0)
  const dy = objectResult && objectResult.dy !== 0 ? objectResult.dy : (gridResult?.dy ?? 0)
  const guides = objectResult?.guides ?? []
  return { dx, dy, guides }
}
