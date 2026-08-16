import type { AnsiScreen } from '../ansi/types'
import { buildCharLookup } from './charLookup'

const DEFAULT_MAX_ITER = 64
const DEFAULT_MORPH_SPEED = 0.015
const DEFAULT_RADIUS = 0.7885
const DEFAULT_ZOOM = 1.0

/**
 * Width of the complex-plane window at zoom 1, in real-axis units. Sized so the
 * whole |z| < ~1.5 neighbourhood the c-orbit's Julia sets live in stays on
 * screen on a typical wide-but-short character grid.
 */
const PLANE_WIDTH = 4.6

// Lightness range of the escape-band palette. The floor is well above black on
// purpose: the low-iteration bands cover most of the screen, so a near-zero
// floor renders the whole exterior invisible.
const MIN_LIGHTNESS = 0.38
const MAX_LIGHTNESS = 0.82
const DEFAULT_CENTER_X = 0
const DEFAULT_CENTER_Y = 0
const DEFAULT_HUE_SPEED = 0.005
const DEFAULT_FG_COLOR = '#00ccff'
const DEFAULT_BG_COLOR = '#000000'
const DEFAULT_CHARS = ' .:-=+*#%@'
const DEFAULT_ASPECT_Y = 2
const DEFAULT_COLOR_MODE: 'spectrum' | 'mono' = 'spectrum'

export interface AsciiJuliaOptions {
	/** Maximum iteration count (higher = more detail, slower). Default: 64 */
	maxIter?: number
	/** Angular speed of the c-parameter orbit (radians/frame). Default: 0.015 */
	morphSpeed?: number
	/**
	 * Orbit radius of the c-parameter. Kept just outside the Mandelbrot
	 * cardioid (~0.7885) so the Julia set morphs continuously without
	 * collapsing into a point or a dust cloud. Default: 0.7885
	 */
	radius?: number
	/** Zoom level of the viewing plane. Default: 1.0 */
	zoom?: number
	/** Plane center real component. Default: 0 */
	centerX?: number
	/** Plane center imaginary component. Default: 0 */
	centerY?: number
	/** Hue drift speed per frame (spectrum mode only). Default: 0.005 */
	hueSpeed?: number
	/** Base foreground color (used in mono mode). Default: '#00ccff' */
	fgColor?: string
	/** Background / interior (non-escaping) color. Default: '#000000' */
	bgColor?: string
	/** Character ramp from low to high iteration count. Default: ' .:-=+*#%@' */
	chars?: string
	/** Y aspect correction for non-square cells. Default: 2 */
	aspectY?: number
	/** Color mode: 'spectrum' cycles rainbow hues, 'mono' uses fgColor brightness. Default: 'spectrum' */
	colorMode?: 'spectrum' | 'mono'
}

// Memoized char lookup
let lastChars: string | null = null
let lastCharLookup: string[] | null = null

function getCharLookup(chars: string): string[] {
	if (lastChars === chars && lastCharLookup) return lastCharLookup
	lastCharLookup = buildCharLookup(Array.from(chars))
	lastChars = chars
	return lastCharLookup
}

/** Convert HSL (h: 0-1, s: 0-1, l: 0-1) to RGB string */
function hslToRgb(h: number, s: number, l: number): string {
	let r: number, g: number, b: number
	if (s === 0) {
		r = g = b = l
	} else {
		const hue2rgb = (p: number, q: number, t: number) => {
			if (t < 0) t += 1
			if (t > 1) t -= 1
			if (t < 1 / 6) return p + (q - p) * 6 * t
			if (t < 1 / 2) return q
			if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
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

/** Parse hex color to [r, g, b] 0-255 */
function parseHex(hex: string): [number, number, number] {
	const h = hex.startsWith('#') ? hex.slice(1) : hex
	return [
		parseInt(h.slice(0, 2), 16) || 0,
		parseInt(h.slice(2, 4), 16) || 0,
		parseInt(h.slice(4, 6), 16) || 0,
	]
}

/**
 * Generate an animated Julia set frame. The c-parameter orbits just outside
 * the Mandelbrot cardioid (r ~ 0.7885) so the set morphs continuously
 * without collapsing into a point (|c| too small) or shattering into dust
 * (|c| too large / outside the set boundary region).
 */
export function generateAsciiJuliaFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiJuliaOptions = {},
): AnsiScreen {
	const {
		maxIter = DEFAULT_MAX_ITER,
		morphSpeed = DEFAULT_MORPH_SPEED,
		radius = DEFAULT_RADIUS,
		zoom = DEFAULT_ZOOM,
		centerX = DEFAULT_CENTER_X,
		centerY = DEFAULT_CENTER_Y,
		hueSpeed = DEFAULT_HUE_SPEED,
		fgColor = DEFAULT_FG_COLOR,
		bgColor = DEFAULT_BG_COLOR,
		chars = DEFAULT_CHARS,
		aspectY = DEFAULT_ASPECT_Y,
		colorMode = DEFAULT_COLOR_MODE,
	} = options

	const charLookup = getCharLookup(chars)

	// c orbits the origin just outside the cardioid boundary — the set
	// morphs every frame but never degenerates.
	const theta = frame * morphSpeed
	const cr = radius * Math.cos(theta)
	const ci = radius * Math.sin(theta)

	// Map the grid to the complex plane. Unlike the Mandelbrot generator (which
	// derives its vertical scale from `rows`, and gets away with it because a deep
	// zoom keeps escape counts high everywhere), the Julia window is derived from
	// the *column* scale and then stretched by aspectY. Deriving it from `rows`
	// makes a wide-but-short grid show several times more imaginary axis than real
	// axis, pushing most of the screen out past |z| > 2 where every cell escapes
	// immediately and renders as background.
	const scaleX = PLANE_WIDTH / zoom / columns
	const scaleY = scaleX * aspectY

	const fgRGB = parseHex(fgColor)

	// Escaped-cell color and glyph depend only on `iter` (0..maxIter-1) and
	// `frame` — build both tables once per frame instead of once per escaped cell
	// (avoids an hslToRgb call + string allocation per pixel).
	//
	// The band position is log-scaled rather than linear: exterior cells escape
	// after a handful of iterations, so `iter / maxIter` crushes almost the entire
	// exterior into the darkest, blank-glyph end of the ramp — which is what made
	// the effect read as a near-black screen for most of the c-orbit. A log ramp
	// spreads the low iteration counts across the whole palette, and the +2 offset
	// keeps even an immediate escape (iter 0) on a visible glyph and a readable
	// lightness, so the black interior of the set is the only unlit region.
	const invLogSpan = 1 / Math.log(maxIter + 2)
	const fgTable = new Array<string>(maxIter)
	const charTable = new Array<string>(maxIter)
	for (let iter = 0; iter < maxIter; iter++) {
		const t = Math.log(iter + 2) * invLogSpan
		charTable[iter] = charLookup[Math.min(255, Math.floor(t * 255))]
		if (colorMode === 'spectrum') {
			const hue = (t * 3 + frame * hueSpeed) % 1
			const lightness = MIN_LIGHTNESS + t * (MAX_LIGHTNESS - MIN_LIGHTNESS)
			fgTable[iter] = hslToRgb(hue, 0.9, lightness)
		} else {
			const shade = MIN_LIGHTNESS / MAX_LIGHTNESS + t * (1 - MIN_LIGHTNESS / MAX_LIGHTNESS)
			const r = Math.round(fgRGB[0] * shade)
			const g = Math.round(fgRGB[1] * shade)
			const b = Math.round(fgRGB[2] * shade)
			fgTable[iter] = `rgb(${r},${g},${b})`
		}
	}

	const lines: AnsiScreen['lines'] = []

	for (let row = 0; row < rows; row++) {
		const line: AnsiScreen['lines'][number] = []
		const zi0 = centerY + (row - rows / 2) * scaleY

		for (let col = 0; col < columns; col++) {
			const zr0 = centerX + (col - columns / 2) * scaleX

			// Julia iteration: z starts at the plane coordinate, c is fixed
			// for the whole frame. |z|^2 > 4 is the standard (and only)
			// escape test — there is no cardioid shortcut for Julia sets.
			let zr = zr0
			let zi = zi0
			let iter = 0
			while (iter < maxIter) {
				const zr2 = zr * zr
				const zi2 = zi * zi
				if (zr2 + zi2 > 4) break
				zi = 2 * zr * zi + ci
				zr = zr2 - zi2 + cr
				iter++
			}

			if (iter === maxIter) {
				// Interior — never escaped
				line.push({ ch: ' ', fg: bgColor, bg: bgColor, bold: false })
			} else {
				line.push({ ch: charTable[iter], fg: fgTable[iter], bg: bgColor, bold: false })
			}
		}

		lines.push(line)
	}

	return { lines, columns }
}
