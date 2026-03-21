import type { EditorCore } from './EditorCore'
import type { NormalizedInputEvent } from './types'
import { rectFromPoints } from './geometry'

const DRAG_START_DISTANCE_PX = 4
const WHEEL_ZOOM_STEP = 0.0015

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

export class ToolStateMachine {
  constructor(private editor: EditorCore) {}

  handle(event: NormalizedInputEvent): void {
    const runtime = this.editor.getRuntime()
    const { interaction, selection, camera } = runtime
    const activeTool = interaction.spacePanActive ? 'hand' : interaction.tool

    switch (event.type) {
      case 'pointer_down': {
        this.editor.closeContextMenu()
        this.editor.clearGuides()

        // Hand tool or middle-click → pan
        if (activeTool === 'hand' || event.button === 1) {
          this.editor.store.updateRuntime(
            (rt) => {
              rt.interaction.mode = 'panning'
              rt.interaction.pointerDownScreen = event.screen
              rt.interaction.lastPointerScreen = event.screen
              rt.interaction.pointerDownWorld = event.world
              rt.interaction.lastPointerWorld = event.world
            },
            ['interaction'],
          )
          return
        }

        // Resize handle
        if (event.target?.kind === 'resize-handle' && event.target.cardId && event.target.handle) {
          this.editor.startResizePreview(event.target.cardId)
          this.editor.store.updateRuntime(
            (rt) => {
              rt.interaction.mode = 'resizing-card'
              rt.interaction.targetCardId = event.target?.cardId
              rt.interaction.resizeHandle = event.target?.handle
              rt.interaction.pointerDownScreen = event.screen
              rt.interaction.pointerDownWorld = event.world
              rt.interaction.lastPointerScreen = event.screen
              rt.interaction.lastPointerWorld = event.world
            },
            ['interaction'],
          )
          return
        }

        // Card body
        if (event.target?.kind === 'card' && event.target.cardId) {
          if (!selection.selectedIds.includes(event.target.cardId)) {
            this.editor.selectCard(event.target.cardId, event.shift)
          }

          this.editor.store.updateRuntime(
            (rt) => {
              rt.interaction.mode = 'pointing'
              rt.interaction.targetCardId = event.target?.cardId
              rt.interaction.pointerDownScreen = event.screen
              rt.interaction.pointerDownWorld = event.world
              rt.interaction.lastPointerScreen = event.screen
              rt.interaction.lastPointerWorld = event.world
            },
            ['interaction'],
          )
          return
        }

        // Empty canvas — enter pointing (may become marquee or click-clear)
        this.editor.store.updateRuntime(
          (rt) => {
            rt.interaction.mode = 'pointing'
            rt.interaction.targetCardId = undefined
            rt.interaction.pointerDownScreen = event.screen
            rt.interaction.pointerDownWorld = event.world
            rt.interaction.lastPointerScreen = event.screen
            rt.interaction.lastPointerWorld = event.world
            rt.interaction.marqueeRect = undefined
            rt.interaction.marqueeBaseSelectedIds = event.shift ? [...rt.selection.selectedIds] : []
          },
          ['interaction'],
        )
        return
      }

      case 'pointer_move': {
        // Hover
        if (event.target?.kind === 'card' && event.target.cardId) {
          this.editor.hoverCard(event.target.cardId)
        } else {
          this.editor.hoverCard(undefined)
        }

        // Pointing → drag or marquee
        if (interaction.mode === 'pointing') {
          if (!interaction.pointerDownScreen || !interaction.pointerDownWorld) return

          if (distance(interaction.pointerDownScreen, event.screen) >= DRAG_START_DISTANCE_PX) {
            const cardId = interaction.targetCardId

            if (cardId) {
              this.editor.startMovePreview(selection.selectedIds)
              this.editor.store.updateRuntime(
                (rt) => {
                  rt.interaction.mode = 'dragging-card'
                  rt.interaction.lastPointerScreen = event.screen
                  rt.interaction.lastPointerWorld = event.world
                },
                ['interaction'],
              )
              return
            }

            // No card → marquee
            this.editor.store.updateRuntime(
              (rt) => {
                rt.interaction.mode = 'marquee-select'
                rt.interaction.lastPointerScreen = event.screen
                rt.interaction.lastPointerWorld = event.world
                rt.interaction.marqueeRect = rectFromPoints(
                  rt.interaction.pointerDownWorld!,
                  event.world,
                )
              },
              ['interaction'],
            )
            return
          }
          return
        }

        // Marquee select
        if (interaction.mode === 'marquee-select') {
          if (!interaction.pointerDownWorld) return

          const marqueeRect = rectFromPoints(interaction.pointerDownWorld, event.world)
          const hits = this.editor.getCardsIntersectingRect(marqueeRect)
          const base = interaction.marqueeBaseSelectedIds ?? []
          const nextSelected = event.shift ? Array.from(new Set([...base, ...hits])) : hits

          this.editor.selectCards(nextSelected)
          this.editor.store.updateRuntime(
            (rt) => {
              rt.interaction.lastPointerScreen = event.screen
              rt.interaction.lastPointerWorld = event.world
              rt.interaction.marqueeRect = marqueeRect
            },
            ['interaction'],
          )
          return
        }

        // Dragging card
        if (interaction.mode === 'dragging-card') {
          const prev = interaction.lastPointerWorld
          if (!prev) return

          const rawDx = event.world.x - prev.x
          const rawDy = event.world.y - prev.y

          if (rawDx !== 0 || rawDy !== 0) {
            const snapped = this.editor.applyMoveSnap(selection.selectedIds, rawDx, rawDy)
            this.editor.previewMove(selection.selectedIds, snapped.dx, snapped.dy)
          }

          this.editor.store.updateRuntime(
            (rt) => {
              rt.interaction.lastPointerScreen = event.screen
              rt.interaction.lastPointerWorld = event.world
            },
            ['interaction'],
          )
          return
        }

        // Resizing card
        if (interaction.mode === 'resizing-card') {
          if (
            !interaction.targetCardId ||
            !interaction.resizeHandle ||
            !interaction.lastPointerWorld
          )
            return

          const rawDelta = {
            x: event.world.x - interaction.lastPointerWorld.x,
            y: event.world.y - interaction.lastPointerWorld.y,
          }

          const snappedDelta = this.editor.applyResizeSnap(
            interaction.targetCardId,
            interaction.resizeHandle,
            rawDelta,
          )

          this.editor.previewResize(
            interaction.targetCardId,
            interaction.resizeHandle,
            snappedDelta,
          )

          this.editor.store.updateRuntime(
            (rt) => {
              rt.interaction.lastPointerScreen = event.screen
              rt.interaction.lastPointerWorld = event.world
            },
            ['interaction'],
          )
          return
        }

        // Panning
        if (interaction.mode === 'panning') {
          const prev = interaction.lastPointerScreen
          if (!prev) return

          const dxScreen = event.screen.x - prev.x
          const dyScreen = event.screen.y - prev.y
          this.editor.panBy(-dxScreen / camera.scale, -dyScreen / camera.scale)

          this.editor.store.updateRuntime(
            (rt) => {
              rt.interaction.lastPointerScreen = event.screen
              rt.interaction.lastPointerWorld = event.world
            },
            ['interaction'],
          )
          return
        }

        return
      }

      case 'pointer_up': {
        if (interaction.mode === 'dragging-card' || interaction.mode === 'resizing-card') {
          this.editor.commitGesture()
          this.editor.clearGuides()
        } else if (interaction.mode === 'pointing') {
          if (!interaction.targetCardId && !event.button) {
            this.editor.clearSelection()
          }
        } else if (interaction.mode === 'marquee-select') {
          this.editor.clearGuides()
        }

        this.editor.store.updateRuntime(
          (rt) => {
            rt.interaction.mode = 'idle'
            rt.interaction.targetCardId = undefined
            rt.interaction.resizeHandle = undefined
            rt.interaction.pointerDownScreen = undefined
            rt.interaction.pointerDownWorld = undefined
            rt.interaction.lastPointerScreen = undefined
            rt.interaction.lastPointerWorld = undefined
            rt.interaction.marqueeRect = undefined
            rt.interaction.marqueeBaseSelectedIds = undefined
          },
          ['interaction'],
        )
        return
      }

      case 'double_click': {
        if (event.target?.kind === 'card' && event.target.cardId) {
          this.editor.focusCard(event.target.cardId)
        }
        return
      }

      case 'wheel': {
        const factor = Math.exp(-event.deltaY * WHEEL_ZOOM_STEP)
        this.editor.zoomBy(factor, event.screen)
        return
      }

      case 'context_menu': {
        if (event.target?.kind === 'card' && event.target.cardId) {
          const selectedIds = this.editor.getRuntime().selection.selectedIds
          if (!selectedIds.includes(event.target.cardId)) {
            this.editor.selectCard(event.target.cardId)
          }
          this.editor.openContextMenu(event.target.cardId, event.screen)
        } else {
          this.editor.closeContextMenu()
        }
        return
      }

      case 'key_down': {
        const key = event.key.toLowerCase()

        // Alt bypass snapping
        if (key === 'alt') {
          this.editor.setSnapBypass(true)
          return
        }

        if (key === ' ') {
          this.editor.store.updateRuntime(
            (rt) => {
              rt.interaction.spacePanActive = true
            },
            ['interaction'],
          )
          return
        }

        if (key === 'v') {
          this.editor.setTool('select')
          return
        }
        if (key === 'h') {
          this.editor.setTool('hand')
          return
        }

        if (key === 'f' && !event.shift) {
          const focusedCandidate = this.editor.getSelectedCards()[0]
          if (focusedCandidate) this.editor.focusCard(focusedCandidate.id)
          return
        }

        // Arrow nudge
        const nudgeAmount = event.shift ? 10 : 1
        if (key === 'arrowleft') {
          this.editor.nudgeSelected(-nudgeAmount, 0)
          return
        }
        if (key === 'arrowright') {
          this.editor.nudgeSelected(nudgeAmount, 0)
          return
        }
        if (key === 'arrowup') {
          this.editor.nudgeSelected(0, -nudgeAmount)
          return
        }
        if (key === 'arrowdown') {
          this.editor.nudgeSelected(0, nudgeAmount)
          return
        }

        // Copy / Paste / Duplicate
        if (event.meta && key === 'c') {
          this.editor.copySelected()
          return
        }
        if (event.meta && key === 'v') {
          this.editor.pasteClipboard()
          return
        }
        if (event.meta && key === 'd') {
          this.editor.duplicateCards(this.editor.getSelectedCards().map((c) => c.id))
          return
        }

        // Select all
        if (event.meta && key === 'a') {
          this.editor.selectAll()
          return
        }

        // Group / Ungroup
        if (event.meta && event.shift && key === 'g') {
          this.editor.ungroupSelected()
          return
        }
        if (event.meta && key === 'g') {
          this.editor.groupSelected()
          return
        }

        // Favorite
        if (event.shift && key === 'f') {
          const card = this.editor.getSelectedCards()[0]
          if (card) this.editor.toggleFavorite(card.id)
          return
        }

        // Undo/redo
        if (event.meta && key === 'z') {
          if (event.shift) {
            this.editor.history.redo()
          } else {
            this.editor.history.undo()
          }
          return
        }

        // Delete
        if (key === 'backspace' || key === 'delete') {
          const ids = this.editor.getSelectedCards().map((c) => c.id)
          if (ids.length > 0) this.editor.deleteCards(ids)
          return
        }

        // Escape
        if (key === 'escape') {
          const rt = this.editor.getRuntime()

          if (rt.interaction.mode === 'dragging-card' || rt.interaction.mode === 'resizing-card') {
            this.editor.cancelGesture()
            this.editor.clearGuides()
            this.editor.store.updateRuntime(
              (runtime) => {
                runtime.interaction.mode = 'idle'
                runtime.interaction.targetCardId = undefined
                runtime.interaction.resizeHandle = undefined
                runtime.interaction.pointerDownScreen = undefined
                runtime.interaction.pointerDownWorld = undefined
                runtime.interaction.lastPointerScreen = undefined
                runtime.interaction.lastPointerWorld = undefined
                runtime.interaction.marqueeRect = undefined
                runtime.interaction.marqueeBaseSelectedIds = undefined
              },
              ['interaction'],
            )
            return
          }

          if (rt.interaction.mode === 'marquee-select') {
            this.editor.store.updateRuntime(
              (runtime) => {
                runtime.interaction.mode = 'idle'
                runtime.interaction.marqueeRect = undefined
                runtime.interaction.marqueeBaseSelectedIds = undefined
                runtime.interaction.pointerDownScreen = undefined
                runtime.interaction.pointerDownWorld = undefined
                runtime.interaction.lastPointerScreen = undefined
                runtime.interaction.lastPointerWorld = undefined
              },
              ['interaction'],
            )
            return
          }

          if (rt.ui.contextMenu.open) {
            this.editor.closeContextMenu()
          } else if (rt.selection.focusedId) {
            this.editor.exitFocus()
          } else {
            this.editor.clearSelection()
          }
          return
        }

        return
      }

      case 'key_up': {
        if (event.key === ' ') {
          this.editor.store.updateRuntime(
            (rt) => {
              rt.interaction.spacePanActive = false
            },
            ['interaction'],
          )
        }

        if (event.key.toLowerCase() === 'alt') {
          this.editor.setSnapBypass(false)
        }

        return
      }
    }
  }
}
