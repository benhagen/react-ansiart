import type { AnsiScreen } from '../ansi/types'
import { getEmbeddedVgaFont } from '../font/embeddedVgaFont'
import { charToCp437Byte } from '../utils/cp437'

// Classic demoscene sine scroller: a greeting message drawn with the library's own
// IBM VGA 8x16 bitmap glyphs, scrolling right-to-left while each column rides a
// vertical sine wave and cycles through a rainbow.
//
// The message lives in "strip space": a virtual pixel strip GLYPH_WIDTH pixels wide
// per character and GLYPH_HEIGHT pixels tall. Screen column x samples one vertical
// slice of that strip; every lit font pixel becomes one character cell.

const GLYPH_WIDTH = 8
const GLYPH_HEIGHT = 16
/** Half the glyph height — the sine offset is a glyph *center*, so we bias by this. */
const GLYPH_HALF_HEIGHT = GLYPH_HEIGHT / 2

const DEFAULT_TEXT = 'REACT-ANSIART ♦ GREETINGS TO THE SCENE ♦ '
const DEFAULT_SPEED = 1.5
const DEFAULT_AMPLITUDE = 3
const DEFAULT_WAVE_FREQ = 0.08
const DEFAULT_WAVE_SPEED = 0.06
const DEFAULT_HUE_STEP = 1.5
const DEFAULT_HUE_SPEED = 1.2
const DEFAULT_SATURATION = 1
const DEFAULT_LIGHTNESS = 0.55
const DEFAULT_BG_COLOR = '#000000'
const DEFAULT_BG_CHAR = ' '
const DEFAULT_CHAR = '█' // CP437 0xDB — full block
const DEFAULT_SHADOW = true
const DEFAULT_SHADOW_COLOR = '#1b1b28'
const DEFAULT_SCALE = 1

/** Size of the precomputed rainbow table. Hue indices wrap modulo this. */
const HUE_STEPS = 128

export interface AsciiSineScrollerOptions {
	/** Message to scroll. CP437 characters only. Default: 'REACT-ANSIART ♦ GREETINGS TO THE SCENE ♦ ' */
	text?: string
	/** Horizontal scroll speed in font pixels per frame. Default: 1.5 */
	speed?: number
	/** Vertical sine amplitude in rows. Default: 3 */
	amplitude?: number
	/** Sine frequency in radians per strip pixel — controls the wave's wavelength. Default: 0.08 */
	waveFreq?: number
	/** Sine phase advance in radians per frame — controls how fast the wave travels. Default: 0.06 */
	waveSpeed?: number
	/** Rainbow advance in hue-table steps per strip pixel (0 = flat color across the text). Default: 1.5 */
	hueStep?: number
	/** Rainbow advance in hue-table steps per frame. Default: 1.2 */
	hueSpeed?: number
	/** Saturation of the rainbow table (0–1). Default: 1 */
	saturation?: number
	/** Lightness of the rainbow table (0–1). Default: 0.55 */
	lightness?: number
	/** Fixed foreground color — overrides the rainbow entirely when set. */
	fgColor?: string
	/** Background color (CSS color string). Default: '#000000' */
	bgColor?: string
	/** Background character. Default: ' ' */
	backgroundChar?: string
	/** Character used for lit font pixels. Default: '█' */
	char?: string
	/** Horizontal pixel scale: 1 (one cell per font pixel) or 2 (double-width). Default: 1 */
	scale?: 1 | 2
	/** Draw a dark drop shadow one cell down-right of the text. Default: true */
	shadow?: boolean
	/** Drop shadow color. Default: '#1b1b28' */
	shadowColor?: string
}

// ---------------------------------------------------------------------------
// Font glyph bitmaps
// ---------------------------------------------------------------------------

// Flattened 4096-byte glyph bitmap: 256 glyphs x 16 rows x 1 byte (8 pixels,
// MSB = leftmost pixel). Sourced from the embedded VGA font, which decodes its
// own base64 with a pure-JS decoder — no canvas, DOM, atob or Buffer involved,
// so this stays usable in the browser, under SSR and in `node --test`.
let cachedGlyphBytes: Uint8Array | null = null

/**
 * The decoded IBM VGA 8x16 glyph bitmaps as one flat 4096-byte array.
 * Decoded once and cached in a module singleton. Exported for tests.
 */
export function getVgaGlyphBytes(): Uint8Array {
	if (cachedGlyphBytes) return cachedGlyphBytes

	const font = getEmbeddedVgaFont()
	const flat = new Uint8Array(256 * GLYPH_HEIGHT)
	for (let code = 0; code < 256; code++) {
		const glyph = font.glyphs[code]
		if (!glyph) continue
		const base = code * GLYPH_HEIGHT
		const rows = Math.min(GLYPH_HEIGHT, glyph.length)
		for (let py = 0; py < rows; py++) {
			flat[base + py] = glyph[py]
		}
	}

	cachedGlyphBytes = flat
	return flat
}

// ---------------------------------------------------------------------------
// Caches (all bounded, single-slot — keyed by scalar/string compare, no JSON)
// ---------------------------------------------------------------------------

// text -> CP437 glyph indices. The message rarely changes, so one slot is plenty.
let lastText: string | null = null
let lastCodes: Uint8Array | null = null

function getGlyphCodes(text: string): Uint8Array {
	if (lastText === text && lastCodes) return lastCodes
	const codes = new Uint8Array(text.length)
	for (let i = 0; i < text.length; i++) {
		codes[i] = charToCp437Byte(text[i]) & 0xff
	}
	lastText = text
	lastCodes = codes
	return codes
}

/** HSL -> 'rgb(r,g,b)'. Used only when (re)building the rainbow table. */
function hslToRgbString(h: number, s: number, l: number): string {
	let r: number
	let g: number
	let b: number

	if (s === 0) {
		r = g = b = l
	} else {
		const hue2rgb = (p: number, q: number, t: number) => {
			let tt = t
			if (tt < 0) tt += 1
			if (tt > 1) tt -= 1
			if (tt < 1 / 6) return p + (q - p) * 6 * tt
			if (tt < 1 / 2) return q
			if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
			return p
		}
		const q = l < 0.5 ? l * (1 + s) : l + s - l * s
		const p = 2 * l - q
		r = hue2rgb(p, q, h + 1 / 3)
		g = hue2rgb(p, q, h)
		b = hue2rgb(p, q, h - 1 / 3)
	}

	return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`
}

// Rainbow table, keyed by (saturation, lightness). Built once — the hot loop only
// ever indexes it, so no rgb() string is ever constructed per column or per cell.
let lastSaturation = Number.NaN
let lastLightness = Number.NaN
let lastHueTable: string[] | null = null

function getHueTable(saturation: number, lightness: number): string[] {
	if (lastHueTable && saturation === lastSaturation && lightness === lastLightness) {
		return lastHueTable
	}
	const table = new Array<string>(HUE_STEPS)
	for (let i = 0; i < HUE_STEPS; i++) {
		table[i] = hslToRgbString(i / HUE_STEPS, saturation, lightness)
	}
	lastSaturation = saturation
	lastLightness = lightness
	lastHueTable = table
	return table
}

// Per-frame scratch buffers, reused across frames of the same size.
const CELL_BG = 0
const CELL_SHADOW = 1
const CELL_FG = 2

interface Scratch {
	columns: number
	rows: number
	/** rows*columns cell states: CELL_BG / CELL_SHADOW / CELL_FG */
	state: Uint8Array
	/** Per-column strip pixel index (absolute, unwrapped) */
	stripCol: Int32Array
	/** Per-column screen row of the glyph's top pixel */
	topRow: Int32Array
	/** Per-column foreground color string */
	fg: string[]
}

let scratch: Scratch | null = null

function getScratch(columns: number, rows: number): Scratch {
	if (scratch && scratch.columns === columns && scratch.rows === rows) {
		scratch.state.fill(CELL_BG)
		return scratch
	}
	scratch = {
		columns,
		rows,
		state: new Uint8Array(rows * columns),
		stripCol: new Int32Array(columns),
		topRow: new Int32Array(columns),
		fg: new Array<string>(columns),
	}
	return scratch
}

// ---------------------------------------------------------------------------
// Option resolution
// ---------------------------------------------------------------------------

function finiteOr(value: number | undefined, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function resolveAndValidate(options: AsciiSineScrollerOptions) {
	const rawText = options.text
	const text = typeof rawText === 'string' && rawText.length > 0 ? rawText : DEFAULT_TEXT

	const rawChar = options.char
	const char = typeof rawChar === 'string' && rawChar.length > 0 ? rawChar[0] : DEFAULT_CHAR

	const rawBgChar = options.backgroundChar
	const backgroundChar =
		typeof rawBgChar === 'string' && rawBgChar.length > 0 ? rawBgChar[0] : DEFAULT_BG_CHAR

	const saturation = Math.min(1, Math.max(0, finiteOr(options.saturation, DEFAULT_SATURATION)))
	const lightness = Math.min(1, Math.max(0, finiteOr(options.lightness, DEFAULT_LIGHTNESS)))

	return {
		text,
		char,
		backgroundChar,
		speed: finiteOr(options.speed, DEFAULT_SPEED),
		amplitude: Math.max(0, finiteOr(options.amplitude, DEFAULT_AMPLITUDE)),
		waveFreq: finiteOr(options.waveFreq, DEFAULT_WAVE_FREQ),
		waveSpeed: finiteOr(options.waveSpeed, DEFAULT_WAVE_SPEED),
		hueStep: finiteOr(options.hueStep, DEFAULT_HUE_STEP),
		hueSpeed: finiteOr(options.hueSpeed, DEFAULT_HUE_SPEED),
		saturation,
		lightness,
		fgColor: typeof options.fgColor === 'string' && options.fgColor.length > 0 ? options.fgColor : null,
		bgColor: options.bgColor ?? DEFAULT_BG_COLOR,
		scale: options.scale === 2 ? 2 : DEFAULT_SCALE,
		shadow: options.shadow ?? DEFAULT_SHADOW,
		shadowColor: options.shadowColor ?? DEFAULT_SHADOW_COLOR,
	}
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate an ASCII sine scroller frame — the flagship demoscene greeting effect.
 *
 * The message is rasterised from the embedded IBM VGA 8x16 bitmap font into a
 * virtual pixel strip that scrolls right-to-left and loops seamlessly. Each screen
 * column shows one vertical slice of that strip, displaced by a travelling sine
 * wave and tinted from a precomputed rainbow table.
 *
 * Everything frame-invariant (glyph bitmaps, CP437 indices, rainbow table) is cached
 * in bounded module singletons; per frame the work is one sin() and one table lookup
 * per column, then a bitmask test per font pixel.
 */
export function generateAsciiSineScrollerFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiSineScrollerOptions = {},
): AnsiScreen {
	const params = resolveAndValidate(options)

	const safeColumns = Math.max(0, Math.floor(columns))
	const safeRows = Math.max(0, Math.floor(rows))
	if (safeColumns === 0 || safeRows === 0) {
		return { lines: [], columns: safeColumns }
	}

	const glyphBytes = getVgaGlyphBytes()
	const codes = getGlyphCodes(params.text)
	const stripWidth = codes.length * GLYPH_WIDTH
	const hueTable = getHueTable(params.saturation, params.lightness)

	const { state, stripCol, topRow, fg } = getScratch(safeColumns, safeRows)

	// Per-frame constants (Float64 throughout — these feed the sine and the hue index).
	const scrollBase = Math.floor(frame * params.speed)
	const wavePhase = frame * params.waveSpeed
	const huePhase = frame * params.hueSpeed
	const centerRow = safeRows / 2
	// scale 2 renders each font pixel as two cells wide: two screen columns share
	// one strip column, so they also share the wave offset and the rainbow color.
	const scaleShift = params.scale === 2 ? 1 : 0

	// Pass 1 — per column: strip position, sine displacement, rainbow color.
	for (let x = 0; x < safeColumns; x++) {
		const sc = scrollBase + (x >> scaleShift)
		stripCol[x] = sc

		const wave = params.amplitude * Math.sin(sc * params.waveFreq + wavePhase)
		topRow[x] = Math.round(centerRow + wave) - GLYPH_HALF_HEIGHT

		if (params.fgColor) {
			fg[x] = params.fgColor
		} else {
			const hueIndex = Math.floor(sc * params.hueStep + huePhase) % HUE_STEPS
			fg[x] = hueTable[hueIndex < 0 ? hueIndex + HUE_STEPS : hueIndex]
		}
	}

	if (stripWidth > 0) {
		// Pass 2 — drop shadow, offset one cell down-right. Drawn first so the
		// bright pass paints over it wherever the two overlap.
		if (params.shadow) {
			for (let x = 0; x + 1 < safeColumns; x++) {
				const wrapped = ((stripCol[x] % stripWidth) + stripWidth) % stripWidth
				const glyphBase = codes[(wrapped / GLYPH_WIDTH) | 0] * GLYPH_HEIGHT
				const mask = 0x80 >> (wrapped & 7)
				const top = topRow[x] + 1

				for (let py = 0; py < GLYPH_HEIGHT; py++) {
					if ((glyphBytes[glyphBase + py] & mask) === 0) continue
					const y = top + py
					if (y < 0 || y >= safeRows) continue // clip
					state[y * safeColumns + x + 1] = CELL_SHADOW
				}
			}
		}

		// Pass 3 — the text itself.
		for (let x = 0; x < safeColumns; x++) {
			const wrapped = ((stripCol[x] % stripWidth) + stripWidth) % stripWidth
			const glyphBase = codes[(wrapped / GLYPH_WIDTH) | 0] * GLYPH_HEIGHT
			const mask = 0x80 >> (wrapped & 7)
			const top = topRow[x]

			for (let py = 0; py < GLYPH_HEIGHT; py++) {
				if ((glyphBytes[glyphBase + py] & mask) === 0) continue
				const y = top + py
				if (y < 0 || y >= safeRows) continue // clip
				state[y * safeColumns + x] = CELL_FG
			}
		}
	}

	// Pass 4 — materialise cells.
	const bgColor = params.bgColor
	const shadowColor = params.shadowColor
	const backgroundChar = params.backgroundChar
	const char = params.char

	const lines: AnsiScreen['lines'] = []
	for (let y = 0; y < safeRows; y++) {
		const line: AnsiScreen['lines'][number] = []
		const rowBase = y * safeColumns
		for (let x = 0; x < safeColumns; x++) {
			const cellState = state[rowBase + x]
			if (cellState === CELL_FG) {
				line.push({ ch: char, fg: fg[x], bg: bgColor, bold: true })
			} else if (cellState === CELL_SHADOW) {
				line.push({ ch: char, fg: shadowColor, bg: bgColor, bold: false })
			} else {
				line.push({ ch: backgroundChar, fg: bgColor, bg: bgColor, bold: false })
			}
		}
		lines.push(line)
	}

	return { lines, columns: safeColumns }
}
