import type { AnsiCell, AnsiScreen } from '../ansi/types'

// Amiga "Boing Ball" (1984 demo) — a checkered red/white sphere bouncing in a
// perspective room: a flat back wall with a regular purple grid, and a floor
// with lines that converge toward a horizon (perspective). The ball rolls as
// it drifts and casts a soft shadow on the floor/wall behind it.

export interface AsciiBoingBallOptions {
	/** Ball size multiplier. Radius ≈ (rows / 3) * scale, in column-units. Default: 1 */
	scale?: number
	/** Vertical bounce angular speed (radians of |sin| phase per frame). Default: 0.15 */
	bounceSpeed?: number
	/** Horizontal drift speed (triangle-wave phase per frame). Default: 0.045 */
	driftSpeed?: number
	/**
	 * Roll rate around the vertical axis, expressed as the radians-per-frame the
	 * checker texture would rotate at while the ball is drifting (rolls opposite
	 * its travel direction). Internally the spin angle is computed as a continuous
	 * function of the ball's horizontal position rather than `frame * spinSpeed`
	 * directly -- i.e. `spin = -(spinSpeed / (travel * driftSpeed)) * cx(frame)` --
	 * so the texture never jumps at drift reversals; this option only sets the
	 * proportionality constant, preserving the same visual rate as a naive
	 * per-frame multiplier would while staying continuous. Default: 0.22
	 */
	spinSpeed?: number
	/** Number of latitude checker bands on the sphere (longitude uses 2x). Default: 8 */
	checkerDensity?: number
	/** Red checker squares (CSS color). Default: '#cc2222' */
	ballRedColor?: string
	/** White checker squares (CSS color). Default: '#f2f2f2' */
	ballWhiteColor?: string
	/** Grid line color for the back wall / floor (CSS color). Default: '#a239d6' */
	gridColor?: string
	/** Background field color for the back wall / floor (CSS color). Default: '#c9c9cf' */
	bgColor?: string
	/** Shadow color cast by the ball onto the wall/floor (CSS color). Default: '#4a4a52' */
	shadowColor?: string
	/** Light direction X component (camera space). Default: -0.5 */
	lightDirX?: number
	/** Light direction Y component (camera space, screen-down positive). Default: -0.65 */
	lightDirY?: number
	/** Light direction Z component (camera space, toward viewer positive). Default: 0.58 */
	lightDirZ?: number
}

// Cells are roughly twice as tall as they are wide (8x16 VGA font), so a
// screen-round circle needs the vertical delta scaled up before comparing
// against a radius expressed in column-units.
const CELL_ASPECT = 2

const DEFAULTS = {
	scale: 1,
	bounceSpeed: 0.15,
	driftSpeed: 0.045,
	spinSpeed: 0.22,
	checkerDensity: 8,
	ballRedColor: '#cc2222',
	ballWhiteColor: '#f2f2f2',
	gridColor: '#a239d6',
	bgColor: '#c9c9cf',
	shadowColor: '#4a4a52',
	lightDirX: -0.5,
	lightDirY: -0.65,
	lightDirZ: 0.58,
} satisfies Required<AsciiBoingBallOptions>

type ResolvedOptions = Required<AsciiBoingBallOptions>

function finiteOr(value: number | undefined, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clampInt(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) return min
	const n = Math.round(value)
	return n < min ? min : n > max ? max : n
}

function resolveOptions(options: AsciiBoingBallOptions): ResolvedOptions {
	const scaleRaw = finiteOr(options.scale, DEFAULTS.scale)
	return {
		scale: scaleRaw > 0 ? scaleRaw : DEFAULTS.scale,
		bounceSpeed: finiteOr(options.bounceSpeed, DEFAULTS.bounceSpeed),
		driftSpeed: finiteOr(options.driftSpeed, DEFAULTS.driftSpeed),
		spinSpeed: finiteOr(options.spinSpeed, DEFAULTS.spinSpeed),
		checkerDensity: clampInt(options.checkerDensity ?? DEFAULTS.checkerDensity, 2, 32),
		ballRedColor: options.ballRedColor?.toString() || DEFAULTS.ballRedColor,
		ballWhiteColor: options.ballWhiteColor?.toString() || DEFAULTS.ballWhiteColor,
		gridColor: options.gridColor?.toString() || DEFAULTS.gridColor,
		bgColor: options.bgColor?.toString() || DEFAULTS.bgColor,
		shadowColor: options.shadowColor?.toString() || DEFAULTS.shadowColor,
		lightDirX: finiteOr(options.lightDirX, DEFAULTS.lightDirX),
		lightDirY: finiteOr(options.lightDirY, DEFAULTS.lightDirY),
		lightDirZ: finiteOr(options.lightDirZ, DEFAULTS.lightDirZ),
	}
}

// ---------------------------------------------------------------------------
// Color helpers (build-time only — never called per cell, per frame)
// ---------------------------------------------------------------------------

function parseColor(color: string): [number, number, number] {
	if (color.startsWith('#')) {
		const hex = color.slice(1)
		if (hex.length === 3) {
			return [
				parseInt(hex[0] + hex[0], 16),
				parseInt(hex[1] + hex[1], 16),
				parseInt(hex[2] + hex[2], 16),
			]
		}
		return [
			parseInt(hex.slice(0, 2), 16),
			parseInt(hex.slice(2, 4), 16),
			parseInt(hex.slice(4, 6), 16),
		]
	}
	const match = color.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
	if (match) {
		return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]
	}
	return [255, 255, 255]
}

function rgbString(r: number, g: number, b: number): string {
	const cr = r < 0 ? 0 : r > 255 ? 255 : r | 0
	const cg = g < 0 ? 0 : g > 255 ? 255 : g | 0
	const cb = b < 0 ? 0 : b > 255 ? 255 : b | 0
	return `rgb(${cr},${cg},${cb})`
}

function scaleColorString(rgb: [number, number, number], factor: number): string {
	return rgbString(rgb[0] * factor, rgb[1] * factor, rgb[2] * factor)
}

function blendColorString(a: [number, number, number], b: [number, number, number], t: number): string {
	return rgbString(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)
}

// ---------------------------------------------------------------------------
// Surface shading ramp — precomputed per (ballRedColor, ballWhiteColor)
// ---------------------------------------------------------------------------

const RAMP_CHARS = ['▒', '▓', '█'] // ▒ dim, ▓ mid, █ bright

type ShadeRamp = { red: [string, string, string]; white: [string, string, string] }

let rampCacheRed = ''
let rampCacheWhite = ''
let rampCache: ShadeRamp | null = null

function getRamp(redColor: string, whiteColor: string): ShadeRamp {
	if (rampCache && rampCacheRed === redColor && rampCacheWhite === whiteColor) return rampCache
	const red = parseColor(redColor)
	const white = parseColor(whiteColor)
	rampCache = {
		red: [scaleColorString(red, 0.45), scaleColorString(red, 0.75), scaleColorString(red, 1.0)],
		white: [scaleColorString(white, 0.45), scaleColorString(white, 0.75), scaleColorString(white, 1.0)],
	}
	rampCacheRed = redColor
	rampCacheWhite = whiteColor
	return rampCache
}

// ---------------------------------------------------------------------------
// Background: back wall (regular grid) + perspective floor.
// Fully precomputed once per (columns, rows, bgColor, gridColor, shadowColor)
// into cached rows of AnsiCell — per-frame code only ever reads references
// out of this cache, it never recomputes colors.
//
// The reference Amiga demo is a LIGHT GRAY field crossed by THIN purple lines,
// so the field colour is what fills every background cell and the grid is drawn
// as single-cell-wide box-drawing glyphs (CP437 0xC4/0xB3/0xC5) in the grid
// colour on top of it. Painting grid cells as solid purple blocks instead — and
// spacing the floor's perspective lines closer together than the floor is tall,
// which packed a line onto every single floor row — is what turned the room into
// a slab of purple with a few gray tiles floating in it.
// ---------------------------------------------------------------------------

const GRID_HORIZONTAL = '─'
const GRID_VERTICAL = '│'
const GRID_CROSS = '┼'

// Target wall grid spacing in columns; rows use half of it so the tiles read
// square through the 2:1 character cell.
const WALL_TILE_COLUMNS = 12
const FLOOR_GAMMA = 1.6
const VERTICAL_LINE_COUNT = 9

// How far the floor's vertical lines have already fanned out at the horizon.
// Converging them all the way to a single vanishing point piles every line into
// three or four columns on the short floors a character grid gives us, which
// reads as a clot of glyphs rather than as perspective.
const FLOOR_NEAR_SPREAD = 0.35

type BackgroundCache = {
	columns: number
	rows: number
	bgColor: string
	gridColor: string
	shadowColor: string
	horizonRow: number
	bgRows: AnsiCell[][]
	shadowRows: AnsiCell[][]
}

function computeHorizonRow(rows: number): number {
	const h = Math.round(rows * (2 / 3))
	return h < 1 ? 1 : h > rows - 1 ? rows - 1 : h
}

function buildBackground(
	columns: number,
	rows: number,
	opts: ResolvedOptions
): BackgroundCache {
	const horizonRow = computeHorizonRow(rows)

	const wallSpacingX = Math.max(4, Math.round(columns / Math.max(1, Math.round(columns / WALL_TILE_COLUMNS))))
	const wallSpacingY = Math.max(2, Math.round(wallSpacingX / CELL_ASPECT))

	// Floor: rows where a perspective horizontal line falls, bunching toward the
	// horizon. The count is derived from how many rows the floor actually has —
	// a fixed count on a short floor lands a line on every row and fills the
	// whole floor with grid colour instead of drawing lines on it.
	const floorHeight = Math.max(1, rows - 1 - horizonRow)
	const floorLineCount = Math.max(2, Math.min(6, Math.round(floorHeight / 3)))
	const horizontalLineRows = new Set<number>([horizonRow])
	let previousLineRow = horizonRow
	for (let k = 1; k <= floorLineCount; k++) {
		const d = k / floorLineCount
		let y = Math.round(horizonRow + floorHeight * Math.pow(d, FLOOR_GAMMA))
		// Perspective bunching plus rounding can drop two lines onto neighbouring
		// rows (or the horizon itself), which paints a solid band instead of two
		// lines with floor between them. Keep at least one clear row between them.
		if (y <= previousLineRow + 1) y = previousLineRow + 2
		if (y > rows - 1) break
		horizontalLineRows.add(y)
		previousLineRow = y
	}

	// Floor: vertical lines fan outward from the horizon's center toward the bottom.
	const centerX = columns / 2
	const baseXs: number[] = []
	for (let i = 0; i < VERTICAL_LINE_COUNT; i++) {
		baseXs.push((i + 0.5) * (columns / VERTICAL_LINE_COUNT))
	}

	const bgRgb = parseColor(opts.bgColor)
	const gridRgb = parseColor(opts.gridColor)
	const shadowRgb = parseColor(opts.shadowColor)
	const shadowedBg = blendColorString(bgRgb, shadowRgb, 0.72)
	const shadowedGrid = blendColorString(gridRgb, shadowRgb, 0.6)

	const bgRows: AnsiCell[][] = new Array(rows)
	const shadowRows: AnsiCell[][] = new Array(rows)
	const verticalMask = new Uint8Array(columns)

	for (let y = 0; y < rows; y++) {
		const bgRow: AnsiCell[] = new Array(columns)
		const shadowRow: AnsiCell[] = new Array(columns)

		const isFloor = y >= horizonRow
		let floorT = 0
		if (isFloor) {
			floorT = (y - horizonRow) / floorHeight
		}

		// Wall rows are counted back from the horizon rather than from row 0, so the
		// lowest wall line never lands immediately above the horizon line.
		const isHorizontalLine = isFloor
			? horizontalLineRows.has(y)
			: (horizonRow - y) % wallSpacingY === 0

		// Where this row's floor lines land, resolved once per row rather than
		// re-derived for every cell.
		verticalMask.fill(0)
		if (isFloor) {
			const spread = FLOOR_NEAR_SPREAD + (1 - FLOOR_NEAR_SPREAD) * floorT
			for (let i = 0; i < VERTICAL_LINE_COUNT; i++) {
				const lineX = Math.round(centerX + (baseXs[i] - centerX) * spread)
				if (lineX >= 0 && lineX < columns) verticalMask[lineX] = 1
			}
		}

		for (let x = 0; x < columns; x++) {
			const isVerticalLine = isFloor ? verticalMask[x] === 1 : x % wallSpacingX === 0

			const ch = isVerticalLine
				? isHorizontalLine
					? GRID_CROSS
					: GRID_VERTICAL
				: isHorizontalLine
					? GRID_HORIZONTAL
					: ' '

			// The field colour always fills the cell background; the grid is only
			// ever a thin glyph stroke drawn over it.
			const isGrid = ch !== ' '
			bgRow[x] = {
				ch,
				fg: isGrid ? opts.gridColor : opts.bgColor,
				bg: opts.bgColor,
				bold: false,
			}
			shadowRow[x] = {
				ch,
				fg: isGrid ? shadowedGrid : shadowedBg,
				bg: shadowedBg,
				bold: false,
			}
		}

		bgRows[y] = bgRow
		shadowRows[y] = shadowRow
	}

	return {
		columns,
		rows,
		bgColor: opts.bgColor,
		gridColor: opts.gridColor,
		shadowColor: opts.shadowColor,
		horizonRow,
		bgRows,
		shadowRows,
	}
}

let backgroundCache: BackgroundCache | null = null

function getBackground(columns: number, rows: number, opts: ResolvedOptions): BackgroundCache {
	const c = backgroundCache
	if (
		c &&
		c.columns === columns &&
		c.rows === rows &&
		c.bgColor === opts.bgColor &&
		c.gridColor === opts.gridColor &&
		c.shadowColor === opts.shadowColor
	) {
		return c
	}
	backgroundCache = buildBackground(columns, rows, opts)
	return backgroundCache
}

// ---------------------------------------------------------------------------
// Ball motion — pure functions of frame, deterministic (no stored state).
// ---------------------------------------------------------------------------

type BallFrame = {
	cx: number
	cy: number
	r: number
	r2: number
	cosSpin: number
	sinSpin: number
	shadowCx: number
	shadowCy: number
	shadowRx: number
	shadowRy: number
	minX: number
	maxX: number
	minY: number
	maxY: number
}

function computeBallFrame(
	frame: number,
	columns: number,
	rows: number,
	horizonRow: number,
	opts: ResolvedOptions
): BallFrame {
	const r = Math.max(1, (rows / 3) * opts.scale)
	const r2 = r * r

	// Horizontal drift: deterministic triangle wave, no stored velocity/state.
	const margin = r + 1
	const travel = Math.max(0, columns - 2 * margin)
	let cx: number
	if (travel <= 0) {
		cx = columns / 2
	} else {
		const phase = ((frame * opts.driftSpeed) % 2 + 2) % 2
		const pos = phase < 1 ? phase : 2 - phase
		cx = margin + pos * travel
	}

	// Vertical bounce: y = floor - bounceHeight * |sin(frame * bounceSpeed)|
	const halfHeight = r / CELL_ASPECT
	const floorRow = horizonRow + 1
	const restCenterY = floorRow - halfHeight
	const bounceHeightRows = Math.max(0, restCenterY - halfHeight - 1)
	const cy = restCenterY - bounceHeightRows * Math.abs(Math.sin(frame * opts.bounceSpeed))

	// Ball visually rolls opposite its travel direction. Spin is derived from the
	// ball's horizontal *position* (cx), not from `frame * spinSpeed * driftDirection`
	// -- the latter is discontinuous, because the drift direction flips sign at every
	// reversal while `frame` keeps growing, so the product jumps by ~2 * frame *
	// spinSpeed radians at each turnaround (visible as the checker texture
	// "teleporting" on the surface). Position is a rolling-without-slipping integral
	// of velocity, so it stays continuous through reversals for free -- a ball that
	// travels forward then back by the same distance ends up spun back to the same
	// orientation, exactly like a physical ball rolling on the floor.
	//
	// rollFactor converts columns of travel into radians of spin. It's picked so the
	// spin rate (radians/frame) while the ball is moving matches spinSpeed's old
	// per-frame meaning: d(spin)/d(frame) = rollFactor * d(cx)/d(frame), and
	// d(cx)/d(frame) has magnitude `travel * driftSpeed` while drifting, so
	// rollFactor = spinSpeed / (travel * driftSpeed) reproduces the same visual rate.
	const driftVelocity = travel * opts.driftSpeed
	const rollFactor = travel > 0 && driftVelocity > 1e-9 ? opts.spinSpeed / driftVelocity : 0
	const spin = travel > 0 && driftVelocity > 1e-9 ? -rollFactor * cx : frame * opts.spinSpeed
	const cosSpin = Math.cos(spin)
	const sinSpin = Math.sin(spin)

	// Shadow: pinned to the floor rest position, offset to the side, tracks drift only.
	const shadowRx = Math.max(0.5, r * 0.85)
	const shadowRy = Math.max(0.5, halfHeight * 0.32)
	const shadowCx = cx + r * 0.55
	const shadowCy = restCenterY + halfHeight * 0.55

	const ballMinX = Math.floor(cx - r)
	const ballMaxX = Math.ceil(cx + r)
	const ballMinY = Math.floor(cy - halfHeight)
	const ballMaxY = Math.ceil(cy + halfHeight)

	const shadowMinX = Math.floor(shadowCx - shadowRx)
	const shadowMaxX = Math.ceil(shadowCx + shadowRx)
	const shadowMinY = Math.floor(shadowCy - shadowRy)
	const shadowMaxY = Math.ceil(shadowCy + shadowRy)

	const minX = Math.max(0, Math.min(ballMinX, shadowMinX))
	const maxX = Math.min(columns - 1, Math.max(ballMaxX, shadowMaxX))
	const minY = Math.max(0, Math.min(ballMinY, shadowMinY))
	const maxY = Math.min(rows - 1, Math.max(ballMaxY, shadowMaxY))

	return {
		cx,
		cy,
		r,
		r2,
		cosSpin,
		sinSpin,
		shadowCx,
		shadowCy,
		shadowRx,
		shadowRy,
		minX,
		maxX,
		minY,
		maxY,
	}
}

function clamp(v: number, min: number, max: number): number {
	return v < min ? min : v > max ? max : v
}

function computeBallCell(
	x: number,
	y: number,
	ball: BallFrame,
	ramp: ShadeRamp,
	checkerDensity: number,
	lightX: number,
	lightY: number,
	lightZ: number
): AnsiCell | null {
	const dx = x - ball.cx
	const dyc = (y - ball.cy) * CELL_ASPECT
	const distSq = dx * dx + dyc * dyc
	if (distSq > ball.r2) return null

	const r = ball.r
	const zc = Math.sqrt(Math.max(0, ball.r2 - distSq))

	// Camera-space unit normal — used for lighting (light stays fixed in world space).
	const nx = dx / r
	const ny = dyc / r
	const nz = zc / r

	// Rotate the normal into object space (spin) for the texture lookup only.
	const rx = nx * ball.cosSpin - nz * ball.sinSpin
	const rz = nx * ball.sinSpin + nz * ball.cosSpin
	const ry = ny

	const lat = Math.asin(clamp(ry, -1, 1))
	const lon = Math.atan2(rz, rx)

	const step = Math.PI / checkerDensity
	const latIndex = Math.floor((lat + Math.PI / 2) / step)
	const lonIndex = Math.floor((lon + Math.PI) / step)
	const parity = ((latIndex + lonIndex) % 2 + 2) % 2

	const lit = clamp(nx * lightX + ny * lightY + nz * lightZ, 0, 1)
	const shadeIndex = lit > 0.66 ? 2 : lit > 0.33 ? 1 : 0
	const chosenRamp = parity === 0 ? ramp.red : ramp.white
	const color = chosenRamp[shadeIndex]

	return { ch: RAMP_CHARS[shadeIndex], fg: color, bg: color, bold: false }
}

/**
 * Generate an ASCII Amiga "Boing Ball" frame — a checkered red/white sphere
 * bouncing and rolling in front of a perspective grid room, complete with a
 * drifting cast shadow. Pure function of `frame`; no internal state.
 */
export function generateAsciiBoingBallFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiBoingBallOptions = {}
): AnsiScreen {
	const opts = resolveOptions(options)
	const bg = getBackground(columns, rows, opts)
	const ball = computeBallFrame(frame, columns, rows, bg.horizonRow, opts)
	const ramp = getRamp(opts.ballRedColor, opts.ballWhiteColor)

	// Normalize the light direction once per frame (cheap, O(1) — not per cell).
	let lx = opts.lightDirX
	let ly = opts.lightDirY
	let lz = opts.lightDirZ
	const len = Math.sqrt(lx * lx + ly * ly + lz * lz) || 1
	lx /= len
	ly /= len
	lz /= len

	const lines: AnsiScreen['lines'] = new Array(rows)

	for (let y = 0; y < rows; y++) {
		if (y < ball.minY || y > ball.maxY) {
			// Entirely outside the ball/shadow bounding box — reuse the cached row as-is.
			lines[y] = bg.bgRows[y]
			continue
		}

		const bgRow = bg.bgRows[y]
		const shadowRow = bg.shadowRows[y]
		const line: AnsiCell[] = new Array(columns)

		for (let x = 0; x < columns; x++) {
			if (x < ball.minX || x > ball.maxX) {
				line[x] = bgRow[x]
				continue
			}

			const ballCell = computeBallCell(x, y, ball, ramp, opts.checkerDensity, lx, ly, lz)
			if (ballCell) {
				line[x] = ballCell
				continue
			}

			const sdx = (x - ball.shadowCx) / ball.shadowRx
			const sdy = (y - ball.shadowCy) / ball.shadowRy
			if (sdx * sdx + sdy * sdy <= 1) {
				line[x] = shadowRow[x]
			} else {
				line[x] = bgRow[x]
			}
		}

		lines[y] = line
	}

	return { lines, columns }
}

/**
 * Create a reusable sampler for the boing ball at a specific frame.
 * Returns a function mapping (x, y) to an AnsiCell, wrapping at a fixed
 * virtual grid.
 */
export function createAsciiBoingBallSampler(frame: number, options: AsciiBoingBallOptions = {}) {
	const cols = 80
	const rows = 40
	const screen = generateAsciiBoingBallFrame(frame, cols, rows, options)

	return (x: number, y: number) => {
		const wrappedX = ((x % cols) + cols) % cols
		const wrappedY = ((y % rows) + rows) % rows
		const cell = screen.lines[wrappedY]?.[wrappedX]
		if (!cell) {
			const opts = resolveOptions(options)
			return { ch: ' ', fg: opts.bgColor, bg: opts.bgColor, bold: false }
		}
		return cell
	}
}
