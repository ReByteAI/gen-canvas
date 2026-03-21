import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { EditorCore } from '../../core/EditorCore'
import type { MenuItemSpec } from '../../core/types'
import { useContextMenuItems, useContextMenuState } from '../hooks'

interface ContextMenuProps {
  editor: EditorCore
}

function MenuActionRow(props: {
  label: string
  shortcut?: string
  disabled?: boolean
  hasChildren?: boolean
  onClick?: () => void
  onMouseEnter?: () => void
}) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      onMouseEnter={props.onMouseEnter}
      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span>{props.label}</span>
      <span className="ml-6 flex items-center gap-2 text-xs text-neutral-400">
        {props.shortcut ? <span>{props.shortcut}</span> : null}
        {props.hasChildren ? <span>{'\u203A'}</span> : null}
      </span>
    </button>
  )
}

function MenuList(props: {
  items: MenuItemSpec[]
  editor: EditorCore
  targetCardId?: string
  onClose: () => void
}) {
  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null)

  return (
    <div className="relative min-w-[220px] rounded-xl border border-neutral-700 bg-neutral-900 p-2 text-white shadow-2xl">
      {props.items.map((item) => {
        if (item.kind === 'separator') {
          return <div key={item.id} className="my-1 border-t border-neutral-800" />
        }

        if (item.kind === 'submenu') {
          const isOpen = openSubmenuId === item.id
          return (
            <div key={item.id} className="relative">
              <MenuActionRow
                label={item.label}
                hasChildren
                disabled={item.disabled}
                onMouseEnter={() => setOpenSubmenuId(item.id)}
              />
              {isOpen ? (
                <div className="absolute left-full top-0 ml-2">
                  <MenuList
                    items={item.children}
                    editor={props.editor}
                    targetCardId={props.targetCardId}
                    onClose={props.onClose}
                  />
                </div>
              ) : null}
            </div>
          )
        }

        return (
          <MenuActionRow
            key={item.id}
            label={item.label}
            shortcut={item.shortcut}
            disabled={item.disabled}
            onMouseEnter={() => setOpenSubmenuId(null)}
            onClick={() => {
              if (item.disabled || !props.targetCardId) return
              void item.action(props.editor, props.targetCardId)
              props.onClose()
            }}
          />
        )
      })}
    </div>
  )
}

export function ContextMenu({ editor }: ContextMenuProps) {
  const state = useContextMenuState(editor)
  const items = useContextMenuItems(editor)
  const ref = useRef<HTMLDivElement | null>(null)

  const style = useMemo<React.CSSProperties>(() => {
    return {
      position: 'absolute',
      left: state.screenX,
      top: state.screenY,
      zIndex: 2000,
    }
  }, [state.screenX, state.screenY])

  useEffect(() => {
    if (!state.open) return

    const onPointerDown = (evt: MouseEvent) => {
      const el = ref.current
      if (!el) return
      if (el.contains(evt.target as Node)) return
      editor.closeContextMenu()
    }

    const onKeyDown = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') editor.closeContextMenu()
    }

    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [editor, state.open])

  if (!state.open || items.length === 0) return null

  return (
    <div ref={ref} style={style}>
      <MenuList
        items={items}
        editor={editor}
        targetCardId={state.targetCardId}
        onClose={() => editor.closeContextMenu()}
      />
    </div>
  )
}
