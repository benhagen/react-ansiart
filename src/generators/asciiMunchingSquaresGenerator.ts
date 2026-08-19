import type { AnsiScreen } from '../ansi/types'

// Munching squares — the classic PDP-1 / HAKMEM item 146 display hack. Every cell's
// value is the XOR of its coordinates plus a time term:
//
//   v = ((x' XOR y') + t) mod size
//
// XOR of coordinates produces the famous nested-squares / Sierpinski-like structure
// (because size is a power of two, x' XOR y' never leaves [0, size)), and the +t term
// slides every cell through the value ring in lockstep, so the thresholds between
// bands sweep across the pattern — the squares "munch". Stateless: the frame is a
// pure function of (frame, columns, rows, options).
//
// Aspect handling: character cells are ~2x taller than wide, so the raw cell grid
// would stretch the squares horizontally. Halving x (x' = x >> 1) makes one domain
// unit two cells wide by one cell tall — visually square — while keeping the XOR
// structure exact and crisp (each domain unit renders as a clean 2x1 cell pair).

const DEFAULT_SPEED = 1
const MIN_SPEED = 0
const MAX_SPEED = 64
const DEFAULT_SIZE = 32
const MIN_SIZE = 8
const MAX_SIZE = 128
const DEFAULT_INVERT = false
const DEFAULT_BG_COLOR = '#000000'
// All CP437-safe: ░ 0xB0, ▒ 0xB1, ▓ 0xB2, █ 0xDB (verified via charToCp437Byte).
const DEFAULT_CHARS = [' ', '░', '▒', '▓', '█']
// The 16 EGA colors in their canonical dark→bright order, so the value ring reads
// as a brightness ramp while still cycling through hues as the pattern munches.
const DEFAULT_PALETTE = [
	'#000000', '#0000AA', '#00AA00', '#00AAAA',
	'#AA0000', '#AA00AA', '#AA5500', '#AAAAAA',
	'#555555', '#5555FF', '#55FF55', '#55FFFF',
	'#FF5555', '#FF55FF', '#FFFF55', '#FFFFFF',
]

export interface AsciiMunchingSquaresOptions {
	/** Value-ring steps advanced per frame (may be fractional). Default: 1 */
	speed?: number
	/**
	 * Domain size of the XOR pattern — the pattern tiles every `size` domain units
	 * (2*size columns by size rows). Rounded to a power of two in [8, 128], which
	 * keeps x' XOR y' inside [0, size). Default: 32
	 */
	size?: number
	/** Characters mapped over the value ring, low to high. Default: ' ░▒▓█' */
	chars?: string[]
	/** Colors cycled over the value ring (CSS color strings). Default: 16-color EGA palette */
	palette?: string[]
	/** Reverse the value ring (bright squares munch dark). Default: false */
	invert?: boolean
	/** Background color (CSS color string). Default: '#000000' */
	bgColor?: string
}

function clampNumber(raw: number | undefined, fallback: number, min: number, max: number): number {
	if (raw === undefined || !Number.isFinite(raw)) return fallback
	return Math.max(min, Math.min(max, raw))
}

// Round to the nearest power of two so the XOR stays closed over [0, size).
function toPowerOfTwo(raw: number): number {
	return 2 ** Math.round(Math.log2(raw))
}

// Resolve and clamp every option in one place; non-finite or out-of-range input
// falls back to the default instead of propagating NaN into a table index.
function resolveOptions(options: AsciiMunchingSquaresOptions): Required<AsciiMunchingSquaresOptions> {
	return {
		speed: clampNumber(options.speed, DEFAULT_SPEED, MIN_SPEED, MAX_SPEED),
		size: toPowerOfTwo(clampNumber(options.size, DEFAULT_SIZE, MIN_SIZE, MAX_SIZE)),
		chars: options.chars && options.chars.length > 0 ? options.chars : DEFAULT_CHARS,
		palette: options.palette && options.palette.length > 0 ? options.palette : DEFAULT_PALETTE,
		invert: options.invert ?? DEFAULT_INVERT,
		bgColor: options.bgColor ?? DEFAULT_BG_COLOR,
	}
}

// Precomputed per-value lookup tables: v -> char and v -> color, so the per-cell
// work is one XOR, one add, one mask, and two array reads. Memoized on the array
// identities plus size/invert (no JSON.stringify, no per-cell string building).
interface ValueTables {
	chTable: string[]
	fgTable: string[]
	boldTable: boolean[]
}

let lastTableChars: string[] | null = null
let lastTablePalette: string[] | null = null
let lastTableSize = -1
let lastTableInvert: boolean | null = null
let lastTables: ValueTables | null = null

function getValueTables(chars: string[], palette: string[], size: number, invert: boolean): ValueTables {
	if (
		lastTables &&
		lastTableChars === chars &&
		lastTablePalette === palette &&
		lastTableSize === size &&
		lastTableInvert === invert
	) {
		return lastTables
	}

	const chTable = new Array<string>(size)
	const fgTable = new Array<string>(size)
	const boldTable = new Array<boolean>(size)
	for (let v = 0; v < size; v++) {
		const level = invert ? size - 1 - v : v
		const t = level / size
		chTable[v] = chars[Math.min(chars.length - 1, Math.floor(t * chars.length))]
		fgTable[v] = palette[Math.min(palette.length - 1, Math.floor(t * palette.length))]
		boldTable[v] = t >= 0.75
	}

	lastTableChars = chars
	lastTablePalette = palette
	lastTableSize = size
	lastTableInvert = invert
	lastTables = { chTable, fgTable, boldTable }
	return lastTables
}

/**
 * Generate an ASCII munching squares frame — the PDP-1 / HAKMEM XOR pattern:
 * nested expanding squares carved by `((x' ^ y') + frame*speed) mod size`.
 */
export function generateAsciiMunchingSquaresFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiMunchingSquaresOptions = {},
): AnsiScreen {
	const { speed, size, chars, palette, invert, bgColor } = resolveOptions(options)

	const { chTable, fgTable, boldTable } = getValueTables(chars, palette, size, invert)
	const mask = size - 1
	// Integer time step, wrapped into [0, size) — the "+t mod size" ring position.
	const t = ((Math.floor(frame * speed) % size) + size) % size

	const lines: AnsiScreen['lines'] = []
	for (let y = 0; y < rows; y++) {
		const line: AnsiScreen['lines'][number] = []
		const sy = y & mask
		for (let x = 0; x < columns; x++) {
			// Halve x for aspect (cells are ~2x taller than wide), then wrap into the
			// power-of-two domain where XOR is closed.
			const sx = (x >> 1) & mask
			const v = ((sx ^ sy) + t) & mask
			line.push({ ch: chTable[v], fg: fgTable[v], bg: bgColor, bold: boldTable[v] })
		}
		lines.push(line)
	}

	return { lines, columns }
}

/**
 * Create a reusable sampler for munching squares at a specific frame.
 * Returns a function mapping (x, y) to an AnsiCell.
 */
export function createAsciiMunchingSquaresSampler(
	frame: number,
	options: AsciiMunchingSquaresOptions = {},
) {
	const { bgColor = DEFAULT_BG_COLOR } = options

	// Backing grid sized to the default tile (2*size x size at size 32) so the
	// wrapped sampler repeats seamlessly.
	const cols = 128
	const rows = 64
	const screen = generateAsciiMunchingSquaresFrame(frame, cols, rows, options)

	return (x: number, y: number) => {
		const wrappedX = ((x % cols) + cols) % cols
		const wrappedY = ((y % rows) + rows) % rows

		const cell = screen.lines[wrappedY]?.[wrappedX]
		if (!cell) {
			return { ch: ' ', fg: bgColor, bg: bgColor, bold: false }
		}
		return cell
	}
}
