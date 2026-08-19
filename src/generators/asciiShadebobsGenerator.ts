import type { AnsiScreen } from '../ansi/types'
import type { CharacterFrameGenerator } from '../types/types'
import { buildCharLookup } from './charLookup'
import { createGeneratorStateStore, type GeneratorStateStore } from './generatorState'
import { catchupSteps } from './simulationCatchup'

// Classic Amiga shadebobs — a handful of soft blobs sweep the screen on Lissajous
// paths, each ADDING energy into a persistent accumulation buffer that decays a
// little every step. The additive deposit plus decay is the whole effect: a moving
// bob leaves a fading trail behind it, and wherever two paths cross the deposits
// stack up and the crossing glows brighter than either bob alone.
//
// The buffer is real simulation state (this frame's glow depends on where the bobs
// have BEEN, not just where they are), so this generator follows the stateful
// pattern from asciiCyclicAutomatonGenerator: a per-instance state store, a capped
// catch-up loop, and a reset on backward seeks. Deposits are computed at absolute
// frame times, so two fresh same-seed instances stepping frame-by-frame agree.

// Cells are ~2x taller than wide; vertical distances are multiplied by this when
// measuring the gaussian falloff so bobs render round instead of egg-shaped.
const CELL_ASPECT = 2

const DEFAULT_BOB_COUNT = 5
const MIN_BOB_COUNT = 1
const MAX_BOB_COUNT = 16
const DEFAULT_BOB_SIZE = 5
const MIN_BOB_SIZE = 1.5
const MAX_BOB_SIZE = 24
// 0.92^28 ≈ 0.10 — a saturated cell falls back under the first ramp threshold in
// just under a second at 30fps, which is the "smooth trail" sweet spot.
const DEFAULT_TRAIL_DECAY = 0.92
const MIN_TRAIL_DECAY = 0.5
const MAX_TRAIL_DECAY = 0.995
const DEFAULT_SPEED = 1
const MIN_SPEED = 0.05
const MAX_SPEED = 8
const DEFAULT_SEED = 2001
// Deposit amplitude per bob per step. A bob moving at typical path speed stacks a
// few consecutive deposits on the cells it passes over (~0.8-1.0 at the core), and
// crossings push past 1.0 into the clamped white end of the ramp.
const DEPOSIT_AMPLITUDE = 0.34
// All CP437-safe (verified via charToCp437Byte): · is 0xFA, █ is 0xDB.
const DEFAULT_CHARS = [' ', '·', ':', ';', '+', '=', 'x', 'X', '#', '█']
// Black → deep purple → magenta → orange → white heat ramp.
const DEFAULT_PALETTE = ['#000000', '#38105e', '#c716c7', '#ff8820', '#ffffff']
const DEFAULT_BG_COLOR = '#000000'

export interface AsciiShadebobsOptions {
	/** Number of bobs sweeping the screen (1-16). Default: 5 */
	bobCount?: number
	/** Bob radius in cell widths (gaussian sigma, aspect-corrected vertically). Default: 5 */
	bobSize?: number
	/** Per-step energy decay factor (0.5-0.995); lower fades trails faster. Default: 0.92 */
	trailDecay?: number
	/** Path speed multiplier for the Lissajous orbits. Default: 1 */
	speed?: number
	/** Seed for the per-bob orbit frequencies and phases. Default: 2001 */
	seed?: number
	/** Brightness ramp characters, dark to bright. Default: ' ·:;+=xX#█' */
	chars?: string[]
	/**
	 * Gradient stops (CSS hex colors) interpolated into a 256-entry energy→color
	 * table. Default: black → deep purple → magenta → orange → white
	 */
	palette?: string[]
	/** Background color (CSS color string). Default: '#000000' */
	bgColor?: string
}

// Deterministic RNG — same LCG as the other generators in this package.
function createRandom(seed: number) {
	let state = seed >>> 0
	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0
		return state / 0xffffffff
	}
}

function clampNumber(raw: number | undefined, fallback: number, min: number, max: number): number {
	if (raw === undefined || !Number.isFinite(raw)) return fallback
	return Math.max(min, Math.min(max, raw))
}

// Resolve and clamp every option in one place; non-finite or out-of-range input
// falls back to the default instead of propagating NaN into a char index.
function resolveOptions(options: AsciiShadebobsOptions): Required<AsciiShadebobsOptions> {
	return {
		bobCount: Math.round(clampNumber(options.bobCount, DEFAULT_BOB_COUNT, MIN_BOB_COUNT, MAX_BOB_COUNT)),
		bobSize: clampNumber(options.bobSize, DEFAULT_BOB_SIZE, MIN_BOB_SIZE, MAX_BOB_SIZE),
		trailDecay: clampNumber(options.trailDecay, DEFAULT_TRAIL_DECAY, MIN_TRAIL_DECAY, MAX_TRAIL_DECAY),
		speed: clampNumber(options.speed, DEFAULT_SPEED, MIN_SPEED, MAX_SPEED),
		seed: Number.isFinite(options.seed ?? DEFAULT_SEED) ? Math.floor(options.seed ?? DEFAULT_SEED) : DEFAULT_SEED,
		chars: options.chars && options.chars.length > 0 ? options.chars : DEFAULT_CHARS,
		palette: options.palette && options.palette.length > 0 ? options.palette : DEFAULT_PALETTE,
		bgColor: options.bgColor ?? DEFAULT_BG_COLOR,
	}
}

// Parse a CSS hex color (#rgb or #rrggbb); rgb(...) strings also accepted.
function parseColor(color: string): [number, number, number] {
	if (color.startsWith('#')) {
		const hex = color.slice(1)
		if (hex.length === 3) {
			return [
				parseInt(hex[0] + hex[0], 16),
				parseInt(hex[1] + hex[1], 16),
				parseInt(hex[2] + hex[2], 16),
			]
		}
		return [
			parseInt(hex.slice(0, 2), 16),
			parseInt(hex.slice(2, 4), 16),
			parseInt(hex.slice(4, 6), 16),
		]
	}
	const match = color.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
	if (match) {
		return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]
	}
	return [255, 255, 255]
}

// Memoized char lookup (identity-keyed like getCharLookup in asciiCopperBarsGenerator).
let lastChars: string[] | null = null
let lastCharLookup: string[] | null = null

function getCharLookup(chars: string[]): string[] {
	if (lastChars === chars && lastCharLookup) return lastCharLookup
	lastCharLookup = buildCharLookup(chars)
	lastChars = chars
	return lastCharLookup
}

// Precomputed 256-entry color gradient interpolated from the palette stops.
// Identity-keyed on the palette array, so the table is built once per option set
// instead of an rgb() string per cell per frame.
let lastPalette: string[] | null = null
let lastColorTable: string[] | null = null

function getColorTable(palette: string[]): string[] {
	if (lastPalette === palette && lastColorTable) return lastColorTable
	const stops = palette.map(parseColor)
	const table = new Array<string>(256)
	const segments = Math.max(1, stops.length - 1)
	for (let i = 0; i < 256; i++) {
		const t = (i / 255) * segments
		const seg = Math.min(segments - 1, Math.floor(t))
		const frac = t - seg
		const a = stops[seg]
		const b = stops[Math.min(stops.length - 1, seg + 1)]
		const r = Math.round(a[0] + (b[0] - a[0]) * frac)
		const g = Math.round(a[1] + (b[1] - a[1]) * frac)
		const bl = Math.round(a[2] + (b[2] - a[2]) * frac)
		table[i] = `rgb(${r},${g},${bl})`
	}
	lastPalette = palette
	lastColorTable = table
	return table
}

// Per-bob Lissajous parameters, cached by seed + bobCount (getBarConfigs pattern).
// Frequencies are deliberately incommensurate-ish so paths precess and cross often.
interface BobConfig {
	freqX: number
	freqY: number
	phaseX: number
	phaseY: number
}

let lastBobConfigKey: string | null = null
let lastBobConfigs: BobConfig[] | null = null

function getBobConfigs(seed: number, bobCount: number): BobConfig[] {
	const key = `${seed}:${bobCount}`
	if (key === lastBobConfigKey && lastBobConfigs) return lastBobConfigs
	const random = createRandom(seed)
	const configs: BobConfig[] = []
	for (let i = 0; i < bobCount; i++) {
		configs.push({
			freqX: 0.021 + random() * 0.03,
			freqY: 0.017 + random() * 0.03,
			phaseX: random() * Math.PI * 2,
			phaseY: random() * Math.PI * 2,
		})
	}
	lastBobConfigKey = key
	lastBobConfigs = configs
	return configs
}

interface ShadebobsState {
	/** Accumulated energy per cell, columns*rows. Float64 — feeds char/color thresholds. */
	energy: Float64Array
	lastFrame: number
}

// State shared by all callers of generateAsciiShadebobsFrame. Prefer
// createAsciiShadebobsGenerator, which gives each instance its own.
const sharedStore = createGeneratorStateStore<ShadebobsState>()

/**
 * Clear the shadebobs state shared by generateAsciiShadebobsFrame callers.
 * Instances from createAsciiShadebobsGenerator own their state and are unaffected.
 */
export function clearShadebobsState(): void {
	sharedStore.clear()
}

// Memoized state-key builder (copied from asciiCyclicAutomatonGenerator). Only
// params that affect *initialization or deposit history* belong in the key: the
// energy buffer's contents depend on dimensions, orbit shape (seed/bobCount) and
// dynamics (bobSize/trailDecay/speed); render-only options (chars/palette/bgColor)
// can change on a running buffer without a reset.
interface StateKeyParams {
	columns: number
	rows: number
	seed: number
	bobCount: number
	bobSize: number
	trailDecay: number
	speed: number
}

let lastStateKeyParams: StateKeyParams | null = null
let lastStateKey: string | null = null

function getStateKey(p: StateKeyParams): string {
	if (
		lastStateKeyParams &&
		lastStateKeyParams.columns === p.columns &&
		lastStateKeyParams.rows === p.rows &&
		lastStateKeyParams.seed === p.seed &&
		lastStateKeyParams.bobCount === p.bobCount &&
		lastStateKeyParams.bobSize === p.bobSize &&
		lastStateKeyParams.trailDecay === p.trailDecay &&
		lastStateKeyParams.speed === p.speed &&
		lastStateKey
	) {
		return lastStateKey
	}
	lastStateKeyParams = p
	// Delimited field concatenation, never JSON.stringify — every field is a number
	// in a fixed position, so there is no shape or property-order ambiguity.
	lastStateKey = `${p.columns}:${p.rows}:${p.seed}:${p.bobCount}:${p.bobSize}:${p.trailDecay}:${p.speed}`
	return lastStateKey
}

/**
 * Deposit one gaussian blob of energy centered at (cx, cy), aspect-corrected so
 * the blob is round on screen. Only the bounding box within ~3 sigma is touched.
 */
function depositBob(
	energy: Float64Array,
	columns: number,
	rows: number,
	cx: number,
	cy: number,
	sigma: number,
): void {
	const invSigmaSq2 = 1 / (2 * sigma * sigma)
	const reachX = sigma * 3
	const reachY = (sigma * 3) / CELL_ASPECT
	const x0 = Math.max(0, Math.floor(cx - reachX))
	const x1 = Math.min(columns - 1, Math.ceil(cx + reachX))
	const y0 = Math.max(0, Math.floor(cy - reachY))
	const y1 = Math.min(rows - 1, Math.ceil(cy + reachY))

	for (let y = y0; y <= y1; y++) {
		const dy = (y - cy) * CELL_ASPECT
		const dySq = dy * dy
		const row = y * columns
		for (let x = x0; x <= x1; x++) {
			const dx = x - cx
			energy[row + x] += DEPOSIT_AMPLITUDE * Math.exp(-(dx * dx + dySq) * invSigmaSq2)
		}
	}
}

function renderShadebobsFrame(
	store: GeneratorStateStore<ShadebobsState>,
	frame: number,
	columns: number,
	rows: number,
	options: AsciiShadebobsOptions,
): AnsiScreen {
	const resolved = resolveOptions(options)
	const { bobCount, bobSize, trailDecay, speed, seed, chars, palette, bgColor } = resolved

	const stateKey = getStateKey({ columns, rows, seed, bobCount, bobSize, trailDecay, speed })

	let state = store.get(stateKey)
	if (!state || frame < state.lastFrame) {
		state = { energy: new Float64Array(columns * rows), lastFrame: -1 }
		store.set(stateKey, state)
	}

	const energy = state.energy
	const total = columns * rows
	const configs = getBobConfigs(seed, bobCount)
	const halfCols = columns / 2
	const halfRows = rows / 2
	// Keep orbit centers a little inside the edges so blobs stay mostly on screen.
	const orbitX = Math.max(1, halfCols - bobSize * 0.5)
	const orbitY = Math.max(1, halfRows - (bobSize * 0.5) / CELL_ASPECT)

	// Simulate the most recent steps of the gap, capped so a seek or backgrounded
	// tab cannot block the main thread. Deposits use absolute frame times, so two
	// same-seed instances stepping frame-by-frame stay in lockstep.
	const cappedSteps = catchupSteps(frame, state.lastFrame)
	for (let step = 0; step < cappedSteps; step++) {
		const t = (frame - cappedSteps + 1 + step) * speed

		// Decay the whole buffer first, then deposit — the freshly drawn bob is at
		// full brightness while everything behind it fades.
		for (let i = 0; i < total; i++) energy[i] *= trailDecay

		for (let b = 0; b < bobCount; b++) {
			const cfg = configs[b]
			const cx = halfCols + Math.sin(t * cfg.freqX + cfg.phaseX) * orbitX
			const cy = halfRows + Math.sin(t * cfg.freqY + cfg.phaseY) * orbitY
			depositBob(energy, columns, rows, cx, cy, bobSize)
		}
	}
	state.lastFrame = frame

	const charLookup = getCharLookup(chars)
	const colorTable = getColorTable(palette)

	const lines: AnsiScreen['lines'] = []
	for (let y = 0; y < rows; y++) {
		const line: AnsiScreen['lines'][number] = []
		const row = y * columns
		for (let x = 0; x < columns; x++) {
			const e = energy[row + x]
			const level = e >= 1 ? 255 : e <= 0 ? 0 : Math.floor(e * 255)
			line.push({
				ch: charLookup[level],
				fg: colorTable[level],
				bg: bgColor,
				bold: level > 200,
			})
		}
		lines.push(line)
	}

	return { lines, columns }
}

/**
 * Generate an ASCII shadebobs frame — the classic Amiga effect of soft additive
 * blobs sweeping Lissajous paths, leaving decaying trails that glow brighter
 * where paths cross.
 *
 * Uses process-wide state keyed on dimensions and options, so separate components
 * with matching options will interfere with each other. Prefer
 * {@link createAsciiShadebobsGenerator} when rendering more than one instance.
 */
export function generateAsciiShadebobsFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiShadebobsOptions = {},
): AnsiScreen {
	return renderShadebobsFrame(sharedStore, frame, columns, rows, options)
}

/**
 * Create a shadebobs generator that owns its energy buffer.
 * Each call returns an independent instance safe to render alongside others.
 */
export function createAsciiShadebobsGenerator(
	options: AsciiShadebobsOptions = {},
): CharacterFrameGenerator {
	const store = createGeneratorStateStore<ShadebobsState>()
	return (frame: number, columns: number, rows: number) =>
		renderShadebobsFrame(store, frame, columns, rows, options)
}

/**
 * Create a reusable sampler for shadebobs at a specific frame.
 * Returns a function that maps world coordinates (x, y) to an ANSI cell.
 */
export function createAsciiShadebobsSampler(
	frame: number,
	options: AsciiShadebobsOptions = {},
) {
	const { bgColor = DEFAULT_BG_COLOR } = options

	const cols = 120
	const rows = 60
	const screen = generateAsciiShadebobsFrame(frame, cols, rows, options)

	return (x: number, y: number) => {
		const wrappedX = ((x % cols) + cols) % cols
		const wrappedY = ((y % rows) + rows) % rows

		const cell = screen.lines[wrappedY]?.[wrappedX]
		if (!cell) {
			return { ch: ' ', fg: bgColor, bg: bgColor, bold: false }
		}
		return cell
	}
}
