import { useSyncExternalStore } from 'react'
import type { EditorCore } from '../core/EditorCore'
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

export function useRuntime(editor: EditorCore) {
  return useSyncExternalStore(
    (cb) => subscribe(editor, cb),
    () => editor.getRuntime(),
  )
}

export function useSelectedCards(editor: EditorCore) {
  return useSyncExternalStore(
    (cb) => subscribe(editor, cb),
    () => editor.getSelectedCards(),
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

export function useContextMenuItems(editor: EditorCore) {
  return useSyncExternalStore(
    (cb) => subscribe(editor, cb),
    () => getContextMenuItems(editor),
  )
}

export function useSelectedChatContext(editor: EditorCore) {
  return useSyncExternalStore(
    (cb) => subscribe(editor, cb),
    () => editor.resolveSelectedChatContext(),
  )
}

export function useFocusedOverlay(editor: EditorCore) {
  return useSyncExternalStore(
    (cb) => subscribe(editor, cb),
    () => getFocusedOverlay(editor),
  )
}

export function useFocusedOverlayScreenRect(editor: EditorCore) {
  return useSyncExternalStore(
    (cb) => subscribe(editor, cb),
    () => getFocusedOverlayScreenRect(editor),
  )
}

export function useFocusedOverlayResolution(editor: EditorCore) {
  return useSyncExternalStore(
    (cb) => subscribe(editor, cb),
    () => getFocusedOverlayResolution(editor),
  )
}

export function useSelectionBounds(editor: EditorCore) {
  return useSyncExternalStore(
    (cb) => subscribe(editor, cb),
    () => editor.getSelectionBounds(),
  )
}
