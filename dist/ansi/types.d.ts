import { SauceMetadata } from '../utils/sauce.js';

/**
 * Represents a single character cell in an ANSI screen
 */
type AnsiCell = {
    /** Character to display */
    ch: string;
    /** Foreground color: ANSI color index (0-15) or CSS color string (e.g., "rgb(255, 0, 0)") */
    fg: number | string;
    /** Background color: ANSI color index (0-15) or CSS color string (e.g., "rgb(0, 0, 0)") */
    bg: number | string;
    /** Whether the character is bold */
    bold: boolean;
};
/**
 * Complete ANSI screen representation
 */
type AnsiScreen = {
    /** Two-dimensional array of character cells: lines[row][column] */
    lines: AnsiCell[][];
    /** Number of columns (character width) */
    columns: number;
    /** Optional SAUCE metadata if present in the file */
    sauce?: SauceMetadata;
};

export type { AnsiCell, AnsiScreen };
