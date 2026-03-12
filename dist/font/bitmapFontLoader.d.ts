import { BitmapFont } from './bitmapFont.js';

/**
 * Load a bitmap font from a URL
 * Tries to extract from FON format first, falls back to raw bitmap format
 * Framework-independent - can be used in any environment
 *
 * Note: Extracted glyphs are cached in localStorage to avoid re-extraction.
 */
declare function loadBitmapFontFromUrl(bitmapFontUrl: string): Promise<BitmapFont | null>;

export { loadBitmapFontFromUrl };
