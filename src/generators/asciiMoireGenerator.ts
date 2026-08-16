import type { AnsiScreen } from '../ansi/types'

export interface AsciiMoireOptions {
	/**
	 * Width of one ring, in aspect-corrected character cells. The interference
	 * bands the eye actually sees are level sets of (dist1 + dist2), so they land
	 * roughly every ringWidth/2 columns — anything under ~4 puts a band inside a
	 * single cell and the whole field collapses into salt-and-pepper noise instead
	 * of readable curves. Default: 6
	 */
	ringWidth?: number
	/** Orbit speed of ring-field 1 (radians per frame). Default: 0.015 */
	speed1?: number
	/** Orbit speed of ring-field 2 (radians per frame). Default: 0.023 */
	speed2?: number
	/** Orbit radius of center 1, as a fraction of min(columns, rows)/2. Default: 1.0 */
	orbitRadius1?: number
	/**
	 * Orbit radius of center 2, as a fraction of min(columns, rows)/2. Kept
	 * deliberately unequal to orbitRadius1: with equal radii and unequal speeds
	 * the two centers eventually drift into coincidence, at which point
	 * ring1 === ring2 everywhere and the XOR blanks the entire screen for a
	 * stretch of frames. Unequal radii bound the separation away from zero.
	 * Default: 0.4
	 */
	orbitRadius2?: number
	/** Phase offset (radians) between the two orbiting centers. Default: Math.PI */
	phaseOffset?: number
	/** Palette cycling speed applied to the interference color, in cycles/frame. Default: 0.01 */
	paletteSpeed?: number
	/** Colors cycled by (ring1 + ring2 + frame-driven offset). Default: rainbow-ish 6-color set */
	palette?: string[]
	/** Characters for "on" cells, chosen by interference sum. Default: ' .:+*#@' */
	chars?: string[]
	/** Background color for "off" cells. Default: '#000000' */
	bgColor?: string
	/** Vertical aspect correction — cells are roughly twice as tall as wide. Default: 2 */
	aspectY?: number
}

const DEFAULT_RING_WIDTH = 6
const DEFAULT_SPEED1 = 0.015
const DEFAULT_SPEED2 = 0.023
const DEFAULT_ORBIT_RADIUS1 = 1.0
const DEFAULT_ORBIT_RADIUS2 = 0.4
const DEFAULT_PHASE_OFFSET = Math.PI
const DEFAULT_PALETTE_SPEED = 0.01
const DEFAULT_PALETTE = ['#ff2244', '#ff8800', '#ffdd00', '#00cc66', '#2288ff', '#aa44ff']
const DEFAULT_CHARS = [' ', '.', ':', '+', '*', '#', '@']
const DEFAULT_BG_COLOR = '#000000'
const DEFAULT_ASPECT_Y = 2

function resolveAndValidate(options: AsciiMoireOptions) {
	const ringWidth = options.ringWidth ?? DEFAULT_RING_WIDTH
	const speed1 = options.speed1 ?? DEFAULT_SPEED1
	const speed2 = options.speed2 ?? DEFAULT_SPEED2
	const orbitRadius1 = options.orbitRadius1 ?? DEFAULT_ORBIT_RADIUS1
	const orbitRadius2 = options.orbitRadius2 ?? DEFAULT_ORBIT_RADIUS2
	const phaseOffset = options.phaseOffset ?? DEFAULT_PHASE_OFFSET
	const paletteSpeed = options.paletteSpeed ?? DEFAULT_PALETTE_SPEED
	const palette = options.palette && options.palette.length > 0 ? options.palette : DEFAULT_PALETTE
	const chars = options.chars && options.chars.length > 0 ? options.chars : DEFAULT_CHARS
	const bgColor = options.bgColor ?? DEFAULT_BG_COLOR
	const aspectY = options.aspectY ?? DEFAULT_ASPECT_Y

	return {
		safeRingWidth: ringWidth > 0 ? ringWidth : DEFAULT_RING_WIDTH,
		speed1,
		speed2,
		orbitRadius1,
		orbitRadius2,
		phaseOffset,
		paletteSpeed,
		palette,
		chars,
		bgColor,
		safeAspectY: aspectY > 0 ? aspectY : DEFAULT_ASPECT_Y,
	}
}

type Params = ReturnType<typeof resolveAndValidate>

// Bounded single-slot cache for the palette color table — depends only on the
// palette array's contents, never on frame or bgColor (the table below is a
// plain copy of the palette; bgColor is applied per-cell, not baked into it).
// Frame-driven cycling is applied by rotating the *index* into this table at
// lookup time, not by rebuilding it.
interface PaletteCacheKey {
	paletteKey: string
}

// Join with a delimiter that can never appear inside a CSS color string --
// a space won't do, since 'rgb(0, 0, 0)'-style values legitimately contain
// spaces. A NUL character never appears in a color string, so e.g.
// ['#fff','#000'] and ['#fff#','000'] can no longer hash to the same key
// -- a plain join('') would collide on cases like that.
const KEY_DELIMITER = '\u0000'

let lastPaletteKey: PaletteCacheKey | null = null
let lastPaletteTable: string[] | null = null

function getPaletteTable(params: Params): string[] {
	const key: PaletteCacheKey = { paletteKey: params.palette.join(KEY_DELIMITER) }
	if (lastPaletteKey && lastPaletteTable && lastPaletteKey.paletteKey === key.paletteKey) {
		return lastPaletteTable
	}
	lastPaletteTable = params.palette.slice()
	lastPaletteKey = key
	return lastPaletteTable
}

/**
 * Generate an ASCII moire-interference frame. Two ring fields orbit slowly
 * around the grid center at different periods/phases; ring parity from each
 * field is XORed to produce the classic on/off interference bands, and "on"
 * cells are colored by the summed ring index through a cycling palette.
 *
 * Distance fields are recomputed every frame (not cached) because the ring
 * centers move — at typical terminal grid sizes two sqrt()s per cell is cheap.
 */
export function generateAsciiMoireFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiMoireOptions = {},
): AnsiScreen {
	const params = resolveAndValidate(options)
	const paletteTable = getPaletteTable(params)
	const paletteLen = paletteTable.length

	const midX = (columns - 1) / 2
	const midY = (rows - 1) / 2
	const orbitScale = Math.min(columns, rows) / 2

	const angle1 = frame * params.speed1
	const angle2 = frame * params.speed2 + params.phaseOffset

	const r1 = params.orbitRadius1 * orbitScale
	const r2 = params.orbitRadius2 * orbitScale

	const center1X = midX + Math.cos(angle1) * r1
	const center1Y = midY + Math.sin(angle1) * r1 * (1 / params.safeAspectY)
	const center2X = midX + Math.cos(angle2) * r2
	const center2Y = midY + Math.sin(angle2) * r2 * (1 / params.safeAspectY)

	const invRingWidth = 1 / params.safeRingWidth
	const aspectY = params.safeAspectY
	const bgColor = params.bgColor
	const charLen = params.chars.length

	// Palette cycles slowly over time by rotating the lookup offset — no table rebuild.
	const paletteOffset = Math.floor(frame * params.paletteSpeed * paletteLen) % paletteLen

	const lines: AnsiScreen['lines'] = []

	for (let y = 0; y < rows; y++) {
		const line: AnsiScreen['lines'][number] = []

		const dy1 = (y - center1Y) * aspectY
		const dy2 = (y - center2Y) * aspectY

		for (let x = 0; x < columns; x++) {
			const dx1 = x - center1X
			const dx2 = x - center2X

			const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1)
			const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2)

			const ring1 = Math.floor(dist1 * invRingWidth)
			const ring2 = Math.floor(dist2 * invRingWidth)

			const on = ((ring1 & 1) ^ (ring2 & 1)) === 1

			if (!on) {
				line.push({ ch: ' ', fg: bgColor, bg: bgColor, bold: false })
				continue
			}

			const sum = ring1 + ring2
			let colorIndex = (sum + paletteOffset) % paletteLen
			if (colorIndex < 0) colorIndex += paletteLen
			const fgColor = paletteTable[colorIndex]

			let charIndex = sum % charLen
			if (charIndex < 0) charIndex += charLen
			// Skew toward the brighter end of the ramp for "on" cells (index 0 is
			// typically blank in the default ramp).
			if (charIndex === 0) charIndex = charLen > 1 ? 1 : 0
			const ch = params.chars[charIndex]

			line.push({ ch, fg: fgColor, bg: bgColor, bold: false })
		}

		lines.push(line)
	}

	return { lines, columns }
}

/**
 * Create a reusable sampler for the moire effect at a specific frame.
 * Returns a function mapping (x, y) to an AnsiCell, backed by a fixed grid.
 */
export function createAsciiMoireSampler(
	frame: number,
	options: AsciiMoireOptions = {},
) {
	const { bgColor = DEFAULT_BG_COLOR } = options

	const cols = 80
	const rows = 60
	const screen = generateAsciiMoireFrame(frame, cols, rows, options)

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
