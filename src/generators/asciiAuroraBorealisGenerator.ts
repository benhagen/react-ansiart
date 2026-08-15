import type { AnsiScreen } from '../ansi/types'
import { buildCharLookup } from './charLookup'

const DEFAULT_CURTAIN_COUNT = 4
const DEFAULT_SPEED = 0.015
const DEFAULT_INTENSITY = 1.0
const DEFAULT_SEED = 3333
const DEFAULT_BG_COLOR = '#000008'
const DEFAULT_CHARS = [' ', ' ', '.', '·', ':', '~', '=', '+', '*', '#', '@']

// Aurora palette — greens, teals, purples inspired by real aurora colors
// (oxygen green, nitrogen blue/purple, high-altitude red)
const DEFAULT_PALETTE = [
	'#00ff66', // Bright green (dominant aurora color — oxygen emission)
	'#00cc88', // Teal-green
	'#2266ff', // Blue (nitrogen)
	'#8844ff', // Purple (nitrogen)
	'#44ffaa', // Cyan-green
	'#ff2266', // Rare red (high-altitude oxygen)
]

export interface AsciiAuroraBorealisOptions {
	/** Number of curtain layers (2–6). Default: 4 */
	curtainCount?: number
	/** Animation speed. Default: 0.015 */
	speed?: number
	/** Overall intensity multiplier. Default: 1.0 */
	intensity?: number
	/** Color palette for curtains (CSS color strings). Default: aurora greens/purples */
	colorPalette?: string[]
	/** Background color (CSS color string). Default: '#000008' (very dark blue) */
	bgColor?: string
	/** Characters for brightness ramp. Default: '  .·:~=+*#@' */
	chars?: string[]
	/** Seed for deterministic curtain configuration. Default: 3333 */
	seed?: number
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
	return [0, 255, 100]
}

// Fast hash for noise-like variation
function hash2D(x: number, y: number, seed: number): number {
	let h = (x * 0x9e3779b1) ^ (y * 0x85ebca6b) ^ seed
	h ^= h >>> 16
	h = Math.imul(h, 0x7feb352d)
	h ^= h >>> 15
	h = Math.imul(h, 0x846ca68b)
	h ^= h >>> 16
	return (h >>> 0) / 0xffffffff
}

// Smooth noise using hash2D with interpolation
function smoothNoise(x: number, y: number, seed: number): number {
	const ix = Math.floor(x)
	const iy = Math.floor(y)
	const fx = x - ix
	const fy = y - iy

	// Smoothstep
	const sx = fx * fx * (3 - 2 * fx)
	const sy = fy * fy * (3 - 2 * fy)

	const n00 = hash2D(ix, iy, seed)
	const n10 = hash2D(ix + 1, iy, seed)
	const n01 = hash2D(ix, iy + 1, seed)
	const n11 = hash2D(ix + 1, iy + 1, seed)

	const nx0 = n00 + (n10 - n00) * sx
	const nx1 = n01 + (n11 - n01) * sx
	return nx0 + (nx1 - nx0) * sy
}

// Multi-octave noise for organic curtain shapes
function fbmNoise(x: number, y: number, seed: number, octaves: number): number {
	let value = 0
	let amplitude = 1
	let frequency = 1
	let maxValue = 0

	for (let i = 0; i < octaves; i++) {
		value += smoothNoise(x * frequency, y * frequency, seed + i * 31) * amplitude
		maxValue += amplitude
		amplitude *= 0.5
		frequency *= 2
	}

	return value / maxValue
}

// Deterministic RNG for curtain config
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

// Pre-computed curtain configuration
interface CurtainConfig {
	freq: number        // Horizontal frequency of the sine wave
	phaseSpeed: number  // How fast the curtain sways
	noiseScale: number  // Scale of noise modulation
	noiseSpeed: number  // Speed of noise animation
	amplitude: number   // Vertical extent of the curtain
	baseOffset: number  // Horizontal offset
	colorIdx: number    // Index into palette
}

// Reused additive-blend accumulation buffers — allocated once and reused
// across frames (re-zeroed each frame), reallocated only when the grid size
// (columns * rows) changes.
interface AuroraBuffers {
	totalR: Float32Array
	totalG: Float32Array
	totalB: Float32Array
	totalBrightness: Float32Array
	size: number
}

let auroraBuffers: AuroraBuffers | null = null

function getAuroraBuffers(size: number): AuroraBuffers {
	if (!auroraBuffers || auroraBuffers.size !== size) {
		auroraBuffers = {
			totalR: new Float32Array(size),
			totalG: new Float32Array(size),
			totalB: new Float32Array(size),
			totalBrightness: new Float32Array(size),
			size,
		}
	} else {
		auroraBuffers.totalR.fill(0)
		auroraBuffers.totalG.fill(0)
		auroraBuffers.totalB.fill(0)
		auroraBuffers.totalBrightness.fill(0)
	}
	return auroraBuffers
}

// Vertical falloff depends only on (y, rows) — not on frame, curtain, or x —
// so it's cached per row count rather than recomputed curtains*columns times
// per row inside the hot loop. Float64Array (not Float32) — verticalFalloff
// was previously a float64 local that feeds cellBrightness -> fg/bg rounding
// and the char index, and the table is at most a few hundred entries, so
// there's no perf reason to truncate precision here.
let falloffBuf: Float64Array | null = null
let falloffRows = -1

function getFalloffTable(rows: number): Float64Array {
	if (!falloffBuf || falloffRows !== rows) {
		falloffBuf = new Float64Array(rows)
		for (let y = 0; y < rows; y++) {
			const verticalPos = y / rows
			falloffBuf[y] = Math.exp(-verticalPos * 3.0) * (1.0 - verticalPos * 0.5)
		}
		falloffRows = rows
	}
	return falloffBuf
}

let lastCurtainConfigKey: string | null = null
let lastCurtainConfigs: CurtainConfig[] | null = null

function getCurtainConfigs(seed: number, curtainCount: number): CurtainConfig[] {
	const key = `${seed}:${curtainCount}`
	if (key === lastCurtainConfigKey && lastCurtainConfigs) return lastCurtainConfigs

	const random = createRandom(seed)
	const configs: CurtainConfig[] = []

	for (let i = 0; i < curtainCount; i++) {
		configs.push({
			freq: 0.02 + random() * 0.04,
			phaseSpeed: (0.5 + random() * 1.0) * (random() > 0.5 ? 1 : -1),
			noiseScale: 0.03 + random() * 0.05,
			noiseSpeed: 0.3 + random() * 0.5,
			amplitude: 0.5 + random() * 0.5,
			baseOffset: random() * Math.PI * 2,
			colorIdx: i,
		})
	}

	lastCurtainConfigKey = key
	lastCurtainConfigs = configs
	return configs
}

/**
 * Generate an ASCII aurora borealis frame — shimmering curtains of northern lights.
 */
export function generateAsciiAuroraBorealisFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiAuroraBorealisOptions = {},
): AnsiScreen {
	const {
		curtainCount = DEFAULT_CURTAIN_COUNT,
		speed = DEFAULT_SPEED,
		intensity = DEFAULT_INTENSITY,
		colorPalette = DEFAULT_PALETTE,
		bgColor = DEFAULT_BG_COLOR,
		chars = DEFAULT_CHARS,
		seed = DEFAULT_SEED,
	} = options

	const charLookup = getCharLookup(chars)
	const curtains = getCurtainConfigs(seed, curtainCount)

	// Parse curtain colors once
	const curtainColors = curtains.map(c => parseColor(colorPalette[c.colorIdx % colorPalette.length]))

	// Parse background color
	const bgRgb = parseColor(bgColor)

	const time = frame * speed

	// Accumulation buffers for additive blending (reused across frames)
	const { totalR, totalG, totalB, totalBrightness } = getAuroraBuffers(columns * rows)

	// Vertical falloff table — one entry per row, reused across frames
	const falloffTable = getFalloffTable(rows)

	// Process each curtain layer
	for (let c = 0; c < curtains.length; c++) {
		const curtain = curtains[c]
		const color = curtainColors[c]

		for (let x = 0; x < columns; x++) {
			// Curtain shape: sine wave + noise modulation for organic movement
			const noiseVal = fbmNoise(
				x * curtain.noiseScale,
				time * curtain.noiseSpeed,
				seed + c * 97,
				3,
			)
			const sineVal = Math.sin(
				x * curtain.freq + time * curtain.phaseSpeed + curtain.baseOffset + noiseVal * 2,
			)

			// Curtain center X-intensity — the curtain is brightest at its core
			const curtainIntensity = (sineVal * 0.5 + 0.5) * curtain.amplitude

			if (curtainIntensity < 0.05) continue

			for (let y = 0; y < rows; y++) {
				// Vertical falloff: bright at top, fading toward bottom
				// Aurora is strongest in the upper portion of sky
				const verticalFalloff = falloffTable[y]

				// Add slight vertical noise for shimmer effect
				const shimmer = 0.7 + 0.3 * fbmNoise(
					x * 0.08,
					y * 0.15 + time * 1.2,
					seed + c * 53,
					2,
				)

				const cellBrightness = curtainIntensity * verticalFalloff * shimmer * intensity

				if (cellBrightness < 0.01) continue

				const idx = y * columns + x
				totalBrightness[idx] += cellBrightness
				totalR[idx] += color[0] * cellBrightness
				totalG[idx] += color[1] * cellBrightness
				totalB[idx] += color[2] * cellBrightness
			}
		}
	}

	// Build screen from accumulated values
	const screenLines: AnsiScreen['lines'] = []

	for (let y = 0; y < rows; y++) {
		const line: AnsiScreen['lines'][number] = []

		for (let x = 0; x < columns; x++) {
			const idx = y * columns + x
			const brightness = totalBrightness[idx]

			if (brightness < 0.02) {
				// Add subtle star-like background dots
				const starNoise = hash2D(x, y, seed + 999)
				if (starNoise > 0.995) {
					const twinkle = 0.3 + 0.7 * Math.sin(frame * 0.1 * starNoise * 10 + starNoise * 100)
					const starBright = Math.floor(40 + twinkle * 60)
					line.push({
						ch: '.',
						fg: `rgb(${starBright},${starBright},${Math.floor(starBright * 1.2)})`,
						bg: bgColor,
						bold: false,
					})
				} else {
					line.push({ ch: ' ', fg: bgColor, bg: bgColor, bold: false })
				}
				continue
			}

			// Character from brightness
			const clampedBrightness = Math.min(brightness, 1)
			const charIndex = Math.floor(clampedBrightness * 255)
			const ch = charLookup[Math.min(255, charIndex)]

			// Weighted color average
			const invB = 1 / brightness
			const r = Math.min(255, Math.round(totalR[idx] * invB * Math.min(brightness, 1.2)))
			const g = Math.min(255, Math.round(totalG[idx] * invB * Math.min(brightness, 1.2)))
			const b = Math.min(255, Math.round(totalB[idx] * invB * Math.min(brightness, 1.2)))
			const fgColor = `rgb(${r},${g},${b})`

			// Subtle glow in background
			const bgScale = Math.min(brightness * 0.15, 0.4)
			const bgR = Math.max(bgRgb[0], Math.min(255, Math.round(totalR[idx] * invB * bgScale)))
			const bgG = Math.max(bgRgb[1], Math.min(255, Math.round(totalG[idx] * invB * bgScale)))
			const bgB = Math.max(bgRgb[2], Math.min(255, Math.round(totalB[idx] * invB * bgScale)))
			const cellBg = brightness > 0.1 ? `rgb(${bgR},${bgG},${bgB})` : bgColor

			line.push({ ch, fg: fgColor, bg: cellBg, bold: brightness > 0.6 })
		}

		screenLines.push(line)
	}

	return { lines: screenLines, columns }
}

/**
 * Create a reusable sampler for aurora borealis at a specific frame.
 */
export function createAsciiAuroraBorealisSampler(
	frame: number,
	options: AsciiAuroraBorealisOptions = {},
) {
	const {
		bgColor = DEFAULT_BG_COLOR,
	} = options

	const cols = 200
	const rows = 60
	const screen = generateAsciiAuroraBorealisFrame(frame, cols, rows, options)

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
