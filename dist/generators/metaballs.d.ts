import { AnsiScreen } from '../ansi/types.js';
import '../utils/sauce.js';

interface AsciiMetaballsOptions {
    /** Random seed. Default: 1337 */
    seed?: number;
    /** Foreground color (CSS). Default: '#55FFFF' */
    fgColor?: string;
    /** Background color (CSS). Default: '#000000' */
    bgColor?: string;
    /** Characters to use for shading (dark -> bright). Default: ' .,:;+=xX$&#@' */
    chars?: string[];
    /** Number of metaballs. Default: 6 */
    balls?: number;
    /** Animation speed multiplier (frame -> time). Default: 0.085 */
    speed?: number;
    /** Minimum metaball radius (cells). Default: 2.5 */
    radiusMin?: number;
    /** Maximum metaball radius (cells). Default: 9.5 */
    radiusMax?: number;
    /** Normalization intensity (k) used in `1 - exp(-k * F)`. Default: 0.55 */
    intensity?: number;
    /** Vertical aspect scale (text cells are taller than wide). Default: 2 */
    aspectY?: number;
}
declare function generateAsciiMetaballsFrame(frame: number, columns: number, rows: number, options?: AsciiMetaballsOptions): AnsiScreen;
declare function createAsciiMetaballsSampler(frame: number, options?: AsciiMetaballsOptions): (x: number, y: number) => {
    ch: string;
    fg: string;
    bg: string;
    bold: boolean;
};

export { type AsciiMetaballsOptions, createAsciiMetaballsSampler, generateAsciiMetaballsFrame };
