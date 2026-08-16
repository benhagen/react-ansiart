import type { AnsiScreen } from '../ansi/types'

const HALF_PI = Math.PI / 2
const QUARTER_PI = Math.PI / 4

const DEFAULT_WIDTH_FRAC = 0.3
const DEFAULT_ROTATION_SPEED = 0.05
const DEFAULT_WAVE_FREQ = 0.25
const DEFAULT_WAVE_SPEED = 0.04
const DEFAULT_WAVE_DEPTH = 0.6
const DEFAULT_BG_COLOR = '#000000'
const DEFAULT_BG_CHAR = ' '
// Dim edge -> bright center shading ramp
const DEFAULT_CHARS = ['░', '▒', '▓', '█']

// Four subtly different metallic-blue shades, one per ribbon face, so the twist reads as it turns
const DEFAULT_PALETTE = ['#3f5f90', '#5a7fb0', '#7fa0c8', '#9fc0e0']

export interface AsciiTwisterOptions {
	/** Half-width of the ribbon in cells (the square column's radius). Default: ~30% of columns */
	width?: number
	/** Rotation speed of the ribbon (radians per frame). Default: 0.05 */
	rotationSpeed?: number
	/** Row-frequency of the vertical twist wave (radians per row). Default: 0.25 */
	waveFreq?: number
	/** Frame-speed of the vertical twist wave (radians per frame). Default: 0.04 */
	waveSpeed?: number
	/** Depth (amplitude, in radians) of the vertical twist wave. Default: 0.6 */
	waveDepth?: number
	/** Four-entry color palette, one shade per ribbon face. Default: metallic-blue shades */
	palette?: string[]
	/** Shading ramp from dim edge to bright center. Default: '░▒▓█' */
	chars?: string[]
	/** Background color (CSS color string). Default: '#000000' */
	bgColor?: string
	/** Background character. Default: ' ' */
	backgroundChar?: string
	/** Horizontal center of the ribbon, in cell coordinates. Default: (columns-1)/2 */
	centerX?: number
}

/**
 * Generate an ASCII twister frame -- a vertically twisted ribbon (classic C64/Amiga twister),
 * rendered as a square column seen edge-on.
 *
 * Per row, the column's four edges are projected onto the x-axis at angles offset by the row's
 * twist angle. Exactly two adjacent edges face the viewer at any given row; their projected span
 * is filled with a per-face color and a brightness-driven shading ramp, producing the illusion of
 * a folded, rotating ribbon.
 */
export function generateAsciiTwisterFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiTwisterOptions = {},
): AnsiScreen {
	const halfWidth = Math.max(1, options.width ?? columns * DEFAULT_WIDTH_FRAC)
	const rotationSpeed = options.rotationSpeed ?? DEFAULT_ROTATION_SPEED
	const waveFreq = options.waveFreq ?? DEFAULT_WAVE_FREQ
	const waveSpeed = options.waveSpeed ?? DEFAULT_WAVE_SPEED
	const waveDepth = options.waveDepth ?? DEFAULT_WAVE_DEPTH
	const palette = options.palette && options.palette.length > 0 ? options.palette : DEFAULT_PALETTE
	const chars = options.chars && options.chars.length > 0 ? options.chars : DEFAULT_CHARS
	const bgColor = options.bgColor ?? DEFAULT_BG_COLOR
	const backgroundChar = options.backgroundChar ?? DEFAULT_BG_CHAR
	const centerX: number = options.centerX ?? (columns - 1) / 2

	const levels = chars.length
	const paletteLen = palette.length
	// Shared across every background cell (and every row) intentionally: consumers never
	// mutate cells — the engine value-copies them when rendering, and post-effects treat
	// input cells as read-only, copy-on-write onto their own buffers (see the aliasing
	// contract in ansiPostEffects.ts) — so one reused object is safe here.
	const bgCell = { ch: backgroundChar, fg: bgColor, bg: bgColor, bold: false }

	const lines: AnsiScreen['lines'] = new Array(rows)

	for (let y = 0; y < rows; y++) {
		const line: AnsiScreen['lines'][number] = new Array(columns)
		for (let x = 0; x < columns; x++) line[x] = bgCell

		const twistAngle: number =
			frame * rotationSpeed + Math.sin(y * waveFreq + frame * waveSpeed) * waveDepth

		// Four edges of the square column, 90 degrees apart, projected onto the x-axis.
		const angle0 = twistAngle
		const angle1 = twistAngle + HALF_PI
		const angle2 = twistAngle + Math.PI
		const angle3 = twistAngle + Math.PI + HALF_PI

		const x0 = centerX + Math.cos(angle0) * halfWidth
		const x1 = centerX + Math.cos(angle1) * halfWidth
		const x2 = centerX + Math.cos(angle2) * halfWidth
		const x3 = centerX + Math.cos(angle3) * halfWidth

		fillFace(line, columns, x0, x1, angle0, chars, levels, palette, paletteLen, 0, bgColor)
		fillFace(line, columns, x1, x2, angle1, chars, levels, palette, paletteLen, 1, bgColor)
		fillFace(line, columns, x2, x3, angle2, chars, levels, palette, paletteLen, 2, bgColor)
		fillFace(line, columns, x3, x0, angle3, chars, levels, palette, paletteLen, 3, bgColor)

		lines[y] = line
	}

	return { lines, columns }
}

// Fills the projected span between two adjacent edges with a single face color and shading
// level, but only when the edges face the viewer (their span runs left-to-right).
function fillFace(
	line: AnsiScreen['lines'][number],
	columns: number,
	xStart: number,
	xEnd: number,
	angleStart: number,
	chars: string[],
	levels: number,
	palette: string[],
	paletteLen: number,
	faceIndex: number,
	bgColor: string,
): void {
	if (xEnd - xStart <= 0) return // Back-facing edge pair -- not visible

	// The two edges are HALF_PI apart, so the face's normal points at the angle exactly
	// midway between them, regardless of wraparound.
	const midAngle = angleStart + QUARTER_PI
	const brightness = Math.abs(Math.sin(midAngle))
	const level = Math.min(levels - 1, Math.floor(brightness * levels))
	const ch = chars[level]
	const color = palette[faceIndex % paletteLen]
	const cell = { ch, fg: color, bg: bgColor, bold: brightness > 0.85 }

	const startX = Math.max(0, Math.round(xStart))
	const endX = Math.min(columns - 1, Math.round(xEnd))
	for (let x = startX; x <= endX; x++) line[x] = cell
}
