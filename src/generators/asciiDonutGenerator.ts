import type { AnsiScreen } from '../ansi/types'

// Homage to a1k0n's donut.c — a torus sampled parametrically, rotated about
// two axes, perspective-projected through a Float64 z-buffer onto the
// character grid, and shaded by the surface normal against a fixed light.
// Stateless: every frame is a pure function of (frame, columns, rows, options).

export interface AsciiDonutOptions {
	/** Rotation speed about the X axis, in radians per frame. Default: 0.07 */
	speedA?: number
	/** Rotation speed about the Z axis, in radians per frame. Default: 0.03 */
	speedB?: number
	/** Initial X-axis rotation (radians) added to frame * speedA. Default: 1.0 */
	phaseA?: number
	/** Initial Z-axis rotation (radians) added to frame * speedB. Default: 0.4 */
	phaseB?: number
	/**
	 * Donut diameter as a fraction of the smaller screen dimension
	 * (aspect-corrected), clamped to 0.1–1.5. Default: 0.9
	 */
	size?: number
	/**
	 * Tube radius as a fraction of the ring radius, clamped to 0.15–0.9.
	 * Smaller values give a thin ring with a large hole; values near 1 close
	 * the hole up. Default: 0.5
	 */
	tubeRatio?: number
	/** Luminance ramp characters, dim → bright. Default: '.,-~:;=!*#$@' */
	chars?: string[]
	/** Base color, shaded dark → bright by luminance (CSS color). Default: '#ffaa33' */
	baseColor?: string
	/** Background color (CSS color string). Default: '#000000' */
	bgColor?: string
}

// Cells are ~2x taller than wide (8x16 VGA font); vertical deltas are halved
// when projecting so the torus reads round on screen.
const CELL_ASPECT = 2

const DEFAULT_SPEED_A = 0.07
const DEFAULT_SPEED_B = 0.03
const DEFAULT_PHASE_A = 1.0
const DEFAULT_PHASE_B = 0.4
const DEFAULT_SIZE = 0.9
const DEFAULT_TUBE_RATIO = 0.5
const DEFAULT_CHARS = ['.', ',', '-', '~', ':', ';', '=', '!', '*', '#', '$', '@']
const DEFAULT_BASE_COLOR = '#ffaa33'
const DEFAULT_BG_COLOR = '#000000'

// Torus geometry in world units: ring radius R2, tube radius R1 = tubeRatio * R2,
// camera distance K2. K1 (projection scale) is derived from the screen size.
const RING_RADIUS = 2
const CAMERA_DISTANCE = 5

// Light direction used by donut.c's luminance term: (0, 1/sqrt(2), -1/sqrt(2)),
// i.e. above and behind the viewer. L ranges -sqrt(2)..sqrt(2).
const SHADE_LEVELS = 32

function finiteOr(value: number | undefined, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clampNumber(value: number, min: number, max: number): number {
	return value < min ? min : value > max ? max : value
}

function resolveOptions(options: AsciiDonutOptions) {
	const size = clampNumber(finiteOr(options.size, DEFAULT_SIZE), 0.1, 1.5)
	const tubeRatio = clampNumber(finiteOr(options.tubeRatio, DEFAULT_TUBE_RATIO), 0.15, 0.9)
	const chars = options.chars && options.chars.length > 0 ? options.chars : DEFAULT_CHARS
	return {
		speedA: finiteOr(options.speedA, DEFAULT_SPEED_A),
		speedB: finiteOr(options.speedB, DEFAULT_SPEED_B),
		phaseA: finiteOr(options.phaseA, DEFAULT_PHASE_A),
		phaseB: finiteOr(options.phaseB, DEFAULT_PHASE_B),
		size,
		tubeRatio,
		chars,
		baseColor: options.baseColor?.toString() || DEFAULT_BASE_COLOR,
		bgColor: options.bgColor?.toString() || DEFAULT_BG_COLOR,
	}
}

// ---------------------------------------------------------------------------
// Color table — SHADE_LEVELS 'rgb()' strings from dark to bright, built once
// per baseColor (never per cell, never per frame).
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

let shadeTableColor: string | null = null
let shadeTable: string[] | null = null

function getShadeTable(baseColor: string): string[] {
	if (shadeTableColor === baseColor && shadeTable) return shadeTable
	const [r, g, b] = parseColor(baseColor)
	const table: string[] = new Array(SHADE_LEVELS)
	for (let i = 0; i < SHADE_LEVELS; i++) {
		// 0.25 → 1.0 so even the dimmest lit facet stays visible over black.
		const t = 0.25 + 0.75 * (i / (SHADE_LEVELS - 1))
		const cr = Math.min(255, Math.round(r * t))
		const cg = Math.min(255, Math.round(g * t))
		const cb = Math.min(255, Math.round(b * t))
		table[i] = `rgb(${cr},${cg},${cb})`
	}
	shadeTableColor = baseColor
	shadeTable = table
	return table
}

// ---------------------------------------------------------------------------
// Trig tables for the parametric sweep — cached by step count so the per-frame
// inner loop does no sin/cos at all for the sweep angles.
// ---------------------------------------------------------------------------

type TrigTable = { cos: Float64Array; sin: Float64Array }

let thetaTableSteps = -1
let thetaTable: TrigTable | null = null
let phiTableSteps = -1
let phiTable: TrigTable | null = null

function buildTrigTable(steps: number): TrigTable {
	const cos = new Float64Array(steps)
	const sin = new Float64Array(steps)
	const step = (Math.PI * 2) / steps
	for (let i = 0; i < steps; i++) {
		cos[i] = Math.cos(i * step)
		sin[i] = Math.sin(i * step)
	}
	return { cos, sin }
}

function getThetaTable(steps: number): TrigTable {
	if (thetaTableSteps !== steps || !thetaTable) {
		thetaTable = buildTrigTable(steps)
		thetaTableSteps = steps
	}
	return thetaTable
}

function getPhiTable(steps: number): TrigTable {
	if (phiTableSteps !== steps || !phiTable) {
		phiTable = buildTrigTable(steps)
		phiTableSteps = steps
	}
	return phiTable
}

// Reused scratch buffers (z-buffer + luminance). Float64Array because these
// values feed char-ramp and shade thresholds (hard rule 3). Never exposed in
// the returned screen, so reuse across frames is safe.
let zBuffer = new Float64Array(0)
let lumBuffer = new Float64Array(0)

/**
 * Generate an ASCII spinning-donut frame — the classic donut.c torus.
 * A parametric torus is rotated about two axes, z-buffered onto the grid,
 * and shaded by surface luminance through a character ramp and a precomputed
 * color table.
 */
export function generateAsciiDonutFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiDonutOptions = {},
): AnsiScreen {
	const opts = resolveOptions(options)
	const chars = opts.chars
	const charCount = chars.length
	const shades = getShadeTable(opts.baseColor)

	const tubeRadius = RING_RADIUS * opts.tubeRatio
	const outerRadius = RING_RADIUS + tubeRadius

	// Screen radius in column units; rows count double through the cell aspect.
	const screenRadius = (opts.size * Math.min(columns, rows * CELL_ASPECT)) / 2
	// donut.c's projection fit: the side silhouette sits at z ≈ K2, so
	// K1 = screenRadius * K2 / outerRadius would fill exactly — the 0.75
	// factor leaves headroom for the near-side bulge (smaller z, larger
	// projection) so the donut never clips while still filling the screen.
	const k1 = (0.75 * screenRadius * CAMERA_DISTANCE) / outerRadius

	// Sample densities scale with the projected size (bounded) so the surface
	// has no holes at 80x25 or at much larger grids.
	const phiSteps = clampNumber(Math.ceil(screenRadius * 18), 120, 720) | 0
	const thetaSteps = clampNumber(Math.ceil(screenRadius * 8), 48, 320) | 0
	const thetaTrig = getThetaTable(thetaSteps)
	const phiTrig = getPhiTable(phiSteps)

	const cellCount = columns * rows
	if (zBuffer.length < cellCount) {
		zBuffer = new Float64Array(cellCount)
		lumBuffer = new Float64Array(cellCount)
	}
	zBuffer.fill(0, 0, cellCount)
	lumBuffer.fill(-1, 0, cellCount)

	const a = frame * opts.speedA + opts.phaseA
	const b = frame * opts.speedB + opts.phaseB
	const cosA = Math.cos(a)
	const sinA = Math.sin(a)
	const cosB = Math.cos(b)
	const sinB = Math.sin(b)

	const centerX = columns / 2
	const centerY = rows / 2
	const invSqrt2 = 1 / Math.SQRT2

	for (let t = 0; t < thetaSteps; t++) {
		const cosTheta = thetaTrig.cos[t]
		const sinTheta = thetaTrig.sin[t]
		// Cross-section circle before the sweep rotation.
		const circleX = RING_RADIUS + tubeRadius * cosTheta
		const circleY = tubeRadius * sinTheta

		// Hoisted theta-only luminance terms.
		const lumT1 = sinA * sinTheta
		const lumT2 = cosA * sinTheta

		for (let p = 0; p < phiSteps; p++) {
			const cosPhi = phiTrig.cos[p]
			const sinPhi = phiTrig.sin[p]

			const z = CAMERA_DISTANCE + cosA * circleX * sinPhi + circleY * sinA
			const ooz = 1 / z
			const x = circleX * (cosB * cosPhi + sinA * sinB * sinPhi) - circleY * cosA * sinB
			const y = circleX * (sinB * cosPhi - sinA * cosB * sinPhi) + circleY * cosA * cosB

			const px = Math.round(centerX + k1 * ooz * x)
			const py = Math.round(centerY - (k1 * ooz * y) / CELL_ASPECT)
			if (px < 0 || px >= columns || py < 0 || py >= rows) continue

			const idx = py * columns + px
			if (ooz <= zBuffer[idx]) continue

			// donut.c luminance: surface normal dot (0, 1/sqrt2, -1/sqrt2).
			const lum =
				cosPhi * cosTheta * sinB -
				lumT2 * sinPhi -
				lumT1 +
				cosB * (lumT2 - cosTheta * sinA * sinPhi)
			zBuffer[idx] = ooz
			lumBuffer[idx] = lum > 0 ? lum * invSqrt2 : 0
		}
	}

	const lines: AnsiScreen['lines'] = new Array(rows)
	for (let y = 0; y < rows; y++) {
		const line: AnsiScreen['lines'][number] = new Array(columns)
		const rowOffset = y * columns
		for (let x = 0; x < columns; x++) {
			const lum = lumBuffer[rowOffset + x]
			if (lum < 0) {
				line[x] = { ch: ' ', fg: opts.bgColor, bg: opts.bgColor, bold: false }
			} else {
				const clamped = lum > 1 ? 1 : lum
				const charIndex = Math.min(charCount - 1, Math.floor(clamped * charCount))
				const shadeIndex = Math.min(SHADE_LEVELS - 1, Math.floor(clamped * SHADE_LEVELS))
				line[x] = {
					ch: chars[charIndex],
					fg: shades[shadeIndex],
					bg: opts.bgColor,
					bold: clamped > 0.75,
				}
			}
		}
		lines[y] = line
	}

	return { lines, columns }
}

/**
 * Create a reusable sampler for the donut at a specific frame.
 * Returns a function mapping (x, y) to an AnsiCell, wrapping at a fixed
 * virtual grid.
 */
export function createAsciiDonutSampler(frame: number, options: AsciiDonutOptions = {}) {
	const cols = 80
	const rows = 60
	const screen = generateAsciiDonutFrame(frame, cols, rows, options)
	const bgColor = options.bgColor?.toString() || DEFAULT_BG_COLOR

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
