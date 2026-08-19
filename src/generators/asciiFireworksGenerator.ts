import type { AnsiCell, AnsiScreen } from '../ansi/types'

// Vertical cells are ~2x taller than wide; world units are square, so divide
// vertical world distances by CELL_ASPECT when converting to row offsets.
const CELL_ASPECT = 2

const DEFAULT_SEED = 1337
const DEFAULT_LAUNCH_INTERVAL = 45
const DEFAULT_RISE_FRAMES = 35
const DEFAULT_BURST_DURATION = 60
const DEFAULT_PARTICLE_COUNT = 60
const DEFAULT_GRAVITY = 0.006
const DEFAULT_BG_COLOR = '#000008'
const DEFAULT_NIGHT_SKY = true

// Firework hues — saturated pyrotechnic colors
const DEFAULT_HUES = [
	'#ff3344', // Red
	'#ff9922', // Orange
	'#ffee44', // Gold
	'#44ee66', // Green
	'#44aaff', // Blue
	'#cc66ff', // Violet
	'#ff66cc', // Pink
	'#ffffff', // White
]

// Brightness ramp for burst particles, dimmest first (index 0 = almost dead).
// All CP437-safe (verified via charToCp437Byte).
const PARTICLE_RAMP = ['.', '·', ':', '+', '*', '#', '@']

// Upper bound on how many rocket indices are examined per frame; the actual
// window is derived from the lifecycle length but stays bounded even for
// pathological option combinations (very short interval + very long burst).
const MAX_ROCKET_WINDOW = 24

const RAMP_LEVELS = 12

export interface AsciiFireworksOptions {
	/** Seed for deterministic launch schedule and particle hashes. Default: 1337 */
	seed?: number
	/** Frames between rocket launches (before per-rocket jitter). Default: 45 */
	launchInterval?: number
	/** Base frames a rocket spends ascending. Default: 35 */
	riseFrames?: number
	/** Frames a burst takes to expand and fade out. Default: 60 */
	burstDuration?: number
	/** Base particles per burst (each rocket varies it ±30%). Default: 60 */
	particleCount?: number
	/** Downward acceleration on burst particles, world units/frame². Default: 0.006 */
	gravity?: number
	/** Hues rockets pick from (CSS color strings). Default: pyrotechnic palette */
	hues?: string[]
	/** Background color (CSS color string). Default: '#000008' */
	bgColor?: string
	/** Sprinkle dim static stars into the sky. Default: true */
	nightSky?: boolean
}

function finiteOr(v: number | undefined, fallback: number): number {
	return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function resolveOptions(options: AsciiFireworksOptions) {
	const seed = finiteOr(options.seed, DEFAULT_SEED) >>> 0
	const launchInterval = Math.max(8, Math.round(finiteOr(options.launchInterval, DEFAULT_LAUNCH_INTERVAL)))
	const riseFrames = Math.max(4, Math.round(finiteOr(options.riseFrames, DEFAULT_RISE_FRAMES)))
	const burstDuration = Math.max(8, Math.round(finiteOr(options.burstDuration, DEFAULT_BURST_DURATION)))
	const particleCount = Math.max(4, Math.min(400, Math.round(finiteOr(options.particleCount, DEFAULT_PARTICLE_COUNT))))
	const gravity = Math.max(0, finiteOr(options.gravity, DEFAULT_GRAVITY))
	const hues = options.hues && options.hues.length > 0 ? options.hues : DEFAULT_HUES
	const bgColor = options.bgColor ?? DEFAULT_BG_COLOR
	const nightSky = options.nightSky ?? DEFAULT_NIGHT_SKY
	return { seed, launchInterval, riseFrames, burstDuration, particleCount, gravity, hues, bgColor, nightSky }
}

/** Fast deterministic 32-bit hash of a 2D coordinate + seed (same mix as ansiPostEffects). */
function hash2D(x: number, y: number, seed: number): number {
	let h = (x * 0x9e3779b1) ^ (y * 0x85ebca6b) ^ seed
	h ^= h >>> 16
	h = Math.imul(h, 0x7feb352d)
	h ^= h >>> 15
	h = Math.imul(h, 0x846ca68b)
	h ^= h >>> 16
	return h >>> 0
}

/** Uniform [0,1) fraction from a hash value. */
function hashFrac(h: number): number {
	return h / 0x100000000
}

// Parse CSS color to RGB (hex #rgb/#rrggbb or "r,g,b" digits)
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

// Memoized per-hue brightness tables: hues.length x RAMP_LEVELS precomputed
// rgb() strings, so no color string is ever built per cell (hard rule 4).
let lastHueKey: string | null = null
let lastHueTables: string[][] | null = null

function getHueTables(hues: string[]): string[][] {
	const key = hues.join('|')
	if (key === lastHueKey && lastHueTables) return lastHueTables
	const tables: string[][] = []
	for (const hue of hues) {
		const [r, g, b] = parseColor(hue)
		const ramp: string[] = []
		for (let level = 0; level < RAMP_LEVELS; level++) {
			const t = (level + 1) / RAMP_LEVELS
			// Blend the brightest steps toward white for a hot-core look
			const w = Math.max(0, t - 0.75) * 2
			const rr = Math.min(255, Math.round(r * t + (255 - r) * w))
			const gg = Math.min(255, Math.round(g * t + (255 - g) * w))
			const bb = Math.min(255, Math.round(b * t + (255 - b) * w))
			ramp.push(`rgb(${rr},${gg},${bb})`)
		}
		tables.push(ramp)
	}
	lastHueKey = key
	lastHueTables = tables
	return tables
}

// Memoized night-sky star positions — frame-invariant per (columns, rows, seed)
interface SkyStar {
	x: number
	y: number
	bright: boolean
}

let lastSkyKey: string | null = null
let lastSkyStars: SkyStar[] | null = null

function getSkyStars(columns: number, rows: number, seed: number): SkyStar[] {
	const key = `${columns}:${rows}:${seed}`
	if (key === lastSkyKey && lastSkyStars) return lastSkyStars
	const stars: SkyStar[] = []
	// Keep stars out of the bottom two rows (the "ground" region)
	const maxY = Math.max(1, rows - 2)
	for (let y = 0; y < maxY; y++) {
		for (let x = 0; x < columns; x++) {
			const h = hash2D(x, y, seed ^ 0x51a7ca5e)
			if (hashFrac(h) < 0.008) {
				stars.push({ x, y, bright: (h >>> 8) % 3 === 0 })
			}
		}
	}
	lastSkyKey = key
	lastSkyStars = stars
	return stars
}

const STAR_DIM = 'rgb(70,75,110)'
const STAR_BRIGHT = 'rgb(120,128,170)'
const ROCKET_HEAD = 'rgb(255,255,230)'

type Params = ReturnType<typeof resolveOptions>

function drawRocket(
	lines: AnsiCell[][],
	columns: number,
	rows: number,
	frame: number,
	k: number,
	params: Params,
	hueTables: string[][],
): void {
	const { seed, launchInterval, riseFrames, burstDuration, particleCount, gravity, bgColor } = params

	const h0 = hash2D(k, 0, seed)
	const h1 = hash2D(k, 1, seed)

	const jitter = h0 % Math.max(1, launchInterval >> 1)
	const launch = k * launchInterval + jitter
	const age = frame - launch
	if (age < 0) return

	// Per-rocket rise duration varies ±15%
	const rise = Math.max(3, Math.round(riseFrames * (0.85 + hashFrac(h1) * 0.3)))
	if (age >= rise + burstDuration) return

	// Apex placement: hashed x with margins, hashed height in the upper half
	const margin = Math.max(2, Math.floor(columns * 0.12))
	const apexX = margin + hashFrac(hash2D(k, 2, seed)) * Math.max(1, columns - 2 * margin)
	const apexY = rows * (0.12 + hashFrac(hash2D(k, 3, seed)) * 0.28)

	// Horizontal drift during ascent
	const drift = (hashFrac(hash2D(k, 4, seed)) - 0.5) * columns * 0.08
	const launchX = apexX - drift

	const hueTable = hueTables[h0 % hueTables.length]
	const multicolor = (h0 >>> 8) % 4 === 0

	if (age < rise) {
		// --- Phase 1: rise ---
		const p = age / rise
		const ease = 1 - (1 - p) * (1 - p) // decelerate toward apex
		const headY = (rows - 1) - ((rows - 1) - apexY) * ease
		const headX = launchX + drift * p

		const hx = Math.round(headX)
		const hy = Math.round(headY)
		if (hx >= 0 && hx < columns && hy >= 0 && hy < rows) {
			lines[hy][hx] = { ch: '■', fg: ROCKET_HEAD, bg: bgColor, bold: true }
		}
		// Short fading trail below the head
		const trailChars = [':', '·', '.']
		for (let t = 0; t < trailChars.length; t++) {
			const ty = hy + 1 + t
			if (ty < 0 || ty >= rows || hx < 0 || hx >= columns) continue
			const level = Math.max(0, RAMP_LEVELS - 4 - t * 3)
			if (lines[ty][hx].ch === ' ' || lines[ty][hx].ch === '·') {
				lines[ty][hx] = { ch: trailChars[t], fg: hueTable[level], bg: bgColor, bold: false }
			}
		}
		return
	}

	// --- Phase 2: burst ---
	const t = age - rise

	// Burst radius sized so an 80x25 explosion spans ~25 columns / ~13 rows
	const radius = Math.min(columns * 0.16, rows * CELL_ASPECT * 0.28)
	const drag = 0.08
	const v0Base = radius * drag
	const reach = (1 - Math.exp(-drag * t)) / drag
	const gravDrop = 0.5 * gravity * t * t

	const count = Math.max(1, Math.round(particleCount * (0.7 + hashFrac(hash2D(k, 5, seed)) * 0.6)))
	const rampMax = PARTICLE_RAMP.length - 1

	// Burst shape: ring shells expand as a crisp circle (tight speed spread,
	// evenly spaced angles); chrysanthemums scatter speeds along even spokes.
	const isRing = (h1 >>> 4) % 3 === 0
	const angleStep = (Math.PI * 2) / count
	const angleJitter = isRing ? 0.25 : 0.9

	for (let i = 0; i < count; i++) {
		const hp = hash2D(k * 131 + 7, i, seed)
		const theta = (i + 0.5) * angleStep + (hashFrac(hp) - 0.5) * angleStep * angleJitter
		const speedMul = isRing
			? 0.88 + hashFrac(hash2D(k * 131 + 8, i, seed)) * 0.18
			: 0.4 + hashFrac(hash2D(k * 131 + 8, i, seed)) * 0.8
		const lifeMul = 0.55 + hashFrac(hash2D(k * 131 + 9, i, seed)) * 0.45
		const life = burstDuration * lifeMul
		if (t >= life) continue

		const v0 = v0Base * speedMul
		const dx = Math.cos(theta) * v0 * reach
		const dyWorld = Math.sin(theta) * v0 * reach + gravDrop

		const px = Math.round(apexX + dx)
		const py = Math.round(apexY + dyWorld / CELL_ASPECT)
		if (px < 0 || px >= columns || py < 0 || py >= rows) continue

		const fade = 1 - t / life
		const brightness = fade * fade * (0.6 + 0.4 * fade) + fade * 0.15
		const clamped = brightness > 1 ? 1 : brightness < 0 ? 0 : brightness
		const charIndex = Math.min(rampMax, Math.floor(clamped * (rampMax + 0.999)))
		const level = Math.min(RAMP_LEVELS - 1, Math.floor(clamped * RAMP_LEVELS))

		const table = multicolor ? hueTables[(h0 + i) % hueTables.length] : hueTable
		lines[py][px] = {
			ch: PARTICLE_RAMP[charIndex],
			fg: table[level],
			bg: bgColor,
			bold: clamped > 0.7,
		}
	}

	// Flash at the very start of the burst
	if (t < 3) {
		const cx = Math.round(apexX)
		const cy = Math.round(apexY)
		if (cx >= 0 && cx < columns && cy >= 0 && cy < rows) {
			lines[cy][cx] = { ch: '@', fg: ROCKET_HEAD, bg: bgColor, bold: true }
		}
	}
}

/**
 * Generate an ASCII fireworks frame — rockets rise on a deterministic
 * schedule, burst into ballistic particle shells, and fade.
 *
 * Fully stateless: every rocket and particle position is computed in closed
 * form from the frame number and coordinate hashes, so seeking is free.
 */
export function generateAsciiFireworksFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiFireworksOptions = {},
): AnsiScreen {
	const params = resolveOptions(options)
	const { seed, launchInterval, bgColor, nightSky } = params
	const safeFrame = Number.isFinite(frame) ? Math.floor(frame) : 0
	const hueTables = getHueTables(params.hues)

	// Background
	const lines: AnsiScreen['lines'] = []
	for (let y = 0; y < rows; y++) {
		const line: AnsiScreen['lines'][number] = []
		for (let x = 0; x < columns; x++) {
			line.push({ ch: ' ', fg: bgColor, bg: bgColor, bold: false })
		}
		lines.push(line)
	}

	if (nightSky) {
		const stars = getSkyStars(columns, rows, seed)
		for (const star of stars) {
			lines[star.y][star.x] = {
				ch: '·',
				fg: star.bright ? STAR_BRIGHT : STAR_DIM,
				bg: bgColor,
				bold: false,
			}
		}
	}

	// Only the trailing window of rocket indices can overlap this frame:
	// lifecycle = jitter (< interval/2) + rise (≤ 1.15x base) + burst.
	const lifecycle = launchInterval / 2 + params.riseFrames * 1.15 + params.burstDuration
	const window = Math.min(MAX_ROCKET_WINDOW, Math.ceil(lifecycle / launchInterval) + 1)
	const kMax = Math.floor(safeFrame / launchInterval)
	const kMin = Math.max(0, kMax - (window - 1))
	for (let k = kMin; k <= kMax; k++) {
		drawRocket(lines, columns, rows, safeFrame, k, params, hueTables)
	}

	return { lines, columns }
}

/**
 * Create a reusable sampler for fireworks at a specific frame.
 * Returns a function mapping (x, y) to an AnsiCell.
 */
export function createAsciiFireworksSampler(
	frame: number,
	options: AsciiFireworksOptions = {},
) {
	const { bgColor = DEFAULT_BG_COLOR } = options

	// Use a reasonable backing grid
	const cols = 80
	const rows = 50
	const screen = generateAsciiFireworksFrame(frame, cols, rows, options)

	return (x: number, y: number): AnsiCell => {
		const wrappedX = ((x % cols) + cols) % cols
		const wrappedY = ((y % rows) + rows) % rows

		const cell = screen.lines[wrappedY]?.[wrappedX]
		if (!cell) {
			return { ch: ' ', fg: bgColor, bg: bgColor, bold: false }
		}
		return cell
	}
}
