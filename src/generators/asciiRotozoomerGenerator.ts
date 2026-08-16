import type { AnsiScreen } from '../ansi/types'
import { buildCharLookup } from './charLookup'

export interface AsciiRotozoomerOptions {
	/** Radians of rotation added per frame. Default: 0.035 */
	rotationSpeed?: number
	/** Angular speed of the zoom oscillation (radians per frame). Default: 0.02 */
	zoomSpeed?: number
	/** Baseline zoom level — smaller values zoom the texture in. Default: 1.0 */
	baseZoom?: number
	/** How far the zoom oscillates around baseZoom. Default: 0.25 */
	zoomAmplitude?: number
	/**
	 * Size of one tile of the procedural texture, in texture units. One texture
	 * unit equals one character column at zoom 1, so the default 12 draws tiles
	 * roughly 12 columns wide and 6 rows tall (rows are aspect-corrected) — far
	 * enough above the character grid's resolving limit that the lattice's tilt
	 * stays legible at every rotation angle. Default: 12
	 */
	textureSize?: number
	/**
	 * Width, in character cells, of the lattice line drawn along each tile's
	 * leading edges (checker pattern only). The lattice is what makes the
	 * rotation readable — a bare two-tone checkerboard is 90°-symmetric and
	 * translation-invariant, so its blobs give the eye no orientation cue.
	 * Set to 0 to draw a plain checkerboard. Default: 1.5
	 */
	latticeWidth?: number
	/** Procedural texture pattern. Default: 'checker' */
	pattern?: 'checker' | 'xor'
	/** Characters used for the texture ramp (xor pattern indexes into this by band). Default: ' .:-=+*#%@' */
	chars?: string[]
	/**
	 * Foreground colors. For the checker pattern index 0/1 are the two tile
	 * tones and index 2 (modulo the array length) is the lattice line; for the
	 * xor pattern they are cycled by band. Default: cyan/magenta + a white lattice
	 */
	fgColors?: string[]
	/** Background color for all cells. Default: '#000000' */
	bgColor?: string
	/** Vertical aspect correction — cells are roughly twice as tall as wide. Default: 2 */
	aspectY?: number
}

const DEFAULT_ROTATION_SPEED = 0.035
const DEFAULT_ZOOM_SPEED = 0.02
const DEFAULT_BASE_ZOOM = 1.0
const DEFAULT_ZOOM_AMPLITUDE = 0.25
const DEFAULT_TEXTURE_SIZE = 12
const DEFAULT_LATTICE_WIDTH = 1.5
const DEFAULT_PATTERN: NonNullable<AsciiRotozoomerOptions['pattern']> = 'checker'
const DEFAULT_CHARS = [' ', '.', ':', '-', '=', '+', '*', '#', '%', '@']
const DEFAULT_FG_COLORS = ['#00e5ff', '#ff00c8', '#f4f8ff']
const DEFAULT_BG_COLOR = '#000000'
const DEFAULT_ASPECT_Y = 2

function resolveAndValidate(options: AsciiRotozoomerOptions) {
	const rotationSpeed = options.rotationSpeed ?? DEFAULT_ROTATION_SPEED
	const zoomSpeed = options.zoomSpeed ?? DEFAULT_ZOOM_SPEED
	const baseZoom = options.baseZoom ?? DEFAULT_BASE_ZOOM
	const zoomAmplitude = options.zoomAmplitude ?? DEFAULT_ZOOM_AMPLITUDE
	const textureSize = options.textureSize ?? DEFAULT_TEXTURE_SIZE
	const latticeWidth = options.latticeWidth ?? DEFAULT_LATTICE_WIDTH
	const pattern = options.pattern ?? DEFAULT_PATTERN
	const chars = options.chars ?? DEFAULT_CHARS
	const fgColors = options.fgColors && options.fgColors.length > 0 ? options.fgColors : DEFAULT_FG_COLORS
	const bgColor = options.bgColor ?? DEFAULT_BG_COLOR
	const aspectY = options.aspectY ?? DEFAULT_ASPECT_Y

	const safeTextureSize = textureSize > 0 ? textureSize : DEFAULT_TEXTURE_SIZE
	// A lattice wider than a third of the tile stops reading as a line and just
	// eats the tile, so clamp rather than trust the caller blindly.
	const clampedLattice = Number.isFinite(latticeWidth)
		? Math.max(0, Math.min(latticeWidth, safeTextureSize / 3))
		: DEFAULT_LATTICE_WIDTH

	return {
		rotationSpeed,
		zoomSpeed,
		baseZoom: baseZoom > 0 ? baseZoom : DEFAULT_BASE_ZOOM,
		zoomAmplitude,
		safeTextureSize,
		latticeWidth: clampedLattice,
		pattern,
		chars: chars.length > 0 ? chars : DEFAULT_CHARS,
		fgColors,
		bgColor,
		safeAspectY: aspectY > 0 ? aspectY : DEFAULT_ASPECT_Y,
	}
}

type Params = ReturnType<typeof resolveAndValidate>

// Bounded single-slot cache: the texture lookup table only depends on the
// (pattern, chars, fgColors, bgColor) tuple, never on frame or zoom/rotation —
// those are applied by the incremental (u, v) walk in the hot loop below.
interface TextureCacheKey {
	pattern: string
	charsKey: string
	fgColorsKey: string
}

interface TextureTable {
	// 256-entry lookup, indexed by a texture "band" value (0-255): each entry
	// is a pre-built cell template so the inner loop never allocates a string.
	chars: string[]
	fgs: string[]
}

let lastKey: TextureCacheKey | null = null
let lastTable: TextureTable | null = null

function sameKey(a: TextureCacheKey, b: TextureCacheKey): boolean {
	return (
		a.pattern === b.pattern &&
		a.charsKey === b.charsKey &&
		a.fgColorsKey === b.fgColorsKey
	)
}

// Join with a delimiter that can never appear inside a char glyph or a CSS
// color string -- a plain space would not do, since the default chars ramp
// itself contains ' ' as an element, so joining with ' ' can still collide
// (['a', ' b'] and ['a ', 'b'] both join to 'a  b'). A NUL character never
// appears in either, so ['a','bc'] and ['ab','c'] can no longer hash to the
// same key -- a plain join('') would collide on those.
const KEY_DELIMITER = '\u0000'

function getTextureTable(params: Params): TextureTable {
	const key: TextureCacheKey = {
		pattern: params.pattern,
		charsKey: params.chars.join(KEY_DELIMITER),
		fgColorsKey: params.fgColors.join(KEY_DELIMITER),
	}

	if (lastKey && lastTable && sameKey(lastKey, key)) return lastTable

	let table: TextureTable
	if (params.pattern === 'xor') {
		// Classic xor-texture ramp: band value maps through the brightness lookup.
		const charLookup = buildCharLookup(params.chars)
		const fgs = new Array<string>(256)
		for (let i = 0; i < 256; i++) {
			fgs[i] = params.fgColors[i % params.fgColors.length]
		}
		table = { chars: charLookup, fgs }
	} else {
		// checker: two alternating (char, color) pairs by tile parity, plus a
		// third entry (index 2) for the lattice line along the tile edges.
		const chars = new Array<string>(3)
		const fgs = new Array<string>(3)
		chars[0] = params.chars[params.chars.length - 1] ?? '#'
		chars[1] = params.chars[Math.max(0, Math.floor(params.chars.length / 3))] ?? '.'
		chars[2] = params.chars[Math.max(0, Math.floor(params.chars.length / 2))] ?? '+'
		fgs[0] = params.fgColors[0]
		fgs[1] = params.fgColors[1 % params.fgColors.length]
		fgs[2] = params.fgColors[2 % params.fgColors.length]
		table = { chars, fgs }
	}

	lastKey = key
	lastTable = table
	return table
}

/**
 * Generate an ASCII rotozoomer frame — the classic Amiga rotating/zooming
 * texture effect. The per-cell sample position is walked incrementally: cos/sin
 * and the zoom factor are computed once per frame, then du/dv per-column and
 * per-row steps are derived so the inner loop is pure floating-point adds —
 * no per-cell trig.
 */
export function generateAsciiRotozoomerFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiRotozoomerOptions = {},
): AnsiScreen {
	const params = resolveAndValidate(options)
	const table = getTextureTable(params)

	const angle = frame * params.rotationSpeed
	const zoom = params.baseZoom + params.zoomAmplitude * Math.sin(frame * params.zoomSpeed)
	// Guard against a degenerate/near-zero zoom collapsing the whole texture to one sample.
	const safeZoom = Math.abs(zoom) < 0.05 ? (zoom < 0 ? -0.05 : 0.05) : zoom

	const cosA = Math.cos(angle) * safeZoom
	const sinA = Math.sin(angle) * safeZoom

	// Per-column step (moving +1 in x) and per-row step (moving +1 in y), in
	// texture space. Rows are aspect-corrected so the rotation reads circular
	// rather than squashed against the tall 8x16 cells.
	const duCol = cosA
	const dvCol = sinA
	const duRow = -sinA * params.safeAspectY
	const dvRow = cosA * params.safeAspectY

	const halfCols = (columns - 1) / 2
	const halfRows = (rows - 1) / 2

	// Starting sample position for cell (0, 0), derived by walking backward
	// from the center by halfCols/halfRows steps.
	let rowU = -halfCols * duCol - halfRows * duRow
	let rowV = -halfCols * dvCol - halfRows * dvRow

	const texSize = params.safeTextureSize
	const invTexSize = 1 / texSize
	const bgColor = params.bgColor

	// Lattice thresholds. `latticeWidth` is expressed in character cells, and one
	// row spans `aspectY` texture units against a column's one, so the v-threshold
	// is scaled by aspectY to keep the horizontal lattice lines the same visual
	// thickness as the vertical ones (an unscaled threshold would be thinner than
	// a single row step and drop out entirely between sample points).
	const latticeU = params.latticeWidth
	const latticeV = params.latticeWidth * params.safeAspectY
	const hasLattice = latticeU > 0

	const lines: AnsiScreen['lines'] = []

	for (let y = 0; y < rows; y++) {
		const line: AnsiScreen['lines'][number] = []
		let u = rowU
		let v = rowV

		for (let x = 0; x < columns; x++) {
			// Tile index in texture space (can be negative — floor handles that).
			const tileU = Math.floor(u * invTexSize)
			const tileV = Math.floor(v * invTexSize)

			if (params.pattern === 'xor') {
				const band = ((tileU ^ tileV) & 0xff)
				line.push({ ch: table.chars[band], fg: table.fgs[band], bg: bgColor, bold: false })
			} else {
				// Position inside the tile, always in [0, texSize) even for
				// negative u/v since tileU/tileV came from Math.floor.
				const onLattice =
					hasLattice && (u - tileU * texSize < latticeU || v - tileV * texSize < latticeV)
				const index = onLattice ? 2 : (tileU + tileV) & 1
				line.push({ ch: table.chars[index], fg: table.fgs[index], bg: bgColor, bold: false })
			}

			u += duCol
			v += dvCol
		}

		rowU += duRow
		rowV += dvRow
		lines.push(line)
	}

	return { lines, columns }
}

/**
 * Create a reusable sampler for the rotozoomer at a specific frame.
 * Returns a function mapping (x, y) to an AnsiCell, backed by a fixed grid.
 */
export function createAsciiRotozoomerSampler(
	frame: number,
	options: AsciiRotozoomerOptions = {},
) {
	const { bgColor = DEFAULT_BG_COLOR } = options

	const cols = 80
	const rows = 60
	const screen = generateAsciiRotozoomerFrame(frame, cols, rows, options)

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
