import type { AnsiScreen } from '../ansi/types'

// Density ramp, ordered strictly densest-to-lightest by measured ink coverage in the
// VGA 8x16 font: Q=50 lit pixels of 128, down through '.'=4, to space=0.
//
// The previous ramp placed 'ù'/'ú' (35 lit pixels) *after* ':'/',' (8), so perceived
// brightness rose again just before the blank end of the ramp. On screen that drew a
// bright band along the edge of every dark region and then cut to nothing, which is
// the opposite of a fade. It also spent 6 of its 20 entries on space and another 6 on
// glyphs the value distribution never reaches (see NOISE_CONTRAST).
// Exported for the colocated test to assert ramp ordering; not re-exported from index.ts,
// so it stays out of the public API.
export const DEFAULT_CHARS = ['Q', '@', '0', 'A', '2', 'C', '*', '(', '+', ';', ':', '.', ' ']

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

// Cache permutation tables by seed to avoid regenerating every frame
const permutationCache = new Map<number, Uint8Array>()

function getCachedPermutation(seed: number): Uint8Array {
	const cached = permutationCache.get(seed)
	if (cached) return cached
	const perm = generatePermutation(seed)
	permutationCache.set(seed, perm)
	// Limit cache size
	if (permutationCache.size > 16) {
		const firstKey = permutationCache.keys().next().value
		if (firstKey !== undefined) permutationCache.delete(firstKey)
	}
	return perm
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

/**
 * Contrast applied when spreading the octave sum across the character ramp.
 *
 * The sum of Perlin octaves is bell-distributed about zero, not uniform over [-1,1]:
 * for the default octaves it measures mean 0.04, sd 0.20, with p1..p99 covering only
 * ~46% of [-1,1] and nothing ever reaching the clamp. Indexing the ramp linearly off
 * that value therefore left more than half of *any* supplied ramp unreachable and
 * piled ~44% of cells onto two adjacent entries — the real reason transitions looked
 * chunky and dark areas read as flat.
 *
 * tanh widens the used range while staying monotonic and never hard-clamping, so the
 * tails compress smoothly instead of terminating at a cliff. 3 spreads the default
 * octaves across the full ramp; raise it for more contrast, lower it for a flatter,
 * dimmer field.
 */
const NOISE_CONTRAST = 3

/**
 * Plasma's own 256-entry lookup: identical in shape to the shared buildCharLookup,
 * but with the contrast curve baked into the table rather than applied per cell, so
 * the spread costs nothing at render time (one array index, exactly as before).
 *
 * Deliberately not folded into the shared helper — the curve corrects for *this*
 * generator's value distribution, and the other 13 callers have their own.
 */
function buildPlasmaCharLookup(chars: string[]): string[] {
	const charCount = chars.length
	const lookup = new Array<string>(256)
	for (let i = 0; i < 256; i++) {
		// Invert the value quantisation in the render loop: value = i / 127.5 - 1.
		const spread = Math.tanh((i / 127.5 - 1) * NOISE_CONTRAST)
		const t = (spread + 1) / 2
		lookup[i] = chars[Math.floor(t * (charCount - 0.001))]
	}
	return lookup
}

// Memoized char lookup table (like asciiFireGenerator's getFireCharLookup) — the table
// was being rebuilt every frame even though chars is constant per generator instance.
let lastPlasmaChars: string[] | null = null
let lastPlasmaCharLookup: string[] | null = null

function getPlasmaCharLookup(chars: string[]): string[] {
	if (lastPlasmaChars === chars && lastPlasmaCharLookup) return lastPlasmaCharLookup
	lastPlasmaCharLookup = buildPlasmaCharLookup(chars)
	lastPlasmaChars = chars
	return lastPlasmaCharLookup
}

// Memoize octave configs to avoid re-creating array of objects every frame
let lastOctaveInput: OctaveConfig[] | null = null
let lastOctaveConfigs: Array<{ scaleX: number; scaleY: number; timeScaleX: number; timeScaleY: number; amplitude: number }> | null = null

function getCachedOctaveConfigs(octaves: OctaveConfig[]) {
	if (lastOctaveInput === octaves && lastOctaveConfigs) return lastOctaveConfigs
	lastOctaveConfigs = octaves.map(o => ({
		scaleX: o.scale,
		scaleY: o.scale,
		timeScaleX: o.timeScaleX,
		timeScaleY: o.timeScaleY,
		amplitude: o.amplitude,
	}))
	lastOctaveInput = octaves
	return lastOctaveConfigs
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

	const time = frame * timeScale

	// Use cached permutation table and octave configs
	const perm = getCachedPermutation(seed)
	const charLookup = getPlasmaCharLookup(chars)
	const octaveConfigs = getCachedOctaveConfigs(octaves)

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

	const time = frame * timeScale
	const perm = getCachedPermutation(seed)
	const charLookup = getPlasmaCharLookup(chars)
	const octaveConfigs = getCachedOctaveConfigs(octaves)

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
