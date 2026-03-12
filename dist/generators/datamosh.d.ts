import { AnsiScreen } from '../ansi/types.js';
import '../utils/sauce.js';

interface AsciiDatamoshOptions {
    /** Random seed. Default: 1337 */
    seed?: number;
    /** Background color (CSS). Default: '#000000' */
    bgColor?: string;
    /** Frames between “keyframes” (full refresh). Default: 24 */
    keyframeIntervalFrames?: number;
    /** Number of corruption operations per frame. Default: 10 */
    blockOpsPerFrame?: number;
    /** Minimum block size (cells). Default: 3 */
    minBlockSize?: number;
    /** Maximum block size (cells). Default: 18 */
    maxBlockSize?: number;
    /** Maximum horizontal/vertical shift used by some ops (cells). Default: 12 */
    maxShift?: number;
    /** Chance (0..1) to apply a horizontal tear op each frame. Default: 0.5 */
    tearChance?: number;
    /** Chance (0..1) to apply a palette shift op each frame. Default: 0.65 */
    paletteShiftChance?: number;
    /** Chance (0..1) to apply a noise fill op each frame. Default: 0.35 */
    noiseFillChance?: number;
    /** Characters used for base “video” shading (dark -> bright). Default: ' ░▒▓█' */
    baseChars?: string;
    /** Characters used for noise fill. Default: '█▓▒░▀▄■□▲▼◆◇╳#@$%&*+;:,. ' */
    noiseChars?: string;
    /** If true, allow blocks/tears to wrap around edges. Default: true */
    wrap?: boolean;
}
declare function generateAsciiDatamoshFrame(frame: number, columns: number, rows: number, options?: AsciiDatamoshOptions): AnsiScreen;
/**
 * Create a sampler that returns cells from an internal “virtual” buffer.
 * This is useful for windowed/scrollable virtual worlds.
 *
 * Notes:
 * - The sampler wraps coordinates (like classic demo effects) for stability.
 * - Provide `virtualColumns` / `virtualRows` when using this for virtual worlds.
 */
declare function createAsciiDatamoshSampler(frame: number, options?: AsciiDatamoshOptions & {
    virtualColumns?: number;
    virtualRows?: number;
}): (x: number, y: number) => {
    ch: string;
    fg: string;
    bg: string;
    bold: boolean;
};
declare function clearDatamoshState(): void;

export { type AsciiDatamoshOptions, clearDatamoshState, createAsciiDatamoshSampler, generateAsciiDatamoshFrame };
