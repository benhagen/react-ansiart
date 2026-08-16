import type { AnsiScreen } from '../ansi/types'
import type { CharacterFrameGenerator } from '../types/types'
import { createGeneratorStateStore, type GeneratorStateStore } from './generatorState'
import { catchupSteps } from './simulationCatchup'

// Cyclic cellular automaton — "rock paper scissors" states arranged in a ring. A cell
// advances to the next state in the ring once enough of its neighbors already hold that
// next state. Starting from uniform noise this self-organizes in three visible phases:
// scattered noise, small droplets of a single state eating into their neighbors, and
// finally rotating spiral waves that persist indefinitely. That progression is the point
// of the effect, so early "noisy" frames are not a bug to be smoothed away.
//
// The ring size matters more than it looks: on a character-grid-sized board the
// spiral cores need enough room to close, and the more states there are the
// larger a core has to be. Measured over 40 (seed, dimension) combinations at
// sizes from 40x15 to 120x40, Moore/threshold-1 sustains indefinitely for every
// combination at N <= 12 and dies out to a single uniform colour for roughly
// 40% of them at N = 16. The original default of 14 sat in that failure band,
// which is why the board went solid green after a few hundred steps.
const DEFAULT_STATES = 10
const MIN_STATES = 3
const MAX_STATES = 24
const DEFAULT_THRESHOLD = 1
const DEFAULT_NEIGHBORHOOD: 'moore' | 'vonNeumann' = 'moore'

// Anti-fixation safety net. The defaults above sustain on their own, but the
// rule is fully parameterised (any N up to 24, any threshold, either
// neighbourhood, any board size), and most of that space eventually locks into a
// frozen or uniform board that can never recover on its own. When the board has
// been essentially still for STALL_WINDOW consecutive steps, a small patch is
// re-randomised from a seed derived from (seed, stepCount) — deterministic for a
// given seed and frame sequence, the same way the falling-sand generator's drain
// keeps that simulation from silting up.
const STALL_ACTIVITY_FLOOR = 0.002
const STALL_WINDOW = 24
const REVIVE_PATCH_COLUMNS = 16
const REVIVE_PATCH_ROWS = 8
const DEFAULT_STEPS_PER_FRAME = 1
const DEFAULT_SEED = 1337
const DEFAULT_SATURATION = 0.75
const DEFAULT_LIGHTNESS = 0.5
const DEFAULT_BG_COLOR = '#000000'
const DEFAULT_CHAR = '█' // █

export interface AsciiCyclicAutomatonOptions {
	/**
	 * Number of states in the cyclic ring. Default: 10. Range: 3-24. Values above
	 * ~12 frequently burn out to a single uniform colour on a character-grid-sized
	 * board; the stall detector will restart them, but they will never settle into
	 * steady spirals the way the default does.
	 */
	states?: number
	/** Minimum count of "successor state" neighbors needed for a cell to advance. Default: 1 */
	threshold?: number
	/** Neighborhood used when counting successor-state neighbors. Default: 'moore' (8-neighbor) */
	neighborhood?: 'moore' | 'vonNeumann'
	/** Simulation substeps per frame. Default: 1 */
	stepsPerFrame?: number
	/** Seed for the initial uniform-random state assignment. Default: 1337 */
	seed?: number
	/**
	 * Optional character ramp indexed by state (`chars[state % chars.length]`). Default is a
	 * single solid block for every state, relying entirely on the hue-wheel palette for
	 * contrast between states.
	 */
	chars?: string[]
	/** Saturation of the generated hue-wheel palette (0-1). Default: 0.75 */
	saturation?: number
	/** Lightness of the generated hue-wheel palette (0-1). Default: 0.5 */
	lightness?: number
	/** Background color behind sparse char ramps (CSS color string). Default: '#000000' */
	bgColor?: string
}

// Deterministic RNG — same small LCG used across the other stateful generators in this
// package (see asciiGameOfLifeGenerator.ts / asciiReactionDiffusionGenerator.ts).
function createRandom(seed: number) {
	let state = seed >>> 0
	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0
		return state / 0xffffffff
	}
}

// HSL to RGB, h in [0, 360), s/l in [0, 1]
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
	const c = (1 - Math.abs(2 * l - 1)) * s
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
	const m = l - c / 2
	let r = 0, g = 0, b = 0

	if (h < 60) { r = c; g = x; b = 0 }
	else if (h < 120) { r = x; g = c; b = 0 }
	else if (h < 180) { r = 0; g = c; b = x }
	else if (h < 240) { r = 0; g = x; b = c }
	else if (h < 300) { r = x; g = 0; b = c }
	else { r = c; g = 0; b = x }

	return [
		Math.round((r + m) * 255),
		Math.round((g + m) * 255),
		Math.round((b + m) * 255),
	]
}

// Precomputed N-entry hue-wheel color table, rebuilt only when the parameters that shape
// it change. Every cell of a given state looks up its color here instead of calling
// hslToRgb / building an rgb() string per cell per frame.
let lastHueTableParams: { states: number; saturation: number; lightness: number } | null = null
let lastHueTable: string[] | null = null

function getHueTable(states: number, saturation: number, lightness: number): string[] {
	if (
		lastHueTableParams &&
		lastHueTableParams.states === states &&
		lastHueTableParams.saturation === saturation &&
		lastHueTableParams.lightness === lightness &&
		lastHueTable
	) {
		return lastHueTable
	}

	const table = new Array<string>(states)
	for (let i = 0; i < states; i++) {
		const hue = (i / states) * 360
		const [r, g, b] = hslToRgb(hue, saturation, lightness)
		table[i] = `rgb(${r},${g},${b})`
	}

	lastHueTableParams = { states, saturation, lightness }
	lastHueTable = table
	return table
}

interface CyclicAutomatonState {
	cells: Uint8Array
	next: Uint8Array
	lastFrame: number
	/** Total simulation substeps run, used to derive the revive patch position. */
	steps: number
	/** Consecutive substeps whose changed-cell fraction was below the floor. */
	stalledSteps: number
}

// State shared by all callers of generateAsciiCyclicAutomatonFrame. Prefer
// createAsciiCyclicAutomatonGenerator, which gives each instance its own.
const sharedStore = createGeneratorStateStore<CyclicAutomatonState>()

/**
 * Clear the cyclic automaton state shared by generateAsciiCyclicAutomatonFrame callers.
 * Instances from createAsciiCyclicAutomatonGenerator own their state and are unaffected.
 */
export function clearCyclicAutomatonState(): void {
	sharedStore.clear()
}

function clampStates(rawStates: number): number {
	const floored = Math.floor(rawStates)
	if (!Number.isFinite(floored)) return DEFAULT_STATES
	return Math.max(MIN_STATES, Math.min(MAX_STATES, floored))
}

function initState(cols: number, rows: number, seed: number, states: number): CyclicAutomatonState {
	const total = cols * rows
	const cells = new Uint8Array(total)
	const random = createRandom(seed)
	for (let i = 0; i < total; i++) {
		cells[i] = Math.min(states - 1, Math.floor(random() * states))
	}
	return { cells, next: new Uint8Array(total), lastFrame: -1, steps: 0, stalledSteps: 0 }
}

/**
 * Re-randomise a small patch of the board, seeding the RNG from (seed, step) so
 * the intervention is reproducible for a given seed and frame sequence. A patch
 * of mixed states in a frozen field immediately gives its neighbours a
 * successor-state neighbour to follow, so waves spread back out from it.
 */
function revivePatch(
	cells: Uint8Array,
	columns: number,
	rows: number,
	states: number,
	seed: number,
	step: number,
): void {
	const random = createRandom((seed ^ Math.imul(step + 1, 0x9e3779b1)) >>> 0)
	const patchColumns = Math.min(columns, REVIVE_PATCH_COLUMNS)
	const patchRows = Math.min(rows, REVIVE_PATCH_ROWS)
	const originX = Math.floor(random() * columns)
	const originY = Math.floor(random() * rows)

	for (let dy = 0; dy < patchRows; dy++) {
		const row = ((originY + dy) % rows) * columns
		for (let dx = 0; dx < patchColumns; dx++) {
			const x = (originX + dx) % columns
			cells[row + x] = Math.min(states - 1, Math.floor(random() * states))
		}
	}
}

// Memoized state-key builder — avoids rebuilding the key string every frame when the
// options driving it haven't changed since the last call. Only params that affect
// *initialization* belong in the key: threshold/neighborhood only affect the step rule
// and can change on an already-running simulation without needing a fresh grid.
let lastStateKeyParams: { columns: number; rows: number; seed: number; states: number } | null = null
let lastStateKey: string | null = null

function getStateKey(columns: number, rows: number, seed: number, states: number): string {
	if (
		lastStateKeyParams &&
		lastStateKeyParams.columns === columns &&
		lastStateKeyParams.rows === rows &&
		lastStateKeyParams.seed === seed &&
		lastStateKeyParams.states === states &&
		lastStateKey
	) {
		return lastStateKey
	}
	lastStateKeyParams = { columns, rows, seed, states }
	// Plain field concatenation instead of JSON.stringify — no object-shape or
	// property-order ambiguity to worry about since every field is a number in a
	// fixed position (matches asciiBoidsGenerator's key builder).
	lastStateKey = `${columns}:${rows}:${seed}:${states}`
	return lastStateKey
}

// Moore (8-neighbor) and von Neumann (4-neighbor) step kernels are separate functions
// rather than one function branching on neighborhood per cell, so the neighborhood check
// happens once per step instead of once per cell. Row offsets are hoisted per row (and
// wrapped with a branch, not a modulo) the same way asciiGameOfLifeGenerator does it.
//
// Both return the number of cells that changed state, which the caller uses to detect
// a board that has stopped evolving. It is one extra integer compare per cell.

function stepMoore(
	cells: Uint8Array,
	next: Uint8Array,
	columns: number,
	rows: number,
	states: number,
	threshold: number,
): number {
	let changed = 0
	for (let y = 0; y < rows; y++) {
		const yUp = y > 0 ? y - 1 : rows - 1
		const yDown = y < rows - 1 ? y + 1 : 0
		const rowUp = yUp * columns
		const rowDown = yDown * columns
		const row = y * columns

		for (let x = 0; x < columns; x++) {
			const xLeft = x > 0 ? x - 1 : columns - 1
			const xRight = x < columns - 1 ? x + 1 : 0
			const idx = row + x

			const s = cells[idx]
			const target = s + 1 < states ? s + 1 : 0

			let count = 0
			if (cells[rowUp + xLeft] === target) count++
			if (cells[rowUp + x] === target) count++
			if (cells[rowUp + xRight] === target) count++
			if (cells[row + xLeft] === target) count++
			if (cells[row + xRight] === target) count++
			if (cells[rowDown + xLeft] === target) count++
			if (cells[rowDown + x] === target) count++
			if (cells[rowDown + xRight] === target) count++

			const advanced = count >= threshold
			if (advanced) changed++
			next[idx] = advanced ? target : s
		}
	}
	return changed
}

function stepVonNeumann(
	cells: Uint8Array,
	next: Uint8Array,
	columns: number,
	rows: number,
	states: number,
	threshold: number,
): number {
	let changed = 0
	for (let y = 0; y < rows; y++) {
		const yUp = y > 0 ? y - 1 : rows - 1
		const yDown = y < rows - 1 ? y + 1 : 0
		const rowUp = yUp * columns
		const rowDown = yDown * columns
		const row = y * columns

		for (let x = 0; x < columns; x++) {
			const xLeft = x > 0 ? x - 1 : columns - 1
			const xRight = x < columns - 1 ? x + 1 : 0
			const idx = row + x

			const s = cells[idx]
			const target = s + 1 < states ? s + 1 : 0

			let count = 0
			if (cells[rowUp + x] === target) count++
			if (cells[row + xLeft] === target) count++
			if (cells[row + xRight] === target) count++
			if (cells[rowDown + x] === target) count++

			const advanced = count >= threshold
			if (advanced) changed++
			next[idx] = advanced ? target : s
		}
	}
	return changed
}

function renderCyclicAutomatonFrame(
	store: GeneratorStateStore<CyclicAutomatonState>,
	frame: number,
	columns: number,
	rows: number,
	options: AsciiCyclicAutomatonOptions,
): AnsiScreen {
	const {
		states: rawStates = DEFAULT_STATES,
		threshold = DEFAULT_THRESHOLD,
		neighborhood = DEFAULT_NEIGHBORHOOD,
		stepsPerFrame = DEFAULT_STEPS_PER_FRAME,
		seed = DEFAULT_SEED,
		chars,
		saturation = DEFAULT_SATURATION,
		lightness = DEFAULT_LIGHTNESS,
		bgColor = DEFAULT_BG_COLOR,
	} = options

	const states = clampStates(rawStates)
	const stateKey = getStateKey(columns, rows, seed, states)

	let state = store.get(stateKey)
	if (!state || frame < state.lastFrame) {
		state = initState(columns, rows, seed, states)
		store.set(stateKey, state)
	}

	// Local mutable bindings so the buffer "swap" below rebinds these variables instead of
	// copying grid contents element-by-element (the same trick asciiReactionDiffusionGenerator
	// uses). Written back onto `state` once the substep loop finishes.
	let cells = state.cells
	let next = state.next

	// Simulate forward, capped so a large jump (backgrounded tab, seek) cannot block the
	// main thread proportionally to the gap.
	const cappedSteps = catchupSteps(frame, state.lastFrame) * stepsPerFrame
	const stepFn = neighborhood === 'vonNeumann' ? stepVonNeumann : stepMoore
	const totalCells = columns * rows

	for (let step = 0; step < cappedSteps; step++) {
		const changed = stepFn(cells, next, columns, rows, states, threshold)
		;[cells, next] = [next, cells]
		state.steps++

		if (changed / totalCells < STALL_ACTIVITY_FLOOR) state.stalledSteps++
		else state.stalledSteps = 0

		if (state.stalledSteps >= STALL_WINDOW) {
			revivePatch(cells, columns, rows, states, seed, state.steps)
			state.stalledSteps = 0
		}
	}

	state.cells = cells
	state.next = next
	state.lastFrame = frame

	const hueTable = getHueTable(states, saturation, lightness)
	const useCharRamp = chars !== undefined && chars.length > 0

	const lines: AnsiScreen['lines'] = []
	for (let y = 0; y < rows; y++) {
		const line: AnsiScreen['lines'][number] = []
		const row = y * columns
		for (let x = 0; x < columns; x++) {
			const s = cells[row + x]
			const fg = hueTable[s]
			const ch = useCharRamp ? chars![s % chars!.length] : DEFAULT_CHAR
			line.push({ ch, fg, bg: bgColor, bold: false })
		}
		lines.push(line)
	}

	return { lines, columns }
}

/**
 * Generate an ASCII cyclic cellular automaton frame — the rock-paper-scissors CA that
 * self-organizes uniform noise into rotating spiral waves.
 *
 * Uses process-wide state keyed on dimensions and options, so separate components with
 * matching options will interfere with each other. Prefer
 * {@link createAsciiCyclicAutomatonGenerator} when rendering more than one instance.
 */
export function generateAsciiCyclicAutomatonFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiCyclicAutomatonOptions = {},
): AnsiScreen {
	return renderCyclicAutomatonFrame(sharedStore, frame, columns, rows, options)
}

/**
 * Create a cyclic cellular automaton generator that owns its simulation state.
 * Each call returns an independent instance safe to render alongside others.
 */
export function createAsciiCyclicAutomatonGenerator(
	options: AsciiCyclicAutomatonOptions = {},
): CharacterFrameGenerator {
	const store = createGeneratorStateStore<CyclicAutomatonState>()
	return (frame: number, columns: number, rows: number) =>
		renderCyclicAutomatonFrame(store, frame, columns, rows, options)
}

/**
 * Create a reusable sampler for the cyclic automaton at a specific frame.
 * Returns a function that maps world coordinates (x, y) to an ANSI cell.
 */
export function createAsciiCyclicAutomatonSampler(
	frame: number,
	options: AsciiCyclicAutomatonOptions = {},
) {
	const { bgColor = DEFAULT_BG_COLOR } = options

	const cols = 120
	const rows = 60
	const screen = generateAsciiCyclicAutomatonFrame(frame, cols, rows, options)

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
