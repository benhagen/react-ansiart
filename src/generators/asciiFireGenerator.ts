import type { AnsiScreen } from '../ansi/types'
import type { CharacterFrameGenerator } from '../types/types'
import { createGeneratorStateStore, type GeneratorStateStore } from './generatorState'

// Default character set for fire effect
const DEFAULT_CHARS = [' ', '.', ':', ';', '+', '=', 'x', 'X', '$', '&', '#', '@']

// Default darken amount - constant value subtracted each frame
// Lower values = slower cooling = taller flames
const DEFAULT_DARKEN_AMOUNT = 0.5

// Default spark range for bottom row fuel
const DEFAULT_SPARK_RANGE: [number, number] = [200, 255]

// Default background color
const DEFAULT_BG_COLOR = '#000000'

// Default seed for random number generation
const DEFAULT_SEED = 12345

/**
 * Generate a color palette that fades from black (index 0) to orangish red (index 255)
 * Returns an array of CSS color strings
 */
function generateFirePalette(): string[] {
	const palette: string[] = []
	for (let i = 0; i < 256; i++) {
		const t = i / 255

		// Create gradient from black to orangish red
		// Black (0,0,0) -> Dark red -> Red -> Orange-red
		let r: number
		let g: number
		let b: number

		if (t < 0.3) {
			// Black to dark red
			const localT = t / 0.3
			r = Math.floor(localT * 50)
			g = 0
			b = 0
		} else if (t < 0.6) {
			// Dark red to red
			const localT = (t - 0.3) / 0.3
			r = Math.floor(50 + localT * 200)
			g = Math.floor(localT * 30)
			b = 0
		} else if (t < 0.85) {
			// Red to orange-red
			const localT = (t - 0.6) / 0.25
			r = 255
			g = Math.floor(30 + localT * 100)
			b = 0
		} else {
			// Orange-red to bright orange
			const localT = (t - 0.85) / 0.15
			r = 255
			g = Math.floor(130 + localT * 125)
			b = Math.floor(localT * 50)
		}

		palette[i] = `rgb(${r},${g},${b})`
	}
	return palette
}

// Pre-compute the fire palette
const FIRE_PALETTE = generateFirePalette()

// Memoized char lookup tables keyed by chars array reference or content
let lastFireChars: string[] | null = null
let lastFireCharLookup: string[] | null = null

function getFireCharLookup(chars: string[]): string[] {
	if (lastFireChars === chars && lastFireCharLookup) return lastFireCharLookup
	const charCount = chars.length
	const lookup = new Array(256)
	for (let i = 0; i < 256; i++) {
		lookup[i] = chars[Math.floor((i / 255) * (charCount - 0.001))]
	}
	lastFireChars = chars
	lastFireCharLookup = lookup
	return lookup
}

export interface AsciiFireOptions {
	/** Array of characters to use for ASCII rendering (brightness-based) */
	chars?: string[]
	/** Constant value to subtract each frame for darkening. Default: 0.5. Higher values = faster extinguishing */
	darkenAmount?: number
	/** Min/max palette indices for bottom row sparks (the fuel). Default: [200, 255] */
	sparkRange?: [number, number]
	/** Background color (CSS color string). Default: '#000000' (black). Accepts any valid CSS color (hex, rgb, rgba, hsl, named colors, etc.) */
	bgColor?: string
	/** Seed for random number generation. Controls the spark pattern. Default: 12345. Use different seeds for different patterns */
	seed?: number
	/** World height for scrollable mode (optional, used to anchor fire to bottom of page) */
	worldHeight?: number
	/** World width for scrollable mode (optional, used to size buffer horizontally) */
	worldWidth?: number
}

// Simple deterministic random number generator
function createRandom(seed: number) {
	let state = seed
	return () => {
		state = (state * 9301 + 49297) % 233280
		return state / 233280
	}
}

/**
 * Calculate natural fire height based on degradation physics
 * This determines how many rows it takes for maximum heat to degrade to 0
 */
function calculateNaturalFireHeight(darkenAmount: number, sparkRange: [number, number]): number {
	// Maximum heat value from spark range
	const maxHeat = sparkRange[1]

	// Calculate how many rows it takes to degrade from maxHeat to 0
	// Each row darkens by darkenAmount, so: maxHeat / darkenAmount gives approximate rows
	const naturalHeight = Math.ceil(maxHeat / darkenAmount)

	// Apply practical limits: minimum 30 rows, maximum 200 rows
	// This prevents extremely tall or short fires
	return Math.max(30, Math.min(200, naturalHeight))
}

// Module-level state storage for fire buffers
// Keyed by state key string to maintain state per generator configuration
interface FireState {
	buffer: Uint8Array
	lastFrame: number
}

interface FireStateWithReadBuffer extends FireState {
	readBuffer?: Uint8Array
}

// State shared by all callers of generateAsciiFireFrame. Prefer
// createAsciiFireGenerator, which gives each instance its own.
const sharedFireStore = createGeneratorStateStore<FireState>()

// Memoized JSON.stringify state keys (single-slot, mirroring the memoized state-key pattern
// used elsewhere in the generators). renderFireFrame and the sampler are each called every
// frame with unchanged options in the common case.
let lastFireKeyInputs: {
	columns: number
	rows: number
	seed: number
	darkenAmount: number
	sparkMin: number
	sparkMax: number
	naturalHeight: number
} | null = null
let lastFireKeyStr: string | null = null

function getFireStateKey(
	columns: number,
	rows: number,
	seed: number,
	darkenAmount: number,
	sparkRange: [number, number],
	naturalHeight: number
): string {
	const sparkMin = sparkRange[0]
	const sparkMax = sparkRange[1]
	const prev = lastFireKeyInputs
	if (
		prev &&
		lastFireKeyStr &&
		prev.columns === columns &&
		prev.rows === rows &&
		prev.seed === seed &&
		prev.darkenAmount === darkenAmount &&
		prev.sparkMin === sparkMin &&
		prev.sparkMax === sparkMax &&
		prev.naturalHeight === naturalHeight
	) {
		return lastFireKeyStr
	}
	lastFireKeyStr = JSON.stringify({ columns, rows, seed, darkenAmount, sparkRange, naturalHeight })
	lastFireKeyInputs = { columns, rows, seed, darkenAmount, sparkMin, sparkMax, naturalHeight }
	return lastFireKeyStr
}

let lastFireSamplerKeyInputs: {
	seed: number
	darkenAmount: number
	sparkMin: number
	sparkMax: number
	naturalHeight: number
} | null = null
let lastFireSamplerKeyStr: string | null = null

function getFireSamplerStateKey(
	seed: number,
	darkenAmount: number,
	sparkRange: [number, number],
	naturalHeight: number
): string {
	const sparkMin = sparkRange[0]
	const sparkMax = sparkRange[1]
	const prev = lastFireSamplerKeyInputs
	if (
		prev &&
		lastFireSamplerKeyStr &&
		prev.seed === seed &&
		prev.darkenAmount === darkenAmount &&
		prev.sparkMin === sparkMin &&
		prev.sparkMax === sparkMax &&
		prev.naturalHeight === naturalHeight
	) {
		return lastFireSamplerKeyStr
	}
	lastFireSamplerKeyStr = JSON.stringify({ seed, darkenAmount, sparkRange, naturalHeight })
	lastFireSamplerKeyInputs = { seed, darkenAmount, sparkMin, sparkMax, naturalHeight }
	return lastFireSamplerKeyStr
}

function renderFireFrame(
	store: GeneratorStateStore<FireState>,
	frame: number,
	columns: number,
	rows: number,
	options: AsciiFireOptions = {}
): AnsiScreen {
	const {
		chars = DEFAULT_CHARS,
		darkenAmount = DEFAULT_DARKEN_AMOUNT,
		sparkRange = DEFAULT_SPARK_RANGE,
		bgColor = DEFAULT_BG_COLOR,
		seed = DEFAULT_SEED,
	} = options

	// Calculate natural fire height based on degradation physics
	const naturalHeight = calculateNaturalFireHeight(darkenAmount, sparkRange)
	// Use the smaller of natural height or requested rows
	const actualBufferHeight = Math.min(naturalHeight, rows)

	// Pre-compute character lookup table (memoized)
	const charLookup = getFireCharLookup(chars)

	// Create unique state key for this generator configuration
	// Include naturalHeight in state key to ensure consistent buffer sizing
	const stateKey = getFireStateKey(columns, rows, seed, darkenAmount, sparkRange, naturalHeight)

	// Get or create fire buffer state
	let state = store.get(stateKey)
	if (!state || frame < state.lastFrame) {
		// Create buffer sized to fit the requested rows, with one extra row for fuel
		// Start mostly black (classic fire effect), only bottom row has heat
		const bufferRows = actualBufferHeight + 1 // Extra row for fuel
		const buffer = new Uint8Array(columns * bufferRows)
		// Initialize bottom fuel row with maximum heat
		const bottomRowStart = (bufferRows - 1) * columns
		for (let x = 0; x < columns; x++) {
			buffer[bottomRowStart + x] = 255 // Max heat at bottom
		}
		// Initialize bottom few visible rows with some heat for immediate visibility
		for (let y = actualBufferHeight - 1; y >= Math.max(0, actualBufferHeight - 5); y--) {
			for (let x = 0; x < columns; x++) {
				const idx = y * columns + x
				// Gradient in bottom rows only
				const distFromBottom = actualBufferHeight - 1 - y
				const heat = Math.max(0, 255 - distFromBottom * 50)
				buffer[idx] = heat
			}
		}
		// Everything else stays at 0 (black)
		state = { buffer, lastFrame: -1 } // Set to -1 so we process frame 0
		store.set(stateKey, state)
	}

	const fireBuffer = state.buffer
	state.lastFrame = frame

	// Create random number generator for this frame
	const random = createRandom(seed + frame)

	// Double-buffer swap: use a second pre-allocated buffer instead of copying
	// Get or create the read buffer for this state
	let readBuffer = (state as FireStateWithReadBuffer).readBuffer
	if (!readBuffer || readBuffer.length !== fireBuffer.length) {
		readBuffer = new Uint8Array(fireBuffer.length)
		;(state as FireStateWithReadBuffer).readBuffer = readBuffer
	}
	// Copy current state to read buffer (swap would be ideal but fire writes
	// non-sequentially so we need the full previous state)
	readBuffer.set(fireBuffer)

	// Fill bottom row (offscreen fuel row) with random palette indices
	const bufferRows = actualBufferHeight + 1 // Extra row for fuel
	const bottomRowStart = (bufferRows - 1) * columns
	for (let x = 0; x < columns; x++) {
		const sparkValue = Math.floor(sparkRange[0] + random() * (sparkRange[1] - sparkRange[0]))
		fireBuffer[bottomRowStart + x] = sparkValue
		// DON'T update readBuffer - we want to read from the PREVIOUS frame
	}

	// Process fire from bottom to top
	// Read from readBuffer (previous frame) and write to fireBuffer (current frame)
	for (let y = actualBufferHeight - 1; y >= 0; y--) {
		for (let x = 0; x < columns; x++) {
			const currentIdx = y * columns + x

			// Get indices of pixels below (with horizontal wrapping)
			const belowY = y + 1
			const leftX = (x - 1 + columns) % columns
			const rightX = (x + 1) % columns

			const belowIdx = belowY * columns + x
			const belowLeftIdx = belowY * columns + leftX
			const belowRightIdx = belowY * columns + rightX

			// Average with adjacent pixels below (read from previous frame)
			const avg = (readBuffer[belowIdx] + readBuffer[belowLeftIdx] + readBuffer[belowRightIdx]) / 3

			// Darken by subtracting constant amount
			// Use floating point then floor to allow fractional darkening
			const darkened = Math.max(0, avg - darkenAmount)

			fireBuffer[currentIdx] = Math.floor(darkened)
		}
	}

	// Generate screen from fire buffer
	const lines: AnsiScreen['lines'] = []

	// Only render the actual buffer height, not the fuel row
	for (let y = 0; y < actualBufferHeight; y++) {
		const line: AnsiScreen['lines'][number] = []

		for (let x = 0; x < columns; x++) {
			const paletteIndex = fireBuffer[y * columns + x]
			const ch = charLookup[paletteIndex]
			const fgColor = FIRE_PALETTE[paletteIndex]

			line.push({ ch, fg: fgColor, bg: bgColor, bold: false })
		}

		lines.push(line)
	}

	// If requested rows is larger than buffer height, fill remaining with black
	for (let y = actualBufferHeight; y < rows; y++) {
		const line: AnsiScreen['lines'][number] = []
		for (let x = 0; x < columns; x++) {
			line.push({ ch: ' ', fg: FIRE_PALETTE[0], bg: bgColor, bold: false })
		}
		lines.push(line)
	}

	return { lines, columns }
}

// Module-level state storage for sampler buffers
interface SamplerState {
	buffer: Uint8Array
	readBuffer?: Uint8Array
	bufferCols: number
	bufferRows: number
	lastFrame: number
}

const sharedSamplerStore = createGeneratorStateStore<SamplerState>()

/**
 * Generate an ASCII fire frame — classic demo scene fire effect.
 *
 * Uses process-wide state keyed on dimensions and options, so separate components with
 * matching options will interfere with each other. Prefer {@link createAsciiFireGenerator}
 * when rendering more than one instance.
 */
export function generateAsciiFireFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiFireOptions = {},
): AnsiScreen {
	return renderFireFrame(sharedFireStore, frame, columns, rows, options)
}

/**
 * Create a fire generator that owns its heat buffer.
 * Each call returns an independent instance safe to render alongside others.
 */
export function createAsciiFireGenerator(
	options: AsciiFireOptions = {},
): CharacterFrameGenerator {
	const store = createGeneratorStateStore<FireState>()
	return (frame: number, columns: number, rows: number) =>
		renderFireFrame(store, frame, columns, rows, options)
}

/**
 * Create a reusable sampler for a specific frame and options.
 * Returns a function that maps world coordinates (x,y) in character cells
 * to an ANSI cell, without caring about any viewport/window.
 *
 * Note: For fire effect, we need to maintain state across the entire virtual world.
 * This is more complex than plasma because fire has persistent state.
 */
export function createAsciiFireSampler(frame: number, options: AsciiFireOptions = {}) {
	const {
		chars = DEFAULT_CHARS,
		darkenAmount = DEFAULT_DARKEN_AMOUNT,
		sparkRange = DEFAULT_SPARK_RANGE,
		bgColor = DEFAULT_BG_COLOR,
		seed = DEFAULT_SEED,
		worldHeight, // Optional: height of virtual world in scrollable mode
		worldWidth, // Optional: width of virtual world in scrollable mode
	} = options

	// Pre-compute character lookup table (memoized)
	const charLookup = getFireCharLookup(chars)

	// Calculate natural fire height based on degradation physics
	const naturalHeight = calculateNaturalFireHeight(darkenAmount, sparkRange)

	// Determine buffer width - use worldWidth if provided, otherwise use a reasonable default
	const bufferCols = worldWidth || 200

	// Create unique state key for this sampler configuration
	// State key should NOT include viewport-dependent values like worldHeight or worldWidth
	// Only include physics-based parameters that determine the fire behavior
	const stateKey = getFireSamplerStateKey(seed, darkenAmount, sparkRange, naturalHeight)

	// Get or create sampler buffer state
	let samplerState = sharedSamplerStore.get(stateKey)
	const bufferRows = naturalHeight + 1 // Extra row for fuel

	// Check if we need to resize the buffer horizontally or create new buffer
	if (samplerState) {
		// Check if frame needs reset (going backwards)
		if (frame < samplerState.lastFrame) {
			// Reset buffer for frame restart
			const buffer = new Uint8Array(bufferCols * bufferRows)
			const bottomRowStart = (bufferRows - 1) * bufferCols
			for (let x = 0; x < bufferCols; x++) {
				buffer[bottomRowStart + x] = 255
			}
			for (let y = bufferRows - 2; y >= Math.max(0, bufferRows - 6); y--) {
				for (let x = 0; x < bufferCols; x++) {
					const idx = y * bufferCols + x
					const distFromBottom = bufferRows - 2 - y
					const heat = Math.max(0, 255 - distFromBottom * 50)
					buffer[idx] = heat
				}
			}
			samplerState.buffer = buffer
			samplerState.bufferCols = bufferCols
			samplerState.bufferRows = bufferRows
			samplerState.lastFrame = -1 // Reset lastFrame so frame 0 will process
		} else if (samplerState.bufferCols !== bufferCols || samplerState.bufferRows !== bufferRows) {
			// Resize buffer while preserving existing state
			const oldBuffer = samplerState.buffer
			const oldCols = samplerState.bufferCols
			const oldRows = samplerState.bufferRows
			const newBuffer = new Uint8Array(bufferCols * bufferRows)

			// Copy existing data, handling column/row changes
			for (let y = 0; y < bufferRows; y++) {
				for (let x = 0; x < bufferCols; x++) {
					const newIdx = y * bufferCols + x
					// If we have old data at this position, copy it; otherwise initialize
					if (x < oldCols && y < oldRows) {
						const oldIdx = y * oldCols + x
						newBuffer[newIdx] = oldBuffer[oldIdx]
					} else {
						// New columns or rows get initialized
						if (y === bufferRows - 1) {
							// Fuel row gets max heat
							newBuffer[newIdx] = 255
						} else {
							// Other rows start at 0
							newBuffer[newIdx] = 0
						}
					}
				}
			}

			samplerState.buffer = newBuffer
			samplerState.bufferCols = bufferCols
			samplerState.bufferRows = bufferRows
		}
	} else {
		// Create new buffer
		const buffer = new Uint8Array(bufferCols * bufferRows)
		// Start mostly black, only bottom row has heat (classic fire effect)
		const bottomRowStart = (bufferRows - 1) * bufferCols
		for (let x = 0; x < bufferCols; x++) {
			buffer[bottomRowStart + x] = 255 // Max heat at bottom
		}
		// Initialize bottom few visible rows with some heat for immediate visibility
		for (let y = bufferRows - 2; y >= Math.max(0, bufferRows - 6); y--) {
			for (let x = 0; x < bufferCols; x++) {
				const idx = y * bufferCols + x
				const distFromBottom = bufferRows - 2 - y
				const heat = Math.max(0, 255 - distFromBottom * 50)
				buffer[idx] = heat
			}
		}
		// Everything else stays at 0 (black)
		samplerState = { buffer, bufferCols, bufferRows, lastFrame: -1 } // Set to -1 so we process frame 0
		sharedSamplerStore.set(stateKey, samplerState)
	}

	const virtualBuffer = samplerState.buffer
	const currentBufferCols = samplerState.bufferCols
	const currentBufferRows = samplerState.bufferRows

	// Only process the buffer if this frame hasn't been processed yet
	// This prevents multiple processing when scrolling triggers multiple renders
	// Process only when frame advances forward (frame > lastFrame)
	// If frame < lastFrame, the reset logic above already handled it
	if (frame > samplerState.lastFrame) {
		// Reuse pre-allocated read buffer instead of allocating new one each frame
		let readBuffer = samplerState.readBuffer
		if (!readBuffer || readBuffer.length !== virtualBuffer.length) {
			readBuffer = new Uint8Array(virtualBuffer.length)
			samplerState.readBuffer = readBuffer
		}
		readBuffer.set(virtualBuffer)

		// Create random number generator
		const random = createRandom(seed + frame)

		// Process fire for the entire virtual buffer
		// Fill bottom row with random sparks
		const bottomRowStart = (currentBufferRows - 1) * currentBufferCols
		for (let x = 0; x < currentBufferCols; x++) {
			const sparkValue = Math.floor(sparkRange[0] + random() * (sparkRange[1] - sparkRange[0]))
			virtualBuffer[bottomRowStart + x] = sparkValue
			// DON'T update readBuffer - we want to read from the PREVIOUS frame
		}

		// Process fire from bottom to top
		// Read from readBuffer (previous frame) and write to virtualBuffer (current frame)
		for (let y = currentBufferRows - 2; y >= 0; y--) {
			for (let x = 0; x < currentBufferCols; x++) {
				const currentIdx = y * currentBufferCols + x

				// Get indices of pixels below (with horizontal wrapping)
				const belowY = y + 1
				const leftX = (x - 1 + currentBufferCols) % currentBufferCols
				const rightX = (x + 1) % currentBufferCols

				const belowIdx = belowY * currentBufferCols + x
				const belowLeftIdx = belowY * currentBufferCols + leftX
				const belowRightIdx = belowY * currentBufferCols + rightX

				// Average with adjacent pixels below (read from previous frame)
				const avg =
					(readBuffer[belowIdx] + readBuffer[belowLeftIdx] + readBuffer[belowRightIdx]) / 3

				// Darken by subtracting constant amount
				// Use floating point then floor to allow fractional darkening
				const darkened = Math.max(0, avg - darkenAmount)

				virtualBuffer[currentIdx] = Math.floor(darkened)
			}
		}

		// Update lastFrame only after processing is complete
		samplerState.lastFrame = frame
	}

	// Return sampler function
	return (x: number, y: number) => {
		// Wrap X coordinates horizontally
		const wrappedX = ((x % currentBufferCols) + currentBufferCols) % currentBufferCols

		// For Y: Fire buffer sits at the BOTTOM of the virtual world
		// Fire bottom should always be at worldHeight - 1
		// Fire top is at worldHeight - naturalHeight
		const actualWorldHeight = worldHeight || currentBufferRows // Use provided worldHeight or default to bufferRows
		const fireStartY = Math.max(0, actualWorldHeight - naturalHeight)

		// If we're above the fire region, return black
		if (y < fireStartY) {
			return { ch: ' ', fg: FIRE_PALETTE[0], bg: bgColor, bold: false }
		}

		// Map world Y to buffer Y
		// y=fireStartY maps to buffer row 0 (top of fire)
		// y=actualWorldHeight-1 maps to buffer row naturalHeight-1 (bottom of fire, before fuel row)
		const bufferY = y - fireStartY
		const clampedY = Math.max(0, Math.min(bufferY, currentBufferRows - 2)) // Don't sample from fuel row

		const paletteIndex = virtualBuffer[clampedY * currentBufferCols + wrappedX]
		const ch = charLookup[paletteIndex]
		const fgColor = FIRE_PALETTE[paletteIndex]

		return { ch, fg: fgColor, bg: bgColor, bold: false }
	}
}

/**
 * Clear all fire state (useful for resetting effects or when switching generators)
 */
export function clearFireState() {
	sharedFireStore.clear()
	sharedSamplerStore.clear()
}
