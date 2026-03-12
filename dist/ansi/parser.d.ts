export { SauceMetadata, getSauceInfo, parseSauce } from '../utils/sauce.js';
import { AnsiScreen } from './types.js';
export { AnsiCell } from './types.js';

/**
 * Character encoding options for ANSI file parsing
 */
type CharacterEncoding = 'cp437' | 'cp850' | 'cp1252' | 'iso-8859-1' | 'utf-8';
/**
 * Options for unified ANSI parsing
 */
type ParseAnsiOptions = {
    /** Fixed column width (if undefined, uses dynamic column sizing) */
    columns?: number;
    /** Maximum byte index to parse (if undefined, parses all bytes) */
    maxByteIndex?: number;
    /** Character encoding to use */
    encoding?: CharacterEncoding;
};
/**
 * Unified ANSI parsing function that handles all parsing modes
 * @param bytesInput - Input bytes to parse
 * @param options - Parsing options (columns, maxByteIndex, encoding)
 * @returns Parsed ANSI screen
 */
declare function parseAnsiCore(bytesInput: Uint8Array, options?: ParseAnsiOptions): AnsiScreen;
/**
 * Parse ANSI art file with fixed column width
 * @param bytesInput - Input bytes to parse
 * @param columns - Fixed column width (default: 80)
 * @param encoding - Character encoding (default: 'cp437')
 * @returns Parsed ANSI screen
 */
declare function parseAnsi(bytesInput: Uint8Array, columns?: number, encoding?: CharacterEncoding): AnsiScreen;
/**
 * Parse ANSI incrementally up to a specific byte index
 * Used for progressive/animated rendering
 * @param bytesInput - Input bytes to parse
 * @param columns - Fixed column width
 * @param maxByteIndex - Maximum byte index to parse up to
 * @param encoding - Character encoding (default: 'cp437')
 * @returns Parsed ANSI screen
 */
declare function parseAnsiIncremental(bytesInput: Uint8Array, columns: number, maxByteIndex: number, encoding?: CharacterEncoding): AnsiScreen;
/**
 * Parse ANSI without fixed column width - allows dynamic sizing
 * Tracks maximum column and row used, returns actual dimensions
 * @param bytesInput - Input bytes to parse
 * @param encoding - Character encoding (default: 'cp437')
 * @returns Parsed ANSI screen
 */
declare function parseAnsiDynamic(bytesInput: Uint8Array, encoding?: CharacterEncoding): AnsiScreen;
/**
 * Parse ANSI incrementally without fixed column width - allows dynamic sizing during animation
 * Tracks maximum column and row seen so far, returns current state with actual dimensions
 * @param bytesInput - Input bytes to parse
 * @param maxByteIndex - Maximum byte index to parse up to
 * @param encoding - Character encoding (default: 'cp437')
 * @returns Parsed ANSI screen
 */
declare function parseAnsiIncrementalDynamic(bytesInput: Uint8Array, maxByteIndex: number, encoding?: CharacterEncoding): AnsiScreen;
/**
 * Detect if an ANSI file contains animation sequences
 * Returns true if the file appears to be animated (contains cursor positioning commands)
 */
declare function detectAnimation(bytes: Uint8Array): boolean;
/**
 * Parse plain ASCII text (no ANSI codes) into AnsiScreen format
 * Useful for simple text art files
 */
declare function parseAscii(bytes: Uint8Array, encoding?: CharacterEncoding): AnsiScreen;
/**
 * Find the next render point after a given byte index
 * Render points are:
 * - After complete escape sequences (CSI commands)
 * - After single ESC sequences
 * - After newlines/carriage returns
 * - After batches of normal characters (every N chars)
 */
declare function findNextRenderPoint(bytes: Uint8Array, startIndex: number, batchSize?: number): number;
/**
 * Find the next cursor movement in ANSI stream
 * Stops after:
 * - Cursor positioning commands: H, f, A, B, C, D, G, s, u
 * - Batch of newlines (multiple lines at once for speed)
 * - Large batch of chars (if no cursor commands found)
 * This creates more natural animation by completing "drawing strokes"
 */
declare function findNextCursorMove(bytes: Uint8Array, startIndex: number, maxCharsBeforeStop?: number, linesPerBatch?: number): number;

export { AnsiScreen, type CharacterEncoding, detectAnimation, findNextCursorMove, findNextRenderPoint, parseAnsi, parseAnsiCore, parseAnsiDynamic, parseAnsiIncremental, parseAnsiIncrementalDynamic, parseAscii };
