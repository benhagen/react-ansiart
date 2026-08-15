import type { AnsiScreen } from '../ansi/types'
import type { CharacterFrameGenerator } from '../types/types'
import { buildCharLookup } from './charLookup'
import { createGeneratorStateStore, type GeneratorStateStore } from './generatorState'
import { catchupSteps } from './simulationCatchup'

// Gray-Scott model defaults — "coral growth" pattern
const DEFAULT_FEED_RATE = 0.055
const DEFAULT_KILL_RATE = 0.062
const DEFAULT_DIFFUSION_U = 1.0
const DEFAULT_DIFFUSION_V = 0.5
const DEFAULT_STEPS_PER_FRAME = 8
const DEFAULT_DT = 1.0
const DEFAULT_SEED = 9876
const DEFAULT_COLOR_MODE: 'spectrum' | 'mono' = 'spectrum'
const DEFAULT_BG_COLOR = '#000000'
const DEFAULT_CHARS = [' ', ' ', '.', '·', ':', ';', '+', '=', 'x', 'X', '$', '#', '@']

export interface AsciiReactionDiffusionOptions {
	/** Feed rate — controls pattern type. Default: 0.055. Range: 0.01–0.08 */
	feedRate?: number
	/** Kill rate — controls pattern type. Default: 0.062. Range: 0.045–0.07 */
	killRate?: number
	/** Diffusion rate of chemical U. Default: 1.0 */
	diffusionU?: number
	/** Diffusion rate of chemical V. Default: 0.5 */
	diffusionV?: number
	/** Simulation substeps per frame. Default: 8. Higher = faster evolution */
	stepsPerFrame?: number
	/** Simulation time step. Default: 1.0 */
	dt?: number
	/** Color mode: 'spectrum' (HSL) or 'mono'. Default: 'spectrum' */
	colorMode?: 'spectrum' | 'mono'
	/** Foreground color for mono mode. Default: '#55ffaa' */
	fgColor?: string
	/** Background color. Default: '#000000' */
	bgColor?: string
	/** Characters for brightness ramp. */
	chars?: string[]
	/** Seed for initial perturbation. Default: 9876 */
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

// HSL to RGB
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
	const c = (1 - Math.abs(2 * l - 1)) * s
	const x = c * (1 - Math.abs((h / 60) % 2 - 1))
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

// Parse CSS color to RGB
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
	return [85, 255, 170]
}

// Memoized char lookup
let lastChars: string[] | null = null
let lastCharLookup: string[] | null = null

function getCharLookup(chars: string[]): string[] {
	if (lastChars === chars && lastCharLookup) return lastCharLookup
	lastCharLookup = buildCharLookup(chars)
	lastChars = chars
	return lastCharLookup
}

// Pre-compute spectrum color table (256 entries)
let cachedSpectrumTable: string[] | null = null

function getSpectrumTable(): string[] {
	if (cachedSpectrumTable) return cachedSpectrumTable
	cachedSpectrumTable = new Array(256)
	for (let i = 0; i < 256; i++) {
		const t = i / 255
		// Map V concentration to hue: low V = blue/purple, high V = green/yellow
		const hue = 180 + t * 180 // 180° (cyan) to 360° (red/magenta)
		const saturation = 0.8 + t * 0.2
		const lightness = 0.1 + t * 0.5
		const [r, g, b] = hslToRgb(hue % 360, saturation, lightness)
		cachedSpectrumTable[i] = `rgb(${r},${g},${b})`
	}
	return cachedSpectrumTable
}

// State for the simulation
interface ReactionDiffusionState {
	gridU: Float32Array
	gridV: Float32Array
	tempU: Float32Array
	tempV: Float32Array
	lastFrame: number
	cols: number
	rows: number
}

// State shared by all callers of generateAsciiReactionDiffusionFrame. Prefer
// createAsciiReactionDiffusionGenerator, which gives each instance its own.
const sharedStore = createGeneratorStateStore<ReactionDiffusionState>()

/**
 * Clear the reaction-diffusion state shared by generateAsciiReactionDiffusionFrame callers.
 * Instances from createAsciiReactionDiffusionGenerator own their state and are unaffected.
 */
export function clearReactionDiffusionState(): void {
	sharedStore.clear()
}

function initState(cols: number, rows: number, seed: number): ReactionDiffusionState {
	const totalCells = cols * rows
	const gridU = new Float32Array(totalCells)
	const gridV = new Float32Array(totalCells)

	// Initialize: U = 1 everywhere, V = 0 everywhere
	gridU.fill(1.0)

	// Seed V with random perturbations — scattered small squares
	const random = createRandom(seed)
	const numSeeds = Math.floor(3 + random() * 5)

	for (let s = 0; s < numSeeds; s++) {
		const cx = Math.floor(random() * cols)
		const cy = Math.floor(random() * rows)
		const size = Math.floor(2 + random() * 4)

		for (let dy = -size; dy <= size; dy++) {
			for (let dx = -size; dx <= size; dx++) {
				const x = ((cx + dx) % cols + cols) % cols
				const y = ((cy + dy) % rows + rows) % rows
				const idx = y * cols + x
				gridU[idx] = 0.5 + random() * 0.1
				gridV[idx] = 0.25 + random() * 0.1
			}
		}
	}

	return {
		gridU,
		gridV,
		tempU: new Float32Array(totalCells),
		tempV: new Float32Array(totalCells),
		lastFrame: -1,
		cols,
		rows,
	}
}

// Memoized state-key builder — avoids a JSON.stringify allocation every frame
// when the options driving the key haven't changed since the last call.
let lastStateKeyParams: {
	columns: number
	rows: number
	seed: number
	feedRate: number
	killRate: number
	diffusionU: number
	diffusionV: number
} | null = null
let lastStateKey: string | null = null

function getStateKey(
	columns: number,
	rows: number,
	seed: number,
	feedRate: number,
	killRate: number,
	diffusionU: number,
	diffusionV: number,
): string {
	if (
		lastStateKeyParams &&
		lastStateKeyParams.columns === columns &&
		lastStateKeyParams.rows === rows &&
		lastStateKeyParams.seed === seed &&
		lastStateKeyParams.feedRate === feedRate &&
		lastStateKeyParams.killRate === killRate &&
		lastStateKeyParams.diffusionU === diffusionU &&
		lastStateKeyParams.diffusionV === diffusionV &&
		lastStateKey
	) {
		return lastStateKey
	}
	lastStateKeyParams = { columns, rows, seed, feedRate, killRate, diffusionU, diffusionV }
	lastStateKey = JSON.stringify(lastStateKeyParams)
	return lastStateKey
}

function renderReactionDiffusionFrame(
	store: GeneratorStateStore<ReactionDiffusionState>,
	frame: number,
	columns: number,
	rows: number,
	options: AsciiReactionDiffusionOptions,
): AnsiScreen {
	const {
		feedRate = DEFAULT_FEED_RATE,
		killRate = DEFAULT_KILL_RATE,
		diffusionU = DEFAULT_DIFFUSION_U,
		diffusionV = DEFAULT_DIFFUSION_V,
		stepsPerFrame = DEFAULT_STEPS_PER_FRAME,
		dt = DEFAULT_DT,
		colorMode = DEFAULT_COLOR_MODE,
		fgColor: monoFgColor = '#55ffaa',
		bgColor = DEFAULT_BG_COLOR,
		chars = DEFAULT_CHARS,
		seed = DEFAULT_SEED,
	} = options

	const charLookup = getCharLookup(chars)

	const stateKey = getStateKey(columns, rows, seed, feedRate, killRate, diffusionU, diffusionV)

	let state = store.get(stateKey)
	if (!state || frame < state.lastFrame) {
		state = initState(columns, rows, seed)
		store.set(stateKey, state)
	}

	// Local mutable bindings so the buffer "swap" below can just rebind these
	// variables instead of copying grid contents. Written back onto `state`
	// once the substep loop finishes so future frames see the latest buffers.
	let gridU = state.gridU
	let gridV = state.gridV
	let tempU = state.tempU
	let tempV = state.tempV

	// Simulate forward, capped so a large jump (backgrounded tab, seek) cannot block
	// the main thread proportionally to the gap.
	const cappedSteps = catchupSteps(frame, state.lastFrame) * stepsPerFrame

	for (let step = 0; step < cappedSteps; step++) {
		// Compute Laplacian and update using Gray-Scott equations
		for (let y = 0; y < rows; y++) {
			const yUp = y > 0 ? y - 1 : rows - 1
			const yDown = y < rows - 1 ? y + 1 : 0

			for (let x = 0; x < columns; x++) {
				const xLeft = x > 0 ? x - 1 : columns - 1
				const xRight = x < columns - 1 ? x + 1 : 0

				const idx = y * columns + x

				// 5-point Laplacian stencil
				const laplacianU =
					gridU[yUp * columns + x] +
					gridU[yDown * columns + x] +
					gridU[y * columns + xLeft] +
					gridU[y * columns + xRight] -
					4 * gridU[idx]

				const laplacianV =
					gridV[yUp * columns + x] +
					gridV[yDown * columns + x] +
					gridV[y * columns + xLeft] +
					gridV[y * columns + xRight] -
					4 * gridV[idx]

				const u = gridU[idx]
				const v = gridV[idx]
				const uvv = u * v * v

				// Gray-Scott equations, clamped at write time so no separate
				// full-grid clamp/copy pass is needed after the stencil.
				tempU[idx] = Math.max(0, Math.min(1, u + (diffusionU * laplacianU - uvv + feedRate * (1 - u)) * dt))
				tempV[idx] = Math.max(0, Math.min(1, v + (diffusionV * laplacianV + uvv - (feedRate + killRate) * v) * dt))
			}
		}

		// Swap buffers by reference (gridU/tempU and gridV/tempV are plain
		// local bindings — no other code holds onto the old references).
		;[gridU, tempU] = [tempU, gridU]
		;[gridV, tempV] = [tempV, gridV]
	}

	state.gridU = gridU
	state.gridV = gridV
	state.tempU = tempU
	state.tempV = tempV
	state.lastFrame = frame

	// Generate screen from V concentration
	const spectrumTable = colorMode === 'spectrum' ? getSpectrumTable() : null
	const monoRgb = colorMode === 'mono' ? parseColor(monoFgColor) : null
	const bgRgb = parseColor(bgColor)

	const screenLines: AnsiScreen['lines'] = []

	for (let y = 0; y < rows; y++) {
		const line: AnsiScreen['lines'][number] = []

		for (let x = 0; x < columns; x++) {
			const v = gridV[y * columns + x]

			// Map V concentration (typically 0–0.5) to brightness 0–255
			const normalized = Math.min(1, v * 3) // Scale up since V rarely exceeds ~0.35
			const brightnessIdx = Math.floor(normalized * 255)
			const ch = charLookup[Math.min(255, Math.max(0, brightnessIdx))]

			let fg: string
			if (spectrumTable) {
				fg = spectrumTable[Math.min(255, brightnessIdx)]
			} else {
				// Mono mode: scale monoFgColor by brightness
				const scale = normalized
				fg = `rgb(${Math.round(monoRgb![0] * scale)},${Math.round(monoRgb![1] * scale)},${Math.round(monoRgb![2] * scale)})`
			}

			// Background: subtle tint from U concentration
			const u = gridU[y * columns + x]
			const uTint = (1 - u) * 0.15
			const bgR = Math.min(255, Math.round(bgRgb[0] + 30 * uTint))
			const bgG = Math.min(255, Math.round(bgRgb[1] + 10 * uTint))
			const bgB = Math.min(255, Math.round(bgRgb[2] + 40 * uTint))
			const cellBg = uTint > 0.01 ? `rgb(${bgR},${bgG},${bgB})` : bgColor

			line.push({ ch, fg, bg: cellBg, bold: normalized > 0.6 })
		}

		screenLines.push(line)
	}

	return { lines: screenLines, columns }
}

/**
 * Generate an ASCII reaction-diffusion frame — Gray-Scott Turing patterns.
 *
 * Uses process-wide state keyed on dimensions and options, so separate components with
 * matching options will interfere with each other. Prefer
 * {@link createAsciiReactionDiffusionGenerator} when rendering more than one instance.
 */
export function generateAsciiReactionDiffusionFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiReactionDiffusionOptions = {},
): AnsiScreen {
	return renderReactionDiffusionFrame(sharedStore, frame, columns, rows, options)
}

/**
 * Create a reaction-diffusion generator that owns its simulation state.
 * Each call returns an independent instance safe to render alongside others.
 */
export function createAsciiReactionDiffusionGenerator(
	options: AsciiReactionDiffusionOptions = {},
): CharacterFrameGenerator {
	const store = createGeneratorStateStore<ReactionDiffusionState>()
	return (frame: number, columns: number, rows: number) =>
		renderReactionDiffusionFrame(store, frame, columns, rows, options)
}

/**
 * Create a reusable sampler for reaction-diffusion at a specific frame.
 */
export function createAsciiReactionDiffusionSampler(
	frame: number,
	options: AsciiReactionDiffusionOptions = {},
) {
	const { bgColor = DEFAULT_BG_COLOR } = options

	const cols = 120
	const rows = 60
	const screen = generateAsciiReactionDiffusionFrame(frame, cols, rows, options)

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
