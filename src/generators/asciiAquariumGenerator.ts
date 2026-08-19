import type { AnsiCell, AnsiScreen } from '../ansi/types'

const DEFAULT_SEED = 24601
const DEFAULT_FISH_COUNT = 7
const DEFAULT_BUBBLE_DENSITY = 0.12
const DEFAULT_SEAWEED_DENSITY = 0.16
const DEFAULT_SWAY_SPEED = 0.07
const DEFAULT_SPEED = 1
const DEFAULT_BG_COLOR = '#0d3a66'

// Fish body colors — bright against the deep blue water
const DEFAULT_PALETTE = [
	'#ffb347', // Goldfish orange
	'#ff6b6b', // Coral red
	'#ffe66d', // Yellow tang
	'#7bed9f', // Pale green
	'#70a1ff', // Powder blue
	'#f8a5c2', // Pink
	'#e0e0e0', // Silver
	'#c56cf0', // Purple
]

// Fish sprites: [rightFacing, leftFacing], mirror-correct, all CP437-safe.
const FISH_SPECIES: ReadonlyArray<readonly [string, string]> = [
	['><>', '<><'],
	['><(((·>', '<·)))><'],
	['><=·>', '<·=><'],
]

const SEAWEED_GREENS = ['rgb(38,140,80)', 'rgb(60,178,106)']
const BUBBLE_COLOR = 'rgb(170,222,255)'
const SHIMMER_COLOR = 'rgb(128,204,255)'
const SAND_COLOR = 'rgb(196,168,110)'
const SAND_DARK = 'rgb(150,128,84)'
const ROCK_COLOR = 'rgb(120,124,132)'

// Bubble glyphs by rise progress: small near the floor, big near the surface
const BUBBLE_GLYPHS = ['·', 'o', 'O']
const BUBBLE_RISE_SPEED = 0.3

export interface AsciiAquariumOptions {
	/** Seed for deterministic fish, seaweed, rock, and bubble placement. Default: 24601 */
	seed?: number
	/** Number of fish. Default: 7 */
	fishCount?: number
	/** Fraction of columns that emit bubbles (0-1). Default: 0.12 */
	bubbleDensity?: number
	/** Fraction of columns growing seaweed (0-1). Default: 0.16 */
	seaweedDensity?: number
	/** Fish body colors (CSS color strings). Default: tropical palette */
	palette?: string[]
	/** Base water color at the surface; darkens toward the floor. Default: '#0d3a66' */
	bgColor?: string
	/** Seaweed sway rate (radians/frame). Default: 0.07 */
	swaySpeed?: number
	/** Global animation speed multiplier. Default: 1 */
	speed?: number
}

function finiteOr(v: number | undefined, fallback: number): number {
	return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function clamp01(v: number): number {
	return v < 0 ? 0 : v > 1 ? 1 : v
}

function resolveOptions(options: AsciiAquariumOptions) {
	const seed = finiteOr(options.seed, DEFAULT_SEED) >>> 0
	const fishCount = Math.max(0, Math.min(64, Math.round(finiteOr(options.fishCount, DEFAULT_FISH_COUNT))))
	const bubbleDensity = clamp01(finiteOr(options.bubbleDensity, DEFAULT_BUBBLE_DENSITY))
	const seaweedDensity = clamp01(finiteOr(options.seaweedDensity, DEFAULT_SEAWEED_DENSITY))
	const palette = options.palette && options.palette.length > 0 ? options.palette : DEFAULT_PALETTE
	const bgColor = options.bgColor ?? DEFAULT_BG_COLOR
	const swaySpeed = finiteOr(options.swaySpeed, DEFAULT_SWAY_SPEED)
	const speed = Math.max(0, finiteOr(options.speed, DEFAULT_SPEED))
	return { seed, fishCount, bubbleDensity, seaweedDensity, palette, bgColor, swaySpeed, speed }
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

// Memoized per-row water gradient — depends only on (rows, bgColor)
let lastWaterKey: string | null = null
let lastWaterRows: string[] | null = null

function getWaterRows(rows: number, bgColor: string): string[] {
	const key = `${rows}:${bgColor}`
	if (key === lastWaterKey && lastWaterRows) return lastWaterRows
	const [r, g, b] = parseColor(bgColor)
	const table: string[] = []
	for (let y = 0; y < rows; y++) {
		// Darken toward the floor: 100% brightness at the surface, ~30% at the bottom
		const t = rows > 1 ? y / (rows - 1) : 0
		const scale = 1 - t * 0.7
		table.push(`rgb(${Math.round(r * scale)},${Math.round(g * scale)},${Math.round(b * scale)})`)
	}
	lastWaterKey = key
	lastWaterRows = table
	return table
}

type Params = ReturnType<typeof resolveOptions>

interface Fish {
	sprite: string
	y: number
	xLeft: number
	color: string
}

function computeFish(
	effFrame: number,
	columns: number,
	floorRow: number,
	params: Params,
): Fish[] {
	const { seed, fishCount, palette } = params
	const laneTop = 2
	const laneBottom = floorRow - 2
	if (laneBottom < laneTop) return []
	const laneSpan = laneBottom - laneTop + 1

	const fish: Fish[] = []
	for (let i = 0; i < fishCount; i++) {
		const h = hash2D(i, 21, seed)
		const species = FISH_SPECIES[h % FISH_SPECIES.length]
		const dir = ((h >>> 3) & 1) === 0 ? 1 : -1
		const sprite = dir > 0 ? species[0] : species[1]
		const spriteW = sprite.length

		const lane = laneTop + ((h >>> 5) % laneSpan)
		const speed = 0.12 + hashFrac(hash2D(i, 22, seed)) * 0.22
		const phase = (h >>> 9) % 4096
		const bobPhase = hashFrac(hash2D(i, 23, seed)) * Math.PI * 2

		// Wrap across (columns + spriteW): the fish swims fully off one edge
		// before re-entering the other, so the seam never teleports the sprite.
		const totalW = columns + spriteW
		const travel = (((phase + effFrame * speed) % totalW) + totalW) % totalW
		const xLeft = dir > 0 ? Math.round(travel) - spriteW : columns - Math.round(travel)

		// Slow vertical bob of ±1 row, kept inside the lane band
		const bob = Math.round(Math.sin(effFrame * 0.045 + bobPhase))
		const y = Math.max(laneTop, Math.min(laneBottom, lane + bob))

		fish.push({ sprite, y, xLeft, color: palette[(h >>> 13) % palette.length] })
	}

	// Lower fish are "nearer" — draw them last so they pass in front
	fish.sort((a, b) => a.y - b.y)
	return fish
}

/**
 * Generate an ASCII aquarium frame — an asciiquarium homage with swimming
 * fish, swaying seaweed, rising bubbles, and a sandy floor over a water
 * gradient.
 *
 * Fully stateless: fish, bubbles, and sway are computed in closed form from
 * the frame number and coordinate hashes, so seeking is free.
 */
export function generateAsciiAquariumFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiAquariumOptions = {},
): AnsiScreen {
	const params = resolveOptions(options)
	const { seed, bubbleDensity, seaweedDensity, bgColor, swaySpeed, speed } = params
	const safeFrame = Number.isFinite(frame) ? frame : 0
	const effFrame = safeFrame * speed

	const waterRows = getWaterRows(rows, bgColor)
	const floorRow = rows - 1

	// --- Water background ---
	const lines: AnsiScreen['lines'] = []
	for (let y = 0; y < rows; y++) {
		const line: AnsiScreen['lines'][number] = []
		const rowBg = waterRows[y]
		for (let x = 0; x < columns; x++) {
			line.push({ ch: ' ', fg: rowBg, bg: rowBg, bold: false })
		}
		lines.push(line)
	}

	// --- Surface shimmer on the top row ---
	if (rows > 2) {
		const surfaceBg = waterRows[0]
		for (let x = 0; x < columns; x++) {
			if (Math.sin(x * 0.55 + effFrame * 0.09) > 0.1) {
				lines[0][x] = { ch: '~', fg: SHIMMER_COLOR, bg: surfaceBg, bold: false }
			}
		}
	}

	// --- Sea floor: sand with occasional rocks ---
	if (rows > 1) {
		const floorBg = waterRows[floorRow]
		for (let x = 0; x < columns; x++) {
			const h = hash2D(x, 97, seed)
			const light = (h & 3) !== 0
			lines[floorRow][x] = {
				ch: light ? '▒' : '░',
				fg: light ? SAND_COLOR : SAND_DARK,
				bg: floorBg,
				bold: false,
			}
		}
		if (rows > 3) {
			const rockRow = floorRow - 1
			for (let x = 0; x < columns; x++) {
				const h = hash2D(x, 53, seed)
				if (hashFrac(h) < 0.05) {
					lines[rockRow][x] = {
						ch: (h & 4) !== 0 ? '○' : '▄',
						fg: ROCK_COLOR,
						bg: waterRows[rockRow],
						bold: false,
					}
				}
			}
		}
	}

	// --- Seaweed: swaying ( / ) stalks rising from the floor ---
	if (rows > 4) {
		for (let x = 1; x < columns - 1; x++) {
			const h = hash2D(x, 3, seed)
			if (hashFrac(h) >= seaweedDensity) continue
			const height = Math.min(3 + ((h >>> 8) % 5), floorRow - 2) // 3..7 rows
			const sway = Math.sin(effFrame * swaySpeed + x * 0.7) > 0 ? 0 : 1
			for (let dy = 0; dy < height; dy++) {
				const y = floorRow - 1 - dy
				if (y < 1) break
				lines[y][x] = {
					ch: (dy + sway) % 2 === 0 ? '(' : ')',
					fg: SEAWEED_GREENS[(dy + ((h >>> 16) & 1)) % 2],
					bg: waterRows[y],
					bold: false,
				}
			}
		}
	}

	// --- Bubbles: closed-form rise from hashed column spawners ---
	if (rows > 4) {
		const spawnY = floorRow - 1
		const surfaceLimit = 1
		const riseRows = spawnY - surfaceLimit
		for (let x = 1; x < columns - 1; x++) {
			const h = hash2D(x, 11, seed)
			if (hashFrac(h) >= bubbleDensity) continue
			// Period long enough that the bubble vanishes at the surface before
			// the next one spawns
			const period = Math.ceil(riseRows / BUBBLE_RISE_SPEED) + 30 + ((h >>> 8) % 90)
			const offset = (h >>> 16) % period
			const age = (((effFrame + offset) % period) + period) % period
			const yFloat = spawnY - age * BUBBLE_RISE_SPEED
			if (yFloat <= surfaceLimit) continue // popped at the surface
			const y = Math.round(yFloat)
			if (y < 1 || y > spawnY) continue
			const wobble = Math.round(Math.sin(age * 0.25 + x))
			const bx = x + wobble
			if (bx < 0 || bx >= columns) continue
			const progress = riseRows > 0 ? (spawnY - yFloat) / riseRows : 1
			const glyph = BUBBLE_GLYPHS[Math.min(2, Math.floor(progress * 3))]
			lines[y][bx] = { ch: glyph, fg: BUBBLE_COLOR, bg: waterRows[y], bold: false }
		}
	}

	// --- Fish, nearest (lowest) drawn last ---
	const fish = computeFish(effFrame, columns, floorRow, params)
	for (const f of fish) {
		const rowBg = waterRows[f.y]
		for (let j = 0; j < f.sprite.length; j++) {
			const x = f.xLeft + j
			if (x < 0 || x >= columns) continue
			lines[f.y][x] = { ch: f.sprite[j], fg: f.color, bg: rowBg, bold: false }
		}
	}

	return { lines, columns }
}

/**
 * Create a reusable sampler for the aquarium at a specific frame.
 * Returns a function mapping (x, y) to an AnsiCell.
 */
export function createAsciiAquariumSampler(
	frame: number,
	options: AsciiAquariumOptions = {},
) {
	const { bgColor = DEFAULT_BG_COLOR } = options

	// Use a reasonable backing grid
	const cols = 80
	const rows = 50
	const screen = generateAsciiAquariumFrame(frame, cols, rows, options)

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
