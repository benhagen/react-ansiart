/**
 * Shape-based ASCII rendering converter.
 *
 * Uses 6D shape vectors to match image regions to characters based on
 * spatial luminance distribution rather than simple brightness.
 * Based on https://alexharri.com/blog/ascii-rendering
 */

import type { BitmapFont } from '../font/bitmapFont'
import type { AnsiCell, AnsiScreen } from './types'
import type { FrameConverter, FrameData } from '../types/types'
import { getPalette, rgbToPaletteColor, ANSI_COLORS_RGB, type PaletteMode } from '../utils/rgbToAnsi'

// ── Shape vector constants ──────────────────────────────────────

const K = 6
const TOTAL_SAMPLES = K + 10 // 6 internal + 10 external

/** 6 internal sampling points (normalized 0–1 within each cell) */
const S_PTS = [
	{ x: 0.3, y: 0.23 },
	{ x: 0.7, y: 0.18 },
	{ x: 0.3, y: 0.5 },
	{ x: 0.7, y: 0.5 },
	{ x: 0.3, y: 0.82 },
	{ x: 0.7, y: 0.77 },
]

/** 10 external sampling points for directional contrast enhancement */
const E_PTS: Array<{ x: number; y: number; a: number[] }> = [
	{ x: 0.07, y: -0.21, a: [0, 1] },
	{ x: 0.93, y: -0.21, a: [0, 1] },
	{ x: -0.25, y: 0.07, a: [0, 2] },
	{ x: 1.25, y: 0.07, a: [1, 3] },
	{ x: -0.25, y: 0.5, a: [0, 2, 4] },
	{ x: 1.25, y: 0.5, a: [1, 3, 5] },
	{ x: -0.25, y: 0.93, a: [2, 4] },
	{ x: 1.25, y: 0.93, a: [3, 5] },
	{ x: 0.07, y: 1.21, a: [4, 5] },
	{ x: 0.93, y: 1.21, a: [4, 5] },
]

/** Reverse mapping: internal[i] → list of external indices that affect it */
const E_AFF: number[][] = Array.from({ length: K }, () => [])
for (let e = 0; e < E_PTS.length; e++) {
	for (const i of E_PTS[e].a) E_AFF[i].push(e)
}

const Q_BITS = 5
const Q_RANGE = 1 << Q_BITS
const Q_MAX = Q_RANGE - 1

const DEFAULT_CONTRAST_EXP = 2.2

// ── Truecolour quantization ─────────────────────────────────────

/**
 * Channel values the glyph renderer snaps truecolour to: 32 evenly spaced levels,
 * endpoints included (see `normalizeGlyphColor` in ../font/bitmapFont).
 *
 * Every emitted colour is re-snapped to this ladder before it is drawn, so a converter
 * ladder built from other values gets quantized twice and drifts by up to 3/255. Picking
 * output levels *from* this array keeps them fixed points of the renderer.
 */
const ENGINE_LADDER = (() => {
	const levels = 32
	const values = new Uint8Array(levels)
	for (let i = 0; i < levels; i++) values[i] = Math.round((i * 255) / (levels - 1))
	return values
})()

/**
 * Default levels per channel emitted by `rgbColor` mode.
 *
 * Truecolour output feeds the display engine's per-cell diff and the bitmap font's
 * glyph cache, both of which key on the exact colour string. Unquantized (or finely
 * quantized) colour makes a continuously shaded animation change every lit cell every
 * frame and mint a new cache key per cell, which collapses the frame rate — measured
 * at 1.1fps against 31.5fps for the same scene in palette mode.
 *
 * Eight levels per channel keeps a slowly-shading cell on the *same* colour string
 * across frames until its value crosses a step, which both calms the dirty-cell diff
 * and bounds the distinct-colour set (<=512, so char x colour combinations stay inside
 * the glyph cache). See {@link ShapeConverterOptions.rgbLevels} to trade that back for
 * colour depth on static conversions.
 */
const DEFAULT_RGB_LEVELS = 8

const MIN_RGB_LEVELS = 2
const MAX_RGB_LEVELS = 64

/**
 * Nearest-value lookup for 0..255 onto a ladder of `levels` entries picked from
 * {@link ENGINE_LADDER} at even index spacing, endpoints included.
 *
 * At the default of 8 levels the ladder is 0, 33, 74, 107, 148, 181, 222, 255 — steps
 * alternate between 33 and 41 (the underlying 32-level grid is not divisible by 7), so
 * a channel moves by at most ~21/255. Rounding to the *nearest* entry rather than
 * truncating is what caps the error at half a step.
 *
 * Levels above 32 collapse onto the engine ladder: duplicate picks are dropped, so the
 * output never has more than 32 distinct values per channel.
 */
function buildRgbQuantLut(levels: number): Uint8Array {
	const count = Math.round(Math.min(MAX_RGB_LEVELS, Math.max(MIN_RGB_LEVELS, levels)))
	const ladder: number[] = []
	for (let i = 0; i < count; i++) {
		const value = ENGINE_LADDER[Math.round((i * (ENGINE_LADDER.length - 1)) / (count - 1))]
		if (ladder[ladder.length - 1] !== value) ladder.push(value)
	}

	const lut = new Uint8Array(256)
	for (let v = 0; v < 256; v++) {
		let best = ladder[0]
		let bestDist = Math.abs(v - best)
		for (let i = 1; i < ladder.length; i++) {
			const dist = Math.abs(v - ladder[i])
			if (dist < bestDist) {
				bestDist = dist
				best = ladder[i]
			}
		}
		lut[v] = best
	}
	return lut
}

/** One LUT per distinct level count, shared by every converter. At most MAX_RGB_LEVELS entries. */
const rgbQuantLuts = new Map<number, Uint8Array>()

function getRgbQuantLut(levels: number): Uint8Array {
	const count = Math.round(Math.min(MAX_RGB_LEVELS, Math.max(MIN_RGB_LEVELS, levels)))
	let lut = rgbQuantLuts.get(count)
	if (!lut) {
		lut = buildRgbQuantLut(count)
		rgbQuantLuts.set(count, lut)
	}
	return lut
}

/** Quantize one sampled channel (0–255, possibly fractional) onto the given ladder. */
function quantizeChannel(lut: Uint8Array, v: number): number {
	const i = v <= 0 ? 0 : v >= 255 ? 255 : (v + 0.5) | 0
	return lut[i]
}

/**
 * Upper bound on interned colour strings.
 *
 * The map only ever sees quantized values, so a converter at the default 8 levels can
 * contribute at most 512 entries and the ladder caps any converter at 32^3. The cap is
 * a backstop for many converters at many level counts; past it strings are rebuilt per
 * call (correct, just not interned).
 */
const MAX_INTERNED_COLORS = 32768

/**
 * Interned `rgb()` strings for quantized colours.
 *
 * Returning the same string instance for a repeated colour lets the engine's per-cell
 * diff settle on a reference comparison instead of comparing characters.
 */
const rgbStringCache = new Map<number, string>()

/** Interned black, used for every cell in mono-background truecolour mode. */
const BLACK_RGB = 'rgb(0,0,0)'

function quantizedRgbString(r: number, g: number, b: number): string {
	const key = (r << 16) | (g << 8) | b
	const cached = rgbStringCache.get(key)
	if (cached !== undefined) return cached

	const s = `rgb(${r},${g},${b})`
	if (rgbStringCache.size < MAX_INTERNED_COLORS) {
		rgbStringCache.set(key, s)
	}
	return s
}

// ── Character set presets ───────────────────────────────────────

/** Printable ASCII characters */
const PRESET_ASCII =
	' !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

/** ASCII + CP437 block/shade elements — best for VGA bitmap font rendering */
const PRESET_CP437 = PRESET_ASCII
	+ '\u2591\u2592\u2593\u2588'  // ░▒▓█
	+ '\u2584\u258C\u2590\u2580'  // ▄▌▐▀

/** Exported character set presets */
export const SHAPE_CHAR_PRESETS = {
	ascii: PRESET_ASCII,
	cp437: PRESET_CP437,
	minimal: ' .:-=+*#%@',
	blocks: ' \u2591\u2592\u2593\u2588',
} as const

export type ShapeCharPreset = keyof typeof SHAPE_CHAR_PRESETS

// ── Sampling functions ──────────────────────────────────────────

/**
 * Average ink coverage within a circle from bitmap font glyph data.
 * Glyph rows are bit-packed: 1 byte per row, MSB = leftmost pixel.
 * Returns 0–1.
 */
function sampleCircleBitmap(
	glyph: Uint8Array,
	fontWidth: number,
	fontHeight: number,
	cx: number,
	cy: number,
	r: number,
): number {
	const r2 = r * r
	const x0 = Math.max(0, (cx - r) | 0)
	const y0 = Math.max(0, (cy - r) | 0)
	const x1 = Math.min(fontWidth - 1, (cx + r + 1) | 0)
	const y1 = Math.min(fontHeight - 1, (cy + r + 1) | 0)
	let sum = 0
	let n = 0
	for (let y = y0; y <= y1; y++) {
		const dy2 = (y - cy) * (y - cy)
		const byte = glyph[y]
		for (let x = x0; x <= x1; x++) {
			if ((x - cx) * (x - cx) + dy2 <= r2) {
				sum += (byte >> (7 - x)) & 1
				n++
			}
		}
	}
	return n > 0 ? sum / n : 0
}

/**
 * Compute a per-pixel luminance plane for the whole frame, once. Cells have
 * overlapping bounding boxes (~2.25x overlap at typical cell sizes), so
 * precomputing luminance here avoids recomputing the same weighted sum for
 * the same pixel multiple times per frame. Uses the exact same formula/order
 * of operations as before, so results are bit-for-bit identical.
 */
function computeLuminancePlane(buf: Uint8Array, w: number, h: number, out: Float64Array): void {
	const n = w * h
	for (let i = 0, i3 = 0; i < n; i++, i3 += 3) {
		out[i] = 0.2126 * buf[i3] + 0.7152 * buf[i3 + 1] + 0.0722 * buf[i3 + 2]
	}
}

/**
 * Batch-sample all 16 points (6 internal + 10 external) for a cell in one pass.
 * Computes a single bounding box that encloses all sample circles and iterates
 * pixels once, accumulating luminance (from the precomputed plane) for each
 * circle a pixel falls within.
 *
 * `ptX`/`ptY`/`sums`/`counts` are caller-owned scratch buffers (size
 * TOTAL_SAMPLES) reused across cells/frames to avoid a per-cell allocation.
 */
function sampleCellPoints(
	lum: Float64Array,
	w: number,
	h: number,
	cellX: number,
	cellY: number,
	cellW: number,
	cellH: number,
	sampleR: number,
	internal: Float32Array,
	external: Float32Array,
	ptX: Float64Array,
	ptY: Float64Array,
	sums: Float64Array,
	counts: Uint16Array,
): void {
	const r2 = sampleR * sampleR

	// Pre-compute absolute positions of all 16 sample points
	for (let s = 0; s < K; s++) {
		ptX[s] = cellX + S_PTS[s].x * cellW
		ptY[s] = cellY + S_PTS[s].y * cellH
	}
	for (let e = 0; e < 10; e++) {
		ptX[K + e] = cellX + E_PTS[e].x * cellW
		ptY[K + e] = cellY + E_PTS[e].y * cellH
	}

	// Compute outer bounding box enclosing all circles
	let outerX0 = ptX[0]
	let outerY0 = ptY[0]
	let outerX1 = ptX[0]
	let outerY1 = ptY[0]
	for (let i = 1; i < TOTAL_SAMPLES; i++) {
		if (ptX[i] < outerX0) outerX0 = ptX[i]
		if (ptY[i] < outerY0) outerY0 = ptY[i]
		if (ptX[i] > outerX1) outerX1 = ptX[i]
		if (ptY[i] > outerY1) outerY1 = ptY[i]
	}
	const x0 = Math.max(0, (outerX0 - sampleR) | 0)
	const y0 = Math.max(0, (outerY0 - sampleR) | 0)
	const x1 = Math.min(w - 1, (outerX1 + sampleR + 1) | 0)
	const y1 = Math.min(h - 1, (outerY1 + sampleR + 1) | 0)

	// Reset accumulators (reused scratch buffers)
	sums.fill(0)
	counts.fill(0)

	for (let y = y0; y <= y1; y++) {
		const rowOff = y * w
		for (let x = x0; x <= x1; x++) {
			const l = lum[rowOff + x]

			for (let p = 0; p < TOTAL_SAMPLES; p++) {
				const dx = x - ptX[p]
				const dy = y - ptY[p]
				if (dx * dx + dy * dy <= r2) {
					sums[p] += l
					counts[p]++
				}
			}
		}
	}

	for (let s = 0; s < K; s++) {
		internal[s] = counts[s] > 0 ? sums[s] / (counts[s] * 255) : 0
	}
	for (let e = 0; e < 10; e++) {
		external[e] = counts[K + e] > 0 ? sums[K + e] / (counts[K + e] * 255) : 0
	}
}

/**
 * Sample 4 strategic points within a cell for fast color averaging.
 * Returns average R, G, B (0-255).
 */
function sampleCellColor(
	buf: Uint8Array,
	w: number,
	h: number,
	cellX: number,
	cellY: number,
	cellW: number,
	cellH: number,
): [number, number, number] {
	const cx = cellX + cellW * 0.5
	const cy = cellY + cellH * 0.5
	const dx = cellW * 0.25
	const dy = cellH * 0.25

	const x0 = cx - dx
	const x1 = cx + dx
	const y0 = cy - dy
	const y1 = cy + dy

	let sumR = 0
	let sumG = 0
	let sumB = 0

	// 4 strategic points, same order as before: TL, TR, BL, BR — inlined to
	// avoid allocating an array-of-points per cell (this runs per cell per frame).
	let px = Math.min(Math.max(Math.floor(x0), 0), w - 1)
	let py = Math.min(Math.max(Math.floor(y0), 0), h - 1)
	let i = (py * w + px) * 3
	sumR += buf[i]
	sumG += buf[i + 1]
	sumB += buf[i + 2]

	px = Math.min(Math.max(Math.floor(x1), 0), w - 1)
	py = Math.min(Math.max(Math.floor(y0), 0), h - 1)
	i = (py * w + px) * 3
	sumR += buf[i]
	sumG += buf[i + 1]
	sumB += buf[i + 2]

	px = Math.min(Math.max(Math.floor(x0), 0), w - 1)
	py = Math.min(Math.max(Math.floor(y1), 0), h - 1)
	i = (py * w + px) * 3
	sumR += buf[i]
	sumG += buf[i + 1]
	sumB += buf[i + 2]

	px = Math.min(Math.max(Math.floor(x1), 0), w - 1)
	py = Math.min(Math.max(Math.floor(y1), 0), h - 1)
	i = (py * w + px) * 3
	sumR += buf[i]
	sumG += buf[i + 1]
	sumB += buf[i + 2]

	return [sumR / 4, sumG / 4, sumB / 4]
}

// ── Character vector building ───────────────────────────────────

/**
 * Build 6D shape vectors for characters from bitmap font glyph data.
 */
function buildCharVecs(
	font: BitmapFont,
	chars: string[],
): { chars: string[]; vecs: Float32Array[] } {
	const vecs: Float32Array[] = []
	const validChars: string[] = []
	let gmax = 0
	const sampleR = Math.max(1, Math.min(font.width, font.height) * 0.28)

	for (const char of chars) {
		const charCode = char.charCodeAt(0)
		const glyph = font.glyphs[charCode]
		if (!glyph) continue

		const v = new Float32Array(K)
		for (let s = 0; s < K; s++) {
			v[s] = sampleCircleBitmap(
				glyph,
				font.width,
				font.height,
				S_PTS[s].x * font.width,
				S_PTS[s].y * font.height,
				sampleR,
			)
			if (v[s] > gmax) gmax = v[s]
		}
		validChars.push(char)
		vecs.push(v)
	}

	if (gmax > 0) {
		for (const v of vecs) {
			for (let s = 0; s < K; s++) v[s] /= gmax
		}
	}

	return { chars: validChars, vecs }
}

// ── Diversity sorting & lookup ──────────────────────────────────

/**
 * Sort characters by visual diversity using greedy farthest-first traversal.
 * The first N entries are always the most visually distinct N characters.
 */
function sortByDiversity(vecs: Float32Array[]): number[] {
	const n = vecs.length
	const order: number[] = [0]
	const used = new Set([0])
	const minDists = new Float32Array(n).fill(Infinity)

	for (let i = 1; i < n; i++) {
		let d = 0
		for (let j = 0; j < K; j++) {
			const t = vecs[i][j] - vecs[0][j]
			d += t * t
		}
		minDists[i] = d
	}

	while (order.length < n) {
		let bestIdx = -1
		let bestDist = -1
		for (let i = 0; i < n; i++) {
			if (!used.has(i) && minDists[i] > bestDist) {
				bestDist = minDists[i]
				bestIdx = i
			}
		}
		if (bestIdx < 0) break
		order.push(bestIdx)
		used.add(bestIdx)

		for (let i = 0; i < n; i++) {
			if (!used.has(i)) {
				let d = 0
				for (let j = 0; j < K; j++) {
					const t = vecs[i][j] - vecs[bestIdx][j]
					d += t * t
				}
				if (d < minDists[i]) minDists[i] = d
			}
		}
	}

	return order
}

/** Quantize 6D float vector to integer cache key (30 bits) */
function qKey(v: Float32Array): number {
	let k = 0
	for (let i = 0; i < K; i++) {
		k = k * Q_RANGE + Math.min(Q_MAX, Math.max(0, (v[i] * Q_RANGE) | 0))
	}
	return k
}

// qKey has a 32^6 (~1 billion) key space. Under continuously-varying input
// (e.g. a video-like feed) a plain unbounded Map would grow forever, so cache
// insertion stops past this cap — same "stop inserting" bounded-cache pattern
// used by the bitmap font's glyph cache. Lookups still work past the cap;
// they just fall back to a (still fast, distance is only over `activeIndices`)
// linear scan instead of a memoized hit.
const LOOKUP_CACHE_MAX = 65536

/** Find nearest character by Euclidean distance in 6D space (cached) */
function findNearest(
	v: Float32Array,
	vecs: Float32Array[],
	activeIndices: number[],
	cache: Map<number, number>,
): number {
	const key = qKey(v)
	const cached = cache.get(key)
	if (cached !== undefined) return cached

	let bestIdx = activeIndices[0]
	let bestDist = Infinity
	for (const idx of activeIndices) {
		let d = 0
		for (let j = 0; j < K; j++) {
			const t = v[j] - vecs[idx][j]
			d += t * t
		}
		if (d < bestDist) {
			bestDist = d
			bestIdx = idx
		}
	}

	if (cache.size < LOOKUP_CACHE_MAX) {
		cache.set(key, bestIdx)
	}
	return bestIdx
}

// ── Brightness helper ───────────────────────────────────────────

function getBrightness(r: number, g: number, b: number): number {
	return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

// ── Public API ──────────────────────────────────────────────────

export interface ShapeConverterOptions {
	/** BitmapFont to compute shape vectors from (required). */
	bitmapFont: BitmapFont
	/** Character set preset (default: 'cp437'). Ignored when `chars` is provided. */
	charSet?: ShapeCharPreset
	/** Characters to use for matching. Overrides `charSet` when provided. */
	chars?: string | string[]
	/** Number of characters from the diversity-sorted set to use (default: all). Lower = faster but less accurate. */
	rampLength?: number
	/** Contrast enhancement exponent (default: 2.2). Higher = sharper edges. Set to 1 to disable. */
	contrastExponent?: number
	/** Use only foreground characters on a black background (default: false). Gives a pure ASCII art look. */
	monoBackground?: boolean
	/**
	 * Use full RGB colors instead of the ANSI palette (default: false). Outputs CSS rgb() strings.
	 *
	 * Emitted channel values are quantized (see `rgbLevels`) — at the default of 8 levels each
	 * channel lands within ~21/255 of the sampled colour. Without this the renderer mints a
	 * distinct glyph-cache key per cell per frame and repaints every lit cell every frame,
	 * which drops a continuously shaded animation from ~31fps to ~1fps.
	 */
	rgbColor?: boolean
	/**
	 * Levels per channel for `rgbColor` output (default: 8, clamped to 2–64). Ignored unless
	 * `rgbColor` is set.
	 *
	 * Levels are picked from the 32-value ladder the glyph renderer snaps truecolour to, so
	 * emitted colours are drawn exactly as given; the default 8 are 0, 33, 74, 107, 148, 181,
	 * 222, 255. Values above 32 are capped by that ladder and yield at most 32 distinct
	 * values per channel.
	 *
	 * This is a direct animation-performance trade: finer levels mean a shading cell changes
	 * colour more often, so more cells repaint per frame and more glyph-cache entries are
	 * minted. Measured on a rotating 3D scene at 120x40 in a software rasteriser: 8 levels
	 * ~24fps, 16 levels ~9–14fps, 32 levels ~1–4fps (palette mode is ~32fps). Raise it for
	 * static or single-frame conversions, leave it alone for animation.
	 */
	rgbLevels?: number
}

/**
 * Create a shape-based ASCII frame converter.
 *
 * Uses 6D shape vectors to match image regions to characters based on
 * spatial luminance distribution. Produces much more detailed ASCII art
 * than simple brightness-to-block-char mapping.
 *
 * The converter pre-computes shape vectors from the provided bitmap font,
 * then on each frame samples 6 strategic points within each cell and finds
 * the closest matching character via Euclidean distance in 6D space.
 *
 * @example
 * ```tsx
 * import { createShapeConverter, AnsiVirtualDisplay } from 'react-ansiart'
 *
 * const converter = createShapeConverter({ bitmapFont: myFont })
 *
 * <AnsiVirtualDisplay
 *   frameGenerator={{ generator: myPixelGen, converter }}
 *   columns={80}
 *   rows={25}
 *   bitmapFontUrl="/fonts/Bm437_IBM_VGA_8x16.FON"
 *   fps={30}
 * />
 * ```
 */
export function createShapeConverter(options: ShapeConverterOptions): FrameConverter {
	const contrastExp = options.contrastExponent ?? DEFAULT_CONTRAST_EXP
	const monoBackground = options.monoBackground ?? false
	const rgbColor = options.rgbColor ?? false
	const rgbLut = getRgbQuantLut(options.rgbLevels ?? DEFAULT_RGB_LEVELS)

	// Resolve character set: explicit chars > charSet preset > default cp437
	const charArray: string[] = options.chars
		? typeof options.chars === 'string'
			? [...options.chars]
			: options.chars
		: [...SHAPE_CHAR_PRESETS[options.charSet ?? 'cp437']]

	// Build shape vectors from bitmap font
	const { chars, vecs } = buildCharVecs(options.bitmapFont, charArray)
	const diversityOrder = sortByDiversity(vecs)
	const rampLen = Math.max(2, Math.min(options.rampLength ?? chars.length, chars.length))
	const activeIndices = diversityOrder.slice(0, rampLen)
	const lookupCache = new Map<number, number>()

	// Reusable per-frame vectors
	const inputVec = new Float32Array(K)
	const extVals = new Float32Array(10)

	// Scratch buffers for sampleCellPoints, reused across every cell/frame
	// instead of allocating two Float64Array(TOTAL_SAMPLES), a Uint16Array(16)
	// per cell (~10K allocations/frame at 80x25).
	const ptXScratch = new Float64Array(TOTAL_SAMPLES)
	const ptYScratch = new Float64Array(TOTAL_SAMPLES)
	const sumsScratch = new Float64Array(TOTAL_SAMPLES)
	const countsScratch = new Uint16Array(TOTAL_SAMPLES)

	// Per-frame luminance plane, reused/resized as needed rather than
	// recomputed per pixel per cell (cells overlap, so pixels get revisited).
	let lumPlane = new Float64Array(0)

	const converter: FrameConverter = (
		frame: FrameData,
		columns: number,
		rows: number,
		palette: PaletteMode = 'ansi16',
	): AnsiScreen => {
		const paletteColors = getPalette(palette)
		const lines: AnsiCell[][] = []

		const pixelsPerCellX = frame.width / columns
		const pixelsPerCellY = frame.height / rows
		const sampleR = Math.max(1, Math.min(pixelsPerCellX, pixelsPerCellY) * 0.2)

		// Precompute the luminance plane once per frame (see computeLuminancePlane).
		const pixelCount = frame.width * frame.height
		if (lumPlane.length !== pixelCount) {
			lumPlane = new Float64Array(pixelCount)
		}
		computeLuminancePlane(frame.pixels, frame.width, frame.height, lumPlane)

		for (let row = 0; row < rows; row++) {
			const line: AnsiCell[] = []

			for (let col = 0; col < columns; col++) {
				const cellX = col * pixelsPerCellX
				const cellY = row * pixelsPerCellY

				// ── Batch sample all 16 points in one pass ──
				sampleCellPoints(
					lumPlane, frame.width, frame.height,
					cellX, cellY, pixelsPerCellX, pixelsPerCellY,
					sampleR, inputVec, extVals,
					ptXScratch, ptYScratch, sumsScratch, countsScratch,
				)

				// ── Directional contrast enhancement ──
				for (let s = 0; s < K; s++) {
					let maxExt = 0
					for (const ei of E_AFF[s]) {
						if (extVals[ei] > maxExt) maxExt = extVals[ei]
					}
					if (maxExt > 0.01) {
						const norm = Math.min(1, inputVec[s] / maxExt)
						inputVec[s] = norm ** contrastExp * maxExt
					}
				}

				// ── Find nearest character ──
				const charIdx = findNearest(inputVec, vecs, activeIndices, lookupCache)
				const ch = chars[charIdx]

				// ── Color: sample 4 strategic points instead of averaging all pixels ──
				const [avgR, avgG, avgB] = sampleCellColor(
					frame.pixels, frame.width, frame.height,
					cellX, cellY, pixelsPerCellX, pixelsPerCellY,
				)
				const brightness = getBrightness(avgR, avgG, avgB)

				let fg: number | string
				let bg: number | string

				if (rgbColor) {
					// Quantized so a slowly-shading cell keeps the same colour string between
					// frames (see DEFAULT_RGB_LEVELS) — this is what keeps truecolour playable.
					const qR = quantizeChannel(rgbLut, avgR)
					const qG = quantizeChannel(rgbLut, avgG)
					const qB = quantizeChannel(rgbLut, avgB)
					fg = quantizedRgbString(qR, qG, qB)
					if (monoBackground) {
						bg = BLACK_RGB
					} else {
						// Derived from the quantized foreground rather than the raw sample, so each
						// foreground colour always pairs with the same background. The glyph cache
						// keys on char + fg + bg, so pairing one fg with several near-identical bgs
						// would multiply the number of cached entries (and dirty cells) for no
						// visible difference.
						const scale = getBrightness(qR, qG, qB) < 0.3 ? 0.15 : 0.3
						bg = quantizedRgbString(
							quantizeChannel(rgbLut, qR * scale),
							quantizeChannel(rgbLut, qG * scale),
							quantizeChannel(rgbLut, qB * scale),
						)
					}
				} else if (monoBackground) {
					bg = 0
					if (palette === 'ansi16') {
						const colorIndex = rgbToPaletteColor(avgR, avgG, avgB, paletteColors)
						fg = brightness > 0.7 && colorIndex < 8 ? colorIndex + 8 : colorIndex
					} else {
						const paletteColorIndex = rgbToPaletteColor(avgR, avgG, avgB, paletteColors)
						const [paletteR, paletteG, paletteB] = paletteColors[paletteColorIndex]
						const ansiMatch = rgbToPaletteColor(paletteR, paletteG, paletteB, ANSI_COLORS_RGB)
						const paletteBrightness = getBrightness(paletteR, paletteG, paletteB)
						fg = paletteBrightness > 0.6 && ansiMatch < 8 ? ansiMatch + 8 : ansiMatch
					}
				} else if (palette === 'ansi16') {
					const colorIndex = rgbToPaletteColor(avgR, avgG, avgB, paletteColors)
					bg = brightness < 0.3 ? 0 : 8
					fg = brightness > 0.7 && colorIndex < 8 ? colorIndex + 8 : colorIndex
				} else {
					const paletteColorIndex = rgbToPaletteColor(avgR, avgG, avgB, paletteColors)
					const [paletteR, paletteG, paletteB] = paletteColors[paletteColorIndex]
					const ansiMatch = rgbToPaletteColor(paletteR, paletteG, paletteB, ANSI_COLORS_RGB)
					bg = brightness < 0.3 ? 0 : 8
					const paletteBrightness = getBrightness(paletteR, paletteG, paletteB)
					fg = paletteBrightness > 0.6 && ansiMatch < 8 ? ansiMatch + 8 : ansiMatch
				}

				line.push({ ch, fg, bg, bold: false })
			}

			lines.push(line)
		}

		return { lines, columns }
	}

	return converter
}
