import type { EditorCore } from './EditorCore'
import type { SerializedEditorDocument } from './types'

export class BrowserDocumentPersistence {
  saveToJSONString(editor: EditorCore): string {
    return JSON.stringify(editor.exportDocument(), null, 2)
  }

  loadFromJSONString(editor: EditorCore, json: string): void {
    const parsed = JSON.parse(json) as SerializedEditorDocument
    editor.loadDocument(parsed)
  }

  saveToLocalStorage(editor: EditorCore, key: string): void {
    const json = this.saveToJSONString(editor)
    localStorage.setItem(key, json)
  }

  loadFromLocalStorage(editor: EditorCore, key: string): boolean {
    const json = localStorage.getItem(key)
    if (!json) return false
    this.loadFromJSONString(editor, json)
    return true
  }

  downloadJSON(editor: EditorCore, filename = 'editor-document.json'): void {
    const json = this.saveToJSONString(editor)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    URL.revokeObjectURL(url)
  }

  async loadFromFile(editor: EditorCore, file: File): Promise<void> {
    const text = await file.text()
    this.loadFromJSONString(editor, text)
  }
}
