// Core
export { EditorStore } from './core/EditorStore'
export { EditorCore } from './core/EditorCore'
export { PluginRegistry } from './core/PluginRegistry'
export { HistoryManager } from './core/HistoryManager'
export { ToolStateMachine } from './core/ToolStateMachine'
export { IntentBus } from './core/IntentBus'
export { BrowserDocumentPersistence } from './core/DocumentPersistence'

// Content providers
export {
  InMemoryContentProvider,
  PassThroughContentProvider,
  CompositeContentProvider,
} from './core/ContentProvider'

// Plugins
export { ScreenCardPlugin } from './core/plugins/ScreenCardPlugin'
export { PrototypeCardPlugin } from './core/plugins/PrototypeCardPlugin'
export { DocumentCardPlugin } from './core/plugins/DocumentCardPlugin'

// Konva adapter
export { KonvaAdapter } from './konva/KonvaAdapter'
export { LiveOverlayManager } from './konva/LiveOverlayManager'

// Geometry
export {
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
} from './core/geometry'

// Helpers
export { cardToRect, resolveCardRect } from './core/cardFrames'
export { resolveFocusedOverlay } from './core/FocusedOverlayManager'

// Types
export type {
  RecordId,
  Timestamp,
  CardType,
  BindingType,
  ToolName,
  PointerMode,
  ResizeHandle,
  SnapMode,
  Point,
  Rect,
  ContentType,
  ResolvedContent,
  ResolvedContentHtml,
  ResolvedContentImage,
  ResolvedContentUrl,
  ResolvedContentCustom,
  ContentProvider,
  CardRecord,
  ProvenanceRecord,
  RevisionRecord,
  BindingRecord,
  DocumentRecord,
  EditorRecords,
  CameraState,
  SelectionState,
  InteractionState,
  UIState,
  PreviewState,
  GuideLine,
  SnapState,
  RuntimeState,
  StoreSnapshot,
  StoreChange,
  StoreListener,
  SerializedEditorDocument,
  SelectedChatContext,
  HitTarget,
  NormalizedInputEvent,
  RenderDescriptor,
  ResizePolicy,
  OverlaySpec,
  MenuItemSpec,
  CardPlugin,
  TransactionOptions,
  HistoryEntry,
  EditorAPI,
  EditorIntent,
  EditorIntentListener,
} from './core/types'
