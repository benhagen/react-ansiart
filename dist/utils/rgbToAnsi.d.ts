declare const ANSI_COLORS_RGB: Array<[number, number, number]>;
/**
 * Generate evenly spaced colors across the RGB spectrum
 * Uses a cube root distribution for more perceptually uniform colors
 */
declare function generateEvenlySpacedPalette(size: number): Array<[number, number, number]>;
type PaletteMode = 'ansi16' | 'unconstrained' | number;
/**
 * Get color palette based on mode
 */
declare function getPalette(mode: PaletteMode): Array<[number, number, number]>;
/**
 * Convert RGB color to closest color index in the given palette
 */
declare function rgbToPaletteColor(r: number, g: number, b: number, palette: Array<[number, number, number]>): number;
/**
 * Convert RGB color to closest ANSI 16-color palette index (0-15)
 */
declare function rgbToAnsiColor(r: number, g: number, b: number): number;

export { ANSI_COLORS_RGB, type PaletteMode, generateEvenlySpacedPalette, getPalette, rgbToAnsiColor, rgbToPaletteColor };
