import React from 'react'
import type { EditorCore } from '../../core/EditorCore'
import { useSingleSelectedCard } from '../hooks'

interface PromptContextChipProps {
  editor: EditorCore
}

export function PromptContextChip({ editor }: PromptContextChipProps) {
  const card = useSingleSelectedCard(editor)

  if (!card) return null

  return (
    <div className="inline-flex max-w-[320px] items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white shadow">
      <div className="h-5 w-5 shrink-0 overflow-hidden rounded bg-neutral-700">
        {card.previewThumbnailUrl ? (
          <img
            src={card.previewThumbnailUrl}
            alt={card.title}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>

      <span className="truncate">{card.title}</span>

      <button
        type="button"
        onClick={() => editor.clearSelection()}
        className="ml-1 rounded-full px-1 text-neutral-400 hover:bg-neutral-800 hover:text-white"
        aria-label="Clear selected card context"
      >
        {'\u00D7'}
      </button>
    </div>
  )
}
