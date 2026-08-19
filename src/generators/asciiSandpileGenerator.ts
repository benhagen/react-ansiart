import type { AnsiScreen } from '../ansi/types'
import type { CharacterFrameGenerator } from '../types/types'
import { createGeneratorStateStore, type GeneratorStateStore } from './generatorState'
import { catchupSteps } from './simulationCatchup'

// Abelian sandpile (Bak–Tang–Wiesenfeld). Grains drop onto one cell; any cell holding
// 4 or more grains topples, sending one grain to each von Neumann neighbor, and grains
// that fall off the open boundary vanish. From a centered drop point this grows the
// classic self-similar mandala: concentric rings of stable counts threaded by fractal
// filaments, with avalanches occasionally rippling across the whole pile.
//
// Toppling is the true Abelian rule on the square cell grid — the final stable
// configuration is independent of topple order, which is what makes the pattern exact
// and perfectly symmetric. Character cells are ~2x taller than wide, so like every
// square cellular automaton rendered on a text grid (the game-of-life generator in
// this package included), the pile appears stretched 2:1 horizontally on screen.
// Distorting the topple rule to compensate would destroy the Abelian math and the
// fractal, so the stretch is left in.
//
// Topple sweeps per substep are capped (maxToppleSweeps): leftover unstable cells
// simply carry into the next frame, so a large avalanche visibly ripples outward over
// several frames instead of resolving instantly — which both looks good and bounds
// per-frame cost.

const DEFAULT_GRAINS_PER_STEP = 8
const DEFAULT_STEPS_PER_FRAME = 1
const DEFAULT_MAX_TOPPLE_SWEEPS = 24
const MAX_TOPPLE_SWEEPS_LIMIT = 10000
// Classic sandpile coloring: counts 0-3 from near-black through blue and purple to
// gold, plus a 5th "hot" flash color for cells caught mid-avalanche (count >= 4).
const DEFAULT_PALETTE = ['#0d0d1a', '#2864dc', '#9a3cd8', '#ffc832', '#ffffff']
const PALETTE_SIZE = 5
// Solid block for occupied counts — the palette carries the signal. All CP437-safe.
const DEFAULT_CHARS = [' ', '█', '█', '█', '█']
const DEFAULT_BG_COLOR = '#000000'
const DEFAULT_DROP_X = 0.5
const DEFAULT_DROP_Y = 0.5

export interface AsciiSandpileOptions {
	/** Grains added at the drop point per simulation substep. Default: 8 */
	grainsPerStep?: number
	/** Simulation substeps per frame. Default: 1 */
	stepsPerFrame?: number
	/**
	 * Maximum full-grid topple sweeps per substep. Cells still unstable when the cap
	 * hits carry into the next frame, so big avalanches ripple over several frames.
	 * Default: 24
	 */
	maxToppleSweeps?: number
	/**
	 * Five colors for grain counts [0, 1, 2, 3, >=4-mid-avalanche] (CSS color strings).
	 * Default: near-black, blue, purple, gold, white
	 */
	palette?: string[]
	/**
	 * Characters indexed by min(grain count, 4). Default: [' ', '█', '█', '█', '█']
	 */
	chars?: string[]
	/** Background color (CSS color string). Default: '#000000' */
	bgColor?: string
	/** Drop point x as a fraction of the grid width (0-1). Default: 0.5 */
	dropX?: number
	/** Drop point y as a fraction of the grid height (0-1). Default: 0.5 */
	dropY?: number
}

function clampNum(v: number | undefined, min: number, max: number, fallback: number): number {
	if (v === undefined || !Number.isFinite(v)) return fallback
	return Math.min(max, Math.max(min, v))
}

interface ResolvedSandpileOptions {
	grainsPerStep: number
	stepsPerFrame: number
	maxToppleSweeps: number
	palette: string[]
	chars: string[]
	bgColor: string
	dropX: number
	dropY: number
}

// Resolve and clamp every option in one place — non-finite or out-of-range input falls
// back to the default, so nothing NaN can reach a grid index.
function resolveOptions(options: AsciiSandpileOptions): ResolvedSandpileOptions {
	return {
		grainsPerStep: Math.round(clampNum(options.grainsPerStep, 1, 1000, DEFAULT_GRAINS_PER_STEP)),
		stepsPerFrame: Math.round(clampNum(options.stepsPerFrame, 1, 10, DEFAULT_STEPS_PER_FRAME)),
		maxToppleSweeps: Math.round(
			clampNum(options.maxToppleSweeps, 1, MAX_TOPPLE_SWEEPS_LIMIT, DEFAULT_MAX_TOPPLE_SWEEPS),
		),
		palette: options.palette !== undefined && options.palette.length > 0 ? options.palette : DEFAULT_PALETTE,
		chars: options.chars !== undefined && options.chars.length > 0 ? options.chars : DEFAULT_CHARS,
		bgColor: options.bgColor ?? DEFAULT_BG_COLOR,
		dropX: clampNum(options.dropX, 0, 1, DEFAULT_DROP_X),
		dropY: clampNum(options.dropY, 0, 1, DEFAULT_DROP_Y),
	}
}

// ---- Memoized count -> color table (5 entries, padded from the palette option) ----
let lastPaletteKey: string | null = null
let lastPaletteTable: string[] | null = null

function getPaletteTable(palette: string[]): string[] {
	// Delimited concatenation, never JSON.stringify — fixed field order, no shape ambiguity.
	const key = palette.join('|')
	if (key === lastPaletteKey && lastPaletteTable) return lastPaletteTable

	const table = new Array<string>(PALETTE_SIZE)
	for (let i = 0; i < PALETTE_SIZE; i++) {
		table[i] = palette[i] ?? DEFAULT_PALETTE[i]
	}
	lastPaletteKey = key
	lastPaletteTable = table
	return table
}

// ---- Memoized count -> char table (5 entries; short arrays index modulo length) ----
let lastCharsKey: string | null = null
let lastCharsTable: string[] | null = null

function getCharTable(chars: string[]): string[] {
	const key = chars.join('|')
	if (key === lastCharsKey && lastCharsTable) return lastCharsTable

	const table = new Array<string>(PALETTE_SIZE)
	for (let i = 0; i < PALETTE_SIZE; i++) {
		table[i] = chars[i % chars.length]
	}
	lastCharsKey = key
	lastCharsTable = table
	return table
}

interface SandpileState {
	/** Grain count per cell. Cells >= 4 are mid-avalanche, waiting to topple. */
	grid: Uint32Array
	lastFrame: number
}

// State shared by all callers of generateAsciiSandpileFrame. Prefer
// createAsciiSandpileGenerator, which gives each instance its own.
const sharedStore = createGeneratorStateStore<SandpileState>()

/**
 * Clear the sandpile state shared by generateAsciiSandpileFrame callers.
 * Instances from createAsciiSandpileGenerator own their state and are unaffected.
 */
export function clearSandpileState(): void {
	sharedStore.clear()
}

// Memoized state-key builder — avoids rebuilding the key string every frame. Only
// params that affect *initialization* belong in the key, and the grid always starts
// empty, so dimensions alone identify a simulation (drop point, grain rate, and sweep
// cap only shape the step rule and can change on a running pile).
let lastStateKeyParams: { columns: number; rows: number } | null = null
let lastStateKey: string | null = null

function getStateKey(columns: number, rows: number): string {
	if (
		lastStateKeyParams &&
		lastStateKeyParams.columns === columns &&
		lastStateKeyParams.rows === rows &&
		lastStateKey
	) {
		return lastStateKey
	}
	lastStateKeyParams = { columns, rows }
	lastStateKey = `${columns}:${rows}`
	return lastStateKey
}

/**
 * One simulation substep: add grains at the drop point, then run in-place topple
 * sweeps until the pile is stable or the sweep cap is reached. In-place sequential
 * toppling is safe because the sandpile is Abelian — the stable configuration does not
 * depend on topple order. Each sweep topples every unstable cell it encounters, moving
 * floor(count / 4) grain quadruples at once; grains pushed past the open boundary
 * vanish.
 */
function stepSandpile(
	grid: Uint32Array,
	columns: number,
	rows: number,
	dropCol: number,
	dropRow: number,
	grainsPerStep: number,
	maxToppleSweeps: number,
): void {
	grid[dropRow * columns + dropCol] += grainsPerStep

	for (let sweep = 0; sweep < maxToppleSweeps; sweep++) {
		let toppled = false
		for (let y = 0; y < rows; y++) {
			const row = y * columns
			for (let x = 0; x < columns; x++) {
				const idx = row + x
				const count = grid[idx]
				if (count < 4) continue
				const quads = count >>> 2
				grid[idx] = count & 3
				if (x > 0) grid[idx - 1] += quads
				if (x < columns - 1) grid[idx + 1] += quads
				if (y > 0) grid[idx - columns] += quads
				if (y < rows - 1) grid[idx + columns] += quads
				toppled = true
			}
		}
		if (!toppled) break
	}
}

function renderSandpileFrame(
	store: GeneratorStateStore<SandpileState>,
	frame: number,
	columns: number,
	rows: number,
	options: AsciiSandpileOptions,
): AnsiScreen {
	const opts = resolveOptions(options)
	const stateKey = getStateKey(columns, rows)

	let state = store.get(stateKey)
	if (!state || frame < state.lastFrame) {
		state = { grid: new Uint32Array(columns * rows), lastFrame: -1 }
		store.set(stateKey, state)
	}

	const dropCol = Math.min(columns - 1, Math.max(0, Math.round(opts.dropX * (columns - 1))))
	const dropRow = Math.min(rows - 1, Math.max(0, Math.round(opts.dropY * (rows - 1))))

	// Simulate forward, capped so a large jump (backgrounded tab, seek) cannot block
	// the main thread proportionally to the gap.
	const cappedSteps = catchupSteps(frame, state.lastFrame) * opts.stepsPerFrame
	for (let step = 0; step < cappedSteps; step++) {
		stepSandpile(state.grid, columns, rows, dropCol, dropRow, opts.grainsPerStep, opts.maxToppleSweeps)
	}
	state.lastFrame = frame

	const grid = state.grid
	const paletteTable = getPaletteTable(opts.palette)
	const charTable = getCharTable(opts.chars)
	const bgColor = opts.bgColor

	const lines: AnsiScreen['lines'] = []
	for (let y = 0; y < rows; y++) {
		const line: AnsiScreen['lines'][number] = []
		const row = y * columns
		for (let x = 0; x < columns; x++) {
			const count = grid[row + x]
			const level = count < 4 ? count : 4
			line.push({ ch: charTable[level], fg: paletteTable[level], bg: bgColor, bold: false })
		}
		lines.push(line)
	}

	return { lines, columns }
}

/**
 * Generate an ASCII Abelian sandpile frame — grains drop onto one cell and topple
 * outward, growing a symmetric fractal mandala rippled by avalanches. The render is
 * stretched 2:1 horizontally like every square cellular automaton on a text grid.
 *
 * Uses process-wide state keyed on dimensions, so separate components with matching
 * dimensions will interfere with each other. Prefer
 * {@link createAsciiSandpileGenerator} when rendering more than one instance.
 */
export function generateAsciiSandpileFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiSandpileOptions = {},
): AnsiScreen {
	return renderSandpileFrame(sharedStore, frame, columns, rows, options)
}

/**
 * Create an Abelian sandpile generator that owns its simulation state.
 * Each call returns an independent instance safe to render alongside others.
 */
export function createAsciiSandpileGenerator(
	options: AsciiSandpileOptions = {},
): CharacterFrameGenerator {
	const store = createGeneratorStateStore<SandpileState>()
	return (frame: number, columns: number, rows: number) =>
		renderSandpileFrame(store, frame, columns, rows, options)
}

/**
 * Create a reusable sampler for the sandpile at a specific frame.
 * Returns a function that maps world coordinates (x, y) to an ANSI cell.
 */
export function createAsciiSandpileSampler(
	frame: number,
	options: AsciiSandpileOptions = {},
) {
	const { bgColor = DEFAULT_BG_COLOR } = options

	const cols = 120
	const rows = 60
	const screen = generateAsciiSandpileFrame(frame, cols, rows, options)

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
