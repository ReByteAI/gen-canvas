import { fitRectToViewport, rectIntersects, zoomCameraAtPoint } from './geometry'
import { HistoryManager } from './HistoryManager'
import { PluginRegistry } from './PluginRegistry'
import { EditorStore } from './EditorStore'
import { cardToRect } from './cardFrames'
import {
  combineSnapResults,
  snapRectMoveToGrid,
  snapRectMoveToObjects,
  snapResizeToGrid,
  snapResizeToObjects,
} from './snapping'
import { IntentBus } from './IntentBus'
import { PassThroughContentProvider } from './ContentProvider'
import type {
  BindingRecord,
  CardRecord,
  ClipboardPayload,
  ContentProvider,
  EditorAPI,
  EditorIntent,
  Point,
  Rect,
  RecordId,
  ResizeHandle,
  RuntimeState,
  SelectedChatContext,
  SerializedEditorDocument,
  SnapMode,
  TransactionOptions,
} from './types'

function now(): number {
  return Date.now()
}

function makeId(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export class EditorCore implements EditorAPI {
  readonly store: EditorStore
  readonly plugins: PluginRegistry
  readonly history: HistoryManager
  readonly intents: IntentBus
  readonly content: ContentProvider

  private pendingGesture:
    | {
        label: string
        before: ReturnType<EditorStore['exportSnapshot']>
      }
    | undefined

  private clipboard: ClipboardPayload | undefined

  constructor(args: {
    store: EditorStore
    plugins?: PluginRegistry
    history?: HistoryManager
    intents?: IntentBus
    content?: ContentProvider
  }) {
    this.store = args.store
    this.plugins = args.plugins ?? new PluginRegistry()
    this.history = args.history ?? new HistoryManager()
    this.intents = args.intents ?? new IntentBus()
    this.content = args.content ?? new PassThroughContentProvider()
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  getRuntime(): RuntimeState {
    return this.store.getRuntime()
  }

  getCard(id: RecordId): CardRecord | undefined {
    return this.store.getCard(id)
  }

  getCardFrame(id: RecordId): Rect | undefined {
    const runtime = this.store.getRuntime()
    const preview = runtime.preview.cardFrames[id]
    if (preview) return preview

    const card = this.getCard(id)
    if (!card) return undefined
    return cardToRect(card)
  }

  getCards(ids?: RecordId[]): CardRecord[] {
    const all = Object.values(this.store.getRecords().cards)
    if (!ids) return all.sort((a, b) => a.zIndex - b.zIndex)
    return ids.map((id) => this.getCard(id)).filter((card): card is CardRecord => Boolean(card))
  }

  getSelectedCards(): CardRecord[] {
    const { selectedIds } = this.store.getRuntime().selection
    return this.getCards(selectedIds)
  }

  getFocusedCard(): CardRecord | undefined {
    const { focusedId } = this.store.getRuntime().selection
    return focusedId ? this.getCard(focusedId) : undefined
  }

  getVisibleCards(): CardRecord[] {
    return this.getCards().filter((card) => card.visible)
  }

  getZoomPercent(): number {
    return Math.round(this.store.getRuntime().camera.scale * 100)
  }

  getCardsIntersectingRect(rect: Rect): RecordId[] {
    return this.getVisibleCards()
      .filter((card) => {
        const frame = this.getCardFrame(card.id)
        if (!frame) return false
        return rectIntersects(frame, rect)
      })
      .map((card) => card.id)
  }

  getSelectionBounds(): Rect | undefined {
    const frames = this.getSelectedCards()
      .map((card) => this.getCardFrame(card.id))
      .filter(Boolean) as Rect[]

    if (frames.length === 0) return undefined

    const minX = Math.min(...frames.map((r) => r.x))
    const minY = Math.min(...frames.map((r) => r.y))
    const maxX = Math.max(...frames.map((r) => r.x + r.width))
    const maxY = Math.max(...frames.map((r) => r.y + r.height))

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }

  // ---------------------------------------------------------------------------
  // Transactions
  // ---------------------------------------------------------------------------

  run<T>(fn: () => T, opts: TransactionOptions = { history: 'ignore' }): T {
    const shouldRecord = opts.history === 'record'
    const before = shouldRecord ? this.store.exportSnapshot() : undefined

    const result = this.store.transact(fn)

    if (shouldRecord && before) {
      const after = this.store.exportSnapshot()
      this.history.push({
        label: opts.label ?? 'Edit',
        timestamp: now(),
        undo: () => this.store.importSnapshot(before),
        redo: () => this.store.importSnapshot(after),
      })
    }

    return result
  }

  // ---------------------------------------------------------------------------
  // Gesture lifecycle
  // ---------------------------------------------------------------------------

  beginGesture(label: string): void {
    if (this.pendingGesture) return
    this.pendingGesture = {
      label,
      before: this.store.exportSnapshot(),
    }
  }

  commitGesture(): void {
    if (!this.pendingGesture) return

    const { label, before } = this.pendingGesture
    const previewFrames = this.store.getRuntime().preview.cardFrames
    const previewIds = Object.keys(previewFrames)

    if (previewIds.length > 0) {
      this.store.transact(() => {
        this.store.updateRecords((records) => {
          for (const id of previewIds) {
            const frame = previewFrames[id]
            const card = records.cards[id]
            if (!card || !frame) continue
            card.x = frame.x
            card.y = frame.y
            card.width = frame.width
            card.height = frame.height
            card.updatedAt = now()
          }
          records.document.updatedAt = now()
        })

        this.store.updateRuntime(
          (runtime) => {
            runtime.preview.active = false
            runtime.preview.kind = undefined
            runtime.preview.cardFrames = {}
          },
          ['preview'],
        )
      })
    } else {
      this.store.updateRuntime(
        (runtime) => {
          runtime.preview.active = false
          runtime.preview.kind = undefined
          runtime.preview.cardFrames = {}
        },
        ['preview'],
      )
    }

    const after = this.store.exportSnapshot()
    this.history.push({
      label,
      timestamp: now(),
      undo: () => this.store.importSnapshot(before),
      redo: () => this.store.importSnapshot(after),
    })

    this.pendingGesture = undefined
  }

  cancelGesture(): void {
    if (!this.pendingGesture) return

    this.store.updateRuntime(
      (runtime) => {
        runtime.preview.active = false
        runtime.preview.kind = undefined
        runtime.preview.cardFrames = {}
      },
      ['preview'],
    )

    this.pendingGesture = undefined
  }

  // ---------------------------------------------------------------------------
  // Preview system
  // ---------------------------------------------------------------------------

  startMovePreview(ids: RecordId[]): void {
    if (this.pendingGesture) return
    this.beginGesture('Move cards')

    const frames = Object.fromEntries(
      ids
        .map((id) => {
          const card = this.getCard(id)
          return card ? ([id, cardToRect(card)] as const) : null
        })
        .filter(Boolean) as [RecordId, Rect][],
    )

    this.store.updateRuntime(
      (runtime) => {
        runtime.preview.active = true
        runtime.preview.kind = 'move'
        runtime.preview.cardFrames = frames
      },
      ['preview'],
    )
  }

  previewMove(ids: RecordId[], dx: number, dy: number): void {
    this.store.updateRuntime(
      (runtime) => {
        for (const id of ids) {
          const frame = runtime.preview.cardFrames[id]
          if (!frame) continue
          frame.x += dx
          frame.y += dy
        }
      },
      ['preview'],
    )
  }

  startResizePreview(id: RecordId): void {
    if (this.pendingGesture) return
    this.beginGesture('Resize card')

    const card = this.getCard(id)
    if (!card) return

    this.store.updateRuntime(
      (runtime) => {
        runtime.preview.active = true
        runtime.preview.kind = 'resize'
        runtime.preview.cardFrames = { [id]: cardToRect(card) }
      },
      ['preview'],
    )
  }

  previewResize(id: RecordId, handle: ResizeHandle, delta: Point): void {
    const card = this.getCard(id)
    if (!card) return

    const plugin = this.plugins.get(card.type)
    const previewFrame = this.getCardFrame(id)
    if (!previewFrame) return

    const syntheticCard: CardRecord = { ...card, ...previewFrame }
    const resized = plugin.applyResize(syntheticCard, handle, delta)

    this.store.updateRuntime(
      (runtime) => {
        runtime.preview.cardFrames[id] = cardToRect(resized)
      },
      ['preview'],
    )
  }

  // ---------------------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------------------

  selectCard(id: RecordId, additive = false): void {
    const card = this.getCard(id)
    if (!card || !card.capabilities.selectable) return

    // Bring selected card to front
    const maxZ = Math.max(0, ...Object.values(this.store.getRecords().cards).map((c) => c.zIndex))
    if (card.zIndex < maxZ) {
      this.store.updateRecords((records) => {
        const c = records.cards[id]
        if (c) c.zIndex = maxZ + 1
      })
    }

    this.store.updateRuntime(
      (runtime) => {
        runtime.selection.selectedIds = additive
          ? Array.from(new Set([...runtime.selection.selectedIds, id]))
          : [id]
        runtime.selection.hoveredId = id
      },
      ['selection'],
    )
  }

  selectCards(ids: RecordId[]): void {
    this.store.updateRuntime(
      (runtime) => {
        runtime.selection.selectedIds = ids
        runtime.selection.hoveredId = ids[0]
      },
      ['selection'],
    )
  }

  clearSelection(): void {
    this.store.updateRuntime(
      (runtime) => {
        runtime.selection.selectedIds = []
        runtime.selection.focusedId = undefined
        runtime.selection.hoveredId = undefined
        runtime.ui.dimensionBadgeVisible = false
      },
      ['selection', 'ui'],
    )
  }

  hoverCard(id?: RecordId): void {
    this.store.updateRuntime(
      (runtime) => {
        runtime.selection.hoveredId = id
      },
      ['selection'],
    )
  }

  focusCard(id: RecordId): void {
    const card = this.getCard(id)
    if (!card) return
    const plugin = this.plugins.get(card.type)
    if (!plugin.canFocus(card)) return

    this.selectCard(id)
    this.store.updateRuntime(
      (runtime) => {
        runtime.selection.focusedId = id
        runtime.ui.dimensionBadgeVisible = true
      },
      ['selection', 'ui'],
    )

    plugin.onFocus?.(card, this)
    this.fitCardToViewport(id, 72)
  }

  exitFocus(): void {
    this.store.updateRuntime(
      (runtime) => {
        runtime.selection.focusedId = undefined
        runtime.ui.dimensionBadgeVisible = false
      },
      ['selection', 'ui'],
    )
  }

  // ---------------------------------------------------------------------------
  // Camera
  // ---------------------------------------------------------------------------

  panBy(dx: number, dy: number): void {
    this.store.updateRuntime(
      (runtime) => {
        runtime.camera.x += dx
        runtime.camera.y += dy
      },
      ['camera'],
    )
  }

  zoomTo(scale: number, screenPoint?: Point): void {
    this.store.updateRuntime(
      (runtime) => {
        runtime.camera = screenPoint
          ? zoomCameraAtPoint(runtime.camera, scale, screenPoint)
          : {
              ...runtime.camera,
              scale: Math.max(runtime.camera.minScale, Math.min(runtime.camera.maxScale, scale)),
            }
      },
      ['camera'],
    )
  }

  zoomBy(factor: number, screenPoint?: Point): void {
    const runtime = this.store.getRuntime()
    this.zoomTo(runtime.camera.scale * factor, screenPoint)
  }

  fitCardToViewport(id: RecordId, padding = 64): void {
    const frame = this.getCardFrame(id)
    if (!frame) return

    this.store.updateRuntime(
      (runtime) => {
        runtime.camera = fitRectToViewport(frame, runtime.camera, padding)
      },
      ['camera'],
    )
  }

  setViewportSize(width: number, height: number): void {
    this.store.updateRuntime(
      (runtime) => {
        runtime.camera.viewportWidth = width
        runtime.camera.viewportHeight = height
      },
      ['camera'],
    )
  }

  // ---------------------------------------------------------------------------
  // Tools
  // ---------------------------------------------------------------------------

  setTool(tool: 'select' | 'hand'): void {
    this.store.updateRuntime(
      (runtime) => {
        runtime.interaction.tool = tool
        runtime.interaction.mode = 'idle'
      },
      ['interaction'],
    )
  }

  getTool(): 'select' | 'hand' {
    return this.store.getRuntime().interaction.tool
  }

  // ---------------------------------------------------------------------------
  // Card CRUD
  // ---------------------------------------------------------------------------

  createCards(
    cards: CardRecord[],
    opts: TransactionOptions = { history: 'record', label: 'Create cards' },
  ): void {
    this.run(() => {
      this.store.updateRecords((records) => {
        for (const card of cards) {
          records.cards[card.id] = card
        }
        records.document.updatedAt = now()
      })
    }, opts)
  }

  updateCards(
    updates: Partial<CardRecord & { id: RecordId }>[],
    opts: TransactionOptions = { history: 'record', label: 'Update cards' },
  ): void {
    this.run(() => {
      this.store.updateRecords((records) => {
        for (const update of updates) {
          const existing = records.cards[update.id!]
          if (!existing) continue
          records.cards[update.id!] = { ...existing, ...update, updatedAt: now() }
        }
        records.document.updatedAt = now()
      })
    }, opts)
  }

  deleteCards(
    ids: RecordId[],
    opts: TransactionOptions = { history: 'record', label: 'Delete cards' },
  ): void {
    this.run(() => {
      this.store.updateRecords((records) => {
        // Collect group children and bindings to cascade delete
        const allDeleteIds = new Set(ids)
        for (const id of ids) {
          const card = records.cards[id]
          if (card?.type === 'group') {
            for (const b of Object.values(records.bindings)) {
              if (b.type === 'group-child' && b.fromId === id) {
                allDeleteIds.add(b.toId)
              }
            }
          }
        }

        // Remove bindings referencing deleted cards
        for (const [bId, b] of Object.entries(records.bindings)) {
          if (allDeleteIds.has(b.fromId) || allDeleteIds.has(b.toId)) {
            delete records.bindings[bId]
          }
        }

        for (const id of allDeleteIds) {
          delete records.cards[id]
        }
        records.document.updatedAt = now()
      })
      this.store.updateRuntime(
        (runtime) => {
          runtime.selection.selectedIds = runtime.selection.selectedIds.filter(
            (id) => !ids.includes(id),
          )
          if (runtime.selection.focusedId && ids.includes(runtime.selection.focusedId)) {
            runtime.selection.focusedId = undefined
            runtime.ui.dimensionBadgeVisible = false
          }
        },
        ['selection', 'ui'],
      )
    }, opts)
  }

  moveCards(
    ids: RecordId[],
    dx: number,
    dy: number,
    opts: TransactionOptions = { history: 'record', label: 'Move cards' },
  ): void {
    this.run(() => {
      this.store.updateRecords((records) => {
        // Collect group children so they move with their parent
        const allIds = new Set(ids)
        for (const id of ids) {
          const card = records.cards[id]
          if (card?.type === 'group') {
            for (const b of Object.values(records.bindings)) {
              if (b.type === 'group-child' && b.fromId === id) {
                allIds.add(b.toId)
              }
            }
          }
        }

        for (const id of allIds) {
          const card = records.cards[id]
          if (!card || card.locked || !card.capabilities.movable) continue
          card.x += dx
          card.y += dy
          card.updatedAt = now()
        }
        records.document.updatedAt = now()
      })
    }, opts)
  }

  resizeCard(
    id: RecordId,
    handle: ResizeHandle,
    delta: Point,
    opts: TransactionOptions = { history: 'record', label: 'Resize card' },
  ): void {
    const card = this.getCard(id)
    if (!card) return
    const plugin = this.plugins.get(card.type)
    const policy = plugin.getResizePolicy(card)
    if (!policy.enabled || !card.capabilities.resizable) return

    this.run(() => {
      this.store.updateRecords((records) => {
        const existing = records.cards[id]
        if (!existing) return
        records.cards[id] = { ...plugin.applyResize(existing, handle, delta), updatedAt: now() }
        records.document.updatedAt = now()
      })
    }, opts)
  }

  duplicateCards(
    ids: RecordId[],
    opts: TransactionOptions = { history: 'record', label: 'Duplicate cards' },
  ): RecordId[] {
    const createdIds: RecordId[] = []
    this.run(() => {
      this.store.updateRecords((records) => {
        for (const id of ids) {
          const card = records.cards[id]
          if (!card) continue
          const copyId = makeId('card')
          createdIds.push(copyId)
          records.cards[copyId] = {
            ...card,
            id: copyId,
            x: card.x + 24,
            y: card.y + 24,
            zIndex: card.zIndex + 1,
            createdAt: now(),
            updatedAt: now(),
            title: `${card.title} Copy`,
          }
        }
        records.document.updatedAt = now()
      })
    }, opts)
    this.selectCards(createdIds)
    return createdIds
  }

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  nudgeSelected(
    dx: number,
    dy: number,
    opts: TransactionOptions = { history: 'record', label: 'Nudge selection' },
  ): void {
    const ids = this.getSelectedCards().map((card) => card.id)
    if (ids.length === 0) return
    this.moveCards(ids, dx, dy, opts)
  }

  alignSelected(
    mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom',
    opts: TransactionOptions = { history: 'record', label: 'Align selection' },
  ): void {
    const selected = this.getSelectedCards()
    if (selected.length < 2) return

    const bounds = this.getSelectionBounds()
    if (!bounds) return

    this.run(() => {
      this.store.updateRecords((records) => {
        for (const card of selected) {
          const frame = this.getCardFrame(card.id)
          if (!frame) continue

          let nextX = frame.x
          let nextY = frame.y

          switch (mode) {
            case 'left':
              nextX = bounds.x
              break
            case 'center':
              nextX = bounds.x + bounds.width / 2 - frame.width / 2
              break
            case 'right':
              nextX = bounds.x + bounds.width - frame.width
              break
            case 'top':
              nextY = bounds.y
              break
            case 'middle':
              nextY = bounds.y + bounds.height / 2 - frame.height / 2
              break
            case 'bottom':
              nextY = bounds.y + bounds.height - frame.height
              break
          }

          const record = records.cards[card.id]
          if (!record || record.locked || !record.capabilities.movable) continue
          record.x = nextX
          record.y = nextY
          record.updatedAt = now()
        }
        records.document.updatedAt = now()
      })
    }, opts)
  }

  distributeSelected(
    axis: 'horizontal' | 'vertical',
    opts: TransactionOptions = { history: 'record', label: 'Distribute selection' },
  ): void {
    const selected = this.getSelectedCards()
    if (selected.length < 3) return

    const items = selected
      .map((card) => {
        const frame = this.getCardFrame(card.id)
        return frame ? { card, frame } : null
      })
      .filter(Boolean) as { card: CardRecord; frame: Rect }[]

    if (axis === 'horizontal') {
      items.sort((a, b) => a.frame.x - b.frame.x)
    } else {
      items.sort((a, b) => a.frame.y - b.frame.y)
    }

    const first = items[0]
    const last = items[items.length - 1]
    const prop = axis === 'horizontal' ? 'x' : 'y'
    const span = last.frame[prop] - first.frame[prop]
    const step = span / (items.length - 1)

    this.run(() => {
      this.store.updateRecords((records) => {
        items.forEach((item, index) => {
          const record = records.cards[item.card.id]
          if (!record || record.locked || !record.capabilities.movable) return
          record[prop] = first.frame[prop] + step * index
          record.updatedAt = now()
        })
        records.document.updatedAt = now()
      })
    }, opts)
  }

  // ---------------------------------------------------------------------------
  // Card actions
  // ---------------------------------------------------------------------------

  toggleFavorite(
    id: RecordId,
    opts: TransactionOptions = { history: 'record', label: 'Toggle favorite' },
  ): void {
    this.run(() => {
      this.store.updateRecords((records) => {
        const card = records.cards[id]
        if (!card) return
        card.favorite = !card.favorite
        card.updatedAt = now()
      })
    }, opts)
  }

  bringToFront(ids: RecordId[]): void {
    const maxZ = Math.max(0, ...this.getCards().map((c) => c.zIndex))
    this.updateCards(
      ids.map((id, index) => ({ id, zIndex: maxZ + index + 1 })),
      { history: 'record', label: 'Bring to front' },
    )
  }

  sendToBack(ids: RecordId[]): void {
    const minZ = Math.min(0, ...this.getCards().map((c) => c.zIndex))
    this.updateCards(
      ids.map((id, index) => ({ id, zIndex: minZ - ids.length + index })),
      { history: 'record', label: 'Send to back' },
    )
  }

  // ---------------------------------------------------------------------------
  // Context menu
  // ---------------------------------------------------------------------------

  openContextMenu(targetCardId: RecordId | undefined, screen: Point): void {
    this.store.updateRuntime(
      (runtime) => {
        runtime.ui.contextMenu = {
          open: true,
          screenX: screen.x,
          screenY: screen.y,
          targetCardId,
        }
        runtime.interaction.mode = 'context-menu-open'
      },
      ['ui', 'interaction'],
    )
  }

  closeContextMenu(): void {
    this.store.updateRuntime(
      (runtime) => {
        runtime.ui.contextMenu.open = false
        runtime.ui.contextMenu.targetCardId = undefined
        if (runtime.interaction.mode === 'context-menu-open') {
          runtime.interaction.mode = 'idle'
        }
      },
      ['ui', 'interaction'],
    )
  }

  // ---------------------------------------------------------------------------
  // Provenance
  // ---------------------------------------------------------------------------

  resolveSelectedChatContext(): SelectedChatContext | null {
    const selected = this.getSelectedCards()
    if (selected.length !== 1) return null

    const card = selected[0]
    if (!card.provenanceId) return null

    const provenance = this.store.getRecords().provenance[card.provenanceId]
    if (!provenance) return null

    const revisions = Object.values(this.store.getRecords().revisions)
      .filter((r) => r.cardId === card.id)
      .sort((a, b) => a.timestamp - b.timestamp)

    return {
      cardId: card.id,
      conversationId: provenance.conversationId,
      currentMessageId: provenance.lastUpdatedByMessageId,
      sourceMessageId: provenance.createdByMessageId,
      revisionIds: revisions.map((r) => r.id),
    }
  }

  // ---------------------------------------------------------------------------
  // Snapping
  // ---------------------------------------------------------------------------

  applyMoveSnap(
    ids: RecordId[],
    proposedDx: number,
    proposedDy: number,
  ): { dx: number; dy: number } {
    const runtime = this.store.getRuntime()
    if (!runtime.snap.enabled || runtime.snap.bypass || runtime.snap.mode === 'off') {
      this.clearGuides()
      return { dx: proposedDx, dy: proposedDy }
    }

    const selectedIds = new Set(ids)
    const movingFrames = ids.map((id) => this.getCardFrame(id)).filter(Boolean) as Rect[]

    if (movingFrames.length === 0) {
      this.clearGuides()
      return { dx: proposedDx, dy: proposedDy }
    }

    const movingBounds: Rect = {
      x: Math.min(...movingFrames.map((r) => r.x)),
      y: Math.min(...movingFrames.map((r) => r.y)),
      width:
        Math.max(...movingFrames.map((r) => r.x + r.width)) -
        Math.min(...movingFrames.map((r) => r.x)),
      height:
        Math.max(...movingFrames.map((r) => r.y + r.height)) -
        Math.min(...movingFrames.map((r) => r.y)),
    }

    const proposedRect: Rect = {
      x: movingBounds.x + proposedDx,
      y: movingBounds.y + proposedDy,
      width: movingBounds.width,
      height: movingBounds.height,
    }

    const referenceRects = this.getVisibleCards()
      .filter((card) => !selectedIds.has(card.id))
      .map((card) => this.getCardFrame(card.id))
      .filter(Boolean) as Rect[]

    const thresholdWorld = runtime.snap.thresholdPx / runtime.camera.scale

    const objectResult =
      runtime.snap.mode === 'objects' || runtime.snap.mode === 'both'
        ? snapRectMoveToObjects(proposedRect, referenceRects, thresholdWorld)
        : null

    const gridResult =
      (runtime.snap.mode === 'grid' || runtime.snap.mode === 'both') && runtime.snap.gridSize
        ? snapRectMoveToGrid(proposedRect, runtime.snap.gridSize)
        : null

    const combined = combineSnapResults(runtime.snap.mode, objectResult, gridResult)

    this.store.updateRuntime(
      (rt) => {
        rt.snap.guides = combined.guides
      },
      ['snap'],
    )

    return {
      dx: proposedDx + combined.dx,
      dy: proposedDy + combined.dy,
    }
  }

  applyResizeSnap(id: RecordId, handle: ResizeHandle, delta: Point): Point {
    const runtime = this.store.getRuntime()
    if (!runtime.snap.enabled || runtime.snap.bypass || runtime.snap.mode === 'off') {
      this.clearGuides()
      return delta
    }

    const card = this.getCard(id)
    if (!card) return delta

    const previewFrame = this.getCardFrame(id)
    if (!previewFrame) return delta

    const plugin = this.plugins.get(card.type)
    const syntheticCard: CardRecord = { ...card, ...previewFrame }
    const resized = plugin.applyResize(syntheticCard, handle, delta)

    const referenceRects = this.getVisibleCards()
      .filter((c) => c.id !== id)
      .map((c) => this.getCardFrame(c.id))
      .filter(Boolean) as Rect[]

    const thresholdWorld = runtime.snap.thresholdPx / runtime.camera.scale
    const resizedRect: Rect = {
      x: resized.x,
      y: resized.y,
      width: resized.width,
      height: resized.height,
    }

    const objectResult =
      runtime.snap.mode === 'objects' || runtime.snap.mode === 'both'
        ? snapResizeToObjects(resizedRect, handle, referenceRects, thresholdWorld)
        : null

    const gridResult =
      (runtime.snap.mode === 'grid' || runtime.snap.mode === 'both') && runtime.snap.gridSize
        ? snapResizeToGrid(resizedRect, handle, runtime.snap.gridSize)
        : null

    const combined = combineSnapResults(runtime.snap.mode, objectResult, gridResult)

    this.store.updateRuntime(
      (rt) => {
        rt.snap.guides = combined.guides
      },
      ['snap'],
    )

    const nextDelta = { ...delta }
    if (handle.includes('e')) nextDelta.x += combined.dx
    if (handle.includes('w')) nextDelta.x += combined.dx
    if (handle.includes('s')) nextDelta.y += combined.dy
    if (handle.includes('n')) nextDelta.y += combined.dy

    return nextDelta
  }

  clearGuides(): void {
    this.store.updateRuntime(
      (runtime) => {
        runtime.snap.guides = []
      },
      ['snap'],
    )
  }

  setSnapMode(mode: SnapMode): void {
    this.store.updateRuntime(
      (runtime) => {
        runtime.snap.mode = mode
        runtime.snap.guides = []
      },
      ['snap'],
    )
  }

  setSnapEnabled(enabled: boolean): void {
    this.store.updateRuntime(
      (runtime) => {
        runtime.snap.enabled = enabled
        runtime.snap.guides = []
      },
      ['snap'],
    )
  }

  setSnapBypass(bypass: boolean): void {
    this.store.updateRuntime(
      (runtime) => {
        runtime.snap.bypass = bypass
        if (bypass) runtime.snap.guides = []
      },
      ['snap'],
    )
  }

  // ---------------------------------------------------------------------------
  // Clipboard
  // ---------------------------------------------------------------------------

  copySelected(): void {
    const selected = this.getSelectedCards()
    if (selected.length === 0) return

    const ids = new Set(selected.map((c) => c.id))
    const records = this.store.getRecords()

    // Collect bindings where both ends are in the selection
    const bindings = Object.values(records.bindings).filter(
      (b) => ids.has(b.fromId) && ids.has(b.toId),
    )

    // Compute center of selection for paste offset
    const bounds = this.getSelectionBounds()!
    this.clipboard = {
      cards: selected.map((c) => ({ ...c })),
      bindings: bindings.map((b) => ({ ...b })),
      centerX: bounds.x + bounds.width / 2,
      centerY: bounds.y + bounds.height / 2,
    }
  }

  pasteClipboard(opts: TransactionOptions = { history: 'record', label: 'Paste' }): RecordId[] {
    if (!this.clipboard || this.clipboard.cards.length === 0) return []

    const idMap = new Map<RecordId, RecordId>()
    const pastedIds: RecordId[] = []
    const offset = 40

    // Map old ids to new ids
    for (const card of this.clipboard.cards) {
      idMap.set(card.id, makeId('card'))
    }
    for (const binding of this.clipboard.bindings) {
      idMap.set(binding.id, makeId('bind'))
    }

    this.run(() => {
      this.store.updateRecords((records) => {
        for (const card of this.clipboard!.cards) {
          const newId = idMap.get(card.id)!
          pastedIds.push(newId)
          records.cards[newId] = {
            ...card,
            id: newId,
            x: card.x + offset,
            y: card.y + offset,
            createdAt: now(),
            updatedAt: now(),
            title: card.title,
          }
        }

        for (const binding of this.clipboard!.bindings) {
          const newId = idMap.get(binding.id)!
          records.bindings[newId] = {
            ...binding,
            id: newId,
            fromId: idMap.get(binding.fromId) ?? binding.fromId,
            toId: idMap.get(binding.toId) ?? binding.toId,
          }
        }

        records.document.updatedAt = now()
      })
    }, opts)

    this.selectCards(pastedIds)
    return pastedIds
  }

  hasClipboard(): boolean {
    return !!this.clipboard && this.clipboard.cards.length > 0
  }

  // ---------------------------------------------------------------------------
  // Select all
  // ---------------------------------------------------------------------------

  selectAll(): void {
    const ids = this.getVisibleCards()
      .filter((c) => c.capabilities.selectable)
      .map((c) => c.id)
    this.selectCards(ids)
  }

  // ---------------------------------------------------------------------------
  // Grouping
  // ---------------------------------------------------------------------------

  groupSelected(
    opts: TransactionOptions = { history: 'record', label: 'Group cards' },
  ): RecordId | null {
    const selected = this.getSelectedCards()
    if (selected.length < 2) return null

    const bounds = this.getSelectionBounds()
    if (!bounds) return null

    const groupId = makeId('group')
    const groupCard: CardRecord = {
      id: groupId,
      type: 'group',
      title: 'Group',
      x: bounds.x - 8,
      y: bounds.y - 8,
      width: bounds.width + 16,
      height: bounds.height + 16,
      zIndex: Math.max(...selected.map((c) => c.zIndex)) + 1,
      visible: true,
      locked: false,
      favorite: false,
      createdAt: now(),
      updatedAt: now(),
      capabilities: {
        selectable: true,
        focusable: false,
        movable: true,
        resizable: false,
        exportable: false,
        downloadable: false,
        viewCode: false,
        liveOverlay: false,
      },
    }

    this.run(() => {
      this.store.updateRecords((records) => {
        records.cards[groupId] = groupCard

        for (const card of selected) {
          const bindingId = makeId('bind')
          records.bindings[bindingId] = {
            id: bindingId,
            type: 'group-child',
            fromId: groupId,
            toId: card.id,
          }
        }

        records.document.updatedAt = now()
      })
    }, opts)

    this.selectCards([groupId])
    return groupId
  }

  ungroupSelected(opts: TransactionOptions = { history: 'record', label: 'Ungroup cards' }): void {
    const selected = this.getSelectedCards()
    const groupIds = selected.filter((c) => c.type === 'group').map((c) => c.id)
    if (groupIds.length === 0) return

    const allChildIds: RecordId[] = []

    this.run(() => {
      this.store.updateRecords((records) => {
        for (const groupId of groupIds) {
          // Find children
          const childBindings = Object.values(records.bindings).filter(
            (b) => b.type === 'group-child' && b.fromId === groupId,
          )
          for (const binding of childBindings) {
            allChildIds.push(binding.toId)
            delete records.bindings[binding.id]
          }

          // Remove group card
          delete records.cards[groupId]
        }

        records.document.updatedAt = now()
      })
    }, opts)

    this.selectCards(allChildIds)
  }

  getGroupChildren(groupId: RecordId): RecordId[] {
    const bindings = this.store.getRecords().bindings
    return Object.values(bindings)
      .filter((b) => b.type === 'group-child' && b.fromId === groupId)
      .map((b) => b.toId)
  }

  // ---------------------------------------------------------------------------
  // Intents
  // ---------------------------------------------------------------------------

  emitIntent(intent: EditorIntent): void {
    this.intents.emit(intent)
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  exportDocument(): SerializedEditorDocument {
    const records = this.store.getRecords()
    return {
      version: records.document.version,
      document: records.document,
      cards: Object.values(records.cards),
      provenance: Object.values(records.provenance),
      revisions: Object.values(records.revisions),
      bindings: Object.values(records.bindings),
    }
  }

  loadDocument(doc: SerializedEditorDocument): void {
    this.store.importSnapshot({
      schemaVersion: doc.version,
      records: {
        document: doc.document,
        cards: Object.fromEntries(doc.cards.map((c) => [c.id, c])),
        provenance: Object.fromEntries(doc.provenance.map((p) => [p.id, p])),
        revisions: Object.fromEntries(doc.revisions.map((r) => [r.id, r])),
        bindings: Object.fromEntries(doc.bindings.map((b) => [b.id, b])),
      },
    })
  }
}
