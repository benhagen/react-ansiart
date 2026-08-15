import type { AnsiScreen } from '../ansi/types'
import type { CharacterFrameGenerator } from '../types/types'
import { createGeneratorStateStore, type GeneratorStateStore } from './generatorState'
import { catchupSteps } from './simulationCatchup'

const DEFAULT_DENSITY = 0.3
const DEFAULT_FG_COLOR = '#55ff55'
const DEFAULT_BG_COLOR = '#000000'
const DEFAULT_SEED = 9999
const DEFAULT_AUTO_SEED = true
const DEFAULT_AUTO_SEED_THRESHOLD = 0.05

export interface AsciiGameOfLifeOptions {
	/** Initial density of live cells (0-1). Default: 0.3 */
	density?: number
	/** Foreground color for live cells (CSS color string). Default: '#55ff55' */
	fgColor?: string
	/** Background color (CSS color string). Default: '#000000' */
	bgColor?: string
	/** Seed for random number generation. Default: 9999 */
	seed?: number
	/** Whether to auto-seed when population drops too low. Default: true */
	autoSeed?: boolean
	/** Population threshold (fraction of total cells) below which auto-seeding triggers. Default: 0.05 */
	autoSeedThreshold?: number
}

// Deterministic RNG
function createRandom(seed: number) {
	let state = seed >>> 0
	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0
		return state / 0xffffffff
	}
}

// Parse a CSS color string to RGB components
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

// Lerp between two RGB colors
function lerpColor(
	a: [number, number, number],
	b: [number, number, number],
	t: number,
): string {
	const r = Math.round(a[0] + (b[0] - a[0]) * t)
	const g = Math.round(a[1] + (b[1] - a[1]) * t)
	const bl = Math.round(a[2] + (b[2] - a[2]) * t)
	return `rgb(${r},${g},${bl})`
}

// `t = min(age, 50) / 50` only ever takes 51 distinct values (age 0..50, and
// age > 50 clamps to the same value as age === 50), so precompute the full
// ramp once per fgColor instead of lerping per live cell every frame.
let lastFgColorForAgeTable: string | null = null
let lastAgeColorTable: string[] | null = null

function getAgeColorTable(fgColor: string): string[] {
	if (lastFgColorForAgeTable === fgColor && lastAgeColorTable) return lastAgeColorTable

	const fgRgb = parseColor(fgColor)
	const dimRgb: [number, number, number] = [
		Math.round(fgRgb[0] * 0.2),
		Math.round(fgRgb[1] * 0.2),
		Math.round(fgRgb[2] * 0.2),
	]

	const table = new Array<string>(51)
	for (let i = 0; i <= 50; i++) {
		table[i] = lerpColor(fgRgb, dimRgb, i / 50)
	}

	lastFgColorForAgeTable = fgColor
	lastAgeColorTable = table
	return table
}

interface GameOfLifeState {
	cells: Uint8Array
	next: Uint8Array
	lastFrame: number
}

// State shared by all callers of generateAsciiGameOfLifeFrame. Prefer
// createAsciiGameOfLifeGenerator, which gives each instance its own.
const sharedStore = createGeneratorStateStore<GameOfLifeState>()

/**
 * Clear the Game of Life state shared by generateAsciiGameOfLifeFrame callers.
 * Instances from createAsciiGameOfLifeGenerator own their state and are unaffected.
 */
export function clearGameOfLifeState(): void {
	sharedStore.clear()
}

// Memoized state-key builder — avoids a JSON.stringify allocation every
// frame when the options driving the key haven't changed since last call.
let lastStateKeyParams: { columns: number; rows: number; seed: number; density: number } | null = null
let lastStateKey: string | null = null

function getStateKey(columns: number, rows: number, seed: number, density: number): string {
	if (
		lastStateKeyParams &&
		lastStateKeyParams.columns === columns &&
		lastStateKeyParams.rows === rows &&
		lastStateKeyParams.seed === seed &&
		lastStateKeyParams.density === density &&
		lastStateKey
	) {
		return lastStateKey
	}
	lastStateKeyParams = { columns, rows, seed, density }
	lastStateKey = JSON.stringify(lastStateKeyParams)
	return lastStateKey
}

function renderGameOfLifeFrame(
	store: GeneratorStateStore<GameOfLifeState>,
	frame: number,
	columns: number,
	rows: number,
	options: AsciiGameOfLifeOptions,
): AnsiScreen {
	const {
		density = DEFAULT_DENSITY,
		fgColor = DEFAULT_FG_COLOR,
		bgColor = DEFAULT_BG_COLOR,
		seed = DEFAULT_SEED,
		autoSeed = DEFAULT_AUTO_SEED,
		autoSeedThreshold = DEFAULT_AUTO_SEED_THRESHOLD,
	} = options

	const totalCells = columns * rows
	const stateKey = getStateKey(columns, rows, seed, density)

	let state = store.get(stateKey)
	if (!state || frame < state.lastFrame) {
		const cells = new Uint8Array(totalCells)
		const next = new Uint8Array(totalCells)
		const random = createRandom(seed)
		for (let i = 0; i < totalCells; i++) {
			cells[i] = random() < density ? 1 : 0
		}
		state = { cells, next, lastFrame: -1 }
		store.set(stateKey, state)
	}

	const { cells, next } = state

	// Simulate forward from lastFrame to current frame, capped so a large jump
	// (backgrounded tab, seek) cannot block the main thread proportionally to the gap.
	const framesToSimulate = catchupSteps(frame, state.lastFrame)
	for (let f = 0; f < framesToSimulate; f++) {
		// Compute next generation
		for (let y = 0; y < rows; y++) {
			// Hoist the wrapped row lookups once per row instead of paying two
			// modulo ops per neighbor (8 neighbors/cell) for every cell.
			const yUp = y > 0 ? y - 1 : rows - 1
			const yDown = y < rows - 1 ? y + 1 : 0
			const rowUp = yUp * columns
			const rowDown = yDown * columns
			const row = y * columns

			for (let x = 0; x < columns; x++) {
				const xLeft = x > 0 ? x - 1 : columns - 1
				const xRight = x < columns - 1 ? x + 1 : 0
				const idx = row + x

				// Count live neighbors (wrapping), branch instead of modulo
				let neighbors = 0
				if (cells[rowUp + xLeft] > 0) neighbors++
				if (cells[rowUp + x] > 0) neighbors++
				if (cells[rowUp + xRight] > 0) neighbors++
				if (cells[row + xLeft] > 0) neighbors++
				if (cells[row + xRight] > 0) neighbors++
				if (cells[rowDown + xLeft] > 0) neighbors++
				if (cells[rowDown + x] > 0) neighbors++
				if (cells[rowDown + xRight] > 0) neighbors++

				if (cells[idx] > 0) {
					// Alive: survive on 2-3 neighbors, die otherwise
					if (neighbors === 2 || neighbors === 3) {
						next[idx] = Math.min(cells[idx] + 1, 255)
					} else {
						next[idx] = 0
					}
				} else {
					// Dead: birth on exactly 3 neighbors
					next[idx] = neighbors === 3 ? 1 : 0
				}
			}
		}

		// Copy next into cells
		cells.set(next)

		// Auto-seed check
		if (autoSeed) {
			let population = 0
			for (let i = 0; i < totalCells; i++) {
				if (cells[i] > 0) population++
			}
			if (population < autoSeedThreshold * totalCells) {
				const random = createRandom(seed + frame + f)
				for (let i = 0; i < totalCells; i++) {
					if (cells[i] === 0 && random() < 0.1) {
						cells[i] = 1
					}
				}
			}
		}
	}

	state.lastFrame = frame

	// Precomputed 51-entry age->color ramp (t = min(age, 50) / 50 only takes 51 distinct values)
	const ageColorTable = getAgeColorTable(fgColor)

	// Build screen
	const lines: AnsiScreen['lines'] = []
	for (let y = 0; y < rows; y++) {
		const line: AnsiScreen['lines'][number] = []
		for (let x = 0; x < columns; x++) {
			const age = cells[y * columns + x]

			let ch: string
			if (age === 0) {
				ch = ' '
			} else if (age === 1) {
				ch = '\u2588' // █
			} else if (age <= 5) {
				ch = '\u2593' // ▓
			} else if (age <= 15) {
				ch = '\u2592' // ▒
			} else {
				ch = '\u2591' // ░
			}

			const fg = age === 0 ? bgColor : ageColorTable[age < 50 ? age : 50]

			line.push({ ch, fg, bg: bgColor, bold: false })
		}
		lines.push(line)
	}

	return { lines, columns }
}

/**
 * Generate an ASCII Game of Life frame with age-based coloring.
 *
 * Uses process-wide state keyed on dimensions and options, so separate components with
 * matching options will interfere with each other. Prefer
 * {@link createAsciiGameOfLifeGenerator} when rendering more than one instance.
 */
export function generateAsciiGameOfLifeFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiGameOfLifeOptions = {},
): AnsiScreen {
	return renderGameOfLifeFrame(sharedStore, frame, columns, rows, options)
}

/**
 * Create a Game of Life generator that owns its simulation state.
 * Each call returns an independent instance safe to render alongside others.
 */
export function createAsciiGameOfLifeGenerator(
	options: AsciiGameOfLifeOptions = {},
): CharacterFrameGenerator {
	const store = createGeneratorStateStore<GameOfLifeState>()
	return (frame: number, columns: number, rows: number) =>
		renderGameOfLifeFrame(store, frame, columns, rows, options)
}

/**
 * Create a reusable sampler for a specific frame and options.
 * Returns a function that maps world coordinates (x, y) to an ANSI cell.
 */
export function createAsciiGameOfLifeSampler(
	frame: number,
	options: AsciiGameOfLifeOptions = {},
) {
	const { bgColor = DEFAULT_BG_COLOR } = options

	// We need a backing grid. Use a reasonable default size.
	const cols = 200
	const rows = 60
	const screen = generateAsciiGameOfLifeFrame(frame, cols, rows, options)

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
