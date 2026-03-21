export type RecordId = string
export type Timestamp = number

export type CardType = 'screen' | 'prototype' | 'document' | 'group'
export type BindingType = 'group-child' | 'prototype-link' | 'depends-on'

export type ToolName = 'select' | 'hand'

export type PointerMode =
  | 'idle'
  | 'pointing'
  | 'panning'
  | 'dragging-card'
  | 'resizing-card'
  | 'marquee-select'
  | 'context-menu-open'

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export type SnapMode = 'off' | 'objects' | 'grid' | 'both'

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

// ---------------------------------------------------------------------------
// Document records (persisted)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Card content — what a card renders
// ---------------------------------------------------------------------------

/** URL content: rendered in an iframe via src= */
export interface CardContentUrl {
  kind: 'url'
  url: string
}

/** Raw HTML content: rendered in an iframe via srcdoc= */
export interface CardContentHtml {
  kind: 'html'
  html: string
}

/** Static image content: rendered as an image in Konva */
export interface CardContentImage {
  kind: 'image'
  src: string
}

export type CardContent = CardContentUrl | CardContentHtml | CardContentImage

export interface CardRecord {
  id: RecordId
  type: CardType
  title: string

  x: number
  y: number
  width: number
  height: number

  zIndex: number

  visible: boolean
  locked: boolean
  favorite: boolean

  /** Primary content — determines what the card renders */
  content?: CardContent

  /** Fallback thumbnail for zoomed-out preview (used when content is url/html) */
  previewThumbnailUrl?: string

  createdAt: Timestamp
  updatedAt: Timestamp

  provenanceId?: RecordId

  capabilities: {
    selectable: boolean
    focusable: boolean
    movable: boolean
    resizable: boolean
    exportable: boolean
    downloadable: boolean
    viewCode: boolean
    liveOverlay: boolean
  }

  meta?: Record<string, unknown>
}

export interface ProvenanceRecord {
  id: RecordId
  conversationId: string
  createdByMessageId?: string
  lastUpdatedByMessageId?: string
  operationIds: string[]
}

export interface RevisionRecord {
  id: RecordId
  cardId: RecordId
  operationId: string
  messageId: string
  timestamp: Timestamp
  summary?: string
}

export interface BindingRecord {
  id: RecordId
  type: BindingType
  fromId: RecordId
  toId: RecordId
  meta?: Record<string, unknown>
}

export interface DocumentRecord {
  id: RecordId
  title: string
  createdAt: Timestamp
  updatedAt: Timestamp
  version: number
}

export interface EditorRecords {
  document: DocumentRecord
  cards: Record<RecordId, CardRecord>
  provenance: Record<RecordId, ProvenanceRecord>
  revisions: Record<RecordId, RevisionRecord>
  bindings: Record<RecordId, BindingRecord>
}

// ---------------------------------------------------------------------------
// Runtime state (not persisted)
// ---------------------------------------------------------------------------

export interface CameraState {
  x: number
  y: number
  scale: number
  viewportWidth: number
  viewportHeight: number
  minScale: number
  maxScale: number
}

export interface SelectionState {
  selectedIds: RecordId[]
  focusedId?: RecordId
  hoveredId?: RecordId
}

export interface InteractionState {
  tool: ToolName
  mode: PointerMode

  pointerDownScreen?: Point
  pointerDownWorld?: Point
  lastPointerScreen?: Point
  lastPointerWorld?: Point

  targetCardId?: RecordId
  resizeHandle?: ResizeHandle

  dragStartCardFrame?: Rect
  marqueeRect?: Rect
  marqueeBaseSelectedIds?: RecordId[]

  spacePanActive: boolean
}

export interface UIState {
  contextMenu: {
    open: boolean
    screenX: number
    screenY: number
    targetCardId?: RecordId
  }
  dimensionBadgeVisible: boolean
}

export interface PreviewState {
  active: boolean
  kind?: 'move' | 'resize'
  cardFrames: Record<RecordId, Rect>
}

export interface GuideLine {
  axis: 'x' | 'y'
  value: number
  start: number
  end: number
}

export interface SnapState {
  enabled: boolean
  mode: SnapMode
  thresholdPx: number
  gridSize?: number
  guides: GuideLine[]
  bypass: boolean
}

export interface RuntimeState {
  camera: CameraState
  selection: SelectionState
  interaction: InteractionState
  ui: UIState
  preview: PreviewState
  snap: SnapState
}

// ---------------------------------------------------------------------------
// Store primitives
// ---------------------------------------------------------------------------

export interface StoreSnapshot {
  schemaVersion: number
  records: EditorRecords
}

export interface StoreChange {
  changedRecordIds: RecordId[]
  changedRuntimeKeys: string[]
}

export type StoreListener = (change: StoreChange) => void

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

export interface SerializedEditorDocument {
  version: number
  document: DocumentRecord
  cards: CardRecord[]
  provenance: ProvenanceRecord[]
  revisions: RevisionRecord[]
  bindings: BindingRecord[]
}

export interface SelectedChatContext {
  cardId: RecordId
  conversationId: string
  currentMessageId?: string
  sourceMessageId?: string
  revisionIds: RecordId[]
}

// ---------------------------------------------------------------------------
// Input events
// ---------------------------------------------------------------------------

export interface HitTarget {
  kind: 'card' | 'resize-handle' | 'empty'
  cardId?: RecordId
  handle?: ResizeHandle
}

export type NormalizedInputEvent =
  | {
      type: 'pointer_down'
      screen: Point
      world: Point
      button: number
      target?: HitTarget
      shift: boolean
      meta: boolean
      alt: boolean
    }
  | {
      type: 'pointer_move'
      screen: Point
      world: Point
      target?: HitTarget
      shift: boolean
      meta: boolean
      alt: boolean
    }
  | {
      type: 'pointer_up'
      screen: Point
      world: Point
      button: number
    }
  | {
      type: 'double_click'
      screen: Point
      world: Point
      target?: HitTarget
    }
  | {
      type: 'wheel'
      screen: Point
      world: Point
      deltaY: number
      ctrlKey: boolean
    }
  | {
      type: 'context_menu'
      screen: Point
      world: Point
      target?: HitTarget
    }
  | {
      type: 'key_down'
      key: string
      shift: boolean
      meta: boolean
      alt: boolean
    }
  | {
      type: 'key_up'
      key: string
    }

// ---------------------------------------------------------------------------
// Card plugin system
// ---------------------------------------------------------------------------

export interface RenderDescriptor {
  kind: 'image-preview' | 'document-preview' | 'prototype-preview' | 'group-outline'
  src?: string
  title?: string
  icon?: 'screen' | 'prototype' | 'document' | 'group'
}

export interface ResizePolicy {
  enabled: boolean
  aspectLocked?: boolean
  minWidth?: number
  minHeight?: number
  allowedHandles?: ResizeHandle[]
}

export interface OverlaySpec {
  kind: 'iframe' | 'html' | 'custom'
  cardId: RecordId
  payload?: unknown
}

export type MenuItemSpec =
  | {
      id: string
      kind: 'action'
      label: string
      shortcut?: string
      disabled?: boolean
      action: (editor: EditorAPI, cardId: RecordId) => void | Promise<void>
    }
  | {
      id: string
      kind: 'separator'
    }
  | {
      id: string
      kind: 'submenu'
      label: string
      disabled?: boolean
      children: MenuItemSpec[]
    }

export interface CardPlugin<T extends CardRecord = CardRecord> {
  type: T['type']

  getBounds(card: T): Rect
  getRenderDescriptor(card: T): RenderDescriptor

  getResizePolicy(card: T): ResizePolicy
  applyResize(card: T, handle: ResizeHandle, delta: Point): T

  getMenuItems(card: T, editor: EditorAPI): MenuItemSpec[]

  canFocus(card: T): boolean
  onFocus?(card: T, editor: EditorAPI): void

  getOverlay?(card: T, editor: EditorAPI): OverlaySpec | null

  canExport?(card: T): boolean
  export?(card: T, format: 'png' | 'svg' | 'json'): Promise<void>

  canDownload?(card: T): boolean
  download?(card: T): Promise<void>
}

// ---------------------------------------------------------------------------
// Transaction / history
// ---------------------------------------------------------------------------

export interface TransactionOptions {
  history?: 'record' | 'ignore'
  label?: string
}

export interface HistoryEntry {
  label: string
  undo: () => void
  redo: () => void
  timestamp: number
}

// ---------------------------------------------------------------------------
// EditorAPI — the public surface consumed by plugins and UI
// ---------------------------------------------------------------------------

export interface EditorAPI {
  getCard(id: RecordId): CardRecord | undefined
  getCardFrame(id: RecordId): Rect | undefined
  getSelectedCards(): CardRecord[]
  getFocusedCard(): CardRecord | undefined
  getVisibleCards(): CardRecord[]
  getRuntime(): RuntimeState
  getSelectionBounds(): Rect | undefined
  getCardsIntersectingRect(rect: Rect): RecordId[]

  selectCard(id: RecordId, additive?: boolean): void
  selectCards(ids: RecordId[]): void
  clearSelection(): void
  focusCard(id: RecordId): void
  exitFocus(): void

  setTool(tool: ToolName): void

  panBy(dx: number, dy: number): void
  zoomTo(scale: number, screenPoint?: Point): void
  zoomBy(factor: number, screenPoint?: Point): void
  fitCardToViewport(id: RecordId, padding?: number): void

  createCards(cards: CardRecord[], opts?: TransactionOptions): void
  updateCards(updates: Partial<CardRecord & { id: RecordId }>[], opts?: TransactionOptions): void
  moveCards(ids: RecordId[], dx: number, dy: number, opts?: TransactionOptions): void
  resizeCard(id: RecordId, handle: ResizeHandle, delta: Point, opts?: TransactionOptions): void
  duplicateCards(ids: RecordId[], opts?: TransactionOptions): RecordId[]
  deleteCards(ids: RecordId[], opts?: TransactionOptions): void

  nudgeSelected(dx: number, dy: number, opts?: TransactionOptions): void
  alignSelected(
    mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom',
    opts?: TransactionOptions,
  ): void
  distributeSelected(axis: 'horizontal' | 'vertical', opts?: TransactionOptions): void

  toggleFavorite(id: RecordId, opts?: TransactionOptions): void
  bringToFront(ids: RecordId[]): void
  sendToBack(ids: RecordId[]): void

  openContextMenu(targetCardId: RecordId | undefined, screen: Point): void
  closeContextMenu(): void

  resolveSelectedChatContext(): SelectedChatContext | null

  // Gesture preview system
  startMovePreview(ids: RecordId[]): void
  previewMove(ids: RecordId[], dx: number, dy: number): void
  startResizePreview(id: RecordId): void
  previewResize(id: RecordId, handle: ResizeHandle, delta: Point): void
  commitGesture(): void
  cancelGesture(): void

  // Snapping
  applyMoveSnap(ids: RecordId[], proposedDx: number, proposedDy: number): { dx: number; dy: number }
  applyResizeSnap(id: RecordId, handle: ResizeHandle, delta: Point): Point
  clearGuides(): void
  setSnapMode(mode: SnapMode): void
  setSnapEnabled(enabled: boolean): void
  setSnapBypass(bypass: boolean): void

  // Intents
  emitIntent(intent: EditorIntent): void

  // Persistence
  exportDocument(): SerializedEditorDocument
  loadDocument(doc: SerializedEditorDocument): void
}

// ---------------------------------------------------------------------------
// Intent system
// ---------------------------------------------------------------------------

export type EditorIntent =
  | { type: 'view-code'; cardId: RecordId }
  | { type: 'export-card'; cardId: RecordId; format?: 'png' | 'svg' | 'json' }
  | { type: 'download-card'; cardId: RecordId }
  | { type: 'open-card-details'; cardId: RecordId }
  | { type: 'open-revisions'; cardId: RecordId }

export type EditorIntentListener = (intent: EditorIntent) => void
