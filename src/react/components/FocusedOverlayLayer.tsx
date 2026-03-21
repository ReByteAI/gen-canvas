import React from 'react'
import type { EditorCore } from '../../core/EditorCore'
import { useFocusedOverlayResolution } from '../hooks'

interface FocusedOverlayLayerProps {
  editor: EditorCore
  offset?: { left: number; top: number }
}

function IframeOverlay({ src }: { src?: string }) {
  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl bg-white text-sm text-neutral-500">
        Missing prototype URL
      </div>
    )
  }

  return (
    <iframe
      src={src}
      className="h-full w-full rounded-xl border-0 bg-white"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      title="Focused prototype"
    />
  )
}

function HtmlOverlay({ payload }: { payload?: unknown }) {
  const documentId =
    typeof payload === 'object' && payload && 'documentId' in payload
      ? String((payload as Record<string, unknown>).documentId)
      : undefined

  return (
    <div className="h-full w-full overflow-auto rounded-xl bg-white p-4 text-neutral-900 shadow-2xl">
      <div className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Document Preview</div>
      <div className="text-sm">
        {documentId ? `Render document ${documentId} here.` : 'Missing document payload'}
      </div>
    </div>
  )
}

export function FocusedOverlayLayer({
  editor,
  offset = { left: 0, top: 0 },
}: FocusedOverlayLayerProps) {
  const resolution = useFocusedOverlayResolution(editor)
  if (!resolution) return null

  const { overlay, screenRect } = resolution

  return (
    <div
      style={{
        position: 'absolute',
        left: offset.left + screenRect.x,
        top: offset.top + screenRect.y,
        width: screenRect.width,
        height: screenRect.height,
        zIndex: 1200,
        pointerEvents: 'auto',
      }}
    >
      {overlay.kind === 'iframe' ? (
        <IframeOverlay src={(overlay.payload as Record<string, unknown>)?.src as string} />
      ) : overlay.kind === 'html' ? (
        <HtmlOverlay payload={overlay.payload} />
      ) : (
        <div className="h-full w-full rounded-xl bg-white shadow-2xl" />
      )}
    </div>
  )
}
