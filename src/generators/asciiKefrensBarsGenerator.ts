import type { AnsiScreen } from '../ansi/types'

const DEFAULT_BAR_WIDTH = 7
const DEFAULT_AMPLITUDE1_FRAC = 0.28
const DEFAULT_FREQUENCY1 = 0.15
const DEFAULT_SPEED1 = 0.05
const DEFAULT_AMPLITUDE2_FRAC = 0.12
const DEFAULT_FREQUENCY2 = 0.37
const DEFAULT_SPEED2 = -0.08
const DEFAULT_HUE_SPEED = 0.15
const DEFAULT_HUE_ROW_STEP = 0.4
const DEFAULT_BG_COLOR = '#000000'
const DEFAULT_BG_CHAR = ' '
// Bright center -> dark edge shading ramp
const DEFAULT_CHARS = ['█', '▓', '▒', '░']

// Classic Amiga-ish rainbow palette bars cycle through as they cascade down the screen
const DEFAULT_PALETTE = [
	'#ff3366', // Hot pink/red
	'#ff9933', // Orange
	'#ffee33', // Yellow
	'#33ff66', // Green
	'#33ccff', // Cyan
	'#9966ff', // Violet
]

export interface AsciiKefrensBarsOptions {
	/** Width of each bar in cells. Default: 7 */
	barWidth?: number
	/** Amplitude of the primary sine wobble, in cells. Default: ~28% of columns */
	amplitude1?: number
	/** Row-frequency of the primary wobble (radians per row). Default: 0.15 */
	frequency1?: number
	/** Frame-speed of the primary wobble (radians per frame). Default: 0.05 */
	speed1?: number
	/** Amplitude of the secondary sine wobble, in cells. Default: ~12% of columns */
	amplitude2?: number
	/** Row-frequency of the secondary wobble (radians per row). Default: 0.37 */
	frequency2?: number
	/** Frame-speed of the secondary wobble (radians per frame). Default: -0.08 */
	speed2?: number
	/** Color palette bars cycle through (CSS color strings). Default: rainbow Amiga-ish palette */
	palette?: string[]
	/** How fast the bar color cycles over time (per frame). Default: 0.15 */
	hueSpeed?: number
	/** How fast the bar color cycles per row, independent of frame. Default: 0.4 */
	hueRowStep?: number
	/** Shading ramp from bright center to dark edge. Default: '█▓▒░' */
	chars?: string[]
	/** Background color (CSS color string). Default: '#000000' */
	bgColor?: string
	/** Background character. Default: ' ' */
	backgroundChar?: string
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

// Per-palette-entry, per-shade-level rgb() strings, blended toward the background color at the
// bar edges. Rebuilt only when palette/chars/bgColor actually change (single-slot cache).
let lastRampPalette: string[] | null = null
let lastRampChars: string[] | null = null
let lastRampBg: string | null = null
let lastRamp: string[][] | null = null

function getColorRamp(palette: string[], chars: string[], bgColor: string): string[][] {
	if (
		lastRamp &&
		lastRampPalette === palette &&
		lastRampChars === chars &&
		lastRampBg === bgColor
	) {
		return lastRamp
	}

	const bg = parseColor(bgColor)
	const levels = chars.length
	const ramp: string[][] = new Array(palette.length)

	for (let p = 0; p < palette.length; p++) {
		const c = parseColor(palette[p])
		const shades: string[] = new Array(levels)
		for (let level = 0; level < levels; level++) {
			const t = levels > 1 ? level / (levels - 1) : 0
			const mix = t * 0.75
			const r = Math.round(c[0] * (1 - mix) + bg[0] * mix)
			const g = Math.round(c[1] * (1 - mix) + bg[1] * mix)
			const b = Math.round(c[2] * (1 - mix) + bg[2] * mix)
			shades[level] = `rgb(${r},${g},${b})`
		}
		ramp[p] = shades
	}

	lastRampPalette = palette
	lastRampChars = chars
	lastRampBg = bgColor
	lastRamp = ramp
	return ramp
}

// Single reusable row buffer, reallocated only when the column count changes. Cleared at the
// start of every frame, then never cleared between rows within that frame -- each row inherits
// whatever bars above it painted, producing the signature cascading curtain.
let bufColumns = -1
let bufCh: string[] | null = null
let bufShade: Uint8Array | null = null
let bufHue: Int16Array | null = null

function getRowBuffer(columns: number) {
	if (bufColumns !== columns || !bufCh || !bufShade || !bufHue) {
		bufCh = new Array(columns)
		bufShade = new Uint8Array(columns)
		bufHue = new Int16Array(columns)
		bufColumns = columns
	}
	return { ch: bufCh, shade: bufShade, hue: bufHue }
}

function clearBuffer(
	buf: { ch: string[]; shade: Uint8Array; hue: Int16Array },
	backgroundChar: string,
): void {
	buf.ch.fill(backgroundChar)
	buf.hue.fill(-1) // -1 marks an unpainted (background) cell
}

function drawBar(
	buf: { ch: string[]; shade: Uint8Array; hue: Int16Array },
	columns: number,
	barX: number,
	barWidth: number,
	hueIndex: number,
	chars: string[],
): void {
	const halfWidth = (barWidth - 1) / 2
	const start = Math.round(barX - halfWidth)
	const levels = chars.length

	for (let k = 0; k < barWidth; k++) {
		const x = start + k
		if (x < 0 || x >= columns) continue
		const dx = k - halfWidth
		const t = halfWidth > 0 ? Math.abs(dx) / halfWidth : 0
		const level = Math.min(levels - 1, Math.floor(t * levels))
		buf.ch[x] = chars[level]
		buf.shade[x] = level
		buf.hue[x] = hueIndex
	}
}

/**
 * Generate an ASCII Kefrens bars frame -- the iconic Amiga "impossible" cascading bars effect.
 *
 * A single row buffer is drawn into top-to-bottom and never cleared between rows within a
 * frame, so each row inherits everything painted above it. Each row's bar position is driven
 * by two layered sine waves (a primary sweep plus a faster secondary wobble), producing the
 * classic descending curtain of overlapping bars.
 */
export function generateAsciiKefrensBarsFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiKefrensBarsOptions = {},
): AnsiScreen {
	const barWidth = Math.max(1, Math.floor(options.barWidth ?? DEFAULT_BAR_WIDTH))
	const amplitude1 = options.amplitude1 ?? columns * DEFAULT_AMPLITUDE1_FRAC
	const frequency1 = options.frequency1 ?? DEFAULT_FREQUENCY1
	const speed1 = options.speed1 ?? DEFAULT_SPEED1
	const amplitude2 = options.amplitude2 ?? columns * DEFAULT_AMPLITUDE2_FRAC
	const frequency2 = options.frequency2 ?? DEFAULT_FREQUENCY2
	const speed2 = options.speed2 ?? DEFAULT_SPEED2
	const hueSpeed = options.hueSpeed ?? DEFAULT_HUE_SPEED
	const hueRowStep = options.hueRowStep ?? DEFAULT_HUE_ROW_STEP
	const palette = options.palette && options.palette.length > 0 ? options.palette : DEFAULT_PALETTE
	const chars = options.chars && options.chars.length > 0 ? options.chars : DEFAULT_CHARS
	const bgColor = options.bgColor ?? DEFAULT_BG_COLOR
	const backgroundChar = options.backgroundChar ?? DEFAULT_BG_CHAR

	const centerX: number = (columns - 1) / 2
	const paletteLen = palette.length

	const colorRamp = getColorRamp(palette, chars, bgColor)
	const buf = getRowBuffer(columns)
	clearBuffer(buf, backgroundChar)

	const lines: AnsiScreen['lines'] = new Array(rows)

	for (let y = 0; y < rows; y++) {
		const barX: number =
			centerX +
			Math.sin(y * frequency1 + frame * speed1) * amplitude1 +
			Math.sin(y * frequency2 + frame * speed2) * amplitude2

		const rawHue = Math.floor(y * hueRowStep + frame * hueSpeed)
		const hueIndex = ((rawHue % paletteLen) + paletteLen) % paletteLen

		drawBar(buf, columns, barX, barWidth, hueIndex, chars)

		const line: AnsiScreen['lines'][number] = new Array(columns)
		for (let x = 0; x < columns; x++) {
			const hue = buf.hue[x]
			if (hue < 0) {
				line[x] = { ch: backgroundChar, fg: bgColor, bg: bgColor, bold: false }
			} else {
				const level = buf.shade[x]
				line[x] = {
					ch: buf.ch[x],
					fg: colorRamp[hue][level],
					bg: bgColor,
					bold: level === 0,
				}
			}
		}
		lines[y] = line
	}

	return { lines, columns }
}
