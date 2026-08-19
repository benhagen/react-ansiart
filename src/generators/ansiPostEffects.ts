import type { AnsiCell, AnsiScreen } from '../ansi/types'
import type { CharacterFrameGenerator, CharacterFrameGeneratorWithMetadata } from '../types/types'
import { ANSI_COLORS_RGB } from '../utils/rgbToAnsi'

/**
 * Post-effect composition layer.
 *
 * A post effect is a screen-space transform applied to the output of any
 * {@link CharacterFrameGenerator}: it reads an {@link AnsiScreen} and returns a new one.
 * Effects are composed onto a generator with {@link composeAnsiEffects}, which returns a
 * function with the exact same `(frame, columns, rows) => AnsiScreen` contract, so the
 * result drops straight into `AnsiVirtualDisplay` / `AnsiArt`.
 *
 * ## Aliasing contract (important)
 *
 * Some generators (the progressive ANSI parser in particular) return screens whose row
 * arrays alias retained internal state. A post effect therefore MUST NOT write into the
 * input screen's rows or cells. Every effect here builds its output into buffers it owns:
 *
 * - The returned object is a fresh `{ lines, columns, sauce? }` literal each call.
 * - `lines` and the row arrays inside it are owned by the effect instance and REUSED
 *   across frames.
 * - Individual cells are either effect-owned mutable cell objects (also reused across
 *   frames) or, for cells the effect does not change, REFERENCES to the input screen's
 *   cells. Passing untransformed cells by reference is safe because the engine
 *   value-copies cells when it renders, and because effects never mutate a cell they do
 *   not own.
 *
 * Consequence for callers: **the screen returned by an effect (and by a composed
 * generator) is only valid until the next call to that same effect instance.** This
 * matches how the engine consumes frames — it reads each frame once, copying values out.
 * Hold on to a frame across calls only after deep-copying it. Each effect instance owns a
 * single output buffer, so the same instance must not appear twice in one chain nor be
 * shared across two simultaneously-live composed generators.
 *
 * ## Performance notes
 *
 * - No per-frame row/cell allocation in the steady state (buffers grow once, then reuse).
 * - Color math is cached in bounded maps keyed by packed RGB + quantized intensity level,
 *   so no per-cell string parsing or per-cell string building happens after warm-up.
 * - Everything is deterministic in `(frame, seed)` — no `Math.random`, no wall clock.
 * - Headless-safe: no DOM, no canvas, zero dependencies.
 */

/**
 * A screen-space transform applied after a frame generator has produced a screen.
 *
 * Implementations must treat `screen` as read-only (see the aliasing contract above) and
 * must be a pure function of `(screen, frame)` plus their own immutable options.
 */
export type AnsiPostEffect = (
	screen: AnsiScreen,
	frame: number,
	columns: number,
	rows: number
) => AnsiScreen

// ---------------------------------------------------------------------------
// Small numeric helpers
// ---------------------------------------------------------------------------

function clampNumber(v: number, min: number, max: number): number {
	if (!Number.isFinite(v)) return min
	return v < min ? min : v > max ? max : v
}

function clampInt(v: number, min: number, max: number): number {
	if (!Number.isFinite(v)) return min
	const n = Math.floor(v)
	return n < min ? min : n > max ? max : n
}

function clamp01(v: number): number {
	if (!Number.isFinite(v)) return 0
	return v < 0 ? 0 : v > 1 ? 1 : v
}

function finiteOr(v: number | undefined, fallback: number): number {
	return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/** Fast deterministic 32-bit hash of a 2D coordinate + seed (same mix as the datamosh generator). */
function hash2D(x: number, y: number, seed: number): number {
	let h = (x * 0x9e3779b1) ^ (y * 0x85ebca6b) ^ seed
	h ^= h >>> 16
	h = Math.imul(h, 0x7feb352d)
	h ^= h >>> 15
	h = Math.imul(h, 0x846ca68b)
	h ^= h >>> 16
	return h >>> 0
}

// ---------------------------------------------------------------------------
// Bounded color caches
// ---------------------------------------------------------------------------

/** Cap for the shared CSS-color parse cache. Once full it stops inserting (still correct, just uncached). */
const MAX_PARSED_COLORS = 4096

/** Cap for each per-effect transformed-color cache. Same stop-insert policy. */
const MAX_TRANSFORMED_COLORS = 4096

/**
 * Shared `css string -> packed 0xRRGGBB` cache (`-1` marks "not parseable, pass through").
 * Shared across effect instances because parsing is a pure function of the string, and
 * because generators tend to emit the same handful of color strings for every cell.
 */
const parsedColorCache = new Map<string, number>()

const HEX3_RE = /^[0-9a-fA-F]{3}$/
const HEX6_RE = /^[0-9a-fA-F]{6}$/
const RGB_RE = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/

function packRgb(r: number, g: number, b: number): number {
	return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff)
}

function toChannel(v: number): number {
	const n = Math.round(v)
	return n < 0 ? 0 : n > 255 ? 255 : n
}

function parsePackedColorUncached(color: string): number {
	const s = color.trim()
	if (s.length === 0) return -1

	if (s.charCodeAt(0) === 35 /* '#' */) {
		const hex = s.slice(1)
		if (HEX3_RE.test(hex)) {
			return packRgb(
				parseInt(hex[0] + hex[0], 16),
				parseInt(hex[1] + hex[1], 16),
				parseInt(hex[2] + hex[2], 16)
			)
		}
		if (HEX6_RE.test(hex)) {
			return packRgb(
				parseInt(hex.slice(0, 2), 16),
				parseInt(hex.slice(2, 4), 16),
				parseInt(hex.slice(4, 6), 16)
			)
		}
		return -1
	}

	const match = RGB_RE.exec(s)
	if (!match) return -1
	return packRgb(
		toChannel(parseInt(match[1], 10)),
		toChannel(parseInt(match[2], 10)),
		toChannel(parseInt(match[3], 10))
	)
}

/**
 * Packed 0xRRGGBB for a cell color of either kind: ANSI palette indices (0-15) go through
 * the EGA table, strings go through {@link parsePackedColor}. `-1` when unresolvable.
 */
function packedCellColor(color: number | string): number {
	if (typeof color === 'number') {
		if (!Number.isInteger(color) || color < 0 || color >= ANSI_COLORS_RGB.length) return -1
		const [r, g, b] = ANSI_COLORS_RGB[color]
		return packRgb(r, g, b)
	}
	return parsePackedColor(color)
}

/**
 * Parse a CSS color string to packed 0xRRGGBB, or `-1` when it is not one of the forms
 * this module understands (`#rgb`, `#rrggbb`, `rgb(...)`, `rgba(...)`). Bounded cache.
 */
function parsePackedColor(color: string): number {
	const cached = parsedColorCache.get(color)
	if (cached !== undefined) return cached
	const packed = parsePackedColorUncached(color)
	if (parsedColorCache.size < MAX_PARSED_COLORS) parsedColorCache.set(color, packed)
	return packed
}

/** Transform receiving unpacked channels + a quantized intensity level, returning packed RGB. */
type PackedColorTransform = (r: number, g: number, b: number, level: number) => number

/**
 * Applies a color transform, cached by `(packed rgb, level)`.
 *
 * Numeric colors (ANSI palette indices) and unparseable strings are returned untouched —
 * an effect must never invent a color it cannot compute.
 */
type ColorCache = (color: number | string, level: number) => number | string

function createColorCache(levels: number, transform: PackedColorTransform): ColorCache {
	const levelCount = Math.max(1, levels)
	const cache = new Map<number, string>()

	return (color, level) => {
		if (typeof color !== 'string') return color
		const packed = parsePackedColor(color)
		if (packed < 0) return color

		// packed is 24 bits and levelCount is tiny, so this stays a small safe integer.
		const key = packed * levelCount + level
		const hit = cache.get(key)
		if (hit !== undefined) return hit

		const out = transform((packed >>> 16) & 0xff, (packed >>> 8) & 0xff, packed & 0xff, level)
		const str = `rgb(${(out >>> 16) & 0xff},${(out >>> 8) & 0xff},${out & 0xff})`
		if (cache.size < MAX_TRANSFORMED_COLORS) cache.set(key, str)
		return str
	}
}

function brightenPacked(r: number, g: number, b: number, amount: number): number {
	return packRgb(
		toChannel(r + (255 - r) * amount),
		toChannel(g + (255 - g) * amount),
		toChannel(b + (255 - b) * amount)
	)
}

function dimPacked(r: number, g: number, b: number, amount: number): number {
	const k = 1 - amount
	return packRgb(toChannel(r * k), toChannel(g * k), toChannel(b * k))
}

function desaturateAndDarkenPacked(
	r: number,
	g: number,
	b: number,
	desaturation: number,
	darken: number
): number {
	const gray = r * 0.299 + g * 0.587 + b * 0.114
	const k = 1 - darken
	return packRgb(
		toChannel((r + (gray - r) * desaturation) * k),
		toChannel((g + (gray - g) * desaturation) * k),
		toChannel((b + (gray - b) * desaturation) * k)
	)
}

// ---------------------------------------------------------------------------
// Effect-owned output buffers
// ---------------------------------------------------------------------------

/**
 * Per-effect-instance output storage.
 *
 * `lines` is what gets handed back inside the returned screen. `owned` holds cell objects
 * the effect allocated for transformed positions; they are allocated once per position and
 * then rewritten in place every frame, so a steady-state frame allocates nothing.
 */
type EffectBuffer = {
	lines: AnsiCell[][]
	owned: AnsiCell[][]
}

function createEffectBuffer(): EffectBuffer {
	return { lines: [], owned: [] }
}

/** Grow/shrink the buffer to `rowCount` rows, making sure every row array exists. */
function prepareLines(buffer: EffectBuffer, rowCount: number): void {
	if (buffer.lines.length !== rowCount) buffer.lines.length = rowCount
	if (buffer.owned.length !== rowCount) buffer.owned.length = rowCount
	for (let y = 0; y < rowCount; y++) {
		if (buffer.lines[y] === undefined) buffer.lines[y] = []
		if (buffer.owned[y] === undefined) buffer.owned[y] = []
	}
}

/** Prepare the output row at `y` to hold `length` entries and return it. */
function prepareRow(buffer: EffectBuffer, y: number, length: number): AnsiCell[] {
	const row = buffer.lines[y]
	if (row.length !== length) row.length = length
	return row
}

/**
 * Get the effect-owned cell for `(y, x)`, seeded with `source`'s values. The returned cell
 * is safe to mutate; `source` is never touched.
 */
function ownedCell(buffer: EffectBuffer, y: number, x: number, source: AnsiCell): AnsiCell {
	const row = buffer.owned[y]
	const existing = row[x]
	if (existing === undefined) {
		const created: AnsiCell = {
			ch: source.ch,
			fg: source.fg,
			bg: source.bg,
			bold: source.bold,
		}
		row[x] = created
		return created
	}
	existing.ch = source.ch
	existing.fg = source.fg
	existing.bg = source.bg
	existing.bold = source.bold
	return existing
}

/** Copy a source row into the output buffer by cell reference (no cell allocation). */
function passThroughRow(buffer: EffectBuffer, y: number, srcRow: AnsiCell[]): void {
	const outRow = prepareRow(buffer, y, srcRow.length)
	for (let x = 0; x < srcRow.length; x++) outRow[x] = srcRow[x]
}

/** Wrap the reused `lines` buffer in a fresh screen object, carrying SAUCE metadata over. */
function finishScreen(buffer: EffectBuffer, source: AnsiScreen): AnsiScreen {
	const out: AnsiScreen = { lines: buffer.lines, columns: source.columns }
	if (source.sauce) out.sauce = source.sauce
	return out
}

/** Clamped 2D sample from a (possibly ragged) line array. */
function sampleCell(lines: AnsiCell[][], x: number, y: number, fallback: AnsiCell): AnsiCell {
	const rowCount = lines.length
	if (rowCount === 0) return fallback
	const yy = y < 0 ? 0 : y >= rowCount ? rowCount - 1 : y
	const row = lines[yy]
	if (row === undefined || row.length === 0) return fallback
	const xx = x < 0 ? 0 : x >= row.length ? row.length - 1 : x
	return row[xx] ?? fallback
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

/**
 * Wrap a frame generator with one or more post effects.
 *
 * The returned function has the identical `(frame, columns, rows) => AnsiScreen` contract
 * as the input generator, so it can be handed to `AnsiVirtualDisplay` / `AnsiArt` directly.
 * Effects are applied left to right: `composeAnsiEffects(gen, a, b)` evaluates
 * `b(a(gen(...)))`. Effects may be passed as separate arguments, as arrays, or a mix.
 *
 * ### Metadata forwarding
 *
 * Player/overlay metadata attached to the source generator function object is copied onto
 * the composed function so playback controls keep working:
 * `capabilities`, `setSpeed`, `seekToFrame`, `getCurrentSpeed`, `advanceByte`,
 * `rewindByte`, `getCurrentBytePosition`, `clearManualBytePosition`.
 *
 * Properties are copied by reference at compose time (the objects/closures they point at
 * still read the source generator's live state, which is how `createAnsiFrameGenerator`
 * builds them). Reassigning one of these properties on the source generator *after*
 * composing is not observed by the composed function.
 *
 * ### `isStatic` is deliberately NOT forwarded when effects are present
 *
 * `isStatic` tells consumers "render one frame and stop driving the frame loop". Every
 * effect in this module animates (the lens glides, the beam sweeps, the tracking glitch
 * fires on a schedule), so a static source wrapped in effects is no longer static — a
 * consumer that honored `isStatic` would freeze the effect on frame 0. The flag is only
 * forwarded when the effect list is empty (a degenerate compose that changes nothing).
 *
 * @returns the composed generator; the screen it returns follows the aliasing contract of
 * the last effect (valid until the next call).
 */
export function composeAnsiEffects(
	generator: CharacterFrameGenerator,
	...effects: Array<AnsiPostEffect | AnsiPostEffect[]>
): CharacterFrameGeneratorWithMetadata {
	const chain: AnsiPostEffect[] = []
	for (const entry of effects) {
		if (Array.isArray(entry)) {
			for (const effect of entry) {
				if (typeof effect === 'function') chain.push(effect)
			}
		} else if (typeof entry === 'function') {
			chain.push(entry)
		}
	}

	const composed = ((frame: number, columns: number, rows: number): AnsiScreen => {
		let screen = generator(frame, columns, rows)
		for (let i = 0; i < chain.length; i++) {
			screen = chain[i](screen, frame, columns, rows)
		}
		return screen
	}) as CharacterFrameGeneratorWithMetadata

	const source = generator as CharacterFrameGeneratorWithMetadata

	if (source.capabilities) composed.capabilities = source.capabilities
	if (source.setSpeed) composed.setSpeed = source.setSpeed
	if (source.seekToFrame) composed.seekToFrame = source.seekToFrame
	if (source.getCurrentSpeed) composed.getCurrentSpeed = source.getCurrentSpeed
	if (source.advanceByte) composed.advanceByte = source.advanceByte
	if (source.rewindByte) composed.rewindByte = source.rewindByte
	if (source.getCurrentBytePosition) composed.getCurrentBytePosition = source.getCurrentBytePosition
	if (source.clearManualBytePosition) {
		composed.clearManualBytePosition = source.clearManualBytePosition
	}

	// See the doc comment: a wrapped generator animates, so it must not claim to be static.
	if (chain.length === 0 && source.isStatic === true) composed.isStatic = true

	return composed
}

// ---------------------------------------------------------------------------
// Lens effect
// ---------------------------------------------------------------------------

export interface LensEffectOptions {
	/** Lens radius in character cells (measured horizontally). Default: 8 */
	radius?: number
	/** Magnification inside the lens; 1 = no zoom. Default: 2 */
	magnification?: number
	/**
	 * Cell height / cell width. Used to keep the lens visually round on the usual 8x16 VGA
	 * cell. Default: 2
	 */
	cellAspect?: number
	/** Lissajous path speed in radians per frame. Default: 0.013 */
	speed?: number
	/** Lissajous frequency on the X axis. Default: 3 */
	freqX?: number
	/** Lissajous frequency on the Y axis. Default: 2 */
	freqY?: number
	/** Phase offset of the path, in radians. Default: 0 */
	phase?: number
	/** Width of the brightened rim band at the lens edge, in cells. Default: 1 */
	rimWidth?: number
	/** Peak rim brightening, 0..1 (0 = no rim). Default: 0.45 */
	rimBrightness?: number
}

/** Quantization levels across the rim band — keeps the rim color cache tiny. */
const LENS_RIM_LEVELS = 4

/**
 * A circular magnifier that glides over the screen on a slow Lissajous path.
 *
 * Cells inside the lens sample the source cell at `center + offset / magnification`
 * (aspect-corrected, so the lens reads as a circle rather than an ellipse). Cells in the
 * outer rim band get their foreground brightened. Everything outside the lens passes
 * through by reference, unchanged.
 */
export function createLensEffect(options: LensEffectOptions = {}): AnsiPostEffect {
	const radius = clampNumber(options.radius ?? 8, 0.5, 512)
	const magnification = clampNumber(options.magnification ?? 2, 1, 16)
	const cellAspect = clampNumber(options.cellAspect ?? 2, 0.25, 8)
	const speed = clampNumber(options.speed ?? 0.013, 0, 1)
	const freqX = clampNumber(options.freqX ?? 3, 0, 64)
	const freqY = clampNumber(options.freqY ?? 2, 0, 64)
	const phase = finiteOr(options.phase, 0)
	const rimWidth = clampNumber(options.rimWidth ?? 1, 0, radius)
	const rimBrightness = clamp01(options.rimBrightness ?? 0.45)

	const buffer = createEffectBuffer()
	const rimCache = createColorCache(LENS_RIM_LEVELS, (r, g, b, level) =>
		brightenPacked(r, g, b, (rimBrightness * (level + 1)) / LENS_RIM_LEVELS)
	)

	const hasRim = rimWidth > 0 && rimBrightness > 0

	return (screen, frame) => {
		const lines = screen.lines
		const rowCount = lines.length
		if (rowCount === 0) return screen

		const width = Math.max(1, screen.columns)
		const radiusRows = radius / cellAspect

		// Lissajous path, inset so the lens never leaves the screen.
		const ampX = Math.max(0, width / 2 - radius)
		const ampY = Math.max(0, rowCount / 2 - radiusRows)
		const t = frame * speed
		const cx = width / 2 + ampX * Math.sin(t * freqX + phase)
		const cy = rowCount / 2 + ampY * Math.sin(t * freqY + phase * 0.5 + Math.PI / 3)

		const radiusSq = radius * radius
		const rimInner = hasRim ? radius - rimWidth : radius
		const rimInnerSq = rimInner > 0 ? rimInner * rimInner : 0
		const invMag = 1 / magnification

		prepareLines(buffer, rowCount)

		for (let y = 0; y < rowCount; y++) {
			const srcRow = lines[y]
			const rowLength = srcRow.length

			// Vertical distance in horizontal-cell units so the lens stays round.
			const dyCells = y - cy
			const dy = dyCells * cellAspect
			const dySq = dy * dy
			if (dySq > radiusSq || rowLength === 0) {
				passThroughRow(buffer, y, srcRow)
				continue
			}

			const outRow = prepareRow(buffer, y, rowLength)
			const halfSpan = Math.sqrt(radiusSq - dySq)
			const xStart = Math.max(0, Math.ceil(cx - halfSpan))
			const xEnd = Math.min(rowLength - 1, Math.floor(cx + halfSpan))
			const sampleY = Math.round(cy + dyCells * invMag)

			for (let x = 0; x < rowLength; x++) {
				if (x < xStart || x > xEnd) {
					outRow[x] = srcRow[x]
					continue
				}

				const dx = x - cx
				const distSq = dx * dx + dySq
				if (distSq > radiusSq) {
					outRow[x] = srcRow[x]
					continue
				}

				const sampled = sampleCell(lines, Math.round(cx + dx * invMag), sampleY, srcRow[x])

				if (hasRim && distSq >= rimInnerSq) {
					const dist = Math.sqrt(distSq)
					const level = clampInt(
						((dist - rimInner) / rimWidth) * LENS_RIM_LEVELS,
						0,
						LENS_RIM_LEVELS - 1
					)
					const cell = ownedCell(buffer, y, x, sampled)
					cell.fg = rimCache(sampled.fg, level)
					outRow[x] = cell
				} else {
					// Untransformed sample: hand the source cell over by reference.
					outRow[x] = sampled
				}
			}
		}

		return finishScreen(buffer, screen)
	}
}

// ---------------------------------------------------------------------------
// Scanline beam effect
// ---------------------------------------------------------------------------

export interface ScanlineEffectOptions {
	/** Rows the beam travels per frame. Default: 0.75 */
	speed?: number
	/** Beam thickness in rows (roughly the number of visibly lit rows). Default: 2.5 */
	thickness?: number
	/** Peak foreground brightening at the beam center, 0..1. Default: 0.6 */
	brightness?: number
	/** Also brighten the background of beam rows. Default: false */
	affectBackground?: boolean
	/** Peak background brightening when `affectBackground` is set, 0..1. Default: 0.25 */
	backgroundBrightness?: number
	/** Dim the rows the beam is not on, for a CRT feel. Default: false */
	dimOthers?: boolean
	/** How much to dim non-beam rows when `dimOthers` is set, 0..1. Default: 0.12 */
	dimAmount?: number
	/** Starting offset of the beam, in rows. Default: 0 */
	phase?: number
}

/** Beam intensity is quantized to this many levels so the color cache stays tiny. */
const SCANLINE_LEVELS = 8

/**
 * A bright horizontal beam sweeping top-to-bottom, cyclically.
 *
 * Beam intensity falls off with a gaussian across `thickness` rows and is quantized to
 * {@link SCANLINE_LEVELS} steps; foreground (and optionally background) colors of lit rows
 * are brightened through a bounded per-level color cache. With `dimOthers`, every other row
 * is slightly dimmed. Rows the effect leaves alone pass through by cell reference.
 */
export function createScanlineEffect(options: ScanlineEffectOptions = {}): AnsiPostEffect {
	const speed = clampNumber(options.speed ?? 0.75, -64, 64)
	const thickness = clampNumber(options.thickness ?? 2.5, 0.5, 64)
	const brightness = clamp01(options.brightness ?? 0.6)
	const affectBackground = options.affectBackground ?? false
	const backgroundBrightness = clamp01(options.backgroundBrightness ?? 0.25)
	const dimOthers = options.dimOthers ?? false
	const dimAmount = clamp01(options.dimAmount ?? 0.12)
	const phase = finiteOr(options.phase, 0)

	const buffer = createEffectBuffer()
	const fgBrightCache = createColorCache(SCANLINE_LEVELS, (r, g, b, level) =>
		brightenPacked(r, g, b, (brightness * (level + 1)) / SCANLINE_LEVELS)
	)
	const bgBrightCache = createColorCache(SCANLINE_LEVELS, (r, g, b, level) =>
		brightenPacked(r, g, b, (backgroundBrightness * (level + 1)) / SCANLINE_LEVELS)
	)
	const dimCache = createColorCache(1, (r, g, b) => dimPacked(r, g, b, dimAmount))

	const dimsOtherRows = dimOthers && dimAmount > 0

	return (screen, frame) => {
		const lines = screen.lines
		const rowCount = lines.length
		if (rowCount === 0) return screen

		const cycle = rowCount
		let beamY = (frame * speed + phase) % cycle
		if (beamY < 0) beamY += cycle

		const sigma = Math.max(0.25, thickness / 2)
		const invTwoSigmaSq = 1 / (2 * sigma * sigma)
		const halfCycle = cycle / 2

		prepareLines(buffer, rowCount)

		for (let y = 0; y < rowCount; y++) {
			const srcRow = lines[y]
			const rowLength = srcRow.length

			// Shortest signed distance to the beam, wrapping at the screen seam so the beam
			// stays continuous as it cycles.
			let dy = y - beamY
			if (dy > halfCycle) dy -= cycle
			else if (dy < -halfCycle) dy += cycle

			const intensity = brightness > 0 ? Math.exp(-(dy * dy) * invTwoSigmaSq) : 0
			const level = Math.round(intensity * SCANLINE_LEVELS) - 1

			if (level < 0) {
				if (!dimsOtherRows) {
					passThroughRow(buffer, y, srcRow)
					continue
				}
				const outRow = prepareRow(buffer, y, rowLength)
				for (let x = 0; x < rowLength; x++) {
					const src = srcRow[x]
					const cell = ownedCell(buffer, y, x, src)
					cell.fg = dimCache(src.fg, 0)
					cell.bg = dimCache(src.bg, 0)
					outRow[x] = cell
				}
				continue
			}

			const outRow = prepareRow(buffer, y, rowLength)
			for (let x = 0; x < rowLength; x++) {
				const src = srcRow[x]
				const cell = ownedCell(buffer, y, x, src)
				cell.fg = fgBrightCache(src.fg, level)
				if (affectBackground) cell.bg = bgBrightCache(src.bg, level)
				outRow[x] = cell
			}
		}

		return finishScreen(buffer, screen)
	}
}

// ---------------------------------------------------------------------------
// VHS tracking effect
// ---------------------------------------------------------------------------

/** CP437-safe glitch glyphs (all present in the CP437 table, so they render as bitmap glyphs). */
const DEFAULT_VHS_NOISE_CHARS = '█▓▒░▄▀■·:+*.'

export interface VhsTrackingEffectOptions {
	/** Seed for the deterministic glitch schedule. Default: 4242 */
	seed?: number
	/** Frames between glitch events. Default: 90 */
	glitchInterval?: number
	/** How many frames each glitch lasts. Default: 4 */
	glitchDuration?: number
	/** Minimum band height in rows. Default: 2 */
	minBandRows?: number
	/** Maximum band height in rows. Default: 4 */
	maxBandRows?: number
	/** Maximum horizontal shift of the band, in cells (wraps). Default: 5 */
	maxShift?: number
	/** Width in cells of the noise-sprinkled zone at each band edge. Default: 4 */
	noiseEdgeWidth?: number
	/** Probability (0..1) that an edge cell is replaced by a noise glyph. Default: 0.35 */
	noiseChance?: number
	/** How far band colors are pulled toward gray, 0..1. Default: 0.6 */
	desaturation?: number
	/** How much band colors are darkened, 0..1. Default: 0.35 */
	darken?: number
	/** Glyphs used for the edge noise. Default: CP437 block/shade set */
	noiseChars?: string
}

/**
 * Occasional VHS tracking glitch.
 *
 * Every `glitchInterval` frames a band of `minBandRows`..`maxBandRows` rows is disturbed for
 * `glitchDuration` frames: shifted horizontally (wrapping), desaturated and darkened, and
 * sprinkled with CP437 noise glyphs at the band edges. Band placement, shift and noise are
 * all derived deterministically from `(frame, seed)`.
 *
 * Between glitches the effect returns the **input screen object itself, untouched** — an
 * idle frame costs nothing and aliases the input, so it inherits the input's own lifetime
 * rather than this effect's buffer lifetime.
 */
export function createVhsTrackingEffect(options: VhsTrackingEffectOptions = {}): AnsiPostEffect {
	const seed = clampInt(options.seed ?? 4242, 0, 0xffffffff)
	const glitchInterval = clampInt(options.glitchInterval ?? 90, 1, 100000)
	const glitchDuration = clampInt(options.glitchDuration ?? 4, 1, glitchInterval)
	const minBandRows = clampInt(options.minBandRows ?? 2, 1, 512)
	const maxBandRows = clampInt(options.maxBandRows ?? 4, minBandRows, 1024)
	const maxShift = clampInt(options.maxShift ?? 5, 0, 512)
	const noiseEdgeWidth = clampInt(options.noiseEdgeWidth ?? 4, 0, 512)
	const noiseChance = clamp01(options.noiseChance ?? 0.35)
	const desaturation = clamp01(options.desaturation ?? 0.6)
	const darken = clamp01(options.darken ?? 0.35)
	const noiseChars = Array.from(
		options.noiseChars && options.noiseChars.length > 0
			? options.noiseChars
			: DEFAULT_VHS_NOISE_CHARS
	)

	const buffer = createEffectBuffer()
	const colorCache = createColorCache(1, (r, g, b) =>
		desaturateAndDarkenPacked(r, g, b, desaturation, darken)
	)

	const bandRowSpan = maxBandRows - minBandRows + 1
	const noiseCharCount = noiseChars.length
	const sprinkles = noiseEdgeWidth > 0 && noiseChance > 0 && noiseCharCount > 0

	return (screen, frame) => {
		const lines = screen.lines
		const rowCount = lines.length
		if (rowCount === 0) return screen

		let phase = frame % glitchInterval
		if (phase < 0) phase += glitchInterval
		// Idle frames pass the input screen straight through (aliases the input; see doc).
		if (phase >= glitchDuration) return screen

		const cycle = Math.floor(frame / glitchInterval)
		const bandHash = hash2D(cycle, 0, seed)
		const bandRows = Math.min(rowCount, minBandRows + (bandHash % bandRowSpan))
		const bandTop = rowCount > bandRows ? (bandHash >>> 9) % (rowCount - bandRows + 1) : 0
		const bandBottom = Math.min(rowCount, bandTop + bandRows)

		const shiftHash = hash2D(cycle, phase + 1, seed ^ 0x5bf03635)
		const shift = maxShift > 0 ? (shiftHash % (maxShift * 2 + 1)) - maxShift : 0
		const noiseSeed = seed ^ Math.imul(cycle, 0x9e3779b1)

		prepareLines(buffer, rowCount)

		for (let y = 0; y < rowCount; y++) {
			const srcRow = lines[y]
			const rowLength = srcRow.length

			if (y < bandTop || y >= bandBottom || rowLength === 0) {
				passThroughRow(buffer, y, srcRow)
				continue
			}

			const outRow = prepareRow(buffer, y, rowLength)
			const edgeStart = rowLength - noiseEdgeWidth

			for (let x = 0; x < rowLength; x++) {
				let sx = (x - shift) % rowLength
				if (sx < 0) sx += rowLength
				const src = srcRow[sx]

				const cell = ownedCell(buffer, y, x, src)
				cell.fg = colorCache(src.fg, 0)
				cell.bg = colorCache(src.bg, 0)

				if (sprinkles && (x < noiseEdgeWidth || x >= edgeStart)) {
					const nh = hash2D(x, y * 31 + phase, noiseSeed)
					if ((nh & 0xffff) / 0xffff < noiseChance) {
						cell.ch = noiseChars[(nh >>> 16) % noiseCharCount]
						cell.bold = ((nh >>> 12) & 1) === 1
					}
				}

				outRow[x] = cell
			}
		}

		return finishScreen(buffer, screen)
	}
}

// ---------------------------------------------------------------------------
// Phosphor persistence effect
// ---------------------------------------------------------------------------

export interface PhosphorPersistenceEffectOptions {
	/** Frames a trail takes to fade from full strength to nothing. Default: 14 */
	decayFrames?: number
	/** Trail brightness the frame after its source cell goes dark, 0..1. Default: 0.65 */
	strength?: number
}

/** Trail brightness is quantized to this many levels so the dim-color cache stays tiny. */
const PHOSPHOR_LEVELS = 12

/**
 * CRT phosphor afterglow: when a lit cell goes dark, its glyph lingers and fades out over
 * `decayFrames` frames instead of vanishing, leaving motion trails behind anything that
 * moves. A cell is "lit" when its character is not a space; trails inherit the departed
 * cell's glyph and foreground color, progressively dimmed toward black.
 *
 * ## Statefulness (deviation from the pure-`(screen, frame)` contract)
 *
 * Afterglow is inherently a function of what was on screen before, so each instance keeps
 * a per-cell memory of the last lit glyph/color — the same "deterministic for a given
 * frame sequence" contract the stateful generators use. Memory resets whenever the frame
 * number does not advance (a seek/rewind) or the screen dimensions change, so any forward
 * replay from a reset produces identical output. Numeric ANSI palette colors dim through
 * the EGA table; colors this module cannot parse produce no trail.
 */
export function createPhosphorPersistenceEffect(
	options: PhosphorPersistenceEffectOptions = {}
): AnsiPostEffect {
	const decayFrames = clampNumber(options.decayFrames ?? 14, 1, 100000)
	const strength = clamp01(options.strength ?? 0.65)

	const buffer = createEffectBuffer()

	// Per-cell memory, flat-indexed y * width + x. `memColor` is packed RGB (-1 = no trail
	// possible), `level` is the remaining trail brightness (0 = no active trail), `wasLit`
	// marks cells that were lit on the previous frame so a lit->dark edge starts a trail.
	let memChars: string[] = []
	let memColor = new Int32Array(0)
	let level = new Float64Array(0)
	let wasLit = new Uint8Array(0)
	let memWidth = -1
	let memHeight = -1
	let lastFrame = Number.NEGATIVE_INFINITY

	// Dimmed trail colors, cached by packed RGB + quantized brightness level.
	const dimmedCache = new Map<number, string>()

	function resetMemory(width: number, height: number): void {
		const total = width * height
		memChars = new Array<string>(total).fill(' ')
		memColor = new Int32Array(total).fill(-1)
		level = new Float64Array(total)
		wasLit = new Uint8Array(total)
		memWidth = width
		memHeight = height
	}

	function trailColor(packed: number, quantized: number): string {
		const key = packed * (PHOSPHOR_LEVELS + 1) + quantized
		const hit = dimmedCache.get(key)
		if (hit !== undefined) return hit
		const k = quantized / PHOSPHOR_LEVELS
		const str = `rgb(${toChannel(((packed >>> 16) & 0xff) * k)},${toChannel(
			((packed >>> 8) & 0xff) * k
		)},${toChannel((packed & 0xff) * k)})`
		if (dimmedCache.size < MAX_TRANSFORMED_COLORS) dimmedCache.set(key, str)
		return str
	}

	return (screen, frame) => {
		const lines = screen.lines
		const rowCount = lines.length
		if (rowCount === 0) return screen

		const width = Math.max(1, screen.columns)
		if (width !== memWidth || rowCount !== memHeight || frame <= lastFrame) {
			resetMemory(width, rowCount)
		}
		// Trails fade by elapsed frames, so a frame jump skips ahead instead of slowing down.
		const decay = Math.max(0, frame - lastFrame) / decayFrames
		lastFrame = frame

		prepareLines(buffer, rowCount)

		for (let y = 0; y < rowCount; y++) {
			const srcRow = lines[y]
			const rowLength = srcRow.length
			const outRow = prepareRow(buffer, y, rowLength)
			const rowBase = y * width

			for (let x = 0; x < rowLength; x++) {
				const src = srcRow[x]
				const idx = rowBase + Math.min(x, width - 1)

				if (src.ch !== ' ') {
					// Lit: pass through and remember the glyph for a future trail.
					memChars[idx] = src.ch
					memColor[idx] = packedCellColor(src.fg)
					wasLit[idx] = 1
					level[idx] = 0
					outRow[x] = src
					continue
				}

				if (wasLit[idx] === 1) {
					// Lit -> dark edge: start the trail at full strength.
					wasLit[idx] = 0
					level[idx] = strength
				} else if (level[idx] > 0) {
					level[idx] -= decay
				}

				const packed = memColor[idx]
				if (level[idx] > 0 && packed >= 0) {
					const quantized = clampInt(Math.round(level[idx] * PHOSPHOR_LEVELS), 1, PHOSPHOR_LEVELS)
					const cell = ownedCell(buffer, y, x, src)
					cell.ch = memChars[idx]
					cell.fg = trailColor(packed, quantized)
					cell.bold = false
					outRow[x] = cell
				} else {
					level[idx] = 0
					outRow[x] = src
				}
			}
		}

		return finishScreen(buffer, screen)
	}
}

// ---------------------------------------------------------------------------
// Chromatic aberration effect
// ---------------------------------------------------------------------------

export interface ChromaticAberrationEffectOptions {
	/**
	 * Maximum horizontal channel displacement in cells — reached at the screen edges with
	 * `falloff: 'edge'`, applied everywhere with `falloff: 'uniform'`. Default: 2
	 */
	maxShift?: number
	/** Blend between the original color and the fully fringed color, 0..1. Default: 1 */
	strength?: number
	/** 'edge': displacement grows quadratically away from the screen center. Default: 'edge' */
	falloff?: 'edge' | 'uniform'
	/** Also fringe background colors (doubles the color work). Default: false */
	affectBackground?: boolean
}

/**
 * Lens color fringing: each cell's red channel is sampled `shift` cells to the left and
 * its blue channel `shift` cells to the right, so hard color edges split into red/blue
 * fringes. With the default `'edge'` falloff the displacement grows quadratically from
 * the screen center outward, like a cheap CRT/camera lens; the center stays clean.
 *
 * Glyphs are untouched — only colors fringe. Cells whose neighborhood is a flat color
 * pass through by reference, so the effect costs nothing on solid areas. Colors that
 * cannot be resolved to RGB (unparseable strings) pass through unchanged.
 */
export function createChromaticAberrationEffect(
	options: ChromaticAberrationEffectOptions = {}
): AnsiPostEffect {
	const maxShift = clampInt(options.maxShift ?? 2, 0, 64)
	const strength = clamp01(options.strength ?? 1)
	const falloff = options.falloff === 'uniform' ? 'uniform' : 'edge'
	const affectBackground = options.affectBackground ?? false

	const buffer = createEffectBuffer()

	// Per-column shift magnitudes, rebuilt only when the width changes.
	let shiftTable = new Int16Array(0)
	let shiftWidth = -1

	// Final fringed color strings, cached by packed RGB.
	const fringedCache = new Map<number, string>()

	function getShiftTable(width: number): Int16Array {
		if (width === shiftWidth) return shiftTable
		shiftTable = new Int16Array(width)
		const cx = (width - 1) / 2
		for (let x = 0; x < width; x++) {
			if (falloff === 'uniform') {
				shiftTable[x] = maxShift
			} else {
				const t = cx > 0 ? Math.abs(x - cx) / cx : 0
				shiftTable[x] = Math.round(maxShift * t * t)
			}
		}
		shiftWidth = width
		return shiftTable
	}

	function packedToString(packed: number): string {
		const hit = fringedCache.get(packed)
		if (hit !== undefined) return hit
		const str = `rgb(${(packed >>> 16) & 0xff},${(packed >>> 8) & 0xff},${packed & 0xff})`
		if (fringedCache.size < MAX_TRANSFORMED_COLORS) fringedCache.set(packed, str)
		return str
	}

	/** Fringed color for one channel plane, or null when it resolves to no change. */
	function fringe(
		center: number | string,
		left: number | string,
		right: number | string
	): string | null {
		if (left === center && right === center) return null
		const packedC = packedCellColor(center)
		if (packedC < 0) return null
		let packedL = packedCellColor(left)
		let packedR = packedCellColor(right)
		if (packedL < 0) packedL = packedC
		if (packedR < 0) packedR = packedC
		if (packedL === packedC && packedR === packedC) return null

		const cr = (packedC >>> 16) & 0xff
		const cg = (packedC >>> 8) & 0xff
		const cb = packedC & 0xff
		const r = toChannel(cr + (((packedL >>> 16) & 0xff) - cr) * strength)
		const b = toChannel(cb + ((packedR & 0xff) - cb) * strength)
		const packed = packRgb(r, cg, b)
		if (packed === packedC) return null
		return packedToString(packed)
	}

	return (screen) => {
		const lines = screen.lines
		const rowCount = lines.length
		if (rowCount === 0 || maxShift === 0 || strength === 0) return screen

		const width = Math.max(1, screen.columns)
		const shifts = getShiftTable(width)

		prepareLines(buffer, rowCount)

		for (let y = 0; y < rowCount; y++) {
			const srcRow = lines[y]
			const rowLength = srcRow.length
			const outRow = prepareRow(buffer, y, rowLength)

			for (let x = 0; x < rowLength; x++) {
				const src = srcRow[x]
				const shift = shifts[Math.min(x, width - 1)]
				if (shift === 0) {
					outRow[x] = src
					continue
				}

				const left = srcRow[Math.max(0, x - shift)]
				const right = srcRow[Math.min(rowLength - 1, x + shift)]
				const fg = fringe(src.fg, left.fg, right.fg)
				const bg = affectBackground ? fringe(src.bg, left.bg, right.bg) : null

				if (fg === null && bg === null) {
					outRow[x] = src
					continue
				}
				const cell = ownedCell(buffer, y, x, src)
				if (fg !== null) cell.fg = fg
				if (bg !== null) cell.bg = bg
				outRow[x] = cell
			}
		}

		return finishScreen(buffer, screen)
	}
}

// ---------------------------------------------------------------------------
// Kaleidoscope effect
// ---------------------------------------------------------------------------

export interface KaleidoscopeEffectOptions {
	/** Number of mirror segments around the center (2-32). Default: 6 */
	segments?: number
	/** Rotation of the rendered pattern, radians per frame. Default: 0.004 */
	rotateSpeed?: number
	/** Drift of which wedge of the source is sampled, radians per frame. Default: 0.0017 */
	sourceRotateSpeed?: number
	/** Cell height / cell width, to keep the fold circular on screen. Default: 2 */
	cellAspect?: number
	/** Fold center as a fraction of the width. Default: 0.5 */
	centerX?: number
	/** Fold center as a fraction of the height. Default: 0.5 */
	centerY?: number
}

/**
 * Classic kaleidoscope fold: the screen is divided into `segments` wedges around a center
 * point, and every wedge shows a mirrored copy of one source wedge, producing N-fold
 * mirror symmetry out of whatever the wrapped generator draws. The whole pattern slowly
 * rotates (`rotateSpeed`) while the sampled source wedge drifts independently
 * (`sourceRotateSpeed`), so even a static source keeps moving.
 *
 * Output cells are references to sampled input cells (never modified), so the effect does
 * no color work at all — it is pure coordinate remapping, aspect-corrected so the fold
 * reads as circular on 2:1 character cells.
 */
export function createKaleidoscopeEffect(options: KaleidoscopeEffectOptions = {}): AnsiPostEffect {
	const segments = clampInt(options.segments ?? 6, 2, 32)
	const rotateSpeed = clampNumber(options.rotateSpeed ?? 0.004, -1, 1)
	const sourceRotateSpeed = clampNumber(options.sourceRotateSpeed ?? 0.0017, -1, 1)
	const cellAspect = clampNumber(options.cellAspect ?? 2, 0.25, 8)
	const centerXFraction = clamp01(options.centerX ?? 0.5)
	const centerYFraction = clamp01(options.centerY ?? 0.5)

	const buffer = createEffectBuffer()
	const wedge = (Math.PI * 2) / segments
	const halfWedge = wedge / 2

	return (screen, frame) => {
		const lines = screen.lines
		const rowCount = lines.length
		if (rowCount === 0) return screen

		const width = Math.max(1, screen.columns)
		const cx = (width - 1) * centerXFraction
		const cy = (rowCount - 1) * centerYFraction
		const rotation = frame * rotateSpeed
		const sourceRotation = frame * sourceRotateSpeed
		const invAspect = 1 / cellAspect

		prepareLines(buffer, rowCount)

		for (let y = 0; y < rowCount; y++) {
			const srcRow = lines[y]
			const rowLength = srcRow.length
			const outRow = prepareRow(buffer, y, rowLength)
			const dy = (y - cy) * cellAspect

			for (let x = 0; x < rowLength; x++) {
				const dx = x - cx
				const radius = Math.sqrt(dx * dx + dy * dy)
				if (radius < 0.5) {
					outRow[x] = srcRow[x]
					continue
				}

				// Fold the angle into [0, wedge), mirrored about the wedge midline.
				let angle = (Math.atan2(dy, dx) + rotation) % wedge
				if (angle < 0) angle += wedge
				if (angle > halfWedge) angle = wedge - angle
				const sampleAngle = angle + sourceRotation

				const sx = Math.round(cx + Math.cos(sampleAngle) * radius)
				const sy = Math.round(cy + Math.sin(sampleAngle) * radius * invAspect)
				outRow[x] = sampleCell(lines, sx, sy, srcRow[x])
			}
		}

		return finishScreen(buffer, screen)
	}
}
