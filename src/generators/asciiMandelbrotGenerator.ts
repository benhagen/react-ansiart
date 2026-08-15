import type { AnsiScreen } from '../ansi/types'
import type { FrameData } from '../types/types'
import { buildCharLookup } from './charLookup'

const DEFAULT_MAX_ITER = 64
const DEFAULT_ZOOM_SPEED = 0.02
const DEFAULT_ZOOM_X = -0.7435
const DEFAULT_ZOOM_Y = 0.1314
const DEFAULT_INITIAL_ZOOM = 0.5
const DEFAULT_FG_COLOR = '#ff8800'
const DEFAULT_BG_COLOR = '#000000'
const DEFAULT_CHARS = ' .:-=+*#%@'
const DEFAULT_ASPECT_Y = 2
const DEFAULT_COLOR_MODE: 'spectrum' | 'mono' = 'spectrum'

export interface AsciiMandelbrotOptions {
	/** Maximum iteration count (higher = more detail, slower). Default: 64 */
	maxIter?: number
	/** Zoom rate per frame. Default: 0.02 */
	zoomSpeed?: number
	/** Zoom target real component. Default: -0.7435 (Seahorse Valley) */
	zoomX?: number
	/** Zoom target imaginary component. Default: 0.1314 */
	zoomY?: number
	/** Starting zoom level. Default: 0.5 */
	initialZoom?: number
	/** Base foreground color (used in mono mode). Default: '#ff8800' */
	fgColor?: string
	/** Background / set interior color. Default: '#000000' */
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

export function generateAsciiMandelbrotFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiMandelbrotOptions = {},
): AnsiScreen {
	const {
		maxIter = DEFAULT_MAX_ITER,
		zoomSpeed = DEFAULT_ZOOM_SPEED,
		zoomX = DEFAULT_ZOOM_X,
		zoomY = DEFAULT_ZOOM_Y,
		initialZoom = DEFAULT_INITIAL_ZOOM,
		fgColor = DEFAULT_FG_COLOR,
		bgColor = DEFAULT_BG_COLOR,
		chars = DEFAULT_CHARS,
		aspectY = DEFAULT_ASPECT_Y,
		colorMode = DEFAULT_COLOR_MODE,
	} = options

	const charLookup = getCharLookup(chars)

	// Exponential zoom: doubles every 1/zoomSpeed frames
	const zoom = initialZoom * Math.pow(1 + zoomSpeed, frame)

	// Map grid to complex plane centered on zoom target
	const scaleX = 3.0 / zoom / columns
	const scaleY = 3.0 / zoom / rows * aspectY

	const fgRGB = parseHex(fgColor)

	// Escaped-cell color depends only on `iter` (0..maxIter-1) and `frame` —
	// build the fg-string table once per frame instead of once per escaped
	// cell (avoids a hslToRgb call + string allocation per pixel).
	const fgTable = new Array<string>(maxIter)
	for (let iter = 0; iter < maxIter; iter++) {
		if (colorMode === 'spectrum') {
			// Rainbow hue cycling
			const hue = ((iter / maxIter) * 3 + frame * 0.005) % 1
			const lightness = 0.15 + (iter / maxIter) * 0.55
			fgTable[iter] = hslToRgb(hue, 0.9, lightness)
		} else {
			// Mono mode: fgColor scaled by brightness
			const t = iter / maxIter
			const r = Math.round(fgRGB[0] * t)
			const g = Math.round(fgRGB[1] * t)
			const b = Math.round(fgRGB[2] * t)
			fgTable[iter] = `rgb(${r},${g},${b})`
		}
	}

	const lines: AnsiScreen['lines'] = []

	for (let row = 0; row < rows; row++) {
		const line: AnsiScreen['lines'][number] = []
		const ci = zoomY + (row - rows / 2) * scaleY

		for (let col = 0; col < columns; col++) {
			const cr = zoomX + (col - columns / 2) * scaleX

			// Cardioid / period-2 bulb membership test: these regions never
			// escape, so we can classify them as interior without running the
			// full iteration loop. This is an exact analytic test (not an
			// approximation) so it changes no output, only skips work.
			const crMinusQuarter = cr - 0.25
			const ci2 = ci * ci
			const q = crMinusQuarter * crMinusQuarter + ci2
			const inCardioid = q * (q + crMinusQuarter) <= 0.25 * ci2
			const crPlusOne = cr + 1
			const inBulb = crPlusOne * crPlusOne + ci2 <= 0.0625

			let iter = 0
			if (!inCardioid && !inBulb) {
				// Mandelbrot iteration
				let zr = 0
				let zi = 0
				while (iter < maxIter) {
					const zr2 = zr * zr
					const zi2 = zi * zi
					if (zr2 + zi2 > 4) break
					zi = 2 * zr * zi + ci
					zr = zr2 - zi2 + cr
					iter++
				}
			} else {
				iter = maxIter
			}

			if (iter === maxIter) {
				// Inside the set
				line.push({ ch: ' ', fg: bgColor, bg: bgColor, bold: false })
			} else {
				// Smooth coloring: use iteration count normalized to 0-255
				const brightness = Math.floor((iter / maxIter) * 255)
				const ch = charLookup[brightness]
				const fg = fgTable[iter]

				line.push({ ch, fg, bg: bgColor, bold: false })
			}
		}

		lines.push(line)
	}

	return { lines, columns }
}

/**
 * Generate Mandelbrot fractal as RGB pixel data.
 * Use with createShapeConverter for shape-based ASCII rendering.
 */
export function generateMandelbrotPixels(
	frame: number,
	width: number,
	height: number,
	options: AsciiMandelbrotOptions = {},
): FrameData {
	const {
		maxIter = DEFAULT_MAX_ITER,
		zoomSpeed = DEFAULT_ZOOM_SPEED,
		zoomX = DEFAULT_ZOOM_X,
		zoomY = DEFAULT_ZOOM_Y,
		initialZoom = DEFAULT_INITIAL_ZOOM,
		fgColor = DEFAULT_FG_COLOR,
		bgColor = DEFAULT_BG_COLOR,
		colorMode = DEFAULT_COLOR_MODE,
	} = options

	const zoom = initialZoom * Math.pow(1 + zoomSpeed, frame)
	const scaleX = 3.0 / zoom / width
	const scaleY = 3.0 / zoom / height

	const fgRGB = parseHex(fgColor)
	const bgRGB = parseHex(bgColor)
	const pixels = new Uint8Array(width * height * 3)

	for (let py = 0; py < height; py++) {
		const ci = zoomY + (py - height / 2) * scaleY
		for (let px = 0; px < width; px++) {
			const cr = zoomX + (px - width / 2) * scaleX

			let zr = 0
			let zi = 0
			let iter = 0
			while (iter < maxIter) {
				const zr2 = zr * zr
				const zi2 = zi * zi
				if (zr2 + zi2 > 4) break
				zi = 2 * zr * zi + ci
				zr = zr2 - zi2 + cr
				iter++
			}

			const i = (py * width + px) * 3
			if (iter === maxIter) {
				pixels[i] = bgRGB[0]
				pixels[i + 1] = bgRGB[1]
				pixels[i + 2] = bgRGB[2]
			} else if (colorMode === 'spectrum') {
				const hue = ((iter / maxIter) * 3 + frame * 0.005) % 1
				const lightness = 0.15 + (iter / maxIter) * 0.55
				const rgb = hslToRgbArray(hue, 0.9, lightness)
				pixels[i] = rgb[0]
				pixels[i + 1] = rgb[1]
				pixels[i + 2] = rgb[2]
			} else {
				const t = iter / maxIter
				pixels[i] = Math.round(fgRGB[0] * t)
				pixels[i + 1] = Math.round(fgRGB[1] * t)
				pixels[i + 2] = Math.round(fgRGB[2] * t)
			}
		}
	}

	return { width, height, pixels }
}

/** HSL to RGB returning number array (avoids string allocation in hot loop) */
function hslToRgbArray(h: number, s: number, l: number): [number, number, number] {
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
	return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}
