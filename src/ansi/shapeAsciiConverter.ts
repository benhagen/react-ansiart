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
	/** Use full RGB colors instead of ANSI palette (default: false). Outputs CSS rgb() strings. */
	rgbColor?: boolean
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
					const q = 8
					const r = Math.round(avgR / q) * q
					const g = Math.round(avgG / q) * q
					const b = Math.round(avgB / q) * q
					fg = `rgb(${r},${g},${b})`
					if (monoBackground) {
						bg = 'rgb(0,0,0)'
					} else {
						const scale = brightness < 0.3 ? 0.15 : 0.3
						const br = Math.round(avgR * scale / q) * q
						const bg2 = Math.round(avgG * scale / q) * q
						const bb = Math.round(avgB * scale / q) * q
						bg = `rgb(${br},${bg2},${bb})`
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
