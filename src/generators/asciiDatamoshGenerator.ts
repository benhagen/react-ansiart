import type { AnsiScreen } from '../ansi/types'
import type { CharacterFrameGenerator } from '../types/types'
import { EGA_PALETTE_RGB } from '../utils/egaPalette'
import { createGeneratorStateStore, type GeneratorStateStore } from './generatorState'

export interface AsciiDatamoshOptions {
	/** Random seed. Default: 1337 */
	seed?: number
	/** Background color (CSS). Default: '#000000' */
	bgColor?: string
	/** Frames between “keyframes” (full refresh). Default: 24 */
	keyframeIntervalFrames?: number
	/** Number of corruption operations per frame. Default: 10 */
	blockOpsPerFrame?: number
	/** Minimum block size (cells). Default: 3 */
	minBlockSize?: number
	/** Maximum block size (cells). Default: 18 */
	maxBlockSize?: number
	/** Maximum horizontal/vertical shift used by some ops (cells). Default: 12 */
	maxShift?: number
	/** Chance (0..1) to apply a horizontal tear op each frame. Default: 0.5 */
	tearChance?: number
	/** Chance (0..1) to apply a palette shift op each frame. Default: 0.65 */
	paletteShiftChance?: number
	/** Chance (0..1) to apply a noise fill op each frame. Default: 0.35 */
	noiseFillChance?: number
	/** Characters used for base “video” shading (dark -> bright). Default: ' ░▒▓█' */
	baseChars?: string
	/** Characters used for noise fill. Default: '█▓▒░▀▄■□▲▼◆◇╳#@$%&*+;:,. ' */
	noiseChars?: string
	/** If true, allow blocks/tears to wrap around edges. Default: true */
	wrap?: boolean
}

const DEFAULTS: Required<
	Pick<
		AsciiDatamoshOptions,
		| 'seed'
		| 'bgColor'
		| 'keyframeIntervalFrames'
		| 'blockOpsPerFrame'
		| 'minBlockSize'
		| 'maxBlockSize'
		| 'maxShift'
		| 'tearChance'
		| 'paletteShiftChance'
		| 'noiseFillChance'
		| 'baseChars'
		| 'noiseChars'
		| 'wrap'
	>
> = {
	seed: 1337,
	bgColor: '#000000',
	keyframeIntervalFrames: 24,
	blockOpsPerFrame: 10,
	minBlockSize: 3,
	maxBlockSize: 18,
	maxShift: 12,
	tearChance: 0.5,
	paletteShiftChance: 0.65,
	noiseFillChance: 0.35,
	baseChars: ' ░▒▓█',
	noiseChars: '█▓▒░▀▄■□▲▼◆◇╳#@$%&*+;:,. ',
	wrap: true,
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

function wrapIndex(v: number, size: number): number {
	const m = v % size
	return m < 0 ? m + size : m
}

function hash2D(x: number, y: number, seed: number): number {
	// Fast-ish deterministic 32-bit hash
	let h = (x * 0x9e3779b1) ^ (y * 0x85ebca6b) ^ seed
	h ^= h >>> 16
	h = Math.imul(h, 0x7feb352d)
	h ^= h >>> 15
	h = Math.imul(h, 0x846ca68b)
	h ^= h >>> 16
	return h >>> 0
}

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t
}

function smoothstep(t: number): number {
	const x = t < 0 ? 0 : t > 1 ? 1 : t
	return x * x * (3 - 2 * x)
}

function makeRng(seed: number) {
	let state = seed >>> 0
	return () => {
		// LCG (deterministic)
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0
		return state / 0xffffffff
	}
}

type CellArrays = {
	chars: string[]
	fg: string[]
	bg: string
	bold: boolean[]
}

function createCellArrays(columns: number, rows: number, bgColor: string): CellArrays {
	const n = columns * rows
	return {
		chars: new Array(n).fill(' '),
		fg: new Array(n).fill('#FFFFFF'),
		bg: bgColor,
		bold: new Array(n).fill(false),
	}
}

function fillKeyframeBase(
	frame: number,
	columns: number,
	rows: number,
	options: Required<Pick<AsciiDatamoshOptions, 'seed' | 'baseChars'> & { bgColor: string }>,
	cells: CellArrays
) {
	const { seed, baseChars, bgColor } = options
	const ramp = getBaseCharsArray(baseChars)
	const rampLen = ramp.length
	cells.bg = bgColor

	// Base field: a stable-ish pseudo “video” using sin bands + hashed grain.
	// Produce both brightness (for chars) and hue-ish palette index (for fg colors).
	const t = frame * 0.06
	let i = 0
	for (let y = 0; y < rows; y++) {
		const yf = y / Math.max(1, rows - 1)
		for (let x = 0; x < columns; x++) {
			const xf = x / Math.max(1, columns - 1)
			const h = hash2D(x, y, seed ^ 0xabcdef01)
			const grain = ((h & 1023) / 1023 - 0.5) * 0.18

			const bandA = Math.sin((xf * 9.0 + yf * 4.0) * Math.PI * 2 + t * 0.9)
			const bandB = Math.sin((xf * 3.0 - yf * 7.0) * Math.PI * 2 - t * 0.6)
			const bandC = Math.sin((xf * 2.0 + yf * 2.0) * Math.PI * 2 + t * 0.25)

			const v = (bandA * 0.45 + bandB * 0.35 + bandC * 0.2) * 0.5 + 0.5 + grain
			const v01 = v < 0 ? 0 : v > 1 ? 1 : v
			const vSmooth = smoothstep(v01)
			const chIndex = Math.min(rampLen - 1, Math.floor(vSmooth * (rampLen - 0.001)))

			const hueish = (xf * 0.35 + yf * 0.25 + t * 0.05 + (((h >>> 10) & 255) / 255) * 0.15) % 1
			const idx = Math.min(63, Math.max(0, Math.floor(hueish * 64)))

			cells.chars[i] = ramp[chIndex]
			cells.fg[i] = EGA_PALETTE_RGB[idx]
			cells.bold[i] = false
			i++
		}
	}
}

function copyRect(
	src: CellArrays,
	dst: CellArrays,
	columns: number,
	rows: number,
	x0: number,
	y0: number,
	w: number,
	h: number,
	dx: number,
	dy: number,
	wrap: boolean
) {
	for (let by = 0; by < h; by++) {
		const sy = y0 + by
		const dyRow = y0 + by + dy
		const srcY = wrap ? wrapIndex(sy, rows) : sy
		const dstY = wrap ? wrapIndex(dyRow, rows) : dyRow
		if (!wrap && (srcY < 0 || srcY >= rows || dstY < 0 || dstY >= rows)) continue

		for (let bx = 0; bx < w; bx++) {
			const sx = x0 + bx
			const dxCol = x0 + bx + dx
			const srcX = wrap ? wrapIndex(sx, columns) : sx
			const dstX = wrap ? wrapIndex(dxCol, columns) : dxCol
			if (!wrap && (srcX < 0 || srcX >= columns || dstX < 0 || dstX >= columns)) continue

			const si = srcY * columns + srcX
			const di = dstY * columns + dstX
			dst.chars[di] = src.chars[si]
			dst.fg[di] = src.fg[si]
			dst.bold[di] = src.bold[si]
		}
	}
}

function horizontalTear(
	src: CellArrays,
	dst: CellArrays,
	columns: number,
	rows: number,
	y0: number,
	h: number,
	shift: number,
	wrap: boolean
) {
	for (let by = 0; by < h; by++) {
		const y = y0 + by
		const yy = wrap ? wrapIndex(y, rows) : y
		if (!wrap && (yy < 0 || yy >= rows)) continue

		for (let x = 0; x < columns; x++) {
			const sx = x
			const dx = x + shift
			const srcX = sx
			const dstX = wrap ? wrapIndex(dx, columns) : dx
			if (!wrap && (dstX < 0 || dstX >= columns)) continue

			const si = yy * columns + srcX
			const di = yy * columns + dstX
			dst.chars[di] = src.chars[si]
			dst.fg[di] = src.fg[si]
			dst.bold[di] = src.bold[si]
		}
	}
}

// Memoized Array.from() splits for character strings, keyed by the resolved (non-empty)
// string value. Both fillKeyframeBase and noiseFillRect otherwise re-split their character
// string into a code-point array on every call.
let lastBaseCharsInput: string | null = null
let lastBaseCharsArray: string[] | null = null

function getBaseCharsArray(baseChars: string): string[] {
	const effective = baseChars.length ? baseChars : DEFAULTS.baseChars
	if (lastBaseCharsInput === effective && lastBaseCharsArray) return lastBaseCharsArray
	lastBaseCharsArray = Array.from(effective)
	lastBaseCharsInput = effective
	return lastBaseCharsArray
}

let lastNoiseCharsInput: string | null = null
let lastNoiseCharsArray: string[] | null = null

function getNoiseCharsArray(noiseChars: string): string[] {
	const effective = noiseChars.length ? noiseChars : DEFAULTS.noiseChars
	if (lastNoiseCharsInput === effective && lastNoiseCharsArray) return lastNoiseCharsArray
	lastNoiseCharsArray = Array.from(effective)
	lastNoiseCharsInput = effective
	return lastNoiseCharsArray
}

function noiseFillRect(
	dst: CellArrays,
	columns: number,
	rows: number,
	x0: number,
	y0: number,
	w: number,
	h: number,
	seed: number,
	frame: number,
	noiseChars: string,
	wrap: boolean
) {
	const chars = getNoiseCharsArray(noiseChars)
	const cLen = chars.length
	for (let by = 0; by < h; by++) {
		const y = y0 + by
		const yy = wrap ? wrapIndex(y, rows) : y
		if (!wrap && (yy < 0 || yy >= rows)) continue
		for (let bx = 0; bx < w; bx++) {
			const x = x0 + bx
			const xx = wrap ? wrapIndex(x, columns) : x
			if (!wrap && (xx < 0 || xx >= columns)) continue
			const i = yy * columns + xx
			const h2 = hash2D(x, y, seed ^ (frame * 0x9e3779b1))
			const ch = chars[h2 % cLen]
			const color = EGA_PALETTE_RGB[(h2 >>> 8) % 64]
			dst.chars[i] = ch
			dst.fg[i] = color
			dst.bold[i] = ((h2 >>> 14) & 1) === 1
		}
	}
}

// Reverse lookup for EGA palette colors to indices (64 entries). Built lazily once at
// module level instead of being rebuilt on every paletteShiftRect call.
let egaIndexByColorCache: Map<string, number> | null = null

function getEgaIndexByColor(): Map<string, number> {
	if (egaIndexByColorCache) return egaIndexByColorCache
	const map = new Map<string, number>()
	for (let i = 0; i < 64; i++) {
		map.set(EGA_PALETTE_RGB[i], i)
	}
	egaIndexByColorCache = map
	return map
}

function paletteShiftRect(
	src: CellArrays,
	dst: CellArrays,
	columns: number,
	rows: number,
	x0: number,
	y0: number,
	w: number,
	h: number,
	shift: number,
	wrap: boolean
) {
	const egaIndexByColor = getEgaIndexByColor()

	for (let by = 0; by < h; by++) {
		const y = y0 + by
		const yy = wrap ? wrapIndex(y, rows) : y
		if (!wrap && (yy < 0 || yy >= rows)) continue
		for (let bx = 0; bx < w; bx++) {
			const x = x0 + bx
			const xx = wrap ? wrapIndex(x, columns) : x
			if (!wrap && (xx < 0 || xx >= columns)) continue

			const i = yy * columns + xx
			const fg = src.fg[i]
			const idx = egaIndexByColor.get(fg)
			if (idx === undefined) {
				dst.fg[i] = fg
				continue
			}
			dst.fg[i] = EGA_PALETTE_RGB[wrapIndex(idx + shift, 64)]
		}
	}
}

type DatamoshState = {
	cells: CellArrays
	readCells: CellArrays | null // Pre-allocated read buffer for double-buffering
	lastFrame: number
	lastKeyframe: number
}

// State shared by all callers of generateAsciiDatamoshFrame / createAsciiDatamoshSampler.
// Prefer createAsciiDatamoshGenerator, which gives each instance its own.
const sharedStore = createGeneratorStateStore<DatamoshState>()

type DatamoshKeyInputs = {
	columns: number
	rows: number
	seed: number
	bgColor: string
	keyframeIntervalFrames: number
	blockOpsPerFrame: number
	minBlockSize: number
	maxBlockSize: number
	maxShift: number
	tearChance: number
	paletteShiftChance: number
	noiseFillChance: number
	baseChars: string
	noiseChars: string
	wrap: boolean
}

// Memoized JSON.stringify state key: getStateKey is called every frame (from both
// renderDatamoshFrame and createAsciiDatamoshSampler) with unchanged options in the common
// case. Cache the built string against the last inputs seen (single-slot, mirroring the
// numeric-comparison pattern used elsewhere in the generators for cached derived values).
let lastDatamoshKeyInputs: DatamoshKeyInputs | null = null
let lastDatamoshKeyStr: string | null = null

function getStateKey(
	columns: number,
	rows: number,
	options: Required<AsciiDatamoshOptions>
): string {
	const prev = lastDatamoshKeyInputs
	if (
		prev &&
		lastDatamoshKeyStr &&
		prev.columns === columns &&
		prev.rows === rows &&
		prev.seed === options.seed &&
		prev.bgColor === options.bgColor &&
		prev.keyframeIntervalFrames === options.keyframeIntervalFrames &&
		prev.blockOpsPerFrame === options.blockOpsPerFrame &&
		prev.minBlockSize === options.minBlockSize &&
		prev.maxBlockSize === options.maxBlockSize &&
		prev.maxShift === options.maxShift &&
		prev.tearChance === options.tearChance &&
		prev.paletteShiftChance === options.paletteShiftChance &&
		prev.noiseFillChance === options.noiseFillChance &&
		prev.baseChars === options.baseChars &&
		prev.noiseChars === options.noiseChars &&
		prev.wrap === options.wrap
	) {
		return lastDatamoshKeyStr
	}

	// Important: include anything that changes the “physics” / output determinism.
	const inputs: DatamoshKeyInputs = {
		columns,
		rows,
		seed: options.seed,
		bgColor: options.bgColor,
		keyframeIntervalFrames: options.keyframeIntervalFrames,
		blockOpsPerFrame: options.blockOpsPerFrame,
		minBlockSize: options.minBlockSize,
		maxBlockSize: options.maxBlockSize,
		maxShift: options.maxShift,
		tearChance: options.tearChance,
		paletteShiftChance: options.paletteShiftChance,
		noiseFillChance: options.noiseFillChance,
		baseChars: options.baseChars,
		noiseChars: options.noiseChars,
		wrap: options.wrap,
	}
	lastDatamoshKeyStr = JSON.stringify(inputs)
	lastDatamoshKeyInputs = inputs
	return lastDatamoshKeyStr
}

function resolveOptions(options: AsciiDatamoshOptions): Required<AsciiDatamoshOptions> {
	return {
		seed: Number.isFinite(options.seed as number) ? (options.seed as number) : DEFAULTS.seed,
		bgColor: (options.bgColor ?? DEFAULTS.bgColor).toString(),
		keyframeIntervalFrames: clampInt(
			options.keyframeIntervalFrames ?? DEFAULTS.keyframeIntervalFrames,
			1,
			600
		),
		blockOpsPerFrame: clampInt(options.blockOpsPerFrame ?? DEFAULTS.blockOpsPerFrame, 0, 200),
		minBlockSize: clampInt(options.minBlockSize ?? DEFAULTS.minBlockSize, 1, 200),
		maxBlockSize: clampInt(options.maxBlockSize ?? DEFAULTS.maxBlockSize, 1, 400),
		maxShift: clampInt(options.maxShift ?? DEFAULTS.maxShift, 0, 200),
		tearChance: clamp01(options.tearChance ?? DEFAULTS.tearChance),
		paletteShiftChance: clamp01(options.paletteShiftChance ?? DEFAULTS.paletteShiftChance),
		noiseFillChance: clamp01(options.noiseFillChance ?? DEFAULTS.noiseFillChance),
		baseChars: (options.baseChars ?? DEFAULTS.baseChars).toString(),
		noiseChars: (options.noiseChars ?? DEFAULTS.noiseChars).toString(),
		wrap: options.wrap ?? DEFAULTS.wrap,
	}
}

function snapshotCells(cells: CellArrays): CellArrays {
	return {
		chars: cells.chars.slice(),
		fg: cells.fg.slice(),
		bg: cells.bg,
		bold: cells.bold.slice(),
	}
}

function advanceState(
	frame: number,
	columns: number,
	rows: number,
	opts: Required<AsciiDatamoshOptions>,
	state: DatamoshState
) {
	// Reset if frame goes backwards (restart / seek).
	if (frame < state.lastFrame) {
		state.lastFrame = -1
		state.lastKeyframe = -1
	}

	// Decide if we need a keyframe refresh.
	const interval = Math.max(1, opts.keyframeIntervalFrames)
	const shouldKeyframe = state.lastKeyframe < 0 || frame === 0 || frame % interval === 0

	// If this exact frame is already processed, do nothing.
	if (frame <= state.lastFrame) return

	if (shouldKeyframe) {
		fillKeyframeBase(
			frame,
			columns,
			rows,
			{
				seed: opts.seed,
				baseChars: opts.baseChars,
				bgColor: opts.bgColor,
			},
			state.cells
		)
		state.lastKeyframe = frame
		state.lastFrame = frame
		return
	}

	// Apply corruption ops on top of existing buffer.
	const rng = makeRng((opts.seed ^ (frame * 0x9e3779b1)) >>> 0)

	const minB = Math.min(opts.minBlockSize, opts.maxBlockSize)
	const maxB = Math.max(opts.minBlockSize, opts.maxBlockSize)
	const maxShift = opts.maxShift
	const wrap = opts.wrap

	// Reuse pre-allocated read buffer instead of allocating new arrays each frame
	if (!state.readCells) {
		state.readCells = snapshotCells(state.cells)
	} else {
		// Copy into existing arrays
		const n = state.cells.chars.length
		for (let i = 0; i < n; i++) {
			state.readCells.chars[i] = state.cells.chars[i]
			state.readCells.fg[i] = state.cells.fg[i]
			state.readCells.bold[i] = state.cells.bold[i]
		}
		state.readCells.bg = state.cells.bg
	}
	const readCells = state.readCells

	// Block ops, tears, and palette shifts each read from readCells and write to
	// state.cells, and each subsequent op stage is meant to see the *previous* stage's
	// same-frame writes (tear picks up the block-op output, palette shift picks up the
	// tear output) — so readCells must be resynced with state.cells between stages.
	// Rather than doing a full O(columns*rows) copy for every resync, track which rects
	// state.cells diverged from readCells in and resync only those (still exact — no
	// output change — since it's the same cells that changed, just not the whole grid).
	const dirtyRects: Array<{ x0: number; y0: number; w: number; h: number }> = []

	function syncDirtyRectsToReadCells() {
		for (let r = 0; r < dirtyRects.length; r++) {
			const rect = dirtyRects[r]
			copyRect(state.cells, readCells, columns, rows, rect.x0, rect.y0, rect.w, rect.h, 0, 0, wrap)
		}
		dirtyRects.length = 0
	}

	const ops = opts.blockOpsPerFrame
	for (let op = 0; op < ops; op++) {
		const w = clampInt(lerp(minB, maxB, rng()), 1, columns)
		const h = clampInt(lerp(minB, maxB, rng()), 1, rows)

		const x0 = clampInt(rng() * columns, 0, columns - 1)
		const y0 = clampInt(rng() * rows, 0, rows - 1)

		const dx = clampInt((rng() * 2 - 1) * maxShift, -maxShift, maxShift)
		const dy = clampInt((rng() * 2 - 1) * maxShift, -maxShift, maxShift)

		copyRect(readCells, state.cells, columns, rows, x0, y0, w, h, dx, dy, wrap)
		dirtyRects.push({ x0: x0 + dx, y0: y0 + dy, w, h })
	}

	// Horizontal tearing (scanline band shift) — reuse readCells buffer
	if (rng() < opts.tearChance) {
		const bandH = clampInt(lerp(1, Math.max(2, Math.floor(rows * 0.15)), rng()), 1, rows)
		const y0 = clampInt(rng() * rows, 0, rows - 1)
		const shift = clampInt((rng() * 2 - 1) * maxShift, -maxShift, maxShift)
		// Resync readCells with the block-op writes above before tear reads it.
		syncDirtyRectsToReadCells()
		horizontalTear(readCells, state.cells, columns, rows, y0, bandH, shift, wrap)
		// Tear can permute a written cell to any column in the band (wrap) or leave gaps
		// (no wrap); mark the full-width band dirty rather than tracking the exact permutation.
		dirtyRects.push({ x0: 0, y0, w: columns, h: bandH })
	}

	// Palette shift blocks — reuse readCells buffer
	if (rng() < opts.paletteShiftChance) {
		const shifts = [3, 5, 7, 11, -3, -5, -7, -11]
		const shift = shifts[clampInt(rng() * shifts.length, 0, shifts.length - 1)]
		const w = clampInt(lerp(minB, maxB, rng()), 1, columns)
		const h = clampInt(lerp(minB, maxB, rng()), 1, rows)
		const x0 = clampInt(rng() * columns, 0, columns - 1)
		const y0 = clampInt(rng() * rows, 0, rows - 1)
		// Resync readCells with the tear (or block-op) writes above before palette shift reads it.
		syncDirtyRectsToReadCells()
		paletteShiftRect(readCells, state.cells, columns, rows, x0, y0, w, h, shift, wrap)
	}

	// Noise fill blocks
	if (rng() < opts.noiseFillChance) {
		const w = clampInt(lerp(minB, maxB, rng()), 1, columns)
		const h = clampInt(lerp(minB, maxB, rng()), 1, rows)
		const x0 = clampInt(rng() * columns, 0, columns - 1)
		const y0 = clampInt(rng() * rows, 0, rows - 1)
		noiseFillRect(state.cells, columns, rows, x0, y0, w, h, opts.seed, frame, opts.noiseChars, wrap)
	}

	state.lastFrame = frame
}

function renderDatamoshFrame(
	store: GeneratorStateStore<DatamoshState>,
	frame: number,
	columns: number,
	rows: number,
	options: AsciiDatamoshOptions
): AnsiScreen {
	const opts = resolveOptions(options)
	const stateKey = getStateKey(columns, rows, opts)

	let state = store.get(stateKey)
	if (!state) {
		state = {
			cells: createCellArrays(columns, rows, opts.bgColor),
			readCells: null,
			lastFrame: -1,
			lastKeyframe: -1,
		}
		store.set(stateKey, state)
	}

	advanceState(frame, columns, rows, opts, state)

	const lines: AnsiScreen['lines'] = []
	let i = 0
	for (let y = 0; y < rows; y++) {
		const line: AnsiScreen['lines'][number] = []
		for (let x = 0; x < columns; x++) {
			line.push({
				ch: state.cells.chars[i],
				fg: state.cells.fg[i],
				bg: state.cells.bg,
				bold: state.cells.bold[i],
			})
			i++
		}
		lines.push(line)
	}

	return { lines, columns }
}

/**
 * Create a sampler that returns cells from an internal “virtual” buffer.
 * This is useful for windowed/scrollable virtual worlds.
 *
 * Notes:
 * - The sampler wraps coordinates (like classic demo effects) for stability.
 * - Provide `virtualColumns` / `virtualRows` when using this for virtual worlds.
 */
export function createAsciiDatamoshSampler(
	frame: number,
	options: AsciiDatamoshOptions & { virtualColumns?: number; virtualRows?: number } = {}
) {
	const virtualColumns = clampInt(options.virtualColumns ?? 200, 1, 2000)
	const virtualRows = clampInt(options.virtualRows ?? 120, 1, 2000)

	const opts = resolveOptions(options)
	const stateKey = getStateKey(virtualColumns, virtualRows, opts)

	let state = sharedStore.get(stateKey)
	if (!state) {
		state = {
			cells: createCellArrays(virtualColumns, virtualRows, opts.bgColor),
			readCells: null,
			lastFrame: -1,
			lastKeyframe: -1,
		}
		sharedStore.set(stateKey, state)
	}

	advanceState(frame, virtualColumns, virtualRows, opts, state)

	return (x: number, y: number) => {
		const xx = wrapIndex(x, virtualColumns)
		const yy = wrapIndex(y, virtualRows)
		const i = yy * virtualColumns + xx
		return {
			ch: state.cells.chars[i],
			fg: state.cells.fg[i],
			bg: state.cells.bg,
			bold: state.cells.bold[i],
		}
	}
}

/**
 * Generate an ASCII datamosh frame — block-based compression-artifact glitching.
 *
 * Uses process-wide state keyed on dimensions and options, so separate components with
 * matching options will interfere with each other. Prefer
 * {@link createAsciiDatamoshGenerator} when rendering more than one instance.
 */
export function generateAsciiDatamoshFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiDatamoshOptions = {}
): AnsiScreen {
	return renderDatamoshFrame(sharedStore, frame, columns, rows, options)
}

/**
 * Create a datamosh generator that owns its cell buffers.
 * Each call returns an independent instance safe to render alongside others.
 */
export function createAsciiDatamoshGenerator(
	options: AsciiDatamoshOptions = {}
): CharacterFrameGenerator {
	const store = createGeneratorStateStore<DatamoshState>()
	return (frame: number, columns: number, rows: number) =>
		renderDatamoshFrame(store, frame, columns, rows, options)
}

/**
 * Clear the datamosh state shared by generateAsciiDatamoshFrame and
 * createAsciiDatamoshSampler callers. Instances from createAsciiDatamoshGenerator
 * own their state and are unaffected.
 */
export function clearDatamoshState() {
	sharedStore.clear()
}
