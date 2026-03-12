import { AnsiScreen } from '../ansi/types.js';
import '../utils/sauce.js';

interface AsciiSonarOptions {
    /** Pulses per second. Default: 0.9 */
    frequency?: number;
    /** Overall ripple strength. Default: 1.0 */
    intensity?: number;
    /** Frames per second used to convert frame->seconds. Default: 30 */
    fps?: number;
    /** Foreground base color (RGB); alpha is applied per-cell. Default: '#ffffff' */
    fgColor?: string;
    /** Background color for all cells. Default: '#000000' */
    bgColor?: string;
    /** Dot character to draw everywhere. Default: '.' */
    dotChar?: string;
    /** Ring expansion speed in character-cells per second. Default: 14 */
    speed?: number;
    /** Ring band width in character-cells (gaussian sigma-ish). Default: 1.25 */
    bandWidth?: number;
    /** Exponential decay per second applied to older rings. Default: 0.75 */
    decay?: number;
    /** Minimum alpha added everywhere (ambient). Default: 0.03 */
    baseAlpha?: number;
    /** Quantize alpha into N steps to avoid exploding glyph cache. Default: 32 */
    alphaSteps?: number;
    /** Center X in cell coordinates (0..columns-1). Default: (columns-1)/2 */
    centerX?: number;
    /** Center Y in cell coordinates (0..rows-1). Default: (rows-1)/2 */
    centerY?: number;
    /** Vertical aspect scale (text cells are taller than wide). Default: 2 */
    aspectY?: number;
    /** Maximum number of active rings to sum (performance cap). Default: 24 */
    maxRings?: number;
}
declare function generateAsciiSonarFrame(frame: number, columns: number, rows: number, options?: AsciiSonarOptions): AnsiScreen;
declare function createAsciiSonarSampler(frame: number, options?: AsciiSonarOptions): (x: number, y: number) => {
    ch: string;
    fg: string;
    bg: string;
    bold: boolean;
};

export { type AsciiSonarOptions, createAsciiSonarSampler, generateAsciiSonarFrame };
