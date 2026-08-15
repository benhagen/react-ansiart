import type { AnsiScreen } from '../ansi/types'
import type { CharacterFrameGenerator } from '../types/types'
import { createGeneratorStateStore, type GeneratorStateStore } from './generatorState'

// Default character pool: half-width katakana + digits + symbols
const DEFAULT_CHARS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789:."=*+-<>'

const DEFAULT_SPEED = 0.5
const DEFAULT_DENSITY = 0.7
const DEFAULT_TRAIL_LENGTH = 15
const DEFAULT_HEAD_COLOR = '#ffffff'
const DEFAULT_TRAIL_COLOR = '#00ff44'
const DEFAULT_BG_COLOR = '#000000'
const DEFAULT_SEED = 7331

export interface AsciiMatrixRainOptions {
	/** Base fall speed (rows per frame). Default: 0.5 */
	speed?: number
	/** Fraction of columns with active streams (0–1). Default: 0.7 */
	density?: number
	/** Average trail length in rows. Default: 15 */
	trailLength?: number
	/** Head character color (CSS). Default: '#ffffff' */
	headColor?: string
	/** Trail body color (CSS). Default: '#00ff44' */
	trailColor?: string
	/** Background color (CSS). Default: '#000000' */
	bgColor?: string
	/** Character pool to draw from. Default: half-width katakana + digits + symbols */
	chars?: string
	/** RNG seed. Default: 7331 */
	seed?: number
}

function createRandom(seed: number) {
	let state = seed >>> 0
	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0
		return state / 0xffffffff
	}
}

// Parse hex color to [r, g, b]
function parseHex(hex: string): [number, number, number] {
	const h = hex.startsWith('#') ? hex.slice(1) : hex
	return [
		parseInt(h.slice(0, 2), 16) || 0,
		parseInt(h.slice(2, 4), 16) || 0,
		parseInt(h.slice(4, 6), 16) || 0,
	]
}

function lerpColor(
	a: [number, number, number],
	b: [number, number, number],
	t: number,
): string {
	const r = Math.round(a[0] + (b[0] - a[0]) * t)
	const g = Math.round(a[1] + (b[1] - a[1]) * t)
	const b2 = Math.round(a[2] + (b[2] - a[2]) * t)
	return `rgb(${r},${g},${b2})`
}

// Memoized char pool split: Array.from(chars) was re-run every frame even though chars is
// constant per generator instance.
let lastMatrixChars: string | null = null
let lastMatrixCharPool: string[] | null = null

function getMatrixCharPool(chars: string): string[] {
	if (lastMatrixChars === chars && lastMatrixCharPool) return lastMatrixCharPool
	lastMatrixCharPool = Array.from(chars)
	lastMatrixChars = chars
	return lastMatrixCharPool
}

// Trail fade color cache: trailColor is constant for a render, and the interpolation factor
// t*t is deterministic per (stream.length, distFromHead) pair, both of which recur across
// frames (streams keep their length once spawned). Cache by exact t value so results are
// pixel-identical to the uncached lerpColor call — no quantization. Bounded with simple
// insertion-order eviction, reset whenever trailColor changes.
const MAX_TRAIL_COLOR_CACHE = 4096
let trailColorCacheKey: string | null = null
let trailColorCache: Map<number, string> | null = null

function getTrailFadeColor(trailRGB: [number, number, number], trailColor: string, t: number): string {
	if (trailColorCacheKey !== trailColor || !trailColorCache) {
		trailColorCache = new Map()
		trailColorCacheKey = trailColor
	}
	const cached = trailColorCache.get(t)
	if (cached !== undefined) return cached
	const result = lerpColor(trailRGB, [0, 0, 0], t)
	trailColorCache.set(t, result)
	if (trailColorCache.size > MAX_TRAIL_COLOR_CACHE) {
		const oldest = trailColorCache.keys().next().value
		if (oldest !== undefined) trailColorCache.delete(oldest)
	}
	return result
}

// Memoized JSON.stringify state key.
let lastMatrixKeyInputs: { columns: number; seed: number; density: number; trailLength: number } | null = null
let lastMatrixKeyStr: string | null = null

function getMatrixStateKey(columns: number, seed: number, density: number, trailLength: number): string {
	const prev = lastMatrixKeyInputs
	if (
		prev &&
		lastMatrixKeyStr &&
		prev.columns === columns &&
		prev.seed === seed &&
		prev.density === density &&
		prev.trailLength === trailLength
	) {
		return lastMatrixKeyStr
	}
	lastMatrixKeyStr = JSON.stringify({ columns, seed, density, trailLength })
	lastMatrixKeyInputs = { columns, seed, density, trailLength }
	return lastMatrixKeyStr
}

interface Stream {
	y: number
	speed: number
	length: number
	charIndices: number[]
	charChangeRate: number
}

interface MatrixState {
	streams: (Stream | null)[]
	lastFrame: number
}

// State shared by all callers of generateAsciiMatrixRainFrame. Prefer
// createAsciiMatrixRainGenerator, which gives each instance its own.
const sharedStore = createGeneratorStateStore<MatrixState>()

function initStream(
	rng: () => number,
	rows: number,
	baseSpeed: number,
	trailLength: number,
	charPoolSize: number,
): Stream {
	const speed = baseSpeed * (0.5 + rng() * 1.0)
	const length = Math.max(3, Math.floor(trailLength * (0.5 + rng() * 1.0)))
	const charIndices: number[] = []
	for (let i = 0; i < length; i++) {
		charIndices.push(Math.floor(rng() * charPoolSize))
	}
	return {
		y: -Math.floor(rng() * rows * 1.5), // stagger start positions
		speed,
		length,
		charIndices,
		charChangeRate: 0.03 + rng() * 0.07,
	}
}

function renderMatrixRainFrame(
	store: GeneratorStateStore<MatrixState>,
	frame: number,
	columns: number,
	rows: number,
	options: AsciiMatrixRainOptions,
): AnsiScreen {
	const {
		speed = DEFAULT_SPEED,
		density = DEFAULT_DENSITY,
		trailLength = DEFAULT_TRAIL_LENGTH,
		headColor = DEFAULT_HEAD_COLOR,
		trailColor = DEFAULT_TRAIL_COLOR,
		bgColor = DEFAULT_BG_COLOR,
		chars = DEFAULT_CHARS,
		seed = DEFAULT_SEED,
	} = options

	const charPool = getMatrixCharPool(chars)
	const stateKey = getMatrixStateKey(columns, seed, density, trailLength)

	let state = store.get(stateKey)
	if (!state || frame < state.lastFrame) {
		const rng = createRandom(seed)
		const streams: (Stream | null)[] = []
		for (let col = 0; col < columns; col++) {
			if (rng() < density) {
				streams.push(initStream(rng, rows, speed, trailLength, charPool.length))
			} else {
				streams.push(null)
			}
		}
		state = { streams, lastFrame: -1 }
		store.set(stateKey, state)
	}

	const trailRGB = parseHex(trailColor)

	// Advance streams
	const rng = createRandom(seed + frame * 97)
	for (let col = 0; col < columns; col++) {
		const stream = state.streams[col]
		if (stream) {
			stream.y += stream.speed

			// Randomly mutate characters in trail
			for (let i = 0; i < stream.charIndices.length; i++) {
				if (rng() < stream.charChangeRate) {
					stream.charIndices[i] = Math.floor(rng() * charPool.length)
				}
			}

			// Respawn when fully off-screen
			if (stream.y - stream.length > rows) {
				if (rng() < density) {
					state.streams[col] = initStream(rng, rows, speed, trailLength, charPool.length)
					state.streams[col]!.y = -Math.floor(rng() * trailLength)
				} else {
					state.streams[col] = null
				}
			}
		} else {
			// Chance to spawn new stream
			if (rng() < density * 0.02) {
				state.streams[col] = initStream(rng, rows, speed, trailLength, charPool.length)
				state.streams[col]!.y = -Math.floor(rng() * trailLength)
			}
		}
	}

	state.lastFrame = frame

	// Render
	const lines: AnsiScreen['lines'] = []
	for (let row = 0; row < rows; row++) {
		const line: AnsiScreen['lines'][number] = []
		for (let col = 0; col < columns; col++) {
			const stream = state.streams[col]
			if (!stream) {
				line.push({ ch: ' ', fg: bgColor, bg: bgColor, bold: false })
				continue
			}

			const headY = Math.floor(stream.y)
			const distFromHead = row - headY

			if (distFromHead < 0 || distFromHead >= stream.length) {
				// Outside trail
				line.push({ ch: ' ', fg: bgColor, bg: bgColor, bold: false })
			} else if (distFromHead === 0) {
				// Head — bright white
				const ch = charPool[stream.charIndices[0] % charPool.length]
				line.push({ ch, fg: headColor, bg: bgColor, bold: true })
			} else {
				// Trail — fade from bright green to black
				const t = distFromHead / (stream.length - 1) // 0 at head, 1 at tail
				const ch = charPool[stream.charIndices[distFromHead % stream.charIndices.length] % charPool.length]
				const fg = getTrailFadeColor(trailRGB, trailColor, t * t) // quadratic fade
				line.push({ ch, fg, bg: bgColor, bold: false })
			}
		}
		lines.push(line)
	}

	return { lines, columns }
}

/**
 * Generate an ASCII Matrix-style digital rain frame.
 *
 * Uses process-wide state keyed on dimensions and options, so separate components with
 * matching options will interfere with each other. Prefer
 * {@link createAsciiMatrixRainGenerator} when rendering more than one instance.
 */
export function generateAsciiMatrixRainFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiMatrixRainOptions = {},
): AnsiScreen {
	return renderMatrixRainFrame(sharedStore, frame, columns, rows, options)
}

/**
 * Create a Matrix rain generator that owns its stream state.
 * Each call returns an independent instance safe to render alongside others.
 */
export function createAsciiMatrixRainGenerator(
	options: AsciiMatrixRainOptions = {},
): CharacterFrameGenerator {
	const store = createGeneratorStateStore<MatrixState>()
	return (frame: number, columns: number, rows: number) =>
		renderMatrixRainFrame(store, frame, columns, rows, options)
}

/**
 * Create a sampler for virtual world / windowed rendering.
 */
export function createAsciiMatrixRainSampler(
	frame: number,
	options: AsciiMatrixRainOptions = {},
) {
	// Pre-render a virtual buffer and return a coordinate lookup
	const virtualCols = 200
	const virtualRows = 120
	const screen = generateAsciiMatrixRainFrame(frame, virtualCols, virtualRows, options)

	return (x: number, y: number) => {
		const wx = ((x % virtualCols) + virtualCols) % virtualCols
		const wy = ((y % virtualRows) + virtualRows) % virtualRows
		const line = screen.lines[wy]
		if (!line || !line[wx]) {
			return { ch: ' ', fg: options.bgColor ?? DEFAULT_BG_COLOR, bg: options.bgColor ?? DEFAULT_BG_COLOR, bold: false }
		}
		return line[wx]
	}
}

/**
 * Clear all matrix rain state.
 */
export function clearMatrixRainState() {
	sharedStore.clear()
}
