import type { AnsiScreen } from '../ansi/types'

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

interface GameOfLifeState {
	cells: Uint8Array
	next: Uint8Array
	lastFrame: number
}

const stateMap = new Map<string, GameOfLifeState>()

/**
 * Clear all Game of Life state (useful for resetting effects or when switching generators)
 */
export function clearGameOfLifeState(): void {
	stateMap.clear()
}

/**
 * Generate an ASCII Game of Life frame with age-based coloring
 */
export function generateAsciiGameOfLifeFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiGameOfLifeOptions = {},
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
	const stateKey = JSON.stringify({ columns, rows, seed, density })

	let state = stateMap.get(stateKey)
	if (!state || frame < state.lastFrame) {
		const cells = new Uint8Array(totalCells)
		const next = new Uint8Array(totalCells)
		const random = createRandom(seed)
		for (let i = 0; i < totalCells; i++) {
			cells[i] = random() < density ? 1 : 0
		}
		state = { cells, next, lastFrame: -1 }
		stateMap.set(stateKey, state)
		if (stateMap.size > 32) {
			const firstKey = stateMap.keys().next().value
			if (firstKey !== undefined) stateMap.delete(firstKey)
		}
	}

	const { cells, next } = state

	// Simulate forward from lastFrame to current frame
	const framesToSimulate = frame - state.lastFrame
	for (let f = 0; f < framesToSimulate; f++) {
		// Compute next generation
		for (let y = 0; y < rows; y++) {
			for (let x = 0; x < columns; x++) {
				const idx = y * columns + x

				// Count live neighbors (wrapping)
				let neighbors = 0
				for (let dy = -1; dy <= 1; dy++) {
					for (let dx = -1; dx <= 1; dx++) {
						if (dy === 0 && dx === 0) continue
						const ny = (y + dy + rows) % rows
						const nx = (x + dx + columns) % columns
						if (cells[ny * columns + nx] > 0) neighbors++
					}
				}

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

	// Parse colors for lerp
	const fgRgb = parseColor(fgColor)
	const dimRgb: [number, number, number] = [
		Math.round(fgRgb[0] * 0.2),
		Math.round(fgRgb[1] * 0.2),
		Math.round(fgRgb[2] * 0.2),
	]

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

			let fg: string
			if (age === 0) {
				fg = bgColor
			} else {
				const t = Math.min(age, 50) / 50
				fg = lerpColor(fgRgb, dimRgb, t)
			}

			line.push({ ch, fg, bg: bgColor, bold: false })
		}
		lines.push(line)
	}

	return { lines, columns }
}

/**
 * Create a reusable sampler for a specific frame and options.
 * Returns a function that maps world coordinates (x, y) to an ANSI cell.
 */
export function createAsciiGameOfLifeSampler(
	frame: number,
	options: AsciiGameOfLifeOptions = {},
) {
	const {
		fgColor = DEFAULT_FG_COLOR,
		bgColor = DEFAULT_BG_COLOR,
	} = options

	const fgRgb = parseColor(fgColor)
	const dimRgb: [number, number, number] = [
		Math.round(fgRgb[0] * 0.2),
		Math.round(fgRgb[1] * 0.2),
		Math.round(fgRgb[2] * 0.2),
	]

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
