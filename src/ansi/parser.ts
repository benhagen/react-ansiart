import { cp437ByteToChar } from '../utils/cp437'
import {
	isSauceTrailer,
	parseSauce,
	getSauceInfo,
	SAUCE_TRAILER_SIZE,
	SAUCE_EOF,
	COMMENT_ID_SIZE,
	COMMENT_SIZE,
	type SauceMetadata,
} from '../utils/sauce'
import type { AnsiCell, AnsiScreen } from './types'

// Re-export types for backward compatibility
export type { SauceMetadata }
export type { AnsiCell, AnsiScreen }
export { parseSauce, getSauceInfo }

// ============================================================================
// Types
// ============================================================================

/**
 * Character encoding options for ANSI file parsing
 */
export type CharacterEncoding = 'cp437' | 'cp850' | 'cp1252' | 'iso-8859-1' | 'utf-8'


/**
 * Cursor position in the ANSI screen
 */
type Cursor = {
	/** Row (line) index, 0-based */
	row: number
	/** Column index, 0-based */
	col: number
}

/**
 * Internal parser state maintained during ANSI parsing
 */
type ParserState = {
	/** Output lines being built */
	lines: AnsiCell[][]
	/** Current cursor position */
	cur: Cursor
	/** Saved cursor position (for save/restore operations) */
	savedCur: Cursor
	/** Current foreground color */
	fg: number | string
	/** Current background color */
	bg: number | string
	/** Current bold attribute */
	bold: boolean
	/** Whether line wrapping is enabled */
	lineWrap: boolean
	/** Whether iCE color mode is enabled */
	iceColors: boolean
	/** Fixed column width (undefined in dynamic mode) */
	columns?: number
	/** Maximum column seen (used in dynamic mode) */
	maxCol?: number
	/** Whether parser is in dynamic column sizing mode */
	isDynamic?: boolean
}

/**
 * Context object passed to CSI command handlers
 */
type CsiHandlerContext = {
	/** Parser state (can be mutated by handlers) */
	state: ParserState
	/** Parsed CSI parameters */
	params: number[]
	/** Helper to get parameter with default value */
	get: (idx: number, def: number) => number
	/** Column width (for fixed-width mode) */
	columns: number
	/** Function to ensure current row exists in lines array */
	ensureRow: () => void
}

/**
 * CSI (Control Sequence Introducer) command handler function
 */
type CsiHandler = (ctx: CsiHandlerContext) => void

// ============================================================================
// Constants
// ============================================================================

// Control characters
const ESC = 0x1b
const CSI_BRACKET = 0x5b // '['
const SOFT_EOF = 0x1a
const LF = 0x0a
const CR = 0x0d


// ANSI parameter parsing
const DIGIT_MIN = 0x30 // '0'
const DIGIT_MAX = 0x39 // '9'
const PARAMETER_BYTE_MIN = 0x30
const PARAMETER_BYTE_MAX = 0x3f
const SEMICOLON = 0x3b
const SPACE = 0x20
const QUESTION_MARK = 0x3f
const MAX_CSI_PARAMS = 64

// ANSI color codes
const ANSI_RESET = 0
const ANSI_BOLD = 1
const ANSI_BOLD_OFF = 22
const ANSI_REVERSE_VIDEO = 7
const ANSI_REVERSE_VIDEO_OFF = 27
const ANSI_BLINK_OFF = 25
const ANSI_FG_DEFAULT = 39
const ANSI_BG_DEFAULT = 49
const ANSI_FG_BASE_MIN = 30
const ANSI_FG_BASE_MAX = 37
const ANSI_BG_BASE_MIN = 40
const ANSI_BG_BASE_MAX = 47
const ANSI_FG_BRIGHT_MIN = 90
const ANSI_FG_BRIGHT_MAX = 97
const ANSI_BG_BRIGHT_MIN = 100
const ANSI_BG_BRIGHT_MAX = 107

// ANSI base colors (30-37) order: black, red, green, yellow, blue, magenta, cyan, white
// Map to DOS palette indices order: 0:black, 1:blue, 2:green, 3:cyan, 4:red, 5:magenta, 6:brown, 7:light gray
const ANSI_TO_DOS: number[] = [0, 4, 2, 6, 1, 5, 3, 7]

// Default values
const DEFAULT_FG = 7
const DEFAULT_BG = 0
const DEFAULT_COLUMNS = 80

// CSI command characters
const CSI_CMD_CURSOR_UP = 'A'
const CSI_CMD_CURSOR_DOWN = 'B'
const CSI_CMD_CURSOR_FORWARD = 'C'
const CSI_CMD_CURSOR_BACK = 'D'
const CSI_CMD_CURSOR_NEXT_LINE = 'E'
const CSI_CMD_CURSOR_PREV_LINE = 'F'
const CSI_CMD_CURSOR_HORIZONTAL_ABS = 'G'
const CSI_CMD_CURSOR_POSITION = 'H'
const CSI_CMD_CURSOR_POSITION_ALT = 'f'
const CSI_CMD_CURSOR_SAVE = 's'
const CSI_CMD_CURSOR_RESTORE = 'u'
const CSI_CMD_ERASE_LINE = 'K'
const CSI_CMD_ERASE_DISPLAY = 'J'
const CSI_CMD_SCROLL_UP = 'S'
const CSI_CMD_SCROLL_DOWN = 'T'
const CSI_CMD_SGR = 'm'
const CSI_CMD_ICE_COLOR = 't'
const CSI_CMD_SET_MODE = 'h'
const CSI_CMD_RESET_MODE = 'l'

// Mode parameters
const MODE_LINE_WRAP = 7
const MODE_ICE_COLORS = 33

// Letter detection
const LETTER_UPPER_MIN = 0x41 // 'A'
const LETTER_UPPER_MAX = 0x5a // 'Z'
const LETTER_LOWER_MIN = 0x61 // 'a'
const LETTER_LOWER_MAX = 0x7a // 'z'

// Valid CSI command characters
const VALID_CSI_COMMANDS = 'ABCDEFGHIJKLMPSTXYZhfmlrmsu'

// ============================================================================
// Core Helpers
// ============================================================================

/**
 * Convert a byte to a character using the specified encoding
 */
function byteToChar(byte: number, encoding: CharacterEncoding = 'cp437'): string {
	switch (encoding) {
		case 'cp437':
			return cp437ByteToChar(byte)
		case 'cp850':
		case 'cp1252':
		case 'iso-8859-1':
			// For these encodings, most characters above 127 are similar to CP437
			// For a full implementation, we'd need proper encoding tables
			if (byte < 128) {
				return String.fromCharCode(byte)
			} else {
				// Fallback to CP437 for extended characters
				return cp437ByteToChar(byte)
			}
		case 'utf-8':
			// For UTF-8, we need to handle multi-byte sequences
			// For now, treat as single bytes (not proper UTF-8 handling)
			return String.fromCharCode(byte)
		default:
			return cp437ByteToChar(byte)
	}
}

function createCell(fg: number | string, bg: number | string, bold: boolean): AnsiCell {
	return { ch: ' ', fg, bg, bold }
}

// Reusable default cell for optimization
const DEFAULT_CELL = createCell(DEFAULT_FG, DEFAULT_BG, false)

// Helper function to create empty line with pre-allocated cells
function createEmptyLine(columns: number): AnsiCell[] {
	return Array.from({ length: columns }, () => ({ ...DEFAULT_CELL }))
}

// Optimized CSI parameter parsing from byte array
function parseCsiParams(csiParamBytes: number[]): number[] {
	if (csiParamBytes.length === 0) return []

	const params: number[] = []
	let currentParam = 0
	let hasValue = false

	for (let i = 0; i < csiParamBytes.length; i++) {
		const byte = csiParamBytes[i]
		// Skip leading spaces and question marks
		if (byte === SPACE || byte === QUESTION_MARK) continue

		// Semicolon separates parameters
		if (byte === SEMICOLON) {
			params.push(hasValue ? currentParam : NaN)
			currentParam = 0
			hasValue = false
			continue
		}

		// Parse digit
		if (byte >= DIGIT_MIN && byte <= DIGIT_MAX) {
			currentParam = currentParam * 10 + (byte - DIGIT_MIN)
			hasValue = true
		} else {
			// Invalid character, treat as separator
			if (hasValue) {
				params.push(currentParam)
				currentParam = 0
				hasValue = false
			}
		}
	}

	// Add final parameter if present
	if (hasValue) {
		params.push(currentParam)
	}

	return params
}

function ensureRow(
	lines: AnsiCell[][],
	row: number,
	columns: number,
	_fg: number | string,
	_bg: number | string,
	_bold: boolean
) {
	while (lines.length <= row) {
		// Initialize new lines with default attributes (not current attributes)
		lines.push(createEmptyLine(columns))
	}
}

function clearLine(
	line: AnsiCell[],
	from: number,
	to: number,
	fg: number | string,
	bg: number | string,
	bold: boolean
) {
	const start = Math.max(0, from)
	const end = Math.min(line.length - 1, to)
	for (let c = start; c <= end; c++) {
		line[c] = createCell(fg, bg, bold)
	}
}

function isLetter(byte: number): boolean {
	return (
		(byte >= LETTER_UPPER_MIN && byte <= LETTER_UPPER_MAX) ||
		(byte >= LETTER_LOWER_MIN && byte <= LETTER_LOWER_MAX)
	)
}

function isValidCsiCommand(ch: string): boolean {
	return VALID_CSI_COMMANDS.includes(ch)
}


// ============================================================================
// CSI Command Handlers
// ============================================================================

function applySGR(params: number[], state: ParserState) {
	if (params.length === 0) params = [ANSI_RESET]
	for (const p of params) {
		if (p === ANSI_RESET) {
			state.fg = DEFAULT_FG
			state.bg = DEFAULT_BG
			state.bold = false
			continue
		}
		if (p === ANSI_BOLD) {
			state.bold = true
			continue
		}
		if (p === 2) {
			// Dim/faint — map bright fg colors to their dim variants
			if (typeof state.fg === 'number' && state.fg >= 8 && state.fg <= 15) {
				state.fg -= 8
			}
			continue
		}
		if (p === 3 || p === 4 || p === 9) {
			// Italic (3), underline (4), strikethrough (9)
			// Accepted but not rendered with bitmap fonts
			continue
		}
		if (p === ANSI_BOLD_OFF) {
			// Also covers "normal intensity" (SGR 22)
			state.bold = false
			continue
		}
		if (p === 23 || p === 24 || p === 29) {
			// Not italic (23), not underlined (24), not strikethrough (29)
			continue
		}
		if (p === ANSI_FG_DEFAULT) {
			state.fg = DEFAULT_FG
			continue
		}
		if (p === ANSI_BG_DEFAULT) {
			state.bg = DEFAULT_BG
			continue
		}
		if (p === ANSI_REVERSE_VIDEO) {
			// Reverse video - swap foreground and background
			const tempFg = state.fg
			const tempBg = state.bg
			state.fg = tempBg
			state.bg = tempFg
			continue
		}
		if (p === ANSI_REVERSE_VIDEO_OFF) {
			// Reverse video off - this is complex to undo, so we'll reset to defaults
			state.fg = DEFAULT_FG
			state.bg = DEFAULT_BG
			continue
		}
		if (p === ANSI_BLINK_OFF) {
			// Blink off - currently not supported in our data structure, ignore
			continue
		}
		if (p >= ANSI_FG_BASE_MIN && p <= ANSI_FG_BASE_MAX) {
			state.fg = ANSI_TO_DOS[p - ANSI_FG_BASE_MIN]
			continue
		}
		if (p >= ANSI_BG_BASE_MIN && p <= ANSI_BG_BASE_MAX) {
			state.bg = ANSI_TO_DOS[p - ANSI_BG_BASE_MIN]
			continue
		}
		if (p >= ANSI_FG_BRIGHT_MIN && p <= ANSI_FG_BRIGHT_MAX) {
			state.fg = 8 + ANSI_TO_DOS[p - ANSI_FG_BRIGHT_MIN]
			continue
		}
		if (p >= ANSI_BG_BRIGHT_MIN && p <= ANSI_BG_BRIGHT_MAX) {
			state.bg = 8 + ANSI_TO_DOS[p - ANSI_BG_BRIGHT_MIN]
			continue
		}
	}
}

function handleCursorSave(ctx: CsiHandlerContext) {
	// Save cursor position (only if no parameters, matching PabloDraw)
	if (ctx.params.length === 0) {
		ctx.state.savedCur.row = ctx.state.cur.row
		ctx.state.savedCur.col = ctx.state.cur.col
	}
}

function handleCursorRestore(ctx: CsiHandlerContext) {
	// Restore cursor position (only if no parameters, matching PabloDraw)
	if (ctx.params.length === 0) {
		ctx.state.cur.row = ctx.state.savedCur.row
		ctx.state.cur.col = ctx.state.savedCur.col
		ctx.ensureRow()
	}
}

function handleCursorPosition(ctx: CsiHandlerContext) {
	const r = Math.max(1, ctx.get(0, 1)) - 1
	const c = Math.max(1, ctx.get(1, 1)) - 1
	ctx.state.cur.row = r
	if (ctx.state.isDynamic) {
		ctx.state.cur.col = Math.max(0, c)
		if (ctx.state.maxCol !== undefined && ctx.state.cur.col > ctx.state.maxCol) {
			ctx.state.maxCol = ctx.state.cur.col
		}
	} else {
		ctx.state.cur.col = Math.max(0, Math.min(ctx.columns - 1, c))
	}
	ctx.ensureRow()
}

function handleCursorUp(ctx: CsiHandlerContext) {
	const n = Math.max(1, ctx.get(0, 1))
	ctx.state.cur.row = Math.max(0, ctx.state.cur.row - n)
}

function handleCursorDown(ctx: CsiHandlerContext) {
	const n = Math.max(1, ctx.get(0, 1))
	ctx.state.cur.row = ctx.state.cur.row + n
	ctx.ensureRow()
}

function handleCursorForward(ctx: CsiHandlerContext) {
	const n = Math.max(1, ctx.get(0, 1))
	if (ctx.state.isDynamic) {
		ctx.state.cur.col = ctx.state.cur.col + n
		if (ctx.state.maxCol !== undefined && ctx.state.cur.col > ctx.state.maxCol) {
			ctx.state.maxCol = ctx.state.cur.col
		}
	} else {
		ctx.state.cur.col = Math.min(ctx.columns - 1, ctx.state.cur.col + n)
	}
}

function handleCursorBack(ctx: CsiHandlerContext) {
	const n = Math.max(1, ctx.get(0, 1))
	ctx.state.cur.col = Math.max(0, ctx.state.cur.col - n)
}

function handleCursorHorizontalAbsolute(ctx: CsiHandlerContext) {
	const c = Math.max(1, ctx.get(0, 1)) - 1
	if (ctx.state.isDynamic) {
		ctx.state.cur.col = Math.max(0, c)
		if (ctx.state.maxCol !== undefined && ctx.state.cur.col > ctx.state.maxCol) {
			ctx.state.maxCol = ctx.state.cur.col
		}
	} else {
		ctx.state.cur.col = Math.max(0, Math.min(ctx.columns - 1, c))
	}
}

function handleCursorNextLine(ctx: CsiHandlerContext) {
	// Next Line - move to beginning of next line
	const n = Math.max(1, ctx.get(0, 1))
	ctx.state.cur.row += n
	ctx.state.cur.col = 0
	ctx.ensureRow()
}

function handleCursorPrevLine(ctx: CsiHandlerContext) {
	// Previous Line - move to beginning of previous line
	const n = Math.max(1, ctx.get(0, 1))
	ctx.state.cur.row = Math.max(0, ctx.state.cur.row - n)
	ctx.state.cur.col = 0
}

function handleSGR(ctx: CsiHandlerContext) {
	// Avoid the filter allocation in the common case of no NaN placeholders
	let params = ctx.params
	for (let i = 0; i < params.length; i++) {
		if (Number.isNaN(params[i])) {
			params = params.filter(p => !Number.isNaN(p))
			break
		}
	}
	applySGR(params, ctx.state)
}

function handleIceColors(ctx: CsiHandlerContext) {
	// RGB color setting (iCE colors)
	if (ctx.params.length >= 4) {
		const mode = ctx.get(0, 0)
		const r = Math.min(255, Math.max(0, ctx.get(1, 0)))
		const g = Math.min(255, Math.max(0, ctx.get(2, 0)))
		const b = Math.min(255, Math.max(0, ctx.get(3, 0)))
		const rgbColor = `rgb(${r}, ${g}, ${b})`
		if (mode === 0) {
			// Background RGB color
			ctx.state.bg = rgbColor
		} else if (mode === 1) {
			// Foreground RGB color
			ctx.state.fg = rgbColor
		}
	}
}

function handleEraseLine(ctx: CsiHandlerContext) {
	const mode = ctx.get(0, 0)
	ctx.ensureRow()
	if (ctx.state.isDynamic) {
		const line = ctx.state.lines[ctx.state.cur.row]
		if (mode === 0) {
			// Clear from cursor to end of line
			for (let c = ctx.state.cur.col; c < line.length; c++) {
				line[c] = createCell(ctx.state.fg, ctx.state.bg, ctx.state.bold)
			}
		} else if (mode === 1) {
			// Clear from start of line to cursor
			for (let c = 0; c <= ctx.state.cur.col; c++) {
				if (c < line.length) {
					line[c] = createCell(ctx.state.fg, ctx.state.bg, ctx.state.bold)
				}
			}
		} else if (mode === 2) {
			// Clear entire line
			line.length = 0
		}
	} else {
		if (mode === 0) {
			clearLine(
				ctx.state.lines[ctx.state.cur.row],
				ctx.state.cur.col,
				ctx.columns - 1,
				ctx.state.fg,
				ctx.state.bg,
				ctx.state.bold
			)
		} else if (mode === 1) {
			clearLine(
				ctx.state.lines[ctx.state.cur.row],
				0,
				ctx.state.cur.col,
				ctx.state.fg,
				ctx.state.bg,
				ctx.state.bold
			)
		} else if (mode === 2) {
			clearLine(
				ctx.state.lines[ctx.state.cur.row],
				0,
				ctx.columns - 1,
				ctx.state.fg,
				ctx.state.bg,
				ctx.state.bold
			)
		}
	}
}

function handleEraseDisplay(ctx: CsiHandlerContext) {
	const mode = ctx.get(0, 0)
	if (mode === 2) {
		// clear entire display and reset cursor (fill with spaces like PabloDraw)
		ctx.state.lines.length = 0
		if (ctx.state.isDynamic && ctx.state.maxCol !== undefined) {
			// Ensure at least one line filled with default colors exists after clearing
			const newLine: AnsiCell[] = []
			for (let c = 0; c < Math.max(ctx.state.maxCol + 1, DEFAULT_COLUMNS); c++) {
				newLine.push(createCell(DEFAULT_FG, DEFAULT_BG, false))
			}
			ctx.state.lines.push(newLine)
			ctx.state.maxCol = 0
		} else {
			ctx.state.lines.push(createEmptyLine(ctx.columns))
		}
		ctx.state.cur.row = 0
		ctx.state.cur.col = 0
	} else if (mode === 0 || mode === 1) {
		// approximate: clear current line segment and subsequent (or previous)
		ctx.ensureRow()
		if (ctx.state.isDynamic) {
			if (mode === 0) {
				// Clear from cursor to end
				const line = ctx.state.lines[ctx.state.cur.row]
				for (let c = ctx.state.cur.col; c < line.length; c++) {
					line[c] = createCell(ctx.state.fg, ctx.state.bg, ctx.state.bold)
				}
				for (let r = ctx.state.cur.row + 1; r < ctx.state.lines.length; r++) {
					ctx.state.lines[r].length = 0
				}
			} else {
				// Clear from start to cursor
				for (let r = 0; r < ctx.state.cur.row; r++) {
					ctx.state.lines[r].length = 0
				}
				const line = ctx.state.lines[ctx.state.cur.row]
				for (let c = 0; c <= ctx.state.cur.col; c++) {
					if (c < line.length) {
						line[c] = createCell(ctx.state.fg, ctx.state.bg, ctx.state.bold)
					}
				}
			}
		} else {
			if (mode === 0) {
				clearLine(
					ctx.state.lines[ctx.state.cur.row],
					ctx.state.cur.col,
					ctx.columns - 1,
					ctx.state.fg,
					ctx.state.bg,
					ctx.state.bold
				)
				for (let r = ctx.state.cur.row + 1; r < ctx.state.lines.length; r++)
					clearLine(
						ctx.state.lines[r],
						0,
						ctx.columns - 1,
						ctx.state.fg,
						ctx.state.bg,
						ctx.state.bold
					)
			} else {
				for (let r = 0; r < ctx.state.cur.row; r++)
					clearLine(
						ctx.state.lines[r],
						0,
						ctx.columns - 1,
						ctx.state.fg,
						ctx.state.bg,
						ctx.state.bold
					)
				clearLine(
					ctx.state.lines[ctx.state.cur.row],
					0,
					ctx.state.cur.col,
					ctx.state.fg,
					ctx.state.bg,
					ctx.state.bold
				)
			}
		}
	}
}

function getLineWidth(ctx: CsiHandlerContext): number {
	if (ctx.state.isDynamic) {
		return ctx.state.maxCol !== undefined
			? Math.max(ctx.state.maxCol + 1, DEFAULT_COLUMNS)
			: DEFAULT_COLUMNS
	}
	return ctx.columns
}

function handleScrollUp(ctx: CsiHandlerContext) {
	const n = Math.max(1, ctx.get(0, 1))
	const colWidth = getLineWidth(ctx)
	for (let scroll = 0; scroll < n; scroll++) {
		if (ctx.state.lines.length > 0) {
			ctx.state.lines.shift()
			ctx.state.lines.push(createEmptyLine(colWidth))
		}
	}
}

function handleScrollDown(ctx: CsiHandlerContext) {
	const n = Math.max(1, ctx.get(0, 1))
	const colWidth = getLineWidth(ctx)
	for (let scroll = 0; scroll < n; scroll++) {
		if (ctx.state.lines.length > 0) {
			ctx.state.lines.pop()
			ctx.state.lines.unshift(createEmptyLine(colWidth))
		}
	}
}

function handleSetMode(ctx: CsiHandlerContext) {
	// Set Mode (enable)
	for (const param of ctx.params) {
		if (param === MODE_LINE_WRAP) {
			ctx.state.lineWrap = true
		} else if (param === MODE_ICE_COLORS) {
			ctx.state.iceColors = true
		}
	}
}

function handleResetMode(ctx: CsiHandlerContext) {
	// Reset Mode (disable)
	for (const param of ctx.params) {
		if (param === MODE_LINE_WRAP) {
			ctx.state.lineWrap = false
		} else if (param === MODE_ICE_COLORS) {
			ctx.state.iceColors = false
		}
	}
}

const CSI_HANDLERS: Record<string, CsiHandler> = {
	[CSI_CMD_CURSOR_SAVE]: handleCursorSave,
	[CSI_CMD_CURSOR_RESTORE]: handleCursorRestore,
	[CSI_CMD_CURSOR_POSITION]: handleCursorPosition,
	[CSI_CMD_CURSOR_POSITION_ALT]: handleCursorPosition,
	[CSI_CMD_CURSOR_UP]: handleCursorUp,
	[CSI_CMD_CURSOR_DOWN]: handleCursorDown,
	[CSI_CMD_CURSOR_FORWARD]: handleCursorForward,
	[CSI_CMD_CURSOR_BACK]: handleCursorBack,
	[CSI_CMD_CURSOR_HORIZONTAL_ABS]: handleCursorHorizontalAbsolute,
	[CSI_CMD_CURSOR_NEXT_LINE]: handleCursorNextLine,
	[CSI_CMD_CURSOR_PREV_LINE]: handleCursorPrevLine,
	[CSI_CMD_SGR]: handleSGR,
	[CSI_CMD_ICE_COLOR]: handleIceColors,
	[CSI_CMD_ERASE_LINE]: handleEraseLine,
	[CSI_CMD_ERASE_DISPLAY]: handleEraseDisplay,
	[CSI_CMD_SCROLL_UP]: handleScrollUp,
	[CSI_CMD_SCROLL_DOWN]: handleScrollDown,
	[CSI_CMD_SET_MODE]: handleSetMode,
	[CSI_CMD_RESET_MODE]: handleResetMode,
}

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Options for unified ANSI parsing
 */
type ParseAnsiOptions = {
	/** Fixed column width (if undefined, uses dynamic column sizing) */
	columns?: number
	/** Maximum byte index to parse (if undefined, parses all bytes) */
	maxByteIndex?: number
	/** Character encoding to use */
	encoding?: CharacterEncoding
}

/**
 * Options for creating a resumable ANSI parse session
 */
type AnsiParseSessionOptions = {
	/** Fixed column width (if undefined, uses dynamic column sizing) */
	columns?: number
	/** Character encoding to use */
	encoding?: CharacterEncoding
}

/**
 * Resumable ANSI parse session
 * Retains parser state between calls so animated playback can parse only the
 * newly revealed bytes instead of re-parsing from byte 0 on every frame.
 */
export type AnsiParseSession = {
	/**
	 * Parse forward to the given byte index and return the current screen.
	 * Moving forward parses only the delta since the previous call; moving
	 * backward (loop/seek) resets the session and re-parses from byte 0.
	 * The returned screen has a fresh top-level lines array, but row arrays
	 * are shared with internal parser state — callers may replace or extend
	 * the lines array, but must not mutate individual rows or cells.
	 */
	advanceTo: (byteIndex: number) => AnsiScreen
	/** SAUCE metadata parsed once at session creation (undefined if absent) */
	sauce: SauceMetadata | undefined
	/** Parseable byte length (input length minus any SAUCE trailer) */
	byteLength: number
}

/**
 * Create a resumable ANSI parse session
 * SAUCE metadata is stripped and parsed once at creation; each advanceTo call
 * parses only the bytes not yet consumed.
 * @param bytesInput - Input bytes to parse
 * @param options - Parsing options (columns, encoding)
 * @returns Resumable parse session
 */
export function createAnsiParseSession(
	bytesInput: Uint8Array,
	options: AnsiParseSessionOptions = {}
): AnsiParseSession {
	const { columns, encoding = 'cp437' } = options
	const isDynamic = columns === undefined

	// Handle SAUCE metadata once at session creation
	// (subarray is a zero-copy view; the parser only reads from it)
	let bytes = bytesInput
	const sauce = parseSauce(bytesInput)
	if (isSauceTrailer(bytesInput)) {
		// Calculate how much to strip: SAUCE (128) + possible EOF (1) + comments
		let stripSize = SAUCE_TRAILER_SIZE

		// Check for EOF byte before SAUCE
		const eofPos = bytesInput.length - SAUCE_TRAILER_SIZE - 1
		if (eofPos >= 0 && bytesInput[eofPos] === SAUCE_EOF) {
			stripSize += 1
		}

		// Check for comments before SAUCE
		if (sauce && sauce.comments > 0) {
			stripSize += COMMENT_ID_SIZE + sauce.comments * COMMENT_SIZE
		}

		bytes = bytesInput.subarray(0, bytesInput.length - stripSize)
	}

	// Retained parser state (single source of truth)
	let state: ParserState
	// Parser state machine (retained because a stop point may land mid-escape-sequence)
	let parserState: 'normal' | 'esc' | 'csi'
	let csiParams: number[]
	// Next byte index to parse
	let nextIndex: number
	// Set once a soft EOF byte is consumed; no further bytes are parsed
	let sawEof: boolean

	const reset = () => {
		state = {
			lines: [],
			cur: { row: 0, col: 0 },
			savedCur: { row: 0, col: 0 },
			fg: DEFAULT_FG,
			bg: DEFAULT_BG,
			bold: false,
			lineWrap: true,
			iceColors: false,
			columns: columns,
			maxCol: isDynamic ? 0 : undefined,
			isDynamic: isDynamic,
		}
		parserState = 'normal'
		csiParams = []
		nextIndex = 0
		sawEof = false
	}
	reset()

	// Create writeChar function based on mode
	const writeChar = (ch: string) => {
		if (ch === '') return
		if (ch === '\n') {
			state.cur.row += 1
			state.cur.col = 0
			return
		}
		if (ch === '\r') {
			// CR: ignored (matching PabloDraw behavior)
			return
		}
		if (state.cur.col < 0) state.cur.col = 0

		if (isDynamic) {
			// Dynamic mode: grow lines and columns as needed
			while (state.lines.length <= state.cur.row) {
				state.lines.push([])
			}
			while (state.lines[state.cur.row].length <= state.cur.col) {
				state.lines[state.cur.row].push(createCell(DEFAULT_FG, DEFAULT_BG, false))
			}
			state.lines[state.cur.row][state.cur.col] = {
				ch,
				fg: state.fg,
				bg: state.bg,
				bold: state.bold,
			}
			state.cur.col += 1
			// Track maximum column seen
			if (state.maxCol !== undefined && state.cur.col > state.maxCol) {
				state.maxCol = state.cur.col
			}
		} else {
			// Fixed mode: use fixed column width
			ensureRow(state.lines, state.cur.row, columns!, state.fg, state.bg, state.bold)
			// Write character only if cursor is within bounds
			if (state.cur.col >= 0 && state.cur.col < columns!) {
				state.lines[state.cur.row][state.cur.col] = {
					ch,
					fg: state.fg,
					bg: state.bg,
					bold: state.bold,
				}
			}
			state.cur.col += 1
			// Handle line wrapping
			if (state.cur.col > columns! - 1) {
				if (state.lineWrap) {
					// Wrap to next line
					state.cur.row += 1
					state.cur.col = 0
				} else {
					// Stop at boundary
					state.cur.col = columns! - 1
				}
			}
		}
	}

	// Build the current screen without mutating retained parser state, so a
	// later advanceTo continues exactly as an uninterrupted parse would.
	// The top-level lines array is a fresh copy; row arrays are shared except
	// for short rows, which are replaced by padded copies.
	const buildScreen = (): AnsiScreen => {
		const lines = state.lines.slice()

		// Post-processing: ensure at least one line exists
		if (lines.length === 0) {
			lines.push(isDynamic ? [] : createEmptyLine(columns!))
		}

		// Calculate final dimensions
		// Dynamic mode: pad all lines to the same width (max column seen)
		// Fixed mode: ensure all lines are exactly `columns` wide
		const finalColumns = isDynamic ? Math.max(1, state.maxCol || 0) : columns!
		for (let r = 0; r < lines.length; r++) {
			const line = lines[r]
			if (!line) {
				lines[r] = createEmptyLine(finalColumns)
			} else if (line.length < finalColumns) {
				const padded = line.slice()
				while (padded.length < finalColumns) {
					padded.push({ ...DEFAULT_CELL })
				}
				lines[r] = padded
			}
		}

		return { lines, columns: finalColumns, sauce }
	}

	const advanceTo = (byteIndex: number): AnsiScreen => {
		const target = Math.max(0, Math.min(byteIndex, bytes.length))

		// Rewind (loop/seek backward): reset and re-parse from byte 0
		if (target < nextIndex) {
			reset()
		}

		// Main parsing loop — only the delta [nextIndex, target)
		let i = nextIndex
		while (i < target && !sawEof) {
			const b = bytes[i++]
			if (b === SOFT_EOF) {
				// soft EOF
				sawEof = true
				break
			}

			switch (parserState) {
				case 'normal': {
					if (b === ESC) {
						parserState = 'esc'
						break
					}
					writeChar(byteToChar(b, encoding))
					break
				}
				case 'esc': {
					if (b === CSI_BRACKET) {
						// CSI
						parserState = 'csi'
						csiParams = []
						break
					}
					// Unrecognized ESC sequence; ignore and reset
					parserState = 'normal'
					break
				}
				case 'csi': {
					// Parameter bytes — compare numerically ('?' is 0x3f, inside the
					// parameter range); defer string conversion to the final byte
					if ((b >= PARAMETER_BYTE_MIN && b <= PARAMETER_BYTE_MAX) || b === SPACE) {
						// Prevent excessively long parameter strings (malformed input protection)
						if (csiParams.length < MAX_CSI_PARAMS) {
							csiParams.push(b)
						}
						break
					}
					// Final byte - validate it's actually a valid command character
					const ch = String.fromCharCode(b)
					if (!isValidCsiCommand(ch)) {
						// Invalid CSI command, reset and continue
						parserState = 'normal'
						csiParams = []
						break
					}

					const params = parseCsiParams(csiParams)
					const get = (idx: number, def: number) =>
						Number.isNaN(params[idx]) || params[idx] === undefined ? def : params[idx]

					const handler = CSI_HANDLERS[ch]
					if (handler) {
						const ctx: CsiHandlerContext = {
							state: state,
							params,
							get,
							columns: columns || 0,
							ensureRow: () => {
								if (isDynamic) {
									while (state.lines.length <= state.cur.row) {
										state.lines.push([])
									}
								} else {
									ensureRow(state.lines, state.cur.row, columns!, state.fg, state.bg, state.bold)
								}
							},
						}
						handler(ctx)
					}

					parserState = 'normal'
					csiParams = []
					break
				}
			}
		}
		nextIndex = target

		return buildScreen()
	}

	return { advanceTo, sauce, byteLength: bytes.length }
}

/**
 * Unified ANSI parsing function that handles all parsing modes
 * @param bytesInput - Input bytes to parse
 * @param options - Parsing options (columns, maxByteIndex, encoding)
 * @returns Parsed ANSI screen
 */
export function parseAnsiCore(bytesInput: Uint8Array, options: ParseAnsiOptions = {}): AnsiScreen {
	const { columns, maxByteIndex, encoding = 'cp437' } = options
	const session = createAnsiParseSession(bytesInput, { columns, encoding })
	return session.advanceTo(maxByteIndex !== undefined ? maxByteIndex : Number.MAX_SAFE_INTEGER)
}

/**
 * Parse ANSI art file with fixed column width
 * @param bytesInput - Input bytes to parse
 * @param columns - Fixed column width (default: 80)
 * @param encoding - Character encoding (default: 'cp437')
 * @returns Parsed ANSI screen
 */
export function parseAnsi(
	bytesInput: Uint8Array,
	columns = DEFAULT_COLUMNS,
	encoding: CharacterEncoding = 'cp437'
): AnsiScreen {
	return parseAnsiCore(bytesInput, { columns, encoding })
}

/**
 * Parse ANSI incrementally up to a specific byte index
 * Used for progressive/animated rendering
 * @param bytesInput - Input bytes to parse
 * @param columns - Fixed column width
 * @param maxByteIndex - Maximum byte index to parse up to
 * @param encoding - Character encoding (default: 'cp437')
 * @returns Parsed ANSI screen
 */
export function parseAnsiIncremental(
	bytesInput: Uint8Array,
	columns: number,
	maxByteIndex: number,
	encoding: CharacterEncoding = 'cp437'
): AnsiScreen {
	return parseAnsiCore(bytesInput, { columns, maxByteIndex, encoding })
}

/**
 * Parse ANSI without fixed column width - allows dynamic sizing
 * Tracks maximum column and row used, returns actual dimensions
 * @param bytesInput - Input bytes to parse
 * @param encoding - Character encoding (default: 'cp437')
 * @returns Parsed ANSI screen
 */
export function parseAnsiDynamic(
	bytesInput: Uint8Array,
	encoding: CharacterEncoding = 'cp437'
): AnsiScreen {
	return parseAnsiCore(bytesInput, { encoding })
}

/**
 * Parse ANSI incrementally without fixed column width - allows dynamic sizing during animation
 * Tracks maximum column and row seen so far, returns current state with actual dimensions
 * @param bytesInput - Input bytes to parse
 * @param maxByteIndex - Maximum byte index to parse up to
 * @param encoding - Character encoding (default: 'cp437')
 * @returns Parsed ANSI screen
 */
export function parseAnsiIncrementalDynamic(
	bytesInput: Uint8Array,
	maxByteIndex: number,
	encoding: CharacterEncoding = 'cp437'
): AnsiScreen {
	return parseAnsiCore(bytesInput, { maxByteIndex, encoding })
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Detect if an ANSI file contains animation sequences
 * Returns true if the file appears to be animated (contains cursor positioning commands)
 */
export function detectAnimation(bytes: Uint8Array): boolean {
	// Check SAUCE metadata first
	const sauce = parseSauce(bytes)
	if (sauce && sauce.dataType === 1 && sauce.fileType === 2) {
		// SAUCE indicates Ansimation type
		return true
	}

	// Scan for cursor positioning commands (H and f) in first 2048 bytes
	const maxCheck = Math.min(2048, bytes.length)
	let i = 0

	while (i < maxCheck) {
		const b = bytes[i++]
		if (b === ESC) {
			// ESC
			if (i < maxCheck && bytes[i] === CSI_BRACKET) {
				// [
				i++ // skip [
				// Skip parameter bytes until we find a letter
				while (i < maxCheck && !isLetter(bytes[i])) {
					i++
				}
				if (i < maxCheck) {
					const cmd = bytes[i]
					if (cmd === 0x48 || cmd === 0x66) {
						// H or f (cursor positioning)
						return true
					}
				}
			}
		}
	}

	return false
}

/**
 * Parse plain ASCII text (no ANSI codes) into AnsiScreen format
 * Useful for simple text art files
 */
export function parseAscii(bytes: Uint8Array, encoding: CharacterEncoding = 'cp437'): AnsiScreen {
	// Handle SAUCE metadata - strip it before parsing
	let bytesToParse = bytes
	const sauce = parseSauce(bytes)
	if (isSauceTrailer(bytes)) {
		// Calculate how much to strip: SAUCE (128) + possible EOF (1) + comments
		let stripSize = SAUCE_TRAILER_SIZE

		// Check for EOF byte before SAUCE
		const eofPos = bytes.length - SAUCE_TRAILER_SIZE - 1
		if (eofPos >= 0 && bytes[eofPos] === SAUCE_EOF) {
			stripSize += 1
		}

		// Check for comments before SAUCE
		if (sauce && sauce.comments > 0) {
			stripSize += COMMENT_ID_SIZE + sauce.comments * COMMENT_SIZE
		}

		bytesToParse = bytes.subarray(0, bytes.length - stripSize)
	}

	const lines: AnsiCell[][] = []
	let currentLine: AnsiCell[] = []

	for (let i = 0; i < bytesToParse.length; i++) {
		const byte = bytesToParse[i]

		if (byte === LF || byte === CR) {
			// LF or CR
			if (currentLine.length > 0 || byte === LF) {
				// Pad line to ensure consistent width (find max line length)
				lines.push([...currentLine])
				currentLine = []
			}
			// Skip CR if followed by LF
			if (byte === CR && i + 1 < bytes.length && bytes[i + 1] === LF) {
				i++
			}
		} else if (byte === SOFT_EOF) {
			// EOF marker
			break
		} else {
			const ch = byteToChar(byte, encoding)
			currentLine.push({ ch, fg: DEFAULT_FG, bg: DEFAULT_BG, bold: false })
		}
	}

	// Add final line if not empty
	if (currentLine.length > 0) {
		lines.push(currentLine)
	}

	// Find the maximum line length
	let maxWidth = 0
	for (const line of lines) {
		maxWidth = Math.max(maxWidth, line.length)
	}

	// Pad all lines to the same width
	for (const line of lines) {
		while (line.length < maxWidth) {
			line.push({ ch: ' ', fg: DEFAULT_FG, bg: DEFAULT_BG, bold: false })
		}
	}

	// Ensure at least one line exists
	if (lines.length === 0) {
		lines.push(
			Array(maxWidth || DEFAULT_COLUMNS)
				.fill(null)
				.map(() => ({ ch: ' ', fg: DEFAULT_FG, bg: DEFAULT_BG, bold: false }))
		)
	}

	return {
		lines,
		columns: maxWidth || DEFAULT_COLUMNS,
		sauce,
	}
}

/**
 * Find the next render point after a given byte index
 * Render points are:
 * - After complete escape sequences (CSI commands)
 * - After single ESC sequences
 * - After newlines/carriage returns
 * - After batches of normal characters (every N chars)
 */
export function findNextRenderPoint(
	bytes: Uint8Array,
	startIndex: number,
	batchSize: number = 50
): number {
	if (startIndex >= bytes.length) return bytes.length

	let i = startIndex
	let state: 'normal' | 'esc' | 'csi' = 'normal'
	let normalCharCount = 0

	while (i < bytes.length) {
		const b = bytes[i++]
		if (b === SOFT_EOF) return i // soft EOF

		switch (state) {
			case 'normal': {
				if (b === ESC) {
					// If we've accumulated normal chars, render before this escape
					if (normalCharCount > 0) return i - 1
					state = 'esc'
					break
				}
				if (b === LF || b === CR) {
					// Newline or carriage return - render point
					return i
				}
				normalCharCount++
				// Batch normal characters
				if (normalCharCount >= batchSize) {
					return i
				}
				break
			}
			case 'esc': {
				if (b === CSI_BRACKET) {
					// CSI - continue reading params
					state = 'csi'
					break
				}
				// Single ESC sequence complete - render point
				return i
			}
			case 'csi': {
				const ch = String.fromCharCode(b)
				if ((b >= PARAMETER_BYTE_MIN && b <= PARAMETER_BYTE_MAX) || ch === ' ' || ch === '?') {
					// Parameter bytes - continue
					break
				}
				// CSI command complete - render point
				return i
			}
		}
	}

	return bytes.length
}

/**
 * Find the next cursor movement in ANSI stream
 * Stops after:
 * - Cursor positioning commands: H, f, A, B, C, D, G, s, u
 * - Batch of newlines (multiple lines at once for speed)
 * - Large batch of chars (if no cursor commands found)
 * This creates more natural animation by completing "drawing strokes"
 */
export function findNextCursorMove(
	bytes: Uint8Array,
	startIndex: number,
	maxCharsBeforeStop: number = 2000,
	linesPerBatch: number = 5
): number {
	if (startIndex >= bytes.length) return bytes.length

	let i = startIndex
	let state: 'normal' | 'esc' | 'csi' = 'normal'
	let csiParams: number[] = []
	let normalCharCount = 0
	let newlineCount = 0

	while (i < bytes.length) {
		const b = bytes[i++]
		if (b === SOFT_EOF) return i // soft EOF

		switch (state) {
			case 'normal': {
				if (b === ESC) {
					state = 'esc'
					csiParams = []
					break
				}
				if (b === LF || b === CR) {
					newlineCount++
					// Stop after multiple lines for better batching
					if (newlineCount >= linesPerBatch) {
						return i
					}
					break
				}
				normalCharCount++
				// Only stop after many chars if we've found cursor commands before
				// This allows simple text files to render quickly in larger chunks
				if (normalCharCount >= maxCharsBeforeStop) {
					return i
				}
				break
			}
			case 'esc': {
				if (b === CSI_BRACKET) {
					// CSI - continue reading
					state = 'csi'
					break
				}
				// Other ESC sequence - not a cursor move, keep going
				state = 'normal'
				break
			}
			case 'csi': {
				const ch = String.fromCharCode(b)
				if ((b >= PARAMETER_BYTE_MIN && b <= PARAMETER_BYTE_MAX) || ch === ' ' || ch === '?') {
					// Parameter bytes - accumulate
					csiParams.push(b)
					break
				}
				// Final byte - check if it's a cursor movement command
				const isCursorMove =
					ch === CSI_CMD_CURSOR_POSITION || // Cursor Position
					ch === CSI_CMD_CURSOR_POSITION_ALT || // Horizontal Vertical Position
					ch === CSI_CMD_CURSOR_UP || // Cursor Up
					ch === CSI_CMD_CURSOR_DOWN || // Cursor Down
					ch === CSI_CMD_CURSOR_FORWARD || // Cursor Forward
					ch === CSI_CMD_CURSOR_BACK || // Cursor Back
					ch === CSI_CMD_CURSOR_HORIZONTAL_ABS || // Cursor Horizontal Absolute
					ch === CSI_CMD_CURSOR_SAVE || // Save Cursor Position
					ch === CSI_CMD_CURSOR_RESTORE // Restore Cursor Position

				state = 'normal'
				csiParams = []

				if (isCursorMove) {
					normalCharCount = 0 // Reset after cursor move
					newlineCount = 0
					// This is a cursor move - render here!
					return i
				}
				// Not a cursor move (probably color/clear cmd) - keep going
				break
			}
		}
	}

	return bytes.length
}
