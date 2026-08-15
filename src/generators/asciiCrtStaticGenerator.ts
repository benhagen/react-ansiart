import type { AnsiScreen } from '../ansi/types'
import { buildCharLookup } from './charLookup'

const DEFAULT_SIGNAL_STRENGTH = 0.3
const DEFAULT_SCANLINE_INTENSITY = 0.3
const DEFAULT_TEAR_FREQUENCY = 0.08
const DEFAULT_ROLLING_BAR_SPEED = 0.02
const DEFAULT_VHS_MODE = false
const DEFAULT_SEED = 4242
const DEFAULT_BG_COLOR = '#000000'
const DEFAULT_CHARS = [' ', '.', '·', '-', ':', '+', '=', '%', '#', '@']

export interface AsciiCrtStaticOptions {
	/** Signal strength 0.0 (lost) to 1.0 (clean). Default: 0.3 */
	signalStrength?: number
	/** Scanline banding intensity (0–1). Default: 0.3 */
	scanlineIntensity?: number
	/** Probability of horizontal tear per frame (0–1). Default: 0.08 */
	tearFrequency?: number
	/** Rolling bar speed. Default: 0.02 */
	rollingBarSpeed?: number
	/** Enable VHS mode (tracking lines + chroma aberration). Default: false */
	vhsMode?: boolean
	/** Seed for deterministic noise. Default: 4242 */
	seed?: number
	/** Background color (CSS color string). Default: '#000000' */
	bgColor?: string
	/** Characters for brightness ramp. Default: ' .·-:+=%#@' */
	chars?: string[]
}

// Fast deterministic hash for per-cell noise
function hash2D(x: number, y: number, seed: number): number {
	let h = (x * 0x9e3779b1) ^ (y * 0x85ebca6b) ^ seed
	h ^= h >>> 16
	h = Math.imul(h, 0x7feb352d)
	h ^= h >>> 15
	h = Math.imul(h, 0x846ca68b)
	h ^= h >>> 16
	return (h >>> 0) / 0xffffffff
}

// Deterministic RNG
function createRandom(seed: number) {
	let state = seed >>> 0
	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0
		return state / 0xffffffff
	}
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

// 256-entry grayscale rgb() table covers the entire non-VHS color path (grey is always an
// integer 0-255 there), avoiding a per-cell template-string allocation every frame.
const GRAY_RGB_TABLE: string[] = (() => {
	const table = new Array<string>(256)
	for (let g = 0; g < 256; g++) {
		table[g] = `rgb(${g},${g},${g})`
	}
	return table
})()

// VHS chroma-aberration colors aren't limited to a small discrete domain, but repeated
// (r, g, b) triples are still common within a frame (many cells share noise/signal inputs).
// Cache by packed key when all channels fall in the normal 0-255 byte range; bounded with
// simple insertion-order eviction like createGeneratorStateStore.
const MAX_VHS_RGB_CACHE = 4096
const vhsRgbCache = new Map<number, string>()

function getVhsRgbString(r: number, g: number, b: number): string {
	if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
		// Outside the normal byte range (e.g. from unclamped option values) — build directly
		// rather than risk a packed-key collision changing the cached output.
		return `rgb(${r},${g},${b})`
	}
	const key = (r << 16) | (g << 8) | b
	const cached = vhsRgbCache.get(key)
	if (cached !== undefined) return cached
	const str = `rgb(${r},${g},${b})`
	vhsRgbCache.set(key, str)
	if (vhsRgbCache.size > MAX_VHS_RGB_CACHE) {
		const oldest = vhsRgbCache.keys().next().value
		if (oldest !== undefined) vhsRgbCache.delete(oldest)
	}
	return str
}

/**
 * Generate an ASCII CRT static frame — analog TV noise with signal degradation artifacts.
 */
export function generateAsciiCrtStaticFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiCrtStaticOptions = {},
): AnsiScreen {
	const {
		signalStrength = DEFAULT_SIGNAL_STRENGTH,
		scanlineIntensity = DEFAULT_SCANLINE_INTENSITY,
		tearFrequency = DEFAULT_TEAR_FREQUENCY,
		rollingBarSpeed = DEFAULT_ROLLING_BAR_SPEED,
		vhsMode = DEFAULT_VHS_MODE,
		seed = DEFAULT_SEED,
		bgColor = DEFAULT_BG_COLOR,
		chars = DEFAULT_CHARS,
	} = options

	const charLookup = getCharLookup(chars)
	const noise = 1 - signalStrength // How much static

	// Determine per-frame tear state
	const frameRng = createRandom(seed + frame * 73)
	const hasTear = frameRng() < tearFrequency
	const tearStartRow = hasTear ? Math.floor(frameRng() * rows) : -1
	const tearHeight = hasTear ? Math.floor(3 + frameRng() * 8) : 0
	const tearOffset = hasTear ? Math.floor((frameRng() - 0.5) * columns * 0.4) : 0

	// Rolling dark bar position
	const rollingBarY = (frame * rollingBarSpeed * rows) % (rows * 1.5)
	const rollingBarHeight = rows * 0.12

	// VHS tracking line positions (slow-moving horizontal glitch bands)
	const vhsLine1 = vhsMode ? (frame * 0.7 + seed) % (rows * 2) : -100
	const vhsLine2 = vhsMode ? (frame * 0.3 + seed * 2) % (rows * 2.5) : -100

	const lines: AnsiScreen['lines'] = []

	for (let y = 0; y < rows; y++) {
		const line: AnsiScreen['lines'][number] = []

		// Scanline banding — subtle darkening on even/odd rows
		const scanlineMod = (y % 2 === 0) ? 1.0 : (1.0 - scanlineIntensity * 0.5)

		// Rolling bar darkening
		const barDist = Math.abs(y - rollingBarY)
		const barFactor = barDist < rollingBarHeight
			? 1.0 - (1.0 - barDist / rollingBarHeight) * 0.6
			: 1.0

		// VHS tracking distortion
		const vhsDist1 = Math.abs(y - vhsLine1)
		const vhsDist2 = Math.abs(y - vhsLine2)
		const vhsFactor = vhsMode
			? (vhsDist1 < 3 ? 0.3 : 1.0) * (vhsDist2 < 2 ? 0.2 : 1.0)
			: 1.0
		const vhsXShift = vhsMode && vhsDist1 < 4
			? Math.floor((4 - vhsDist1) * 3 * Math.sin(y * 0.5 + frame * 0.3))
			: 0

		// Horizontal tear offset for this row
		const isTornRow = hasTear && y >= tearStartRow && y < tearStartRow + tearHeight
		const xShift = (isTornRow ? tearOffset : 0) + vhsXShift

		for (let x = 0; x < columns; x++) {
			// Apply horizontal shift
			const sampleX = ((x + xShift) % columns + columns) % columns

			// Base noise — different each frame
			const noiseVal = hash2D(sampleX, y, seed + frame)

			// Brightness: blend noise with a mid-gray signal based on signalStrength
			const signalVal = 0.5 + Math.sin(sampleX * 0.1 + y * 0.05 + frame * 0.02) * 0.15
			const rawBrightness = signalVal * signalStrength + noiseVal * noise

			// Apply scanline, rolling bar, and VHS modulation
			const brightness = Math.max(0, Math.min(1, rawBrightness * scanlineMod * barFactor * vhsFactor))

			const charIndex = Math.floor(brightness * 255)
			const ch = charLookup[Math.min(255, Math.max(0, charIndex))]

			// Color: grayscale base
			let fgColor: string

			if (vhsMode) {
				// Chroma aberration — offset RGB channels slightly
				const rNoise = hash2D(sampleX + 1, y, seed + frame)
				const bNoise = hash2D(sampleX - 1, y, seed + frame)
				const r = Math.floor(Math.min(255, (noiseVal * noise + rNoise * 0.3 * noise + signalVal * signalStrength) * scanlineMod * barFactor * 255))
				const g = Math.floor(Math.min(255, brightness * 255))
				const b = Math.floor(Math.min(255, (noiseVal * noise + bNoise * 0.3 * noise + signalVal * signalStrength) * scanlineMod * barFactor * 255))
				fgColor = getVhsRgbString(r, g, b)
			} else {
				const grey = Math.floor(brightness * 255)
				fgColor = GRAY_RGB_TABLE[grey]
			}

			line.push({ ch, fg: fgColor, bg: bgColor, bold: false })
		}

		lines.push(line)
	}

	return { lines, columns }
}

/**
 * Create a reusable sampler for CRT static at a specific frame.
 */
export function createAsciiCrtStaticSampler(
	frame: number,
	options: AsciiCrtStaticOptions = {},
) {
	const {
		bgColor = DEFAULT_BG_COLOR,
	} = options

	const cols = 200
	const rows = 60
	const screen = generateAsciiCrtStaticFrame(frame, cols, rows, options)

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
