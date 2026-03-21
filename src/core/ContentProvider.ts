import type { ContentProvider, ContentType, ResolvedContent } from './types'

/**
 * In-memory content provider. Stores content in a Map keyed by ref string.
 * Useful for demos, testing, and cases where content is loaded into memory upfront.
 */
export class InMemoryContentProvider implements ContentProvider {
  private store = new Map<string, ResolvedContent>()

  set(ref: string, content: ResolvedContent): void {
    this.store.set(ref, content)
  }

  delete(ref: string): void {
    this.store.delete(ref)
  }

  has(ref: string): boolean {
    return this.store.has(ref)
  }

  resolve(ref: string, _contentType: ContentType): ResolvedContent {
    const content = this.store.get(ref)
    if (!content) {
      throw new Error(`Content not found for ref: "${ref}"`)
    }
    return content
  }
}

/**
 * Pass-through content provider.
 * Treats the ref itself as the content value:
 * - 'html' refs are treated as HTML strings
 * - 'image' refs are treated as image URLs
 * - 'url' refs are treated as iframe URLs
 *
 * This is a simple default for cases where the ref IS the content.
 */
export class PassThroughContentProvider implements ContentProvider {
  resolve(ref: string, contentType: ContentType): ResolvedContent {
    switch (contentType) {
      case 'html':
        return { type: 'html', html: ref }
      case 'image':
        return { type: 'image', src: ref }
      case 'url':
        return { type: 'url', url: ref }
      default:
        return { type: 'custom', contentType: String(contentType), data: ref }
    }
  }
}

/**
 * Composite content provider. Tries providers in order until one succeeds.
 * Useful for combining multiple sources (e.g., in-memory cache + filesystem + network).
 */
export class CompositeContentProvider implements ContentProvider {
  private providers: ContentProvider[] = []

  add(provider: ContentProvider): void {
    this.providers.push(provider)
  }

  async resolve(ref: string, contentType: ContentType): Promise<ResolvedContent> {
    for (const provider of this.providers) {
      try {
        return await provider.resolve(ref, contentType)
      } catch {
        // Try next provider
      }
    }
    throw new Error(`No provider could resolve ref: "${ref}"`)
  }
}
