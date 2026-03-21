import { createDemoEditor } from '../src/bootstrap'

const container = document.getElementById('editor-root') as HTMLDivElement | null
if (!container) {
  throw new Error('Missing #editor-root element')
}

const { editor } = createDemoEditor(container)

// Log intents to console
editor.intents.subscribe((intent) => {
  console.log('[Intent]', intent)
})

// Wire toolbar buttons
const btnSelect = document.getElementById('btn-select')!
const btnHand = document.getElementById('btn-hand')!
const btnZoomFit = document.getElementById('btn-zoom-fit')!
const zoomPill = document.getElementById('zoom-pill')!
const snapPill = document.getElementById('snap-pill')!

btnSelect.addEventListener('click', () => editor.setTool('select'))
btnHand.addEventListener('click', () => editor.setTool('hand'))
btnZoomFit.addEventListener('click', () => {
  const cards = editor.getVisibleCards()
  if (cards.length > 0) {
    const bounds = editor.getSelectionBounds() ?? {
      x: Math.min(...cards.map((c) => c.x)),
      y: Math.min(...cards.map((c) => c.y)),
      width: Math.max(...cards.map((c) => c.x + c.width)) - Math.min(...cards.map((c) => c.x)),
      height: Math.max(...cards.map((c) => c.y + c.height)) - Math.min(...cards.map((c) => c.y)),
    }
    editor.store.updateRuntime(
      (rt) => {
        const padding = 120
        const usableW = Math.max(1, rt.camera.viewportWidth - padding * 2)
        const usableH = Math.max(1, rt.camera.viewportHeight - padding * 2)
        const scaleX = usableW / bounds.width
        const scaleY = usableH / bounds.height
        const scale = Math.min(scaleX, scaleY, 4)
        rt.camera.scale = Math.max(0.05, scale)
        rt.camera.x = bounds.x + bounds.width / 2 - rt.camera.viewportWidth / (2 * rt.camera.scale)
        rt.camera.y =
          bounds.y + bounds.height / 2 - rt.camera.viewportHeight / (2 * rt.camera.scale)
      },
      ['camera'],
    )
  }
})

snapPill.addEventListener('click', () => {
  const snap = editor.getRuntime().snap
  editor.setSnapEnabled(!snap.enabled)
})

// Update UI on state change
editor.store.subscribe(() => {
  const rt = editor.getRuntime()

  // Tool buttons
  btnSelect.classList.toggle('active', rt.interaction.tool === 'select')
  btnHand.classList.toggle('active', rt.interaction.tool === 'hand')

  // Zoom
  zoomPill.textContent = `${Math.round(rt.camera.scale * 100)}%`

  // Snap
  snapPill.textContent = rt.snap.enabled ? `Snap: ${rt.snap.mode}` : 'Snap: off'
  snapPill.classList.toggle('snap-on', rt.snap.enabled)
})

console.log('gen-canvas demo loaded. Access `editor` in console.')
