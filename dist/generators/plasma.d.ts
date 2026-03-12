import { AnsiScreen } from '../ansi/types.js';
import '../utils/sauce.js';

interface OctaveConfig {
    scale: number;
    amplitude: number;
    timeScaleX: number;
    timeScaleY: number;
}
interface AsciiPerlinPlasmaOptions {
    /** Array of characters to use for ASCII rendering (brightness-based) */
    chars?: string[];
    /** Animation speed multiplier. Default: 0.9. Lower = slower animation */
    timeScale?: number;
    /** Foreground color (CSS color string). Default: '#55FFFF' (bright cyan). Accepts any valid CSS color (hex, rgb, rgba, hsl, named colors, etc.) */
    fgColor?: string;
    /** Background color (CSS color string). Default: '#000000' (black). Accepts any valid CSS color (hex, rgb, rgba, hsl, named colors, etc.) */
    bgColor?: string;
    /** Noise octave configurations */
    octaves?: OctaveConfig[];
    /** Seed for noise generation. Controls the pattern shape. Default: 12345. Use different seeds for different patterns */
    seed?: number;
}
/**
 * Generate ASCII Perlin Plasma frame
 * Creates a character frame with Perlin noise-based brightness mapping
 */
declare function generateAsciiPerlinPlasmaFrame(frame: number, columns: number, rows: number, options?: AsciiPerlinPlasmaOptions): AnsiScreen;
/**
 * Create a reusable sampler for a specific frame and options.
 * Returns a function that maps world coordinates (x,y) in character cells
 * to an ANSI cell, without caring about any viewport/window.
 */
declare function createAsciiPerlinPlasmaSampler(frame: number, options?: AsciiPerlinPlasmaOptions): (x: number, y: number) => {
    ch: string;
    fg: string;
    bg: string;
    bold: boolean;
};

export { type AsciiPerlinPlasmaOptions, type OctaveConfig, createAsciiPerlinPlasmaSampler, generateAsciiPerlinPlasmaFrame };
