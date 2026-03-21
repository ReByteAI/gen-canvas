import React from 'react'
import type { EditorCore } from '../../core/EditorCore'
import { useSelectedCards } from '../hooks'

interface SelectionActionBarProps {
  editor: EditorCore
}

function ActionButton(props: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
    >
      {props.label}
    </button>
  )
}

export function SelectionActionBar({ editor }: SelectionActionBarProps) {
  const selected = useSelectedCards(editor)

  if (selected.length < 2) return null

  const distributeDisabled = selected.length < 3

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-950/95 px-3 py-3 shadow-2xl backdrop-blur">
      <ActionButton label="Left" onClick={() => editor.alignSelected('left')} />
      <ActionButton label="Center" onClick={() => editor.alignSelected('center')} />
      <ActionButton label="Right" onClick={() => editor.alignSelected('right')} />

      <div className="mx-1 h-6 border-l border-neutral-800" />

      <ActionButton label="Top" onClick={() => editor.alignSelected('top')} />
      <ActionButton label="Middle" onClick={() => editor.alignSelected('middle')} />
      <ActionButton label="Bottom" onClick={() => editor.alignSelected('bottom')} />

      <div className="mx-1 h-6 border-l border-neutral-800" />

      <ActionButton
        label="Distribute H"
        onClick={() => editor.distributeSelected('horizontal')}
        disabled={distributeDisabled}
      />
      <ActionButton
        label="Distribute V"
        onClick={() => editor.distributeSelected('vertical')}
        disabled={distributeDisabled}
      />
    </div>
  )
}
