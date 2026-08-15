import type { AnsiScreen } from '../ansi/types'
import { buildCharLookup } from './charLookup'

const DEFAULT_SCROLL_SPEED = 0.3
const DEFAULT_HEIGHT_SCALE = 1.0
const DEFAULT_FOG_DISTANCE = 0.7
const DEFAULT_COLOR_MODE: 'biome' | 'mono' = 'biome'
const DEFAULT_SEED = 54321
const DEFAULT_BG_COLOR = '#000011'
const DEFAULT_SKY_COLOR = '#000022'
const DEFAULT_CHARS = [' ', '.', '·', ':', ';', '=', '+', 'x', 'X', '%', '#', '@']

// Biome color thresholds and colors
const BIOME_WATER: [number, number, number] = [20, 60, 140]
const BIOME_SAND: [number, number, number] = [180, 160, 100]
const BIOME_GRASS: [number, number, number] = [30, 130, 40]
const BIOME_FOREST: [number, number, number] = [20, 80, 25]
const BIOME_ROCK: [number, number, number] = [120, 110, 100]
const BIOME_SNOW: [number, number, number] = [220, 225, 235]

export interface AsciiTerrainFlyoverOptions {
	/** Scroll speed — how fast terrain moves toward camera. Default: 0.3 */
	scrollSpeed?: number
	/** Height scale (0–1). Default: 0.4. Controls terrain amplitude */
	heightScale?: number
	/** Fog distance factor (0–1). Default: 0.7. Lower = more fog */
	fogDistance?: number
	/** Color mode: 'biome' (height-based terrain colors) or 'mono'. Default: 'biome' */
	colorMode?: 'biome' | 'mono'
	/** Foreground color for mono mode. Default: '#88cc88' */
	fgColor?: string
	/** Background/sky color. Default: '#000011' */
	bgColor?: string
	/** Sky color for above-horizon rows. Default: '#000022' */
	skyColor?: string
	/** Characters for height ramp. */
	chars?: string[]
	/** Seed for terrain generation. Default: 54321 */
	seed?: number
}

// Fast hash for terrain noise
function hash2D(x: number, y: number, seed: number): number {
	let h = (x * 0x9e3779b1) ^ (y * 0x85ebca6b) ^ seed
	h ^= h >>> 16
	h = Math.imul(h, 0x7feb352d)
	h ^= h >>> 15
	h = Math.imul(h, 0x846ca68b)
	h ^= h >>> 16
	return (h >>> 0) / 0xffffffff
}

// Smooth noise with interpolation
function smoothNoise(x: number, y: number, seed: number): number {
	const ix = Math.floor(x)
	const iy = Math.floor(y)
	const fx = x - ix
	const fy = y - iy

	// Quintic smoothstep for better continuity
	const sx = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
	const sy = fy * fy * fy * (fy * (fy * 6 - 15) + 10)

	const n00 = hash2D(ix, iy, seed)
	const n10 = hash2D(ix + 1, iy, seed)
	const n01 = hash2D(ix, iy + 1, seed)
	const n11 = hash2D(ix + 1, iy + 1, seed)

	const nx0 = n00 + (n10 - n00) * sx
	const nx1 = n01 + (n11 - n01) * sx
	return nx0 + (nx1 - nx0) * sy
}

// Multi-octave fractal noise for terrain
function terrainNoise(x: number, y: number, seed: number): number {
	let value = 0
	let amplitude = 1
	let frequency = 1
	let maxValue = 0

	// 4 octaves for detailed terrain
	for (let i = 0; i < 4; i++) {
		value += smoothNoise(x * frequency, y * frequency, seed + i * 127) * amplitude
		maxValue += amplitude
		amplitude *= 0.45
		frequency *= 2.1
	}

	return value / maxValue
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
	return [0, 0, 17]
}

// Get biome color based on terrain height (0–1)
function getBiomeColor(height: number): [number, number, number] {
	if (height < 0.3) return BIOME_WATER
	if (height < 0.35) {
		// Water to sand transition
		const t = (height - 0.3) / 0.05
		return lerpRgb(BIOME_WATER, BIOME_SAND, t)
	}
	if (height < 0.4) return BIOME_SAND
	if (height < 0.45) {
		const t = (height - 0.4) / 0.05
		return lerpRgb(BIOME_SAND, BIOME_GRASS, t)
	}
	if (height < 0.6) return BIOME_GRASS
	if (height < 0.65) {
		const t = (height - 0.6) / 0.05
		return lerpRgb(BIOME_GRASS, BIOME_FOREST, t)
	}
	if (height < 0.75) return BIOME_FOREST
	if (height < 0.8) {
		const t = (height - 0.75) / 0.05
		return lerpRgb(BIOME_FOREST, BIOME_ROCK, t)
	}
	if (height < 0.9) return BIOME_ROCK
	if (height < 0.92) {
		const t = (height - 0.9) / 0.02
		return lerpRgb(BIOME_ROCK, BIOME_SNOW, t)
	}
	return BIOME_SNOW
}

function lerpRgb(
	a: [number, number, number],
	b: [number, number, number],
	t: number,
): [number, number, number] {
	return [
		Math.round(a[0] + (b[0] - a[0]) * t),
		Math.round(a[1] + (b[1] - a[1]) * t),
		Math.round(a[2] + (b[2] - a[2]) * t),
	]
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

// Reused row-height scratch buffer — each terrain row samples worldX at
// columns+1 points (one extra for the neighbor/slope lookup), reused across
// frames and reallocated only when the column count changes.
// Float64Array — terrainNoise produces float64, and `heights[x]` feeds both
// character selection (heightIdx) and biome-color thresholding (hard 0.05-wide
// boundaries), so truncating to float32 here risked flipping glyph/biome band
// right at a boundary. Float64 preserves full precision; the array is only
// columns+1 entries so the perf win from reuse is unaffected.
let heightsBuf: Float64Array | null = null
let heightsBufCols = -1

function getHeightsBuffer(columns: number): Float64Array {
	if (!heightsBuf || heightsBufCols !== columns) {
		heightsBuf = new Float64Array(columns + 1)
		heightsBufCols = columns
	}
	return heightsBuf
}

// Bounded cache mapping packed 24-bit RGB -> CSS rgb() string. Terrain color
// inputs are already integer-quantized (0-255 per channel) after rounding,
// so caching by exact (r,g,b) is lossless and keeps output identical.
const RGB_STRING_CACHE_MAX = 8192
const rgbStringCache = new Map<number, string>()

function rgbString(r: number, g: number, b: number): string {
	const key = (r << 16) | (g << 8) | b
	const cached = rgbStringCache.get(key)
	if (cached !== undefined) return cached
	const s = `rgb(${r},${g},${b})`
	if (rgbStringCache.size >= RGB_STRING_CACHE_MAX) {
		rgbStringCache.clear()
	}
	rgbStringCache.set(key, s)
	return s
}

/**
 * Generate an ASCII terrain flyover frame — 3D perspective heightmap with biome coloring.
 */
export function generateAsciiTerrainFlyoverFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiTerrainFlyoverOptions = {},
): AnsiScreen {
	const {
		scrollSpeed = DEFAULT_SCROLL_SPEED,
		heightScale = DEFAULT_HEIGHT_SCALE,
		fogDistance = DEFAULT_FOG_DISTANCE,
		colorMode = DEFAULT_COLOR_MODE,
		fgColor: monoFgColor = '#88cc88',
		bgColor = DEFAULT_BG_COLOR,
		skyColor = DEFAULT_SKY_COLOR,
		chars = DEFAULT_CHARS,
		seed = DEFAULT_SEED,
	} = options

	const charLookup = getCharLookup(chars)
	const bgRgb = parseColor(bgColor)
	const skyRgb = parseColor(skyColor)
	const monoRgb = colorMode === 'mono' ? parseColor(monoFgColor) : null

	// Terrain scrolls forward over time
	const scrollOffset = frame * scrollSpeed

	// Screen layout:
	// Top portion = sky (horizon line at ~30% from top)
	// Bottom portion = terrain rendered with perspective
	const horizonRow = Math.floor(rows * 0.3)

	// Initialize screen with sky
	const screenLines: AnsiScreen['lines'] = []

	// Sky rows
	for (let y = 0; y < horizonRow; y++) {
		const line: AnsiScreen['lines'][number] = []
		const skyT = y / horizonRow // 0 at top, 1 at horizon

		// Gradient from dark sky to lighter horizon
		const r = Math.round(skyRgb[0] + (skyRgb[0] * 0.5 + 10) * skyT)
		const g = Math.round(skyRgb[1] + (skyRgb[1] * 0.5 + 10) * skyT)
		const b = Math.round(skyRgb[2] + (skyRgb[2] * 0.5 + 20) * skyT)
		const rowSkyColor = `rgb(${Math.min(255, r)},${Math.min(255, g)},${Math.min(255, b)})`

		// Occasional stars in the upper sky
		for (let x = 0; x < columns; x++) {
			const starNoise = hash2D(x, y, seed + 555)
			if (skyT < 0.5 && starNoise > 0.993) {
				const twinkle = 0.5 + 0.5 * Math.sin(frame * 0.08 + starNoise * 100)
				const starBright = Math.floor(60 + twinkle * 80)
				line.push({
					ch: '.',
					fg: `rgb(${starBright},${starBright},${Math.floor(starBright * 1.1)})`,
					bg: rowSkyColor,
					bold: false,
				})
			} else {
				line.push({ ch: ' ', fg: rowSkyColor, bg: rowSkyColor, bold: false })
			}
		}
		screenLines.push(line)
	}

	// Terrain rows — rendered with perspective projection
	// Each screen row below horizon maps to a world Z distance
	const terrainRows = rows - horizonRow

	// We'll build a 2D buffer and fill it back-to-front
	const terrainBuffer: Array<{ ch: string; fg: string; bg: string; bold: boolean } | null>[] = []
	for (let i = 0; i < terrainRows; i++) {
		terrainBuffer.push(new Array(columns).fill(null))
	}

	// Render from far (top terrain row) to near (bottom terrain row)
	for (let screenY = 0; screenY < terrainRows; screenY++) {
		// Map screen row to world Z distance
		// screenY=0 is farthest, screenY=terrainRows-1 is nearest
		const t = (screenY + 1) / terrainRows // 0→1 from far to near
		const worldZ = 1 / (t * t + 0.01) // Inverse square for perspective

		// Fog factor based on distance
		const maxZ = 1 / (0.01) // Max possible Z
		const distRatio = worldZ / maxZ
		const fogFactor = Math.max(0, Math.min(1, 1 - (1 - fogDistance) * distRatio * 4))

		// Width scaling — farther rows are narrower in world space
		const widthScale = worldZ * 0.15

		// Sample the heightmap once per world-X sample point (columns+1 points
		// per row instead of the previous 2*columns — the neighbor sample for
		// column x is exactly the height sample for column x+1).
		const heights = getHeightsBuffer(columns)
		for (let hx = 0; hx <= columns; hx++) {
			const sampleWorldX = (hx - columns / 2) * widthScale
			heights[hx] = terrainNoise(
				sampleWorldX * 0.02,
				(worldZ + scrollOffset) * 0.02,
				seed,
			)
		}

		for (let x = 0; x < columns; x++) {
			// Sample heightmap
			const height = heights[x]

			// Character based on height
			const scaledHeight = height * heightScale
			const heightIdx = Math.floor(Math.max(0, Math.min(1, scaledHeight)) * 255)
			const ch = charLookup[Math.min(255, heightIdx)]

			// Color based on biome or mono
			let fgR: number, fgG: number, fgB: number
			if (colorMode === 'biome') {
				const biome = getBiomeColor(height)
				fgR = biome[0]
				fgG = biome[1]
				fgB = biome[2]
			} else {
				fgR = Math.round(monoRgb![0] * height)
				fgG = Math.round(monoRgb![1] * height)
				fgB = Math.round(monoRgb![2] * height)
			}

			// Apply fog (blend toward background)
			fgR = Math.round(fgR * fogFactor + bgRgb[0] * (1 - fogFactor))
			fgG = Math.round(fgG * fogFactor + bgRgb[1] * (1 - fogFactor))
			fgB = Math.round(fgB * fogFactor + bgRgb[2] * (1 - fogFactor))

			// Shading: use height gradient for pseudo-lighting
			// Compare with neighbor to get slope
			const neighborHeight = heights[x + 1]
			const slope = (neighborHeight - height) * 3
			const shadeFactor = Math.max(0.4, Math.min(1.2, 1.0 + slope))
			fgR = Math.min(255, Math.round(fgR * shadeFactor))
			fgG = Math.min(255, Math.round(fgG * shadeFactor))
			fgB = Math.min(255, Math.round(fgB * shadeFactor))

			const fg = rgbString(fgR, fgG, fgB)

			// Background: slightly darker version of fg for terrain fill
			const bgR2 = Math.floor(fgR * 0.3 + bgRgb[0] * 0.7)
			const bgG2 = Math.floor(fgG * 0.3 + bgRgb[1] * 0.7)
			const bgB2 = Math.floor(fgB * 0.3 + bgRgb[2] * 0.7)
			const cellBg = rgbString(bgR2, bgG2, bgB2)

			terrainBuffer[screenY][x] = {
				ch,
				fg,
				bg: cellBg,
				bold: height > 0.7 && fogFactor > 0.5,
			}
		}
	}

	// Add terrain rows to screen
	for (let y = 0; y < terrainRows; y++) {
		const line: AnsiScreen['lines'][number] = []
		for (let x = 0; x < columns; x++) {
			const cell = terrainBuffer[y][x]
			if (cell) {
				line.push(cell)
			} else {
				line.push({ ch: ' ', fg: bgColor, bg: bgColor, bold: false })
			}
		}
		screenLines.push(line)
	}

	return { lines: screenLines, columns }
}

/**
 * Create a reusable sampler for terrain flyover at a specific frame.
 */
export function createAsciiTerrainFlyoverSampler(
	frame: number,
	options: AsciiTerrainFlyoverOptions = {},
) {
	const { bgColor = DEFAULT_BG_COLOR } = options

	const cols = 200
	const rows = 60
	const screen = generateAsciiTerrainFlyoverFrame(frame, cols, rows, options)

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
