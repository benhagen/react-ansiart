import type { AnsiScreen } from '../ansi/types'
import { buildCharLookup } from './charLookup'

const DEFAULT_DAMPING = 0.97
const DEFAULT_DROP_FREQUENCY = 15
const DEFAULT_DROP_STRENGTH = 255
const DEFAULT_FG_COLOR = '#4488ff'
const DEFAULT_BG_COLOR = '#000011'
const DEFAULT_CHARS = [' ', '\u00b7', ':', '~', '=', '@']
const DEFAULT_SEED = 5555

export interface AsciiWaterRippleOptions {
	/** Damping factor for wave decay (0-1). Default: 0.97. Lower = faster decay */
	damping?: number
	/** Drop a stone every N frames. Default: 15 */
	dropFrequency?: number
	/** Amplitude of dropped stones. Default: 255 */
	dropStrength?: number
	/** Foreground color for disturbed water (CSS color string). Default: '#4488ff' */
	fgColor?: string
	/** Background color for calm water (CSS color string). Default: '#000011' */
	bgColor?: string
	/** Characters for brightness ramp. Default: ' ·:~=@' */
	chars?: string
	/** Seed for random number generation. Default: 5555 */
	seed?: number
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

interface WaterRippleState {
	current: Float32Array
	previous: Float32Array
	lastFrame: number
}

const stateMap = new Map<string, WaterRippleState>()

/**
 * Clear all water ripple state (useful for resetting effects or when switching generators)
 */
export function clearWaterRippleState(): void {
	stateMap.clear()
}

// Memoized char lookup
let lastChars: string | null = null
let lastCharLookup: string[] | null = null

function getCharLookup(chars: string): string[] {
	if (lastChars === chars && lastCharLookup) return lastCharLookup
	const charArray = Array.from(chars)
	lastCharLookup = buildCharLookup(charArray)
	lastChars = chars
	return lastCharLookup
}

/**
 * Generate an ASCII water ripple frame with wave-equation simulation
 */
export function generateAsciiWaterRippleFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiWaterRippleOptions = {},
): AnsiScreen {
	const {
		damping = DEFAULT_DAMPING,
		dropFrequency = DEFAULT_DROP_FREQUENCY,
		dropStrength = DEFAULT_DROP_STRENGTH,
		fgColor = DEFAULT_FG_COLOR,
		bgColor = DEFAULT_BG_COLOR,
		chars = DEFAULT_CHARS.join(''),
		seed = DEFAULT_SEED,
	} = options

	const totalCells = columns * rows
	const stateKey = JSON.stringify({ columns, rows, seed, damping, dropFrequency, dropStrength })

	let state = stateMap.get(stateKey)
	if (!state || frame < state.lastFrame) {
		const current = new Float32Array(totalCells)
		const previous = new Float32Array(totalCells)
		state = { current, previous, lastFrame: -1 }
		stateMap.set(stateKey, state)
		if (stateMap.size > 32) {
			const firstKey = stateMap.keys().next().value
			if (firstKey !== undefined) stateMap.delete(firstKey)
		}
	}

	const { current, previous } = state

	// Simulate forward from lastFrame to current frame
	const framesToSimulate = frame - state.lastFrame
	for (let f = 0; f < framesToSimulate; f++) {
		const currentFrame = state.lastFrame + 1 + f

		// Drop a stone at the right frequency
		if (currentFrame % dropFrequency === 0) {
			const random = createRandom(seed + currentFrame)
			const dx = Math.floor(random() * columns)
			const dy = Math.floor(random() * rows)
			current[dy * columns + dx] = dropStrength
		}

		// Compute next state using wave equation
		// We need a temporary buffer since we read from current while writing next
		// But we can write into previous (which we're done reading from after this step)
		// Then swap: previous becomes next's output, current becomes the old previous
		for (let y = 0; y < rows; y++) {
			for (let x = 0; x < columns; x++) {
				const idx = y * columns + x

				// Cardinal neighbors (clamped to edges)
				const up = y > 0 ? (y - 1) * columns + x : idx
				const down = y < rows - 1 ? (y + 1) * columns + x : idx
				const left = x > 0 ? y * columns + (x - 1) : idx
				const right = x < columns - 1 ? y * columns + (x + 1) : idx

				const next = ((current[up] + current[down] + current[left] + current[right]) / 2 - previous[idx]) * damping
				previous[idx] = next
			}
		}

		// Swap buffers: previous now holds the new state, current holds the old state
		// We need to swap the data, not the references (since state holds references)
		// Copy previous (new state) to a temp, then current becomes previous, previous becomes new
		// Simpler: just swap contents
		for (let i = 0; i < totalCells; i++) {
			const tmp = previous[i]
			previous[i] = current[i]
			current[i] = tmp
		}
	}

	state.lastFrame = frame

	// Pre-compute character lookup
	const charLookup = getCharLookup(chars)

	// Parse colors
	const fgRgb = parseColor(fgColor)
	const bgRgb = parseColor(bgColor)

	// Build screen
	const lines: AnsiScreen['lines'] = []
	for (let y = 0; y < rows; y++) {
		const line: AnsiScreen['lines'][number] = []
		for (let x = 0; x < columns; x++) {
			const height = current[y * columns + x]

			// Normalize height to 0-1 range
			const clamped = Math.max(-dropStrength, Math.min(dropStrength, height))
			const normalized = (clamped + dropStrength) / (2 * dropStrength)

			// Character from brightness ramp
			const brightnessIndex = Math.floor(normalized * 255)
			const ch = charLookup[Math.max(0, Math.min(255, brightnessIndex))]

			// Color: lerp from bgColor (calm) to fgColor (disturbed) based on abs(height)
			const intensity = Math.min(Math.abs(height) / dropStrength, 1)
			const fg = lerpColor(bgRgb, fgRgb, intensity)

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
export function createAsciiWaterRippleSampler(
	frame: number,
	options: AsciiWaterRippleOptions = {},
) {
	const {
		bgColor = DEFAULT_BG_COLOR,
	} = options

	// Use a reasonable default backing grid size
	const cols = 200
	const rows = 60
	const screen = generateAsciiWaterRippleFrame(frame, cols, rows, options)

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
