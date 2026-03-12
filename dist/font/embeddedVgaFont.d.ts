import { BitmapFont } from './bitmapFont.js';

/**
 * Returns the embedded IBM VGA 8x16 bitmap font.
 * Decodes from base64 on first call, then returns a cached singleton.
 * Fully synchronous — works in browser, SSR, and Node without fetch.
 */
declare function getEmbeddedVgaFont(): BitmapFont;

export { getEmbeddedVgaFont };
