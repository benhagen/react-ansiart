import type { AnsiScreen } from '../ansi/types'
import { buildCharLookup } from './charLookup'

const DEFAULT_SPEED = 0.08
const DEFAULT_ROTATION_SPEED = 0.01
const DEFAULT_TILES = 8
const DEFAULT_FG_COLOR = '#00ffaa'
const DEFAULT_BG_COLOR = '#000000'
const DEFAULT_CHARS = [' ', '.', ':', '-', '=', '+', '*', '#', '%', '@']
const DEFAULT_ASPECT_Y = 2

export interface AsciiTunnelOptions {
	/** Forward movement speed through the tunnel. Default: 0.08 */
	speed?: number
	/** Rotation speed of the tunnel. Default: 0.01 */
	rotationSpeed?: number
	/** Number of checkerboard tiles in each direction. Default: 8 */
	tiles?: number
	/** Foreground color (CSS color string). Default: '#00ffaa' */
	fgColor?: string
	/** Background color (CSS color string). Default: '#000000' */
	bgColor?: string
	/** Characters used for brightness mapping (dark to bright). Default: ' .:-=+*#%@' */
	chars?: string
	/** Vertical aspect ratio correction factor. Default: 2 */
	aspectY?: number
}

// Memoized char lookup table
let lastTunnelChars: string | null = null
let lastTunnelCharLookup: string[] | null = null

function getTunnelCharLookup(chars: string): string[] {
	if (lastTunnelChars === chars && lastTunnelCharLookup) return lastTunnelCharLookup
	const charArray = chars.split('')
	lastTunnelCharLookup = buildCharLookup(charArray)
	lastTunnelChars = chars
	return lastTunnelCharLookup
}

/**
 * Parse a CSS hex color string into [r, g, b] components.
 */
function parseHexColor(hex: string): [number, number, number] {
	const clean = hex.replace('#', '')
	if (clean.length === 3) {
		const r = parseInt(clean[0] + clean[0], 16)
		const g = parseInt(clean[1] + clean[1], 16)
		const b = parseInt(clean[2] + clean[2], 16)
		return [r, g, b]
	}
	const r = parseInt(clean.substring(0, 2), 16)
	const g = parseInt(clean.substring(2, 4), 16)
	const b = parseInt(clean.substring(4, 6), 16)
	return [r, g, b]
}

const TWO_PI = Math.PI * 2
const TUNNEL_SCALE = 1.0
const FOG_FACTOR = 0.1

// distance, angle, and the fog-attenuated fgColor rgb() string are all pure functions of
// (x, y, columns, rows, aspectY, fgColor) — none depend on frame — yet were being recomputed
// (including a Math.sqrt + Math.atan2 + string-building rgb()) for every cell on every frame.
// Cache them as flat Float64Arrays / a string array, keyed on the dimensions/aspect/color,
// mirroring the cached distance field in asciiSonarFrameGenerator. Float64 (not Float32) is
// required here: distance feeds the `distance < 0.5` singularity threshold and a 1/distance
// division, so rounding to float32 measurably shifted output at cell boundaries.
interface TunnelFieldCache {
	columns: number
	rows: number
	aspectY: number
	fgColor: string
	distance: Float64Array
	angle: Float64Array
	fgRgbStrings: string[]
}

let tunnelFieldCache: TunnelFieldCache | null = null

function getTunnelFields(
	columns: number,
	rows: number,
	aspectY: number,
	fgColor: string,
	fgR: number,
	fgG: number,
	fgB: number
): TunnelFieldCache {
	const cached = tunnelFieldCache
	if (
		cached &&
		cached.columns === columns &&
		cached.rows === rows &&
		cached.aspectY === aspectY &&
		cached.fgColor === fgColor
	) {
		return cached
	}

	const centerX = columns / 2
	const centerY = rows / 2
	const n = columns * rows
	const distance = new Float64Array(n)
	const angle = new Float64Array(n)
	const fgRgbStrings = new Array<string>(n)

	let i = 0
	for (let y = 0; y < rows; y++) {
		const actualY = (y - centerY) * aspectY
		for (let x = 0; x < columns; x++) {
			const actualX = x - centerX
			const dist = Math.sqrt(actualX * actualX + actualY * actualY)
			distance[i] = dist
			angle[i] = Math.atan2(actualY, actualX)

			const fog = 1 / (1 + dist * FOG_FACTOR)
			const r = Math.floor(fgR * fog)
			const g = Math.floor(fgG * fog)
			const b = Math.floor(fgB * fog)
			fgRgbStrings[i] = `rgb(${r},${g},${b})`
			i++
		}
	}

	const next: TunnelFieldCache = { columns, rows, aspectY, fgColor, distance, angle, fgRgbStrings }
	tunnelFieldCache = next
	return next
}

/**
 * Generate ASCII Tunnel frame
 * Creates a classic demo scene rotating/zooming tunnel with checkerboard texture.
 * This is a stateless generator — output is a pure function of the frame number.
 */
export function generateAsciiTunnelFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiTunnelOptions = {}
): AnsiScreen {
	const {
		speed = DEFAULT_SPEED,
		rotationSpeed = DEFAULT_ROTATION_SPEED,
		tiles = DEFAULT_TILES,
		fgColor = DEFAULT_FG_COLOR,
		bgColor = DEFAULT_BG_COLOR,
		chars = DEFAULT_CHARS.join(''),
		aspectY = DEFAULT_ASPECT_Y,
	} = options

	const charLookup = getTunnelCharLookup(chars)
	const [fgR, fgG, fgB] = parseHexColor(fgColor)

	const { distance: distanceField, angle: angleField, fgRgbStrings } = getTunnelFields(
		columns,
		rows,
		aspectY,
		fgColor,
		fgR,
		fgG,
		fgB
	)

	const lines: AnsiScreen['lines'] = []
	let idx = 0

	for (let y = 0; y < rows; y++) {
		const line: AnsiScreen['lines'][number] = []

		for (let x = 0; x < columns; x++) {
			const distance = distanceField[idx]

			// Center singularity: render as empty space
			if (distance < 0.5) {
				line.push({ ch: ' ', fg: bgColor, bg: bgColor, bold: false })
				idx++
				continue
			}

			const angle = angleField[idx]

			// Texture coordinates
			let u = angle / TWO_PI + 0.5
			let v = TUNNEL_SCALE / distance

			// Animate
			u += frame * rotationSpeed
			v += frame * speed

			// Checkerboard pattern
			const tileU = Math.floor(u * tiles)
			const tileV = Math.floor(v * tiles)
			const pattern = ((tileU + tileV) % 2 + 2) % 2 // ensure positive modulo

			// Depth fog: attenuate brightness with distance
			const fog = 1 / (1 + distance * FOG_FACTOR)
			const brightness = Math.floor(pattern * fog * 255)
			const clampedBrightness = Math.max(0, Math.min(255, brightness))

			const ch = charLookup[clampedBrightness]

			// Color: lerp from full fgColor (near) to dim version (far) based on fog.
			// fog depends only on distance (frame-independent), so this string is precomputed.
			const cellFg = fgRgbStrings[idx]

			line.push({ ch, fg: cellFg, bg: bgColor, bold: false })
			idx++
		}

		lines.push(line)
	}

	return { lines, columns }
}
