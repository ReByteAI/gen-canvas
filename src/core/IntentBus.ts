import type { EditorIntent, EditorIntentListener } from './types'

export class IntentBus {
  private listeners = new Set<EditorIntentListener>()

  emit(intent: EditorIntent): void {
    for (const listener of this.listeners) {
      listener(intent)
    }
  }

  subscribe(listener: EditorIntentListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}
