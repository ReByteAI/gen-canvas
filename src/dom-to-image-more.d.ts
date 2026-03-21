declare module 'dom-to-image-more' {
  interface Options {
    width?: number
    height?: number
    scale?: number
    bgcolor?: string
    style?: Record<string, string>
    filter?: (node: Node) => boolean
    quality?: number
    imagePlaceholder?: string
    cacheBust?: boolean
  }

  function toPng(node: Node, options?: Options): Promise<string>
  function toJpeg(node: Node, options?: Options): Promise<string>
  function toSvg(node: Node, options?: Options): Promise<string>
  function toBlob(node: Node, options?: Options): Promise<Blob>
  function toPixelData(node: Node, options?: Options): Promise<Uint8ClampedArray>

  export { toPng, toJpeg, toSvg, toBlob, toPixelData }
  export default { toPng, toJpeg, toSvg, toBlob, toPixelData }
}
