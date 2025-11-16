import type { AnsiCell, AnsiScreen } from './parser'
import type { FrameData } from '../types/types'
import { getPalette, rgbToPaletteColor, ANSI_COLORS_RGB, type PaletteMode } from '../utils/rgbToAnsi'

// Block characters for different brightness levels
const BLOCK_CHARS = {
	dark: ' ', // Space
	light: '\u2591', // ░ Light shade
	medium: '\u2592', // ▒ Medium shade
	heavy: '\u2593', // ▓ Heavy shade
	full: '\u2588', // █ Full block
}

/**
 * Calculate brightness from RGB (0-1)
 */
function getBrightness(r: number, g: number, b: number): number {
	// Using luminance formula
	return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/**
 * Select block character based on brightness
 */
function getBlockChar(brightness: number): string {
	if (brightness < 0.15) return BLOCK_CHARS.dark
	if (brightness < 0.35) return BLOCK_CHARS.light
	if (brightness < 0.6) return BLOCK_CHARS.medium
	if (brightness < 0.85) return BLOCK_CHARS.heavy
	return BLOCK_CHARS.full
}

/**
 * Convert FrameData to AnsiScreen
 * Downsamples RGB pixel data to character cells and selects appropriate
 * colors and block characters based on the palette mode
 */
export function convertFrameDataToAnsi(
	frame: FrameData,
	columns: number,
	rows: number,
	palette: PaletteMode = 'ansi16'
): AnsiScreen {
	const paletteColors = getPalette(palette)
	const paletteSize = paletteColors.length
	const lines: AnsiCell[][] = []

	// Calculate pixels per cell
	const pixelsPerCellX = frame.width / columns
	const pixelsPerCellY = frame.height / rows

	for (let row = 0; row < rows; row++) {
		const line: AnsiCell[] = []

		for (let col = 0; col < columns; col++) {
			// Calculate pixel bounds for this cell
			const pxStart = Math.floor(col * pixelsPerCellX)
			const pxEnd = Math.min(Math.floor((col + 1) * pixelsPerCellX), frame.width)
			const pyStart = Math.floor(row * pixelsPerCellY)
			const pyEnd = Math.min(Math.floor((row + 1) * pixelsPerCellY), frame.height)

			// Average RGB values in this cell
			let sumR = 0
			let sumG = 0
			let sumB = 0
			let pixelCount = 0

			for (let py = pyStart; py < pyEnd; py++) {
				for (let px = pxStart; px < pxEnd; px++) {
					const pixelIndex = (py * frame.width + px) * 3
					sumR += frame.pixels[pixelIndex]
					sumG += frame.pixels[pixelIndex + 1]
					sumB += frame.pixels[pixelIndex + 2]
					pixelCount++
				}
			}

			if (pixelCount === 0) {
				// Empty cell - use black background
				line.push({ ch: ' ', fg: 7, bg: 0, bold: false })
				continue
			}

			const avgR = sumR / pixelCount
			const avgG = sumG / pixelCount
			const avgB = sumB / pixelCount

			// Calculate brightness to choose block character
			const brightness = getBrightness(avgR, avgG, avgB)
			const ch = getBlockChar(brightness)

			// For custom palettes, use the palette color's RGB value to find best ANSI match
			// This ensures we use the actual palette color, not just a scaled index
			let fg: number
			let bg: number

			if (palette === 'ansi16') {
				// Original ANSI behavior - use palette index directly
				const colorIndex = rgbToPaletteColor(avgR, avgG, avgB, paletteColors)
				bg = brightness < 0.3 ? 0 : 8
				if (brightness > 0.7 && colorIndex < 8) {
					fg = colorIndex + 8 // Use bright variant
				} else {
					fg = colorIndex
				}
			} else {
				// For custom palettes, find the palette color first, then match to ANSI
				const paletteColorIndex = rgbToPaletteColor(avgR, avgG, avgB, paletteColors)
				const [paletteR, paletteG, paletteB] = paletteColors[paletteColorIndex]

				// Use the palette color's RGB to find the closest ANSI color
				// This preserves the palette color information
				const ansiMatch = rgbToPaletteColor(paletteR, paletteG, paletteB, ANSI_COLORS_RGB)

				bg = brightness < 0.3 ? 0 : 8

				// Use brightness to decide if we should use bright variant
				const paletteBrightness = getBrightness(paletteR, paletteG, paletteB)
				if (paletteBrightness > 0.6 && ansiMatch < 8) {
					fg = ansiMatch + 8 // Use bright variant
				} else {
					fg = ansiMatch
				}
			}

			line.push({ ch, fg, bg, bold: false })
		}

		lines.push(line)
	}

	return { lines, columns }
}

