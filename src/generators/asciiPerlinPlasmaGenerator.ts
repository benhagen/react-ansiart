import type { AnsiScreen } from '../ansi/parser'

// Default character set (same as asciiPerlinPlasma.tsx)
const DEFAULT_CHARS2 = [
	'@',
	'0',
	'#',
	'2',
	'$',
	'*',
	'+',
	':',
	',',
	'.',
	' ',
	' ',
	' ',
	' ',
	' ',
	' ',
]

const DEFAULT_CHARS = [
	'Q',
	'B',
	'$',
	'8',
	'@',
	'0',
	'#',
	'2',
	'*',
	'+',
	':',
	',',
	'ù',
	'ú',
	' ',
	' ',
	' ',
	' ',
	' ',
	' ',
]

// Default octave configuration
const DEFAULT_OCTAVES = [
	{
		scale: 0.02,
		amplitude: 1.0,
		timeScaleX: -1.0, // Much slower movement
		timeScaleY: -0.5, // Much slower movement
	},
	{
		scale: 0.04,
		amplitude: 1,
		timeScaleX: -0.5, // Much slower movement
		timeScaleY: -0.3, // Much slower movement
	},
]

// Default timeScale - controls animation speed
// In the original component, time accumulates by adding timeScale each frame
// Here, time = frame * timeScale, so we use the same value as the original
const DEFAULT_TIME_SCALE = 0.9
const DEFAULT_FG_COLOR = '#55FFFF' // Bright cyan
const DEFAULT_BG_COLOR = '#000000' // Black

export interface OctaveConfig {
	scale: number // Base frequency
	amplitude: number // Contribution strength
	timeScaleX: number // Horizontal movement speed
	timeScaleY: number // Vertical movement speed
}

export interface AsciiPerlinPlasmaOptions {
	/** Array of characters to use for ASCII rendering (brightness-based) */
	chars?: string[]
	/** Animation speed multiplier. Default: 0.9. Lower = slower animation */
	timeScale?: number
	/** Foreground color (CSS color string). Default: '#55FFFF' (bright cyan). Accepts any valid CSS color (hex, rgb, rgba, hsl, named colors, etc.) */
	fgColor?: string
	/** Background color (CSS color string). Default: '#000000' (black). Accepts any valid CSS color (hex, rgb, rgba, hsl, named colors, etc.) */
	bgColor?: string
	/** Noise octave configurations */
	octaves?: OctaveConfig[]
	/** Seed for noise generation. Controls the pattern shape. Default: 12345. Use different seeds for different patterns */
	seed?: number
}

// Pre-compute fade curve values (quintic)
const FADE_TABLE = new Float32Array(512)
for (let i = 0; i < 512; i++) {
	const t = i / 511
	FADE_TABLE[i] = t * t * t * (t * (t * 6 - 15) + 10)
}

// Optimized fade lookup
function fastFade(t: number): number {
	return FADE_TABLE[(t * 511) | 0]
}

// Pre-computed gradients
const GRAD_TABLE = new Float32Array([
	0.707, 0.707, -0.707, 0.707, 0.707, -0.707, -0.707, -0.707, 1, 0, -1, 0, 0, 1, 0, -1,
])

// Fast gradient function
function fastGrad(hash: number, x: number, y: number): number {
	const h = (hash & 7) << 1 // Multiply by 2 using shift
	return GRAD_TABLE[h] * x + GRAD_TABLE[h | 1] * y
}

// Faster hash function optimized for performance
function hash(x: number, y: number, seed: number): number {
	// Use a simpler, faster hash that's still good for noise
	let h = (x * 73856093) ^ (y * 19349663) ^ seed
	h = (h >>> 16) ^ h
	h *= 0x7feb352d
	h ^= h >>> 15
	h *= 0x846ca68b
	return h ^ (h >>> 16)
}

// Generate permutation table
function generatePermutation(seed: number): Uint8Array {
	const perm = new Uint8Array(256)
	for (let i = 0; i < 256; i++) perm[i] = i

	// Use seed to seed the random number generator
	// Simple LCG for deterministic randomness
	let randomSeed = seed
	function random() {
		randomSeed = (randomSeed * 9301 + 49297) % 233280
		return randomSeed / 233280
	}

	for (let i = 255; i > 0; i--) {
		const j = Math.floor(random() * (i + 1))
		;[perm[i], perm[j]] = [perm[j], perm[i]]
	}
	return perm
}

// 2D Perlin noise function
function noise2D(x: number, y: number, perm: Uint8Array): number {
	const X = Math.floor(x)
	const Y = Math.floor(y)

	x -= X
	y -= Y

	// Improved fade function (quintic)
	const u = fastFade(x)
	const v = fastFade(y)

	// Better hashing for grid coordinates
	const seed = perm[0]
	const A = Math.abs(hash(X, Y, seed)) % 256
	const B = Math.abs(hash(X + 1, Y, seed)) % 256
	const C = Math.abs(hash(X, Y + 1, seed)) % 256
	const D = Math.abs(hash(X + 1, Y + 1, seed)) % 256

	// Get gradients
	const g00 = fastGrad(perm[A], x, y)
	const g10 = fastGrad(perm[B], x - 1, y)
	const g01 = fastGrad(perm[C], x, y - 1)
	const g11 = fastGrad(perm[D], x - 1, y - 1)

	// Improved interpolation
	const a = g00 + u * (g10 - g00)
	const b = g01 + u * (g11 - g01)
	return a + v * (b - a)
}

/**
 * Generate ASCII Perlin Plasma frame
 * Creates a character frame with Perlin noise-based brightness mapping
 */
export function generateAsciiPerlinPlasmaFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiPerlinPlasmaOptions = {}
): AnsiScreen {
	const {
		chars = DEFAULT_CHARS,
		timeScale = DEFAULT_TIME_SCALE,
		fgColor = DEFAULT_FG_COLOR,
		bgColor = DEFAULT_BG_COLOR,
		octaves = DEFAULT_OCTAVES,
		seed = 12345, // Fixed default seed for consistent patterns
	} = options

	const charCount = chars.length
	const time = frame * timeScale

	// Generate permutation table
	const perm = generatePermutation(seed)

	// Pre-compute character lookup table based on brightness
	const charLookup = new Array(256)
	for (let i = 0; i < 256; i++) {
		const normalizedValue = i / 255
		charLookup[i] = chars[Math.floor(normalizedValue * (charCount - 0.001))]
	}

	// Pre-compute octave configurations
	const octaveConfigs = octaves.map(octave => ({
		scaleX: octave.scale,
		scaleY: octave.scale,
		timeScaleX: octave.timeScaleX,
		timeScaleY: octave.timeScaleY,
		amplitude: octave.amplitude,
	}))

	// Generate screen
	const lines: AnsiScreen['lines'] = []

	for (let y = 0; y < rows; y++) {
		const line: AnsiScreen['lines'][number] = []

		for (let x = 0; x < columns; x++) {
			let value = 0

			// Combine multiple octaves of noise using pre-computed configs
			for (const octave of octaveConfigs) {
				value +=
					noise2D(
						(x + time * octave.timeScaleX) * octave.scaleX,
						(y + time * octave.timeScaleY) * octave.scaleY,
						perm
					) * octave.amplitude
			}

			// Clamp value and map to character using pre-computed lookup
			const clampedValue = value < -1 ? -1 : value > 1 ? 1 : value
			const charIndex = ((clampedValue + 1) * 127.5) | 0 // Fast conversion to 0-255 range
			const ch = charLookup[charIndex]

			// Create cell with character and CSS colors
			line.push({ ch, fg: fgColor, bg: bgColor, bold: false })
		}

		lines.push(line)
	}

	return { lines, columns }
}

/**
 * Create a reusable sampler for a specific frame and options.
 * Returns a function that maps world coordinates (x,y) in character cells
 * to an ANSI cell, without caring about any viewport/window.
 */
export function createAsciiPerlinPlasmaSampler(
	frame: number,
	options: AsciiPerlinPlasmaOptions = {}
) {
	const {
		chars = DEFAULT_CHARS,
		timeScale = DEFAULT_TIME_SCALE,
		fgColor = DEFAULT_FG_COLOR,
		bgColor = DEFAULT_BG_COLOR,
		octaves = DEFAULT_OCTAVES,
		seed = 12345,
	} = options

	const charCount = chars.length
	const time = frame * timeScale
	const perm = generatePermutation(seed)

	const charLookup = new Array(256)
	for (let i = 0; i < 256; i++) {
		const normalizedValue = i / 255
		charLookup[i] = chars[Math.floor(normalizedValue * (charCount - 0.001))]
	}

	const octaveConfigs = octaves.map(octave => ({
		scaleX: octave.scale,
		scaleY: octave.scale,
		timeScaleX: octave.timeScaleX,
		timeScaleY: octave.timeScaleY,
		amplitude: octave.amplitude,
	}))

	return (x: number, y: number) => {
		let value = 0
		for (const octave of octaveConfigs) {
			value +=
				noise2D(
					(x + time * octave.timeScaleX) * octave.scaleX,
					(y + time * octave.timeScaleY) * octave.scaleY,
					perm
				) * octave.amplitude
		}

		const clampedValue = value < -1 ? -1 : value > 1 ? 1 : value
		const charIndex = ((clampedValue + 1) * 127.5) | 0
		const ch = charLookup[charIndex]
		return { ch, fg: fgColor, bg: bgColor, bold: false }
	}
}
