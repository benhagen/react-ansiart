import type { AnsiScreen } from '../ansi/types'

// Default options
const DEFAULT_STARS = 200
const DEFAULT_SPEED = 0.02
const DEFAULT_FG_COLOR = '#ffffff'
const DEFAULT_BG_COLOR = '#000000'
const DEFAULT_CHARS = '·.+*#@'
const DEFAULT_SEED = 4242

export interface AsciiStarfieldOptions {
	/** Number of stars in the field. Default: 200 */
	stars?: number
	/** Speed at which stars approach the viewer per frame. Default: 0.02 */
	speed?: number
	/** Foreground color for stars (CSS color string). Default: '#ffffff' */
	fgColor?: string
	/** Background color (CSS color string). Default: '#000000' */
	bgColor?: string
	/** Characters used by depth: first char = farthest, last char = nearest. Default: '·.+*#@' */
	chars?: string
	/** Seed for deterministic random number generation. Default: 4242 */
	seed?: number
	/** Whether near stars draw streak trails. Default: true */
	streaks?: boolean
}

// Deterministic RNG
function createRandom(seed: number) {
	let state = seed >>> 0
	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0
		return state / 0xffffffff
	}
}

interface Star {
	x: number
	y: number
	z: number
}

interface StarfieldState {
	stars: Star[]
	lastFrame: number
}

// Module-level state map keyed by JSON-serialized config, capped at 32 entries with FIFO eviction
const starfieldStateMap = new Map<string, StarfieldState>()

function initStars(count: number, rng: () => number): Star[] {
	const stars: Star[] = []
	for (let i = 0; i < count; i++) {
		stars.push({
			x: rng() * 2 - 1,
			y: rng() * 2 - 1,
			z: rng(),
		})
	}
	return stars
}

function respawnStar(star: Star, rng: () => number): void {
	star.x = rng() * 2 - 1
	star.y = rng() * 2 - 1
	star.z = 1
}

/**
 * Interpolate between bgColor-derived dim gray and fgColor-derived bright white based on brightness (0..1).
 * Parses hex fgColor to extract RGB components, then scales by brightness.
 */
function brightnessToRgb(brightness: number, fgColor: string): string {
	let r = 255
	let g = 255
	let b = 255

	// Parse hex color
	if (fgColor.startsWith('#')) {
		const hex = fgColor.slice(1)
		if (hex.length === 3) {
			r = parseInt(hex[0] + hex[0], 16)
			g = parseInt(hex[1] + hex[1], 16)
			b = parseInt(hex[2] + hex[2], 16)
		} else if (hex.length === 6) {
			r = parseInt(hex.slice(0, 2), 16)
			g = parseInt(hex.slice(2, 4), 16)
			b = parseInt(hex.slice(4, 6), 16)
		}
	}

	const clamped = Math.max(0, Math.min(1, brightness))
	// Minimum brightness so far stars are still slightly visible
	const minBrightness = 0.15
	const scaled = minBrightness + clamped * (1 - minBrightness)

	return `rgb(${Math.floor(r * scaled)},${Math.floor(g * scaled)},${Math.floor(b * scaled)})`
}

/**
 * Generate ASCII Starfield frame
 * Creates a 3D starfield effect (flying through space) as a CharacterFrameGenerator
 */
export function generateAsciiStarfieldFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiStarfieldOptions = {}
): AnsiScreen {
	const {
		stars: starCount = DEFAULT_STARS,
		speed = DEFAULT_SPEED,
		fgColor = DEFAULT_FG_COLOR,
		bgColor = DEFAULT_BG_COLOR,
		chars = DEFAULT_CHARS,
		seed = DEFAULT_SEED,
		streaks = true,
	} = options

	const stateKey = JSON.stringify({ starCount, speed, seed })

	let state = starfieldStateMap.get(stateKey)
	if (!state || frame < state.lastFrame) {
		// Initialize stars with deterministic RNG from seed
		const initRng = createRandom(seed)
		const starPool = initStars(starCount, initRng)
		state = { stars: starPool, lastFrame: -1 }
		starfieldStateMap.set(stateKey, state)
		if (starfieldStateMap.size > 32) {
			const firstKey = starfieldStateMap.keys().next().value
			if (firstKey !== undefined) starfieldStateMap.delete(firstKey)
		}
	}

	const starPool = state.stars

	// Create RNG for this frame (used for respawning)
	const rng = createRandom(seed + frame * 7919)

	// Update star positions
	for (let i = 0; i < starPool.length; i++) {
		const star = starPool[i]
		star.z -= speed
		if (star.z < 0.01) {
			respawnStar(star, rng)
		}
	}

	state.lastFrame = frame

	// Build screen filled with background
	const lines: AnsiScreen['lines'] = []
	for (let y = 0; y < rows; y++) {
		const line: AnsiScreen['lines'][number] = []
		for (let x = 0; x < columns; x++) {
			line.push({ ch: ' ', fg: bgColor, bg: bgColor, bold: false })
		}
		lines.push(line)
	}

	const centerX = columns / 2
	const centerY = rows / 2
	const scale = Math.min(columns, rows) * 0.4
	const charCount = chars.length

	// Project and render stars
	for (let i = 0; i < starPool.length; i++) {
		const star = starPool[i]

		const screenX = Math.floor(centerX + (star.x / star.z) * scale)
		const screenY = Math.floor(centerY + (star.y / star.z) * scale * 0.5)

		if (screenX < 0 || screenX >= columns || screenY < 0 || screenY >= rows) {
			continue
		}

		// Depth: z goes from 1 (far) to ~0 (near)
		// brightness: near = bright, far = dim
		const brightness = 1 - star.z

		// Character index by depth: far stars use first chars, near stars use last chars
		const charIndex = Math.min(charCount - 1, Math.floor(brightness * charCount))
		const ch = chars[charIndex]

		const fg = brightnessToRgb(brightness, fgColor)

		lines[screenY][screenX] = { ch, fg, bg: bgColor, bold: brightness > 0.7 }

		// Streak effect for near stars
		if (streaks && star.z < 0.3) {
			const streakY = screenY - 1
			if (streakY >= 0 && streakY < rows) {
				const streakBrightness = brightness * 0.5
				const streakCharIndex = Math.max(0, charIndex - 1)
				const streakCh = chars[streakCharIndex]
				const streakFg = brightnessToRgb(streakBrightness, fgColor)

				// Only draw streak if the cell is still empty (background)
				if (lines[streakY][screenX].ch === ' ') {
					lines[streakY][screenX] = { ch: streakCh, fg: streakFg, bg: bgColor, bold: false }
				}
			}
		}
	}

	return { lines, columns }
}

/**
 * Create a reusable sampler for a specific frame and options.
 * Returns a function that maps world coordinates (x,y) in character cells
 * to an ANSI cell.
 */
export function createAsciiStarfieldSampler(frame: number, options: AsciiStarfieldOptions = {}) {
	const {
		stars: starCount = DEFAULT_STARS,
		speed = DEFAULT_SPEED,
		fgColor = DEFAULT_FG_COLOR,
		bgColor = DEFAULT_BG_COLOR,
		chars = DEFAULT_CHARS,
		seed = DEFAULT_SEED,
		streaks = true,
	} = options

	const stateKey = JSON.stringify({ starCount, speed, seed, sampler: true })

	let state = starfieldStateMap.get(stateKey)
	if (!state || frame < state.lastFrame) {
		const initRng = createRandom(seed)
		const starPool = initStars(starCount, initRng)
		state = { stars: starPool, lastFrame: -1 }
		starfieldStateMap.set(stateKey, state)
		if (starfieldStateMap.size > 32) {
			const firstKey = starfieldStateMap.keys().next().value
			if (firstKey !== undefined) starfieldStateMap.delete(firstKey)
		}
	}

	const starPool = state.stars

	// Only update if frame has advanced
	if (frame > state.lastFrame) {
		const rng = createRandom(seed + frame * 7919)
		for (let i = 0; i < starPool.length; i++) {
			const star = starPool[i]
			star.z -= speed
			if (star.z < 0.01) {
				respawnStar(star, rng)
			}
		}
		state.lastFrame = frame
	}

	const charCount = chars.length

	// Pre-project all stars into a sparse map for efficient lookup
	// Use a reasonable virtual viewport for projection
	const virtualCols = 200
	const virtualRows = 60
	const centerX = virtualCols / 2
	const centerY = virtualRows / 2
	const scale = Math.min(virtualCols, virtualRows) * 0.4

	interface ProjectedStar {
		ch: string
		fg: string
		bold: boolean
		isStreak?: boolean
	}

	const projected = new Map<string, ProjectedStar>()

	for (let i = 0; i < starPool.length; i++) {
		const star = starPool[i]
		const screenX = Math.floor(centerX + (star.x / star.z) * scale)
		const screenY = Math.floor(centerY + (star.y / star.z) * scale * 0.5)

		const brightness = 1 - star.z
		const charIndex = Math.min(charCount - 1, Math.floor(brightness * charCount))
		const ch = chars[charIndex]
		const fg = brightnessToRgb(brightness, fgColor)

		const key = `${screenX},${screenY}`
		projected.set(key, { ch, fg, bold: brightness > 0.7 })

		if (streaks && star.z < 0.3) {
			const streakY = screenY - 1
			const streakKey = `${screenX},${streakY}`
			if (!projected.has(streakKey)) {
				const streakBrightness = brightness * 0.5
				const streakCharIndex = Math.max(0, charIndex - 1)
				const streakCh = chars[streakCharIndex]
				const streakFg = brightnessToRgb(streakBrightness, fgColor)
				projected.set(streakKey, { ch: streakCh, fg: streakFg, bold: false, isStreak: true })
			}
		}
	}

	return (x: number, y: number) => {
		const key = `${x},${y}`
		const star = projected.get(key)
		if (star) {
			return { ch: star.ch, fg: star.fg, bg: bgColor, bold: star.bold }
		}
		return { ch: ' ', fg: bgColor, bg: bgColor, bold: false }
	}
}

/**
 * Clear all starfield state (useful for resetting effects or when switching generators)
 */
export function clearStarfieldState(): void {
	starfieldStateMap.clear()
}
