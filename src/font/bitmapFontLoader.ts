import { BitmapFont, loadRawBitmapFont } from './bitmapFont'
import { extractFontFromFON } from './fonExtractor'

/**
 * Load a bitmap font from a URL
 * Tries to extract from FON format first, falls back to raw bitmap format
 * Framework-independent - can be used in any environment
 */
export async function loadBitmapFontFromUrl(bitmapFontUrl: string): Promise<BitmapFont | null> {
	try {
		// Try extracting from FON file first
		const fontResult = await extractFontFromFON(bitmapFontUrl)

		if (fontResult) {
			const { bitmapData, width, height } = fontResult
			const bytesPerGlyph = height
			const glyphs: Uint8Array[] = []
			for (let i = 0; i < 256; i++) {
				glyphs.push(bitmapData.slice(i * bytesPerGlyph, (i + 1) * bytesPerGlyph))
			}
			return { width, height, glyphs, rawBitmapData: bitmapData }
		} else {
			// Fallback to loadRawBitmapFont if extractFontFromFON fails
			const font = await loadRawBitmapFont(bitmapFontUrl, 8, 16)
			return font
		}
	} catch (e: any) {
		console.warn('Failed to load bitmap font:', e)
		return null
	}
}

