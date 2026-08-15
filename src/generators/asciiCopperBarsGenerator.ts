import type { AnsiScreen } from '../ansi/types'
import { buildCharLookup } from './charLookup'

const DEFAULT_BAR_COUNT = 5
const DEFAULT_BAR_HEIGHT = 6
const DEFAULT_SPEED = 0.04
const DEFAULT_BG_COLOR = '#000000'
const DEFAULT_BG_CHAR = ' '
const DEFAULT_SEED = 7777
const DEFAULT_CHARS = [' ', '.', '·', ':', '+', '=', '#', '@']

// Classic Amiga copper bar palette — vivid, saturated colors
const DEFAULT_PALETTE = [
	'#ff2244', // Red
	'#ff8800', // Orange
	'#ffdd00', // Yellow
	'#00cc66', // Green
	'#2288ff', // Blue
	'#aa44ff', // Purple
	'#ff44aa', // Pink
	'#00cccc', // Teal
]

export interface AsciiCopperBarsOptions {
	/** Number of bars (3–8). Default: 5 */
	barCount?: number
	/** Height of each bar in rows (gaussian sigma). Default: 6 */
	barHeight?: number
	/** Animation speed multiplier. Default: 0.04 */
	speed?: number
	/** Color palette for bars (CSS color strings). Default: classic Amiga palette */
	colorPalette?: string[]
	/** Background color (CSS color string). Default: '#000000' */
	bgColor?: string
	/** Background character. Default: ' ' */
	backgroundChar?: string
	/** Characters for brightness ramp. Default: ' .·:+=# @' */
	chars?: string[]
	/** Seed for deterministic bar phases. Default: 7777 */
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
	const match = color.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
	if (match) {
		return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]
	}
	return [255, 255, 255]
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

// Pre-computed bar config (phases, speed multipliers) cached by seed + barCount
interface BarConfig {
	phase: number
	speedMul: number
	amplitude: number
}

let lastBarConfigKey: string | null = null
let lastBarConfigs: BarConfig[] | null = null

function getBarConfigs(seed: number, barCount: number): BarConfig[] {
	const key = `${seed}:${barCount}`
	if (key === lastBarConfigKey && lastBarConfigs) return lastBarConfigs
	const random = createRandom(seed)
	const configs: BarConfig[] = []
	for (let i = 0; i < barCount; i++) {
		configs.push({
			phase: random() * Math.PI * 2,
			speedMul: 0.7 + random() * 0.6, // Varied speeds
			amplitude: 0.3 + random() * 0.4, // Varied amplitudes (fraction of screen height)
		})
	}
	lastBarConfigKey = key
	lastBarConfigs = configs
	return configs
}

/**
 * Generate an ASCII copper bars frame — classic Amiga demoscene effect.
 * Horizontal gradient bars move on sine wave paths with additive overlap.
 */
export function generateAsciiCopperBarsFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiCopperBarsOptions = {},
): AnsiScreen {
	const {
		barCount = DEFAULT_BAR_COUNT,
		barHeight = DEFAULT_BAR_HEIGHT,
		speed = DEFAULT_SPEED,
		colorPalette = DEFAULT_PALETTE,
		bgColor = DEFAULT_BG_COLOR,
		backgroundChar = DEFAULT_BG_CHAR,
		chars = DEFAULT_CHARS,
		seed = DEFAULT_SEED,
	} = options

	const charLookup = getCharLookup(chars)
	const barConfigs = getBarConfigs(seed, barCount)
	const halfRows = rows / 2

	// Parse bar colors once
	const barColors = barConfigs.map((_, i) => parseColor(colorPalette[i % colorPalette.length]))

	// Gaussian falloff: sigma = barHeight / 2, so 95% of energy within barHeight
	const sigma = barHeight / 2
	const invSigmaSq2 = 1 / (2 * sigma * sigma)

	// Pre-compute per-row contributions from each bar
	// This is the key optimization — bar contribution only varies by row, not column
	const rowBrightness = new Float32Array(rows)
	const rowColorR = new Float32Array(rows)
	const rowColorG = new Float32Array(rows)
	const rowColorB = new Float32Array(rows)

	for (let b = 0; b < barCount; b++) {
		const config = barConfigs[b]
		const color = barColors[b]

		// Bar center Y oscillates on a sine wave
		const centerY = halfRows + Math.sin(frame * speed * config.speedMul + config.phase) * halfRows * config.amplitude

		for (let y = 0; y < rows; y++) {
			const dy = y - centerY
			const falloff = Math.exp(-(dy * dy) * invSigmaSq2)

			if (falloff < 0.01) continue // Skip negligible contributions

			// Additive blending
			rowBrightness[y] += falloff
			rowColorR[y] += color[0] * falloff
			rowColorG[y] += color[1] * falloff
			rowColorB[y] += color[2] * falloff
		}
	}

	// Build screen
	const lines: AnsiScreen['lines'] = []

	for (let y = 0; y < rows; y++) {
		const line: AnsiScreen['lines'][number] = []
		const brightness = rowBrightness[y]

		if (brightness < 0.01) {
			// Empty row — all background
			for (let x = 0; x < columns; x++) {
				line.push({ ch: backgroundChar, fg: bgColor, bg: bgColor, bold: false })
			}
		} else {
			// Clamp brightness for character lookup
			const clampedBrightness = Math.min(brightness, 1)
			const charIndex = Math.floor(clampedBrightness * 255)
			const ch = charLookup[Math.min(255, charIndex)]

			// Normalize color by total brightness (weighted average)
			const invBrightness = 1 / brightness
			const r = Math.min(255, Math.round(rowColorR[y] * invBrightness))
			const g = Math.min(255, Math.round(rowColorG[y] * invBrightness))
			const b = Math.min(255, Math.round(rowColorB[y] * invBrightness))

			// Scale color intensity by brightness for the glow effect
			const intensityScale = Math.min(brightness, 1.5)
			const fr = Math.min(255, Math.round(r * intensityScale))
			const fg = Math.min(255, Math.round(g * intensityScale))
			const fb = Math.min(255, Math.round(b * intensityScale))
			const fgColor = `rgb(${fr},${fg},${fb})`

			// Background has a subtle glow from the bar
			const bgScale = Math.min(brightness * 0.3, 0.8)
			const br = Math.min(255, Math.round(r * bgScale))
			const bgr = Math.min(255, Math.round(g * bgScale))
			const bgb = Math.min(255, Math.round(b * bgScale))
			const rowBgColor = brightness > 0.05 ? `rgb(${br},${bgr},${bgb})` : bgColor

			for (let x = 0; x < columns; x++) {
				line.push({ ch, fg: fgColor, bg: rowBgColor, bold: brightness > 0.7 })
			}
		}

		lines.push(line)
	}

	return { lines, columns }
}

/**
 * Create a reusable sampler for copper bars at a specific frame.
 * Returns a function mapping (x, y) to an AnsiCell.
 */
export function createAsciiCopperBarsSampler(
	frame: number,
	options: AsciiCopperBarsOptions = {},
) {
	const {
		bgColor = DEFAULT_BG_COLOR,
		backgroundChar = DEFAULT_BG_CHAR,
	} = options

	// Use a reasonable backing grid
	const cols = 80
	const rows = 60
	const screen = generateAsciiCopperBarsFrame(frame, cols, rows, options)

	return (x: number, y: number) => {
		const wrappedX = ((x % cols) + cols) % cols
		const wrappedY = ((y % rows) + rows) % rows

		const cell = screen.lines[wrappedY]?.[wrappedX]
		if (!cell) {
			return { ch: backgroundChar, fg: bgColor, bg: bgColor, bold: false }
		}
		return cell
	}
}
