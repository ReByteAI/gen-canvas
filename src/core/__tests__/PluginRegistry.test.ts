import { describe, it, expect } from 'vitest'
import { PluginRegistry } from '../PluginRegistry'
import { ScreenCardPlugin } from '../plugins/ScreenCardPlugin'

describe('PluginRegistry', () => {
  it('registers and retrieves a plugin', () => {
    const registry = new PluginRegistry()
    const plugin = new ScreenCardPlugin()
    registry.register(plugin)
    expect(registry.get('screen')).toBe(plugin)
    expect(registry.has('screen')).toBe(true)
  })

  it('throws on duplicate registration', () => {
    const registry = new PluginRegistry()
    registry.register(new ScreenCardPlugin())
    expect(() => registry.register(new ScreenCardPlugin())).toThrow('already registered')
  })

  it('throws when getting unregistered type', () => {
    const registry = new PluginRegistry()
    expect(() => registry.get('prototype')).toThrow('No plugin registered')
  })

  it('has returns false for unregistered type', () => {
    const registry = new PluginRegistry()
    expect(registry.has('document')).toBe(false)
  })
})
