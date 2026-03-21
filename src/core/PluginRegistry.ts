import type { CardPlugin, CardType } from './types'

export class PluginRegistry {
  private plugins = new Map<CardType, CardPlugin>()

  register(plugin: CardPlugin): void {
    if (this.plugins.has(plugin.type)) {
      throw new Error(`Plugin already registered for card type "${plugin.type}"`)
    }
    this.plugins.set(plugin.type, plugin)
  }

  get(type: CardType): CardPlugin {
    const plugin = this.plugins.get(type)
    if (!plugin) {
      throw new Error(`No plugin registered for card type "${type}"`)
    }
    return plugin
  }

  has(type: CardType): boolean {
    return this.plugins.has(type)
  }
}
