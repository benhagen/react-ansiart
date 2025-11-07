import { perlinNoise3D } from './perlin'
import type { FrameData } from './types'

/**
 * Generate a plasma effect frame using Perlin noise
 * Creates flowing, organic color patterns that animate smoothly
 */
export function generatePlasmaFrame(frame: number, width: number, height: number): FrameData {
	const pixels = new Uint8Array(width * height * 3)
	const time = frame * 0.05 // Animation speed

	// Multiple octaves of noise for richer pattern
	const octaves = [
		{ scale: 0.02, intensity: 1.0 },
		{ scale: 0.05, intensity: 0.5 },
		{ scale: 0.1, intensity: 0.25 },
	]

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			let value = 0

			// Combine multiple noise octaves for plasma pattern
			const octaves = [
				{ scale: 0.02, intensity: 1.0 },
				{ scale: 0.05, intensity: 0.5 },
				{ scale: 0.1, intensity: 0.25 },
			]

			for (const octave of octaves) {
				const nx = x * octave.scale
				const ny = y * octave.scale
				const nz = time * 0.1

				// Use multiple noise samples with different offsets for richer pattern
				const noise1 = perlinNoise3D(nx, ny, nz)
				const noise2 = perlinNoise3D(nx * 1.3 + 100, ny * 1.3 + 50, nz * 0.8)
				const noise3 = perlinNoise3D((x + y) * 0.03, (x - y) * 0.03, nz * 0.5)

				// Combine noises
				const combined = (noise1 + noise2 * 0.7 + noise3 * 0.5) / 2.2
				value += combined * octave.intensity
			}

			// Normalize value to 0-1 range (noise ranges from -1 to 1)
			// With multiple octaves, value can be outside this range, so normalize
			value = (value + 2) / 4 // Rough normalization for combined octaves
			value = Math.max(0, Math.min(1, value))

			// Convert to RGB using trigonometric functions for vibrant color cycling
			// This ensures we get full color spectrum (rainbow effect)
			const r = Math.sin(value * Math.PI * 2 + 0) * 0.5 + 0.5
			const g = Math.sin(value * Math.PI * 2 + (2 * Math.PI) / 3) * 0.5 + 0.5
			const b = Math.sin(value * Math.PI * 2 + (4 * Math.PI) / 3) * 0.5 + 0.5

			// Add some variation by mixing in a small amount of direct noise
			const noiseR = perlinNoise3D(x * 0.1, y * 0.1, time * 0.2) * 0.2
			const noiseG = perlinNoise3D(x * 0.12 + 200, y * 0.08 + 100, time * 0.15) * 0.2
			const noiseB = perlinNoise3D(x * 0.09 - 150, y * 0.11 - 50, time * 0.18) * 0.2

			// Combine color cycling with noise variation
			const finalR = Math.max(0, Math.min(1, r + noiseR))
			const finalG = Math.max(0, Math.min(1, g + noiseG))
			const finalB = Math.max(0, Math.min(1, b + noiseB))

			const index = (y * width + x) * 3
			pixels[index] = Math.floor(finalR * 255)
			pixels[index + 1] = Math.floor(finalG * 255)
			pixels[index + 2] = Math.floor(finalB * 255)
		}
	}

	return {
		width,
		height,
		pixels,
	}
}

