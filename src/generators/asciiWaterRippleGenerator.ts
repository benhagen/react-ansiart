import type { AnsiScreen } from '../ansi/types'
import type { CharacterFrameGenerator } from '../types/types'
import { buildCharLookup } from './charLookup'
import { createGeneratorStateStore, type GeneratorStateStore } from './generatorState'
import type { AnsiPointerInput } from './pointerInput'
import { catchupSteps } from './simulationCatchup'

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
	/**
	 * Pointer input channel from the host display; sampled via `pointer.state`.
	 * While pressed, a strong drop lands at the pointer cell every rendered frame; while
	 * merely hovering, gentle wake drops trail the pointer as it moves. Absent or inactive,
	 * behavior is identical to having no pointer at all.
	 */
	pointer?: AnsiPointerInput
	/** Amplitude of drops injected while the pointer is pressed. Default: dropStrength */
	pointerDropStrength?: number
	/** Amplitude of wake drops left by a moving, unpressed pointer. Default: dropStrength / 3 */
	pointerWakeStrength?: number
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

const LERP_TABLE_STEPS = 256

// intensity is a continuous 0..1 value recomputed per cell, but the endpoint
// colors (bgRgb/fgRgb) are fixed for an entire render call, so quantizing
// intensity into 256 steps (same resolution as the brightness ramp already
// used for character selection) and precomputing the rgb() strings once
// avoids rebuilding an identical string per cell. Error is at most 1/510 of
// the color range — imperceptible.
let lastLerpA: [number, number, number] | null = null
let lastLerpB: [number, number, number] | null = null
let lastLerpTable: string[] | null = null

function getLerpColorTable(a: [number, number, number], b: [number, number, number]): string[] {
	if (
		lastLerpTable &&
		lastLerpA &&
		lastLerpB &&
		lastLerpA[0] === a[0] && lastLerpA[1] === a[1] && lastLerpA[2] === a[2] &&
		lastLerpB[0] === b[0] && lastLerpB[1] === b[1] && lastLerpB[2] === b[2]
	) {
		return lastLerpTable
	}
	const table = new Array<string>(LERP_TABLE_STEPS)
	for (let i = 0; i < LERP_TABLE_STEPS; i++) {
		table[i] = lerpColor(a, b, i / (LERP_TABLE_STEPS - 1))
	}
	lastLerpA = a
	lastLerpB = b
	lastLerpTable = table
	return table
}

interface WaterRippleState {
	current: Float32Array
	previous: Float32Array
	lastFrame: number
	// Position of the last pointer-injected drop (fractional cells), NaN before the first
	// injection. Used to gate wake drops on the pointer having moved >= ~1 cell.
	pointerLastX: number
	pointerLastY: number
}

// State shared by all callers of generateAsciiWaterRippleFrame. Prefer
// createAsciiWaterRippleGenerator, which gives each instance its own.
const sharedStore = createGeneratorStateStore<WaterRippleState>()

/**
 * Clear the water ripple state shared by generateAsciiWaterRippleFrame callers.
 * Instances from createAsciiWaterRippleGenerator own their state and are unaffected.
 */
export function clearWaterRippleState(): void {
	sharedStore.clear()
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

// Memoized state-key builder — avoids a JSON.stringify allocation every
// frame when the options driving the key haven't changed since last call.
let lastStateKeyParams: {
	columns: number
	rows: number
	seed: number
	damping: number
	dropFrequency: number
	dropStrength: number
} | null = null
let lastStateKey: string | null = null

function getStateKey(
	columns: number,
	rows: number,
	seed: number,
	damping: number,
	dropFrequency: number,
	dropStrength: number,
): string {
	if (
		lastStateKeyParams &&
		lastStateKeyParams.columns === columns &&
		lastStateKeyParams.rows === rows &&
		lastStateKeyParams.seed === seed &&
		lastStateKeyParams.damping === damping &&
		lastStateKeyParams.dropFrequency === dropFrequency &&
		lastStateKeyParams.dropStrength === dropStrength &&
		lastStateKey
	) {
		return lastStateKey
	}
	lastStateKeyParams = { columns, rows, seed, damping, dropFrequency, dropStrength }
	lastStateKey = JSON.stringify(lastStateKeyParams)
	return lastStateKey
}

function renderWaterRippleFrame(
	store: GeneratorStateStore<WaterRippleState>,
	frame: number,
	columns: number,
	rows: number,
	options: AsciiWaterRippleOptions,
): AnsiScreen {
	const {
		damping = DEFAULT_DAMPING,
		dropFrequency = DEFAULT_DROP_FREQUENCY,
		dropStrength = DEFAULT_DROP_STRENGTH,
		fgColor = DEFAULT_FG_COLOR,
		bgColor = DEFAULT_BG_COLOR,
		chars = DEFAULT_CHARS.join(''),
		seed = DEFAULT_SEED,
		pointer,
		pointerDropStrength = dropStrength,
		pointerWakeStrength = dropStrength / 3,
	} = options

	// Sample the pointer channel once per generate call so a mid-render host update
	// cannot tear a frame. Costs one property read when a pointer is attached, nothing
	// otherwise.
	const pointerState = pointer ? pointer.state : undefined

	const totalCells = columns * rows
	const stateKey = getStateKey(columns, rows, seed, damping, dropFrequency, dropStrength)

	let state = store.get(stateKey)
	if (!state || frame < state.lastFrame) {
		const current = new Float32Array(totalCells)
		const previous = new Float32Array(totalCells)
		state = { current, previous, lastFrame: -1, pointerLastX: NaN, pointerLastY: NaN }
		store.set(stateKey, state)
	}

	// Local mutable bindings so the buffer swap below can rebind these
	// variables instead of copying grid contents element-by-element.
	let current = state.current
	let previous = state.previous

	// Simulate forward from lastFrame to current frame, capped so a large jump
	// (backgrounded tab, seek) cannot block the main thread proportionally to the gap.
	// When capped, run the most recent steps so drop timing stays in phase with `frame`.
	const framesToSimulate = catchupSteps(frame, state.lastFrame)
	const firstFrame = frame - framesToSimulate + 1
	for (let f = 0; f < framesToSimulate; f++) {
		const currentFrame = firstFrame + f

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

		// Swap buffers by reference: `previous` now holds the newly computed
		// state and `current` holds the state-before-last, which is exactly
		// what the next iteration needs for `current`/`previous` respectively.
		// `current`/`previous` are plain local bindings (state.current/
		// state.previous are plain properties with no external aliases), so a
		// reference swap is equivalent to the old element-wise copy and avoids
		// an O(totalCells) pass per substep.
		;[current, previous] = [previous, current]
	}

	// --- Pointer interaction ---
	// Injected once per generate call, AFTER catch-up simulation, rather than once per
	// catch-up substep: catchupSteps() may replay up to MAX_SIMULATION_CATCHUP ticks for a
	// single call, and injecting per substep would multiply the pointer's energy by a
	// calling-pattern-dependent tick count. One drop per rendered frame keeps interaction
	// strength independent of frame gaps. Gated on framesToSimulate > 0 so re-rendering
	// the same frame (a pure re-read) injects nothing and stays idempotent.
	if (pointerState && pointerState.active && framesToSimulate > 0) {
		const cx = Math.round(pointerState.x)
		const cy = Math.round(pointerState.y)
		// A pointer dragged past the display edge reports out-of-grid coordinates; drops
		// there have no cell to land in, so they are ignored rather than clamped to the rim.
		if (cx >= 0 && cx < columns && cy >= 0 && cy < rows) {
			if (pointerState.pressed) {
				current[cy * columns + cx] = pointerDropStrength
				state.pointerLastX = pointerState.x
				state.pointerLastY = pointerState.y
			} else {
				const dx = pointerState.x - state.pointerLastX
				const dy = pointerState.y - state.pointerLastY
				// NaN (no prior injection) compares false, so test for it explicitly: the
				// first hover injection always lands.
				const moved = !(dx * dx + dy * dy < 1)
				if (moved) {
					current[cy * columns + cx] = pointerWakeStrength
					state.pointerLastX = pointerState.x
					state.pointerLastY = pointerState.y
				}
			}
		}
	}

	state.current = current
	state.previous = previous
	state.lastFrame = frame

	// Pre-compute character lookup
	const charLookup = getCharLookup(chars)

	// Parse colors
	const fgRgb = parseColor(fgColor)
	const bgRgb = parseColor(bgColor)
	const lerpTable = getLerpColorTable(bgRgb, fgRgb)
	const lerpTableMax = lerpTable.length - 1

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
			const fg = lerpTable[Math.round(intensity * lerpTableMax)]

			line.push({ ch, fg, bg: bgColor, bold: false })
		}
		lines.push(line)
	}

	return { lines, columns }
}

/**
 * Generate an ASCII water ripple frame with wave-equation simulation.
 *
 * Uses process-wide state keyed on dimensions and options, so separate components with
 * matching options will interfere with each other. Prefer
 * {@link createAsciiWaterRippleGenerator} when rendering more than one instance.
 */
export function generateAsciiWaterRippleFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiWaterRippleOptions = {},
): AnsiScreen {
	return renderWaterRippleFrame(sharedStore, frame, columns, rows, options)
}

/**
 * Create a water ripple generator that owns its simulation state.
 * Each call returns an independent instance safe to render alongside others.
 */
export function createAsciiWaterRippleGenerator(
	options: AsciiWaterRippleOptions = {},
): CharacterFrameGenerator {
	const store = createGeneratorStateStore<WaterRippleState>()
	return (frame: number, columns: number, rows: number) =>
		renderWaterRippleFrame(store, frame, columns, rows, options)
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
