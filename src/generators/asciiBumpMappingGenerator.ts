import type { AnsiScreen } from '../ansi/types'
import { buildCharLookup } from './charLookup'

const DEFAULT_SEED = 9001
const DEFAULT_NOISE_SCALE = 0.15
const DEFAULT_OCTAVES = 4
const DEFAULT_LIGHT_RADIUS = 0.6
const DEFAULT_ORBIT_SPEED = 0.05
const DEFAULT_LIGHT_HEIGHT = 6
const DEFAULT_BUMP_STRENGTH = 6
const DEFAULT_SPECULAR_POWER = 12
const DEFAULT_ASPECT_Y = 2
const DEFAULT_BG_COLOR = '#050302'
const DEFAULT_CHARS = ' ·░▒▓█' // ' ·░▒▓█'
// Warm bronze -> steel-highlight gradient, low to high intensity
const DEFAULT_PALETTE = ['#1a0f08', '#8a5a2a', '#f0d8a8']
const PALETTE_STEPS = 128

export interface AsciiBumpMappingOptions {
	/** Seed for the static heightfield. Default: 9001 */
	seed?: number
	/** Noise frequency for the heightfield. Default: 0.15 */
	noiseScale?: number
	/** Octaves of fbm noise (3-4 recommended). Default: 4 */
	octaves?: number
	/** Orbit radius of the light, as a fraction of the shorter screen dimension. Default: 0.6 */
	lightRadius?: number
	/** Angular speed of the orbiting light (radians/frame). Default: 0.05 */
	orbitSpeed?: number
	/** Height (z) of the light above the surface plane. Default: 6 */
	lightHeight?: number
	/** Steepness multiplier applied to heightfield derivatives for the surface normal. Default: 6 */
	bumpStrength?: number
	/** Specular exponent — higher = tighter, brighter highlight. Default: 12 */
	specularPower?: number
	/** Character ramp from dark to bright. Default: ' ·░▒▓█' */
	chars?: string
	/** Color palette (2-3 CSS hex color stops), low to high intensity. Default: warm bronze/steel gradient */
	palette?: string[]
	/** Background color, used as the bg for every cell. Default: '#050302' */
	bgColor?: string
	/** Y aspect correction for non-square cells. Default: 2 */
	aspectY?: number
}

// ---- Memoized char lookup ----
let lastChars: string | null = null
let lastCharLookup: string[] | null = null

function getCharLookup(chars: string): string[] {
	if (lastChars === chars && lastCharLookup) return lastCharLookup
	lastCharLookup = buildCharLookup(Array.from(chars))
	lastChars = chars
	return lastCharLookup
}

/** Parse hex color to [r, g, b] 0-255 */
function parseHex(hex: string): [number, number, number] {
	const h = hex.startsWith('#') ? hex.slice(1) : hex
	return [
		parseInt(h.slice(0, 2), 16) || 0,
		parseInt(h.slice(2, 4), 16) || 0,
		parseInt(h.slice(4, 6), 16) || 0,
	]
}

// ---- Memoized intensity -> rgb() palette table ----
// The palette itself never varies per frame (only the light position does),
// so this table is built once per distinct set of color stops rather than
// once per cell or once per frame.
let lastPaletteKey: string | null = null
let lastPaletteTable: string[] | null = null

function getPaletteTable(palette: string[]): string[] {
	const key = palette.join('|')
	if (key === lastPaletteKey && lastPaletteTable) return lastPaletteTable

	let stops = palette
	if (stops.length === 0) stops = DEFAULT_PALETTE
	else if (stops.length === 1) stops = [stops[0], stops[0]]

	const stopRGB = stops.map(parseHex)
	const segments = stopRGB.length - 1

	const table = new Array<string>(PALETTE_STEPS)
	for (let i = 0; i < PALETTE_STEPS; i++) {
		const t = i / (PALETTE_STEPS - 1)
		const scaled = t * segments
		const segIndex = Math.min(segments - 1, Math.floor(scaled))
		const localT = scaled - segIndex
		const a = stopRGB[segIndex]
		const b = stopRGB[segIndex + 1]
		const r = Math.round(a[0] + (b[0] - a[0]) * localT)
		const g = Math.round(a[1] + (b[1] - a[1]) * localT)
		const bch = Math.round(a[2] + (b[2] - a[2]) * localT)
		table[i] = `rgb(${r},${g},${bch})`
	}

	lastPaletteKey = key
	lastPaletteTable = table
	return table
}

// ---- Local hash / fbm noise (each generator carries its own copy) ----
function hash2D(x: number, y: number, seed: number): number {
	let h = (x * 0x9e3779b1) ^ (y * 0x85ebca6b) ^ seed
	h ^= h >>> 16
	h = Math.imul(h, 0x7feb352d)
	h ^= h >>> 15
	h = Math.imul(h, 0x846ca68b)
	h ^= h >>> 16
	return (h >>> 0) / 0xffffffff
}

function smoothNoise(x: number, y: number, seed: number): number {
	const ix = Math.floor(x)
	const iy = Math.floor(y)
	const fx = x - ix
	const fy = y - iy

	// Quintic smoothstep for continuity
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

function fbm(x: number, y: number, seed: number, octaves: number): number {
	let value = 0
	let amplitude = 1
	let frequency = 1
	let maxValue = 0

	for (let i = 0; i < octaves; i++) {
		value += smoothNoise(x * frequency, y * frequency, seed + i * 127) * amplitude
		maxValue += amplitude
		amplitude *= 0.5
		frequency *= 2
	}

	return maxValue > 0 ? value / maxValue : 0
}

// ---- Single-slot heightfield + normal-plane cache ----
// The heightfield is STATIC — it depends only on grid size + noise options,
// never on `frame`. It (and the frame-invariant parts of the surface
// normal) are computed once and reused across every frame render; only the
// light position varies per frame.
interface HeightCache {
	columns: number
	rows: number
	seed: number
	noiseScale: number
	octaves: number
	bumpStrength: number
	aspectY: number
	heights: Float64Array
	normX: Float64Array
	normY: Float64Array
	invLen: Float64Array
}

let heightCache: HeightCache | null = null

function getHeightCache(
	columns: number,
	rows: number,
	seed: number,
	noiseScale: number,
	octaves: number,
	bumpStrength: number,
	aspectY: number,
): HeightCache {
	const c = heightCache
	if (
		c &&
		c.columns === columns &&
		c.rows === rows &&
		c.seed === seed &&
		c.noiseScale === noiseScale &&
		c.octaves === octaves &&
		c.bumpStrength === bumpStrength &&
		c.aspectY === aspectY
	) {
		return c
	}

	const size = columns * rows
	// NOTE: Float64Array (not Float32) — these values feed char/color
	// threshold lookups downstream and must retain full precision.
	const heights = new Float64Array(size)

	// Aspect-correct sampling: rows read ~aspectY x taller than columns are
	// wide, so a unit step in the row index covers aspectY x more world
	// distance than a unit step in the column index. Scale the y noise
	// coordinate up (not down) to match, same convention as every other
	// generator's row->world-unit conversion (e.g. Mandelbrot's
	// `scaleY = base * aspectY`) — this keeps noise features isotropic on
	// screen instead of stretching them taller.
	for (let y = 0; y < rows; y++) {
		for (let x = 0; x < columns; x++) {
			heights[y * columns + x] = fbm(x * noiseScale, y * noiseScale * aspectY, seed, octaves)
		}
	}

	const normX = new Float64Array(size)
	const normY = new Float64Array(size)
	const invLen = new Float64Array(size)

	for (let y = 0; y < rows; y++) {
		const yUp = Math.max(0, y - 1)
		const yDown = Math.min(rows - 1, y + 1)
		for (let x = 0; x < columns; x++) {
			const xLeft = Math.max(0, x - 1)
			const xRight = Math.min(columns - 1, x + 1)

			const dhx = (heights[y * columns + xRight] - heights[y * columns + xLeft]) * bumpStrength
			const dhy =
				((heights[yDown * columns + x] - heights[yUp * columns + x]) * bumpStrength) / aspectY

			const nx = -dhx
			const ny = -dhy
			const i = y * columns + x
			normX[i] = nx
			normY[i] = ny
			// Frame-invariant half of the normal's normalization — the only
			// per-cell sqrt this generator needs is done here, once.
			invLen[i] = 1 / Math.sqrt(nx * nx + ny * ny + 1)
		}
	}

	heightCache = {
		columns,
		rows,
		seed,
		noiseScale,
		octaves,
		bumpStrength,
		aspectY,
		heights,
		normX,
		normY,
		invLen,
	}
	return heightCache
}

function clamp01(v: number): number {
	return v < 0 ? 0 : v > 1 ? 1 : v
}

/**
 * Generate a bump-mapped frame — an embossed, liquid-metal / carved-stone
 * look in text mode, lit by a single point light that orbits above a
 * static fbm heightfield. The heightfield (and the frame-invariant half of
 * its surface normal) is cached once per (columns, rows, seed, noiseScale,
 * octaves, bumpStrength, aspectY); only the light's position is recomputed
 * per frame.
 */
export function generateAsciiBumpMappingFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiBumpMappingOptions = {},
): AnsiScreen {
	const {
		seed = DEFAULT_SEED,
		noiseScale = DEFAULT_NOISE_SCALE,
		octaves = DEFAULT_OCTAVES,
		lightRadius = DEFAULT_LIGHT_RADIUS,
		orbitSpeed = DEFAULT_ORBIT_SPEED,
		lightHeight = DEFAULT_LIGHT_HEIGHT,
		bumpStrength = DEFAULT_BUMP_STRENGTH,
		specularPower = DEFAULT_SPECULAR_POWER,
		chars = DEFAULT_CHARS,
		palette = DEFAULT_PALETTE,
		bgColor = DEFAULT_BG_COLOR,
		aspectY = DEFAULT_ASPECT_Y,
	} = options

	const charLookup = getCharLookup(chars)
	const paletteTable = getPaletteTable(palette)

	const { heights, normX, normY, invLen } = getHeightCache(
		columns,
		rows,
		seed,
		noiseScale,
		octaves,
		bumpStrength,
		aspectY,
	)

	const cx = columns / 2
	const cy = rows / 2
	const radius = lightRadius * Math.min(columns, rows * aspectY) * 0.5
	const radius2 = radius * radius

	// Orbiting point light. The y component of the orbit is compressed by
	// aspectY so it traces a visually circular path on screen despite rows
	// being aspectY x taller than columns.
	const theta = frame * orbitSpeed
	const lx = cx + radius * Math.cos(theta)
	const ly = cy + (radius / aspectY) * Math.sin(theta)
	const lz = lightHeight

	const lines: AnsiScreen['lines'] = []

	for (let y = 0; y < rows; y++) {
		const line: AnsiScreen['lines'][number] = []
		for (let x = 0; x < columns; x++) {
			const i = y * columns + x

			// Vector from cell to light, in aspect-corrected world units.
			const dx = lx - x
			const dy = (ly - y) * aspectY
			const dz = lz - heights[i]

			// Epsilon guard: a contrived config (e.g. lightRadius 0 and
			// lightHeight equal to this cell's height) can drive len2 to 0,
			// which would otherwise divide-by-zero into NaN/Infinity.
			const len2 = Math.max(dx * dx + dy * dy + dz * dz, 1e-9)
			const invLenL = 1 / Math.sqrt(len2)

			// diffuse = max(0, normal · normalize(lightVec))
			const dot = (normX[i] * dx + normY[i] * dy + dz) * invLen[i] * invLenL
			const diffuse = dot > 0 ? dot : 0

			// Distance falloff so the light reads as a moving spot rather
			// than flat ambient lighting.
			const falloff = radius2 / (radius2 + len2)

			// Specular boost: diffuse^k stays near 1 only very close to the
			// mirror direction, producing a tight highlight.
			const specular = Math.pow(diffuse, specularPower)

			const intensity = clamp01(diffuse * falloff + specular * falloff * 0.6)

			const brightness = Math.floor(intensity * 255)
			const ch = charLookup[brightness]
			const paletteIndex = Math.min(PALETTE_STEPS - 1, Math.floor(intensity * (PALETTE_STEPS - 1)))
			const fg = paletteTable[paletteIndex]

			line.push({ ch, fg, bg: bgColor, bold: intensity > 0.85 })
		}
		lines.push(line)
	}

	return { lines, columns }
}
