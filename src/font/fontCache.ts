// Font cache utility for localStorage-based caching of extracted bitmap fonts
// Caches extracted glyphs to avoid re-extracting fonts on every load

import type { BitmapFont } from './bitmapFont'

const CACHE_PREFIX = 'react-ansiart:font:'
const CACHE_VERSION = '1' // For future cache invalidation

type CachedFontData = {
	glyphs: string[] // base64 encoded Uint8Array for each glyph (256 glyphs)
	rawBitmapData?: string // base64 encoded Uint8Array (optional, for debugging)
	width: number
	height: number
	version: string
}

/**
 * Get cached bitmap font from localStorage
 * @param url Font URL to look up in cache
 * @returns Cached bitmap font, or null if not found or error
 */
export function getCachedFont(url: string): BitmapFont | null {
	if (typeof window === 'undefined' || !window.localStorage) {
		return null
	}

	try {
		const cacheKey = `${CACHE_PREFIX}${encodeURIComponent(url)}`
		const cached = window.localStorage.getItem(cacheKey)

		if (!cached) {
			return null
		}

		const data: CachedFontData = JSON.parse(cached)

		// Check version for future cache invalidation
		if (data.version !== CACHE_VERSION) {
			// Version mismatch - clear this cache entry
			window.localStorage.removeItem(cacheKey)
			return null
		}

		// Deserialize glyphs array (256 base64 strings to Uint8Arrays)
		const glyphs = data.glyphs.map(base64 => base64ToUint8Array(base64))

		// Deserialize optional rawBitmapData
		const rawBitmapData = data.rawBitmapData ? base64ToUint8Array(data.rawBitmapData) : undefined

		return {
			width: data.width,
			height: data.height,
			glyphs,
			rawBitmapData,
			// Don't restore glyphCache - it's runtime-only
		}
	} catch (e) {
		// If anything goes wrong (parse error, corrupted data, etc.), return null
		console.warn('[fontCache] Failed to read cached font:', e)
		return null
	}
}

/**
 * Store bitmap font in localStorage cache
 * @param url Font URL to use as cache key
 * @param font BitmapFont object to cache
 */
export function setCachedFont(url: string, font: BitmapFont): void {
	if (typeof window === 'undefined' || !window.localStorage) {
		return
	}

	try {
		const cacheKey = `${CACHE_PREFIX}${encodeURIComponent(url)}`

		// Serialize glyphs array to base64 strings (256 glyphs)
		const glyphsBase64 = font.glyphs.map(glyph => uint8ArrayToBase64(glyph))

		// Serialize optional rawBitmapData
		const rawBitmapDataBase64 = font.rawBitmapData
			? uint8ArrayToBase64(font.rawBitmapData)
			: undefined

		const data: CachedFontData = {
			glyphs: glyphsBase64,
			rawBitmapData: rawBitmapDataBase64,
			width: font.width,
			height: font.height,
			version: CACHE_VERSION,
		}

		window.localStorage.setItem(cacheKey, JSON.stringify(data))
	} catch (e: any) {
		// Handle quota exceeded or other storage errors gracefully
		if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
			console.warn('[fontCache] localStorage quota exceeded, cannot cache font')
		} else {
			console.warn('[fontCache] Failed to cache font:', e)
		}
		// Silently fail - don't break font loading if caching fails
	}
}

/**
 * Clear font cache
 * @param url Optional specific URL to clear, or undefined to clear all font caches
 */
export function clearFontCache(url?: string): void {
	if (typeof window === 'undefined' || !window.localStorage) {
		return
	}

	try {
		if (url) {
			// Clear specific URL
			const cacheKey = `${CACHE_PREFIX}${encodeURIComponent(url)}`
			window.localStorage.removeItem(cacheKey)
		} else {
			// Clear all font caches
			const keysToRemove: string[] = []
			for (let i = 0; i < window.localStorage.length; i++) {
				const key = window.localStorage.key(i)
				if (key && key.startsWith(CACHE_PREFIX)) {
					keysToRemove.push(key)
				}
			}
			keysToRemove.forEach(key => window.localStorage.removeItem(key))
		}
	} catch (e) {
		console.warn('[fontCache] Failed to clear cache:', e)
	}
}

/**
 * Convert Uint8Array to base64 string for localStorage storage
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
	// Use browser's built-in btoa if available
	if (typeof btoa !== 'undefined') {
		// Convert to binary string first
		let binary = ''
		for (let i = 0; i < bytes.length; i++) {
			binary += String.fromCharCode(bytes[i])
		}
		return btoa(binary)
	}

	// Fallback for Node.js environments (though this is primarily browser code)
	// In practice, this shouldn't be needed for React components
	throw new Error('btoa not available - cannot serialize font data')
}

/**
 * Convert base64 string back to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
	// Use browser's built-in atob if available
	if (typeof atob !== 'undefined') {
		const binary = atob(base64)
		const bytes = new Uint8Array(binary.length)
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i)
		}
		return bytes
	}

	// Fallback for Node.js environments
	throw new Error('atob not available - cannot deserialize font data')
}
