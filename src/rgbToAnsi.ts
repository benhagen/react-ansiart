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
 * Calculate Euclidean distance between two RGB colors
 */
function rgbDistance(
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
	return Math.sqrt(dr * dr + dg * dg + db * db)
}

/**
 * Generate evenly spaced colors across the RGB spectrum
 * Uses a cube root distribution for more perceptually uniform colors
 */
export function generateEvenlySpacedPalette(size: number): Array<[number, number, number]> {
	const palette: Array<[number, number, number]> = []

	if (size === 1) {
		return [[128, 128, 128]]
	}

	// Calculate cube root for 3D distribution
	const cubeRoot = Math.cbrt(size)
	const steps = Math.ceil(cubeRoot)

	for (let i = 0; i < size; i++) {
		// Distribute colors across RGB cube
		const r = Math.floor((i % steps) * (255 / (steps - 1)))
		const g = Math.floor(Math.floor(i / steps) % steps * (255 / (steps - 1)))
		const b = Math.floor(Math.floor(i / (steps * steps)) * (255 / (steps - 1)))

		palette.push([r, g, b])
	}

	// For better distribution, use a more sophisticated method
	// Generate colors using HSV space for better coverage
	if (size > 16) {
		const newPalette: Array<[number, number, number]> = []

		// Calculate dimensions for a 3D color space distribution
		const hueSteps = Math.ceil(Math.sqrt(size))
		const satSteps = Math.ceil(Math.sqrt(size))
		const valSteps = Math.ceil(size / (hueSteps * satSteps))

		for (let i = 0; i < size; i++) {
			// Distribute across hue (0-360), saturation (0.3-1.0), and value (0.2-1.0)
			const hueIdx = i % hueSteps
			const satIdx = Math.floor(i / hueSteps) % satSteps
			const valIdx = Math.floor(i / (hueSteps * satSteps))

			const hue = (hueIdx / hueSteps) * 360
			const saturation = 0.3 + (satIdx / satSteps) * 0.7 // Range: 0.3 to 1.0
			const value = 0.2 + (valIdx / valSteps) * 0.8 // Range: 0.2 to 1.0

			const [r, g, b] = hsvToRgb(hue, Math.min(1, saturation), Math.min(1, value))
			newPalette.push([r, g, b])
		}
		return newPalette
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

/**
 * Get color palette based on mode
 */
export function getPalette(mode: PaletteMode): Array<[number, number, number]> {
	if (mode === 'ansi16') {
		return ANSI_COLORS_RGB
	} else if (mode === 'unconstrained') {
		// Use 256 colors for unconstrained mode (full 8-bit palette approximation)
		return generateEvenlySpacedPalette(256)
	} else {
		// Custom palette size
		return generateEvenlySpacedPalette(mode)
	}
}

/**
 * Convert RGB color to closest color index in the given palette
 */
export function rgbToPaletteColor(
	r: number,
	g: number,
	b: number,
	palette: Array<[number, number, number]>
): number {
	let minDistance = Infinity
	let closestIndex = 0

	for (let i = 0; i < palette.length; i++) {
		const [ar, ag, ab] = palette[i]
		const distance = rgbDistance(r, g, b, ar, ag, ab)
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

