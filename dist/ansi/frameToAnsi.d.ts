import { AnsiScreen } from './types.js';
import { FrameData } from '../types/types.js';
import { PaletteMode } from '../utils/rgbToAnsi.js';
import '../utils/sauce.js';

/**
 * Convert FrameData to AnsiScreen
 * Downsamples RGB pixel data to character cells and selects appropriate
 * colors and block characters based on the palette mode
 */
declare function convertFrameDataToAnsi(frame: FrameData, columns: number, rows: number, palette?: PaletteMode): AnsiScreen;

export { convertFrameDataToAnsi };
