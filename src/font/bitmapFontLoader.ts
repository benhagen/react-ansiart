import { BitmapFont, loadRawBitmapFont } from './bitmapFont'
import { extractFontFromFON } from './fonExtractor'
import { getCachedFont, setCachedFont } from './fontCache'

/**
 * Load a bitmap font from a URL
 * Tries to extract from FON format first, falls back to raw bitmap format
 * Framework-independent - can be used in any environment
 *
 * Note: Extracted glyphs are cached in localStorage to avoid re-extraction.
 */
export async function loadBitmapFontFromUrl(bitmapFontUrl: string): Promise<BitmapFont | null> {
	// Check cache first for the final BitmapFont with extracted glyphs
	const cached = getCachedFont(bitmapFontUrl)
	if (cached) {
		console.log('[bitmapFontLoader] Using cached font for:', bitmapFontUrl)
		return cached
	}

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
			const font = { width, height, glyphs, rawBitmapData: bitmapData }
			// Cache the font with extracted glyphs
			setCachedFont(bitmapFontUrl, font)
			return font
		} else {
			// Fallback to loadRawBitmapFont if extractFontFromFON fails
			const font = await loadRawBitmapFont(bitmapFontUrl, 8, 16)
			// Cache the raw bitmap font result
			if (font) {
				setCachedFont(bitmapFontUrl, font)
			}
			return font
		}
	} catch (e: any) {
		console.warn('Failed to load bitmap font:', e)
		return null
	}
}
