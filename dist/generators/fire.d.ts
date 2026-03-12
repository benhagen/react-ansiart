import { AnsiScreen } from '../ansi/types.js';
import '../utils/sauce.js';

interface AsciiFireOptions {
    /** Array of characters to use for ASCII rendering (brightness-based) */
    chars?: string[];
    /** Constant value to subtract each frame for darkening. Default: 0.5. Higher values = faster extinguishing */
    darkenAmount?: number;
    /** Min/max palette indices for bottom row sparks (the fuel). Default: [200, 255] */
    sparkRange?: [number, number];
    /** Background color (CSS color string). Default: '#000000' (black). Accepts any valid CSS color (hex, rgb, rgba, hsl, named colors, etc.) */
    bgColor?: string;
    /** Seed for random number generation. Controls the spark pattern. Default: 12345. Use different seeds for different patterns */
    seed?: number;
    /** World height for scrollable mode (optional, used to anchor fire to bottom of page) */
    worldHeight?: number;
    /** World width for scrollable mode (optional, used to size buffer horizontally) */
    worldWidth?: number;
}
/**
 * Generate ASCII Fire frame
 * Creates a character frame with classic demo scene fire effect
 */
declare function generateAsciiFireFrame(frame: number, columns: number, rows: number, options?: AsciiFireOptions): AnsiScreen;
/**
 * Create a reusable sampler for a specific frame and options.
 * Returns a function that maps world coordinates (x,y) in character cells
 * to an ANSI cell, without caring about any viewport/window.
 *
 * Note: For fire effect, we need to maintain state across the entire virtual world.
 * This is more complex than plasma because fire has persistent state.
 */
declare function createAsciiFireSampler(frame: number, options?: AsciiFireOptions): (x: number, y: number) => {
    ch: string;
    fg: string;
    bg: string;
    bold: boolean;
};
/**
 * Clear all fire state (useful for resetting effects or when switching generators)
 */
declare function clearFireState(): void;

export { type AsciiFireOptions, clearFireState, createAsciiFireSampler, generateAsciiFireFrame };
