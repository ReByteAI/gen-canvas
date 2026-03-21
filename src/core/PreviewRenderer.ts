import domtoimage from 'dom-to-image-more'

export interface PreviewRenderOptions {
  /** The HTML string to render */
  html: string
  /** Card width in world pixels */
  width: number
  /** Card height in world pixels */
  height: number
  /** Pixel scale for sharper previews (default: 2) */
  scale?: number
  /** Background color (default: '#ffffff') */
  bgcolor?: string
}

/**
 * Renders an HTML string to a PNG data URL by:
 * 1. Creating a hidden iframe with sandbox="allow-same-origin" (no scripts)
 * 2. Waiting for fonts and images to load
 * 3. Rasterizing the DOM via dom-to-image-more
 * 4. Returning a data URL suitable for Konva Image nodes
 *
 * The iframe is same-origin so contentDocument is accessible.
 * Scripts are disabled for security — this is a preview, not a live environment.
 */
export async function renderHtmlToImage(opts: PreviewRenderOptions): Promise<string> {
  const { html, width, height, scale = 2, bgcolor = '#ffffff' } = opts

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-100000px'
  iframe.style.top = '0'
  iframe.style.width = `${width}px`
  iframe.style.height = `${height}px`
  iframe.style.border = '0'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'

  // allow-same-origin lets us read contentDocument. NO allow-scripts.
  iframe.setAttribute('sandbox', 'allow-same-origin')

  iframe.srcdoc = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
html, body {
  margin: 0;
  padding: 0;
  width: ${width}px;
  height: ${height}px;
  overflow: hidden;
  background: ${bgcolor};
}
</style>
</head>
<body>${html}</body>
</html>`

  document.body.appendChild(iframe)

  try {
    // Wait for iframe to load
    await new Promise<void>((resolve, reject) => {
      iframe.onload = () => resolve()
      iframe.onerror = () => reject(new Error('Preview iframe failed to load'))
    })

    const doc = iframe.contentDocument
    if (!doc) throw new Error('Cannot access iframe contentDocument')

    // Wait for fonts
    await doc.fonts.ready

    // Wait for images
    const imgs = Array.from(doc.images)
    await Promise.all(
      imgs.map(async (img) => {
        try {
          if (!img.complete) {
            await new Promise<void>((resolve) => {
              img.addEventListener('load', () => resolve(), { once: true })
              img.addEventListener('error', () => resolve(), { once: true })
            })
          }
          await img.decode?.().catch(() => {})
        } catch {
          // skip failed images
        }
      }),
    )

    // Rasterize
    const dataUrl = await domtoimage.toPng(doc.documentElement, {
      width,
      height,
      scale,
      bgcolor,
    })

    return dataUrl
  } finally {
    iframe.remove()
  }
}

/**
 * Manages preview image generation and caching for cards.
 * Generates previews asynchronously and notifies via callback when ready.
 */
export class PreviewCache {
  private cache = new Map<string, string>()
  private pending = new Set<string>()
  private onUpdate: (() => void) | null = null

  constructor(onUpdate?: () => void) {
    this.onUpdate = onUpdate ?? null
  }

  /** Get cached preview data URL, or undefined if not yet rendered */
  get(key: string): string | undefined {
    return this.cache.get(key)
  }

  /** Check if a preview is currently being generated */
  isPending(key: string): boolean {
    return this.pending.has(key)
  }

  /**
   * Request a preview. If cached, returns immediately.
   * If not, starts async generation and calls onUpdate when done.
   */
  request(key: string, opts: PreviewRenderOptions): string | undefined {
    const cached = this.cache.get(key)
    if (cached) return cached

    if (this.pending.has(key)) return undefined

    this.pending.add(key)
    renderHtmlToImage(opts)
      .then((dataUrl) => {
        this.cache.set(key, dataUrl)
        this.pending.delete(key)
        this.onUpdate?.()
      })
      .catch(() => {
        this.pending.delete(key)
      })

    return undefined
  }

  /** Invalidate a specific key */
  invalidate(key: string): void {
    this.cache.delete(key)
  }

  /** Clear entire cache */
  clear(): void {
    this.cache.clear()
    this.pending.clear()
  }
}
