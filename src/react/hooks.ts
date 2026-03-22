import { useSyncExternalStore } from 'react'
import type { EditorCore } from '../core/EditorCore'
import type { CardRecord, MenuItemSpec, Rect, SelectedChatContext } from '../core/types'
import type { FocusedOverlayResolution } from '../core/FocusedOverlayManager'
import {
  getContextMenuItems,
  getFocusedOverlay,
  getFocusedOverlayResolution,
  getFocusedOverlayScreenRect,
  getSingleSelectedCard,
} from './selectors'

function subscribe(editor: EditorCore, cb: () => void) {
  return editor.store.subscribe(() => cb())
}

/* ------------------------------------------------------------------ */
/*  Snapshot caching                                                   */
/*                                                                     */
/*  React 18's useSyncExternalStore requires getSnapshot to return the */
/*  SAME reference when the data hasn't changed. Hooks that derive     */
/*  new arrays/objects (getSelectedCards, getContextMenuItems, etc.)    */
/*  must cache their last result and return it if nothing changed.     */
/* ------------------------------------------------------------------ */

function shallowArrayEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false
  }
  return true
}

function shallowRectEqual(a: Rect | undefined | null, b: Rect | undefined | null): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

/**
 * Creates a cached getSnapshot function for useSyncExternalStore.
 * Uses a WeakMap keyed by EditorCore so each editor instance has its own cache,
 * and the cache is GC'd when the editor is disposed.
 */
function cachedArraySnapshot<T>(
  cache: WeakMap<EditorCore, T[]>,
  editor: EditorCore,
  compute: () => T[],
): T[] {
  const next = compute()
  const prev = cache.get(editor)
  if (prev && shallowArrayEqual(prev, next)) return prev
  cache.set(editor, next)
  return next
}

function cachedRectSnapshot(
  cache: WeakMap<EditorCore, Rect | undefined | null>,
  editor: EditorCore,
  compute: () => Rect | undefined | null,
): Rect | undefined | null {
  const next = compute()
  const prev = cache.get(editor)
  if (prev !== undefined && shallowRectEqual(prev, next)) return prev
  cache.set(editor, next)
  return next
}

// Per-hook caches
const _selectedCards = new WeakMap<EditorCore, CardRecord[]>()
const _contextMenuItems = new WeakMap<EditorCore, MenuItemSpec[]>()
const _selectionBounds = new WeakMap<EditorCore, Rect | undefined | null>()
const _focusedOverlayRect = new WeakMap<EditorCore, Rect | undefined | null>()
const _focusedOverlay = new WeakMap<EditorCore, { kind: string; cardId: string } | null>()
const _focusedOverlayRes = new WeakMap<EditorCore, FocusedOverlayResolution | null>()
const _chatContext = new WeakMap<EditorCore, SelectedChatContext | null>()

/* ------------------------------------------------------------------ */
/*  Safe hooks (return primitives or stable object references)         */
/* ------------------------------------------------------------------ */

export function useRuntime(editor: EditorCore) {
  return useSyncExternalStore(
    (cb) => subscribe(editor, cb),
    () => editor.getRuntime(),
  )
}

export function useSingleSelectedCard(editor: EditorCore) {
  return useSyncExternalStore(
    (cb) => subscribe(editor, cb),
    () => getSingleSelectedCard(editor),
  )
}

export function useFocusedCard(editor: EditorCore) {
  return useSyncExternalStore(
    (cb) => subscribe(editor, cb),
    () => editor.getFocusedCard(),
  )
}

export function useZoomPercent(editor: EditorCore) {
  return useSyncExternalStore(
    (cb) => subscribe(editor, cb),
    () => editor.getZoomPercent(),
  )
}

export function useContextMenuState(editor: EditorCore) {
  return useSyncExternalStore(
    (cb) => subscribe(editor, cb),
    () => editor.getRuntime().ui.contextMenu,
  )
}

/* ------------------------------------------------------------------ */
/*  Cached hooks (return derived arrays/objects)                       */
/* ------------------------------------------------------------------ */

export function useSelectedCards(editor: EditorCore) {
  return useSyncExternalStore(
    (cb) => subscribe(editor, cb),
    () => cachedArraySnapshot(_selectedCards, editor, () => editor.getSelectedCards()),
  )
}

export function useContextMenuItems(editor: EditorCore) {
  return useSyncExternalStore(
    (cb) => subscribe(editor, cb),
    () => cachedArraySnapshot(_contextMenuItems, editor, () => getContextMenuItems(editor)),
  )
}

export function useSelectedChatContext(editor: EditorCore) {
  return useSyncExternalStore(
    (cb) => subscribe(editor, cb),
    () => {
      const next = editor.resolveSelectedChatContext()
      const prev = _chatContext.get(editor)
      // resolveSelectedChatContext returns null or { card, provenance, revision }
      // null === null is stable; non-null changes when card selection changes
      if (prev === null && next === null) return prev
      if (
        prev &&
        next &&
        prev.cardId === next.cardId &&
        prev.conversationId === next.conversationId
      )
        return prev
      _chatContext.set(editor, next)
      return next
    },
  )
}

export function useFocusedOverlay(editor: EditorCore) {
  return useSyncExternalStore(
    (cb) => subscribe(editor, cb),
    () => {
      const next = getFocusedOverlay(editor)
      const prev = _focusedOverlay.get(editor)
      if (prev === null && next === null) return prev
      if (prev && next && prev.kind === next.kind && prev.cardId === next.cardId) return prev
      _focusedOverlay.set(editor, next)
      return next
    },
  )
}

export function useFocusedOverlayScreenRect(editor: EditorCore) {
  return useSyncExternalStore(
    (cb) => subscribe(editor, cb),
    () =>
      cachedRectSnapshot(_focusedOverlayRect, editor, () => getFocusedOverlayScreenRect(editor)),
  )
}

export function useFocusedOverlayResolution(editor: EditorCore) {
  return useSyncExternalStore(
    (cb) => subscribe(editor, cb),
    () => {
      const next = getFocusedOverlayResolution(editor)
      const prev = _focusedOverlayRes.get(editor)
      if (prev === null && next === null) return prev
      if (
        prev &&
        next &&
        prev.overlay === next.overlay &&
        shallowRectEqual(prev.screenRect, next.screenRect)
      ) {
        return prev
      }
      // Also try using cached overlay for stable reference
      if (prev && next && shallowRectEqual(prev.screenRect, next.screenRect)) {
        const cachedOverlay = _focusedOverlay.get(editor)
        if (cachedOverlay && cachedOverlay === prev.overlay) return prev
      }
      _focusedOverlayRes.set(editor, next)
      return next
    },
  )
}

export function useSelectionBounds(editor: EditorCore) {
  return useSyncExternalStore(
    (cb) => subscribe(editor, cb),
    () => cachedRectSnapshot(_selectionBounds, editor, () => editor.getSelectionBounds()),
  )
}
