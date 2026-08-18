// Bitmap font loader and renderer for VGA-style fonts
// Supports raw binary bitmap data (8x16 VGA format)

export type BitmapFont = {
	width: number
	height: number
	glyphs: Uint8Array[] // Array of 256 glyphs, each is height bytes (1 byte per row)
	rawBitmapData?: Uint8Array // Optional raw bitmap data for debugging
	glyphCache?: Map<string, HTMLCanvasElement> // LRU cache of pre-rendered glyphs as canvases
}

/** How many leading bytes of a candidate region the offset heuristic inspects. */
const OFFSET_PROBE_WINDOW = 1000
const OFFSET_PROBE_MIN_NONZERO = 100
const OFFSET_PROBE_MAX_NONZERO = 900

/**
 * Locate the start of raw glyph data, which may sit behind a .FON wrapper header.
 *
 * Heuristic: the first position whose leading bytes are neither mostly empty nor completely
 * saturated. The non-zero count is carried across positions as a sliding window, so this is
 * a single pass — scoring each candidate independently would be quadratic in file size.
 *
 * Exported for tests; callers should use {@link loadRawBitmapFont}.
 */
export function findFontDataOffset(bytes: Uint8Array, expectedSize: number): number {
	if (bytes.length <= expectedSize) return 0

	const lastOffset = bytes.length - expectedSize
	const window = Math.min(OFFSET_PROBE_WINDOW, expectedSize)

	let nonZero = 0
	for (let j = 0; j < window; j++) {
		if (bytes[j] !== 0) nonZero++
	}

	for (let i = 0; i <= lastOffset; i++) {
		if (i > 0) {
			if (bytes[i - 1] !== 0) nonZero--
			if (bytes[i + window - 1] !== 0) nonZero++
		}
		if (nonZero > OFFSET_PROBE_MIN_NONZERO && nonZero < OFFSET_PROBE_MAX_NONZERO) {
			return i
		}
	}

	return 0
}

/**
 * Load a raw binary bitmap font (8xN format, 256 glyphs)
 * Expected format: 256 consecutive glyphs, each N bytes (one byte per scanline)
 */
export async function loadRawBitmapFont(url: string, width = 8, height = 16): Promise<BitmapFont> {
	const response = await fetch(url)
	if (!response.ok) throw new Error(`Failed to load font: ${response.status}`)
	const buffer = await response.arrayBuffer()
	const bytes = new Uint8Array(buffer)

	const bytesPerGlyph = height
	const expectedSize = 256 * bytesPerGlyph

	const offset = findFontDataOffset(bytes, expectedSize)
	const fontData = bytes.slice(offset, offset + expectedSize)
	if (fontData.length < expectedSize) {
		throw new Error(`Font file too small: ${fontData.length} < ${expectedSize}`)
	}

	const glyphs: Uint8Array[] = []
	for (let i = 0; i < 256; i++) {
		const start = i * bytesPerGlyph
		glyphs.push(fontData.slice(start, start + bytesPerGlyph))
	}

	return { width, height, glyphs }
}

/**
 * Upper bound on fully-coloured glyph canvases kept per font.
 *
 * The cache is LRU: a hit refreshes the entry's recency, and a miss at the cap evicts the
 * least-recently-used entry and repaints into its canvas rather than allocating a new one.
 * Eviction matters because fonts are shared — the embedded VGA font is a process-wide
 * singleton, so every display on a page draws through ONE cache. A page of concurrent
 * truecolour generators (the demo's generator picker runs ~28 displays) mints more distinct
 * (char, fg, bg) keys than any fixed cap within seconds; an insert-until-full cache then
 * degrades every uncached draw to a slow path *permanently*, even though the set of keys
 * live at any moment is far smaller than the cap. LRU keeps the recurring working set on
 * the fast path and recycles canvases for the rest, so memory and allocations stay bounded
 * without the one-way ratchet.
 */
const MAX_COLORED_GLYPHS = 4096

/**
 * Levels per channel that truecolour `rgb()` inputs are snapped to.
 *
 * The glyph cache keys on the exact colour string, so a caller emitting unquantized
 * 24-bit colour mints a new key per cell per frame: the cache fills with keys that are
 * never reused, and every later draw falls through to the (much slower) mask-tint path.
 * Snapping to 32 levels per channel bounds the key space at 32^3 per character while
 * moving any channel by at most 4/255, which is imperceptible.
 *
 * This is a safety net for arbitrary truecolour sources. Callers that emit colour on a
 * coarser ladder of their own pass through unchanged only if their levels are drawn from
 * *this* ladder — otherwise they are quantized a second time and drift by up to 3/255.
 * The shape converter's `rgbLevels` picks its values from here for that reason.
 */
const TRUECOLOR_LEVELS = 32

/** Nearest-level lookup for 0..255, endpoints included so 255 stays full-bright. */
const TRUECOLOR_LUT = (() => {
	const steps = TRUECOLOR_LEVELS - 1
	const lut = new Uint8Array(256)
	for (let v = 0; v < 256; v++) {
		lut[v] = Math.round((Math.round((v * steps) / 255) * 255) / steps)
	}
	return lut
})()

/**
 * Upper bound on remembered raw -> quantized colour strings.
 *
 * Normalising on every call (rather than only on a cache miss) is what makes the glyph
 * cache effective: a miss-only normalisation would keep caching the raw key and re-parse
 * it forever. The memo keeps the per-call cost at one Map lookup. The memo is LRU for the
 * same reason as the glyph cache: it is process-wide, so stop-inserting-at-cap would let
 * whichever colours arrived first squat in it forever while the currently-live palette
 * re-parses on every draw.
 */
const MAX_NORMALIZED_COLORS = 8192

const normalizedColors = new Map<string, string>()

const RGB_PATTERN = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/

/**
 * Snap a CSS `rgb(r,g,b)` colour onto the {@link TRUECOLOR_LEVELS} ladder.
 *
 * Anything else — hex, named colours, `rgba()`, already-resolved DOS palette entries —
 * is returned unchanged, so palette rendering is byte-identical to before.
 *
 * Exported for tests; callers should use {@link renderGlyph}.
 */
export function normalizeGlyphColor(color: string): string {
	const memo = normalizedColors.get(color)
	if (memo !== undefined) {
		// Refresh recency only once the memo is contended; below the cap insertion order
		// doesn't matter and the common path stays a single Map lookup.
		if (normalizedColors.size >= MAX_NORMALIZED_COLORS) {
			normalizedColors.delete(color)
			normalizedColors.set(color, memo)
		}
		return memo
	}
	if (!color.startsWith('rgb(')) return color

	const match = RGB_PATTERN.exec(color)
	if (!match) return color

	const r = TRUECOLOR_LUT[Math.min(255, +match[1])]
	const g = TRUECOLOR_LUT[Math.min(255, +match[2])]
	const b = TRUECOLOR_LUT[Math.min(255, +match[3])]
	const quantized = `rgb(${r},${g},${b})`

	if (normalizedColors.size >= MAX_NORMALIZED_COLORS) {
		const oldest = normalizedColors.keys().next().value
		if (oldest !== undefined) normalizedColors.delete(oldest)
	}
	normalizedColors.set(color, quantized)
	return quantized
}

/** Current size of the raw -> quantized colour memo. Exported for tests. */
export function normalizedColorCacheSize(): number {
	return normalizedColors.size
}

/**
 * Render a single glyph to a canvas context (pixel-perfect, no scaling).
 */
export function renderGlyph(
	ctx: CanvasRenderingContext2D,
	font: BitmapFont,
	charCode: number,
	x: number,
	y: number,
	rawFgColor: string,
	rawBgColor: string
) {
	if (!font.glyphCache) {
		font.glyphCache = new Map()
	}

	// Truecolour inputs are snapped to a bounded ladder for both the key and the paint, so
	// a cache hit and a cache miss render the same colour (see normalizeGlyphColor).
	const fgColor = normalizeGlyphColor(rawFgColor)
	const bgColor = normalizeGlyphColor(rawBgColor)

	const cacheKey = `${charCode}:${fgColor}:${bgColor}`
	const cached = font.glyphCache.get(cacheKey)

	if (cached) {
		// Refresh recency: Map preserves insertion order, so delete+set keeps the entry out
		// of eviction's way. Only needed once the cache is contended; below the cap a hit is
		// just the lookup above.
		if (font.glyphCache.size >= MAX_COLORED_GLYPHS) {
			font.glyphCache.delete(cacheKey)
			font.glyphCache.set(cacheKey, cached)
		}
		ctx.drawImage(cached, x, y)
		return
	}

	// Miss: paint this colour combination into its own canvas. At the cap, evict the
	// least-recently-used entry and repaint into its canvas — steady state allocates
	// nothing, no matter how many distinct colours a generator streams through.
	let canvas: HTMLCanvasElement
	if (font.glyphCache.size >= MAX_COLORED_GLYPHS) {
		const oldestKey = font.glyphCache.keys().next().value as string
		canvas = font.glyphCache.get(oldestKey)!
		font.glyphCache.delete(oldestKey)
	} else {
		canvas = document.createElement('canvas')
		canvas.width = font.width
		canvas.height = font.height
	}
	const glyphCtx = canvas.getContext('2d', { willReadFrequently: false })!

	// A recycled canvas still holds the evicted glyph; a translucent background (rgba,
	// 'transparent') would blend with it instead of replacing it, so clear first.
	glyphCtx.clearRect(0, 0, font.width, font.height)
	glyphCtx.fillStyle = bgColor
	glyphCtx.fillRect(0, 0, font.width, font.height)

	const glyph = font.glyphs[charCode] || font.glyphs[0]
	glyphCtx.fillStyle = fgColor
	for (let row = 0; row < font.height; row++) {
		const byte = glyph[row]
		for (let col = 0; col < font.width; col++) {
			const bit = 7 - col
			if (byte & (1 << bit)) {
				glyphCtx.fillRect(col, row, 1, 1)
			}
		}
	}

	font.glyphCache.set(cacheKey, canvas)
	ctx.drawImage(canvas, x, y)
}

/**
 * Render text string using bitmap font
 */
export function renderText(
	ctx: CanvasRenderingContext2D,
	font: BitmapFont,
	text: string,
	x: number,
	y: number,
	fgColor: string,
	bgColor: string
): number {
	let xPos = x
	for (let i = 0; i < text.length; i++) {
		const charCode = text.charCodeAt(i)
		renderGlyph(ctx, font, charCode, xPos, y, fgColor, bgColor)
		xPos += font.width
	}
	return xPos - x // return width rendered
}

