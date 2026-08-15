// ANSI 16-color palette (VGA colors)
export const ANSI_COLORS_RGB: Array<[number, number, number]> = [
	[0, 0, 0], // 0: Black
	[0, 0, 170], // 1: Blue
	[0, 170, 0], // 2: Green
	[0, 170, 170], // 3: Cyan
	[170, 0, 0], // 4: Red
	[170, 0, 170], // 5: Magenta
	[170, 85, 0], // 6: Brown
	[170, 170, 170], // 7: Light Gray
	[85, 85, 85], // 8: Dark Gray
	[85, 85, 255], // 9: Bright Blue
	[85, 255, 85], // 10: Bright Green
	[85, 255, 255], // 11: Bright Cyan
	[255, 85, 85], // 12: Bright Red
	[255, 85, 255], // 13: Bright Magenta
	[255, 255, 85], // 14: Yellow
	[255, 255, 255], // 15: White
]

/**
 * Calculate squared Euclidean distance between two RGB colors.
 * Avoids the sqrt() call — squared distance is monotone with true distance,
 * so it's equivalent for finding the argmin (closest color).
 */
function rgbDistanceSquared(
	r1: number,
	g1: number,
	b1: number,
	r2: number,
	g2: number,
	b2: number
): number {
	const dr = r1 - r2
	const dg = g1 - g2
	const db = b1 - b2
	return dr * dr + dg * dg + db * db
}

/**
 * Generate evenly spaced colors across the RGB spectrum
 * Uses a cube root distribution for more perceptually uniform colors
 */
export function generateEvenlySpacedPalette(size: number): Array<[number, number, number]> {
	if (size === 1) {
		return [[128, 128, 128]]
	}

	if (size > 16) {
		// Use HSV space for better perceptual coverage
		const palette: Array<[number, number, number]> = []
		const hueSteps = Math.ceil(Math.sqrt(size))
		const satSteps = Math.ceil(Math.sqrt(size))
		const valSteps = Math.ceil(size / (hueSteps * satSteps))

		for (let i = 0; i < size; i++) {
			const hueIdx = i % hueSteps
			const satIdx = Math.floor(i / hueSteps) % satSteps
			const valIdx = Math.floor(i / (hueSteps * satSteps))

			const hue = (hueIdx / hueSteps) * 360
			const saturation = 0.3 + (satIdx / satSteps) * 0.7
			const value = 0.2 + (valIdx / valSteps) * 0.8

			const [r, g, b] = hsvToRgb(hue, Math.min(1, saturation), Math.min(1, value))
			palette.push([r, g, b])
		}
		return palette
	}

	// For small palettes (≤16), use RGB cube distribution
	const palette: Array<[number, number, number]> = []
	const cubeRoot = Math.cbrt(size)
	const steps = Math.ceil(cubeRoot)

	for (let i = 0; i < size; i++) {
		const r = Math.floor((i % steps) * (255 / (steps - 1)))
		const g = Math.floor(Math.floor(i / steps) % steps * (255 / (steps - 1)))
		const b = Math.floor(Math.floor(i / (steps * steps)) * (255 / (steps - 1)))
		palette.push([r, g, b])
	}

	return palette
}

/**
 * Convert HSV to RGB
 */
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
	const c = v * s
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
	const m = v - c

	let r = 0,
		g = 0,
		b = 0

	if (h >= 0 && h < 60) {
		r = c
		g = x
		b = 0
	} else if (h >= 60 && h < 120) {
		r = x
		g = c
		b = 0
	} else if (h >= 120 && h < 180) {
		r = 0
		g = c
		b = x
	} else if (h >= 180 && h < 240) {
		r = 0
		g = x
		b = c
	} else if (h >= 240 && h < 300) {
		r = x
		g = 0
		b = c
	} else if (h >= 300 && h < 360) {
		r = c
		g = 0
		b = x
	}

	return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

export type PaletteMode = 'ansi16' | 'unconstrained' | number

// Palettes are deterministic given `mode`, but generation (256 hsvToRgb calls +
// tuple allocations) is not free and callers (frameToAnsi/shapeAsciiConverter)
// invoke getPalette() once per frame. Memoize by mode so the same immutable
// array instance is reused. Bounded defensively — modes seen in practice are a
// small, fixed set ('ansi16' short-circuits below, 'unconstrained', or a handful
// of custom sizes), but we cap insertion so a pathological caller passing many
// distinct numeric sizes can't grow this without bound.
const PALETTE_CACHE_MAX = 64
const paletteCache = new Map<PaletteMode, Array<[number, number, number]>>()

/**
 * Get color palette based on mode
 */
export function getPalette(mode: PaletteMode): Array<[number, number, number]> {
	if (mode === 'ansi16') {
		return ANSI_COLORS_RGB
	}

	const cached = paletteCache.get(mode)
	if (cached) return cached

	// Use 256 colors for unconstrained mode (full 8-bit palette approximation),
	// otherwise a custom palette size.
	const palette = mode === 'unconstrained' ? generateEvenlySpacedPalette(256) : generateEvenlySpacedPalette(mode)

	if (paletteCache.size < PALETTE_CACHE_MAX) {
		paletteCache.set(mode, palette)
	}

	return palette
}

// Memoized nearest-color lookups, scoped per palette array instance via WeakMap
// so distinct palettes (e.g. ANSI_COLORS_RGB vs a generated unconstrained
// palette) never collide, and caches for palettes that fall out of use can be
// garbage collected. Each palette's cache is additionally size-capped (same
// "stop inserting past the cap" pattern used by the shape converter's
// lookupCache and the bitmap font's glyph cache) so continuously-varying input
// (e.g. video-like feeds) can't grow it without bound.
//
// NOTE on the key: an earlier version of this cache quantized (r,g,b) to an
// integer-rounded 24-bit key. That was measured (see task report) to change
// output at exact tie/near-tie boundaries between palette entries — two raw
// inputs that round to the same key can legitimately have different nearest
// palette entries, since the un-cached scan breaks ties by first-index-wins
// on the *exact* float distance. That's a real, if rare, output difference,
// which the task requires we not introduce. The key below is therefore exact
// (no rounding) — same string-keyed-by-exact-inputs pattern already used by
// the bitmap font's glyph cache (`${charCode}:${fgColor}:${bgColor}`) — so a
// cache hit only ever occurs for a bit-for-bit-identical input, which by
// construction returns exactly what a fresh computation would. This still
// captures the common case well: solid/flat color regions and repeated
// frames produce the exact same averaged float repeatedly.
const RGB_LOOKUP_CACHE_MAX = 65536
const rgbLookupCaches = new WeakMap<Array<[number, number, number]>, Map<string, number>>()

/**
 * Convert RGB color to closest color index in the given palette
 */
export function rgbToPaletteColor(
	r: number,
	g: number,
	b: number,
	palette: Array<[number, number, number]>
): number {
	let cache = rgbLookupCaches.get(palette)
	if (!cache) {
		cache = new Map()
		rgbLookupCaches.set(palette, cache)
	}

	const key = r + ':' + g + ':' + b
	const cached = cache.get(key)
	if (cached !== undefined) return cached

	const closestIndex = findClosestPaletteIndex(r, g, b, palette)
	if (cache.size < RGB_LOOKUP_CACHE_MAX) {
		cache.set(key, closestIndex)
	}
	return closestIndex
}

/**
 * Linear scan for the closest palette entry using squared distance (no sqrt —
 * monotone with true distance, so the argmin is identical).
 */
function findClosestPaletteIndex(
	r: number,
	g: number,
	b: number,
	palette: Array<[number, number, number]>
): number {
	let minDistance = Infinity
	let closestIndex = 0

	for (let i = 0; i < palette.length; i++) {
		const entry = palette[i]
		const distance = rgbDistanceSquared(r, g, b, entry[0], entry[1], entry[2])
		if (distance < minDistance) {
			minDistance = distance
			closestIndex = i
		}
	}

	return closestIndex
}

/**
 * Convert RGB color to closest ANSI 16-color palette index (0-15)
 */
export function rgbToAnsiColor(r: number, g: number, b: number): number {
	return rgbToPaletteColor(r, g, b, ANSI_COLORS_RGB)
}

