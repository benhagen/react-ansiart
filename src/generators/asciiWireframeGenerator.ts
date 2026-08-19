import type { AnsiScreen } from '../ansi/types'

// Glenz-vector style spinning wireframe polyhedron — rotating vertex/edge
// tables, perspective projection, DDA line walks into a Float64 depth buffer
// so nearer edges win and shade brighter. Stateless: a pure function of
// (frame, columns, rows, options).

export type AsciiWireframeShape = 'cube' | 'tetrahedron' | 'octahedron' | 'icosahedron'

export interface AsciiWireframeOptions {
	/** Which polyhedron to spin. Default: 'cube' */
	shape?: AsciiWireframeShape
	/**
	 * Object diameter as a fraction of the screen height (aspect-corrected),
	 * clamped to 0.1–2. Default: 0.8
	 */
	size?: number
	/** Rotation speed about the X axis, radians per frame. Default: 0.019 */
	speedX?: number
	/** Rotation speed about the Y axis, radians per frame. Default: 0.023 */
	speedY?: number
	/** Rotation speed about the Z axis, radians per frame. Default: 0.011 */
	speedZ?: number
	/** Edge color (CSS color), shaded darker with depth when depthShading is on. Default: '#44ff88' */
	edgeColor?: string
	/** Vertex marker color (CSS color). Default: '#ffffff' */
	vertexColor?: string
	/** Shade nearer edges brighter via a precomputed 16-level table. Default: true */
	depthShading?: boolean
	/** Background color (CSS color string). Default: '#000000' */
	bgColor?: string
	/** Edge characters from far to near (CP437-safe). Default: ['·', ':', '+', '#'] */
	edgeChars?: string[]
	/** Vertex marker character (CP437-safe). Default: '■' */
	vertexChar?: string
}

// Cells are ~2x taller than wide (8x16 VGA font); the projected Y delta is
// halved so the polyhedron reads with true proportions on screen.
const CELL_ASPECT = 2

const DEFAULT_SHAPE: AsciiWireframeShape = 'cube'
const DEFAULT_SIZE = 0.8
const DEFAULT_SPEED_X = 0.019
const DEFAULT_SPEED_Y = 0.023
const DEFAULT_SPEED_Z = 0.011
const DEFAULT_EDGE_COLOR = '#44ff88'
const DEFAULT_VERTEX_COLOR = '#ffffff'
const DEFAULT_BG_COLOR = '#000000'
const DEFAULT_EDGE_CHARS = ['·', ':', '+', '#']
const DEFAULT_VERTEX_CHAR = '■'

// Initial rotation offsets so frame 0 is not an axis-aligned degenerate view.
const INITIAL_ANGLE_X = 0.55
const INITIAL_ANGLE_Y = 0.35
const INITIAL_ANGLE_Z = 0.15

// Camera sits CAMERA_DISTANCE world units in front of the (unit-radius) object.
const CAMERA_DISTANCE = 3.2
const DEPTH_LEVELS = 16

// ---------------------------------------------------------------------------
// Shape tables. Raw coordinates are normalized to unit radius; edges are the
// vertex pairs at the polyhedron's minimal pairwise distance — for these four
// regular solids that is exactly the edge set. Built once at module load.
// ---------------------------------------------------------------------------

type Shape3D = {
	/** Flat xyz triples, unit radius. */
	vertices: Float64Array
	/** Pairs of vertex indices. */
	edges: ReadonlyArray<readonly [number, number]>
}

function buildShape(raw: number[][]): Shape3D {
	const count = raw.length
	const vertices = new Float64Array(count * 3)
	for (let i = 0; i < count; i++) {
		const [x, y, z] = raw[i]
		const len = Math.sqrt(x * x + y * y + z * z) || 1
		vertices[i * 3] = x / len
		vertices[i * 3 + 1] = y / len
		vertices[i * 3 + 2] = z / len
	}

	// Minimal pairwise squared distance over the raw coordinates.
	let minDistSq = Infinity
	for (let i = 0; i < count; i++) {
		for (let j = i + 1; j < count; j++) {
			const dx = raw[i][0] - raw[j][0]
			const dy = raw[i][1] - raw[j][1]
			const dz = raw[i][2] - raw[j][2]
			const d = dx * dx + dy * dy + dz * dz
			if (d < minDistSq) minDistSq = d
		}
	}

	const edges: Array<readonly [number, number]> = []
	const tolerance = minDistSq * 1e-6
	for (let i = 0; i < count; i++) {
		for (let j = i + 1; j < count; j++) {
			const dx = raw[i][0] - raw[j][0]
			const dy = raw[i][1] - raw[j][1]
			const dz = raw[i][2] - raw[j][2]
			const d = dx * dx + dy * dy + dz * dz
			if (Math.abs(d - minDistSq) <= tolerance) edges.push([i, j])
		}
	}
	return { vertices, edges }
}

const GOLDEN = (1 + Math.sqrt(5)) / 2

const SHAPES: Record<AsciiWireframeShape, Shape3D> = {
	cube: buildShape([
		[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
		[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
	]),
	tetrahedron: buildShape([
		[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1],
	]),
	octahedron: buildShape([
		[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
	]),
	icosahedron: buildShape([
		[0, 1, GOLDEN], [0, 1, -GOLDEN], [0, -1, GOLDEN], [0, -1, -GOLDEN],
		[1, GOLDEN, 0], [1, -GOLDEN, 0], [-1, GOLDEN, 0], [-1, -GOLDEN, 0],
		[GOLDEN, 0, 1], [-GOLDEN, 0, 1], [GOLDEN, 0, -1], [-GOLDEN, 0, -1],
	]),
}

// ---------------------------------------------------------------------------
// Option resolution
// ---------------------------------------------------------------------------

function finiteOr(value: number | undefined, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clampNumber(value: number, min: number, max: number): number {
	return value < min ? min : value > max ? max : value
}

function resolveOptions(options: AsciiWireframeOptions) {
	const shape: AsciiWireframeShape =
		options.shape && options.shape in SHAPES ? options.shape : DEFAULT_SHAPE
	const edgeChars =
		options.edgeChars && options.edgeChars.length > 0 ? options.edgeChars : DEFAULT_EDGE_CHARS
	const vertexChar =
		options.vertexChar && [...options.vertexChar].length === 1
			? options.vertexChar
			: DEFAULT_VERTEX_CHAR
	return {
		shape,
		size: clampNumber(finiteOr(options.size, DEFAULT_SIZE), 0.1, 2),
		speedX: finiteOr(options.speedX, DEFAULT_SPEED_X),
		speedY: finiteOr(options.speedY, DEFAULT_SPEED_Y),
		speedZ: finiteOr(options.speedZ, DEFAULT_SPEED_Z),
		edgeColor: options.edgeColor?.toString() || DEFAULT_EDGE_COLOR,
		vertexColor: options.vertexColor?.toString() || DEFAULT_VERTEX_COLOR,
		depthShading: options.depthShading ?? true,
		bgColor: options.bgColor?.toString() || DEFAULT_BG_COLOR,
		edgeChars,
		vertexChar,
	}
}

// ---------------------------------------------------------------------------
// Depth-shade color table — DEPTH_LEVELS 'rgb()' strings from far-dim to
// near-bright, built once per edgeColor (never per cell).
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

let depthTableColor: string | null = null
let depthTable: string[] | null = null

function getDepthTable(edgeColor: string): string[] {
	if (depthTableColor === edgeColor && depthTable) return depthTable
	const [r, g, b] = parseColor(edgeColor)
	const table: string[] = new Array(DEPTH_LEVELS)
	for (let i = 0; i < DEPTH_LEVELS; i++) {
		const t = 0.3 + 0.7 * (i / (DEPTH_LEVELS - 1))
		const cr = Math.min(255, Math.round(r * t))
		const cg = Math.min(255, Math.round(g * t))
		const cb = Math.min(255, Math.round(b * t))
		table[i] = `rgb(${cr},${cg},${cb})`
	}
	depthTableColor = edgeColor
	depthTable = table
	return table
}

// Reused scratch buffers. Float64Array for depth because it feeds shade/char
// thresholds (hard rule 3). Never exposed in the returned screen.
let depthBuffer = new Float64Array(0)
let kindBuffer = new Uint8Array(0)

const KIND_NONE = 0
const KIND_EDGE = 1
const KIND_VERTEX = 2

/**
 * Generate an ASCII wireframe frame — a spinning polyhedron (cube,
 * tetrahedron, octahedron, or icosahedron) drawn with depth-buffered,
 * depth-shaded edges and marked vertices.
 */
export function generateAsciiWireframeFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiWireframeOptions = {},
): AnsiScreen {
	const opts = resolveOptions(options)
	const { vertices, edges } = SHAPES[opts.shape]
	const vertexCount = vertices.length / 3
	const depthColors = getDepthTable(opts.edgeColor)
	const edgeChars = opts.edgeChars
	const edgeCharCount = edgeChars.length

	// Rotation matrix Rz * Ry * Rx composed once per frame.
	const ax = frame * opts.speedX + INITIAL_ANGLE_X
	const ay = frame * opts.speedY + INITIAL_ANGLE_Y
	const az = frame * opts.speedZ + INITIAL_ANGLE_Z
	const cx = Math.cos(ax)
	const sx = Math.sin(ax)
	const cy = Math.cos(ay)
	const sy = Math.sin(ay)
	const cz = Math.cos(az)
	const sz = Math.sin(az)

	const m00 = cz * cy
	const m01 = cz * sy * sx - sz * cx
	const m02 = cz * sy * cx + sz * sx
	const m10 = sz * cy
	const m11 = sz * sy * sx + cz * cx
	const m12 = sz * sy * cx - cz * sx
	const m20 = -sy
	const m21 = cy * sx
	const m22 = cy * cx

	// Projection scale in column units. size is a fraction of the screen
	// height. For a unit-radius object at camera distance D, the largest
	// projected radius over all orientations is D / sqrt(D^2 - 1) times the
	// nominal (z = 0) projection, so dividing by that keeps the silhouette
	// inside size * rows for every rotation — no clipping, no dead margin.
	const perspectiveHeadroom =
		Math.sqrt(CAMERA_DISTANCE * CAMERA_DISTANCE - 1) / CAMERA_DISTANCE
	const scale = ((opts.size * rows * CELL_ASPECT) / 2) * perspectiveHeadroom
	const centerX = columns / 2
	const centerY = rows / 2

	// Project all vertices.
	const projX = new Float64Array(vertexCount)
	const projY = new Float64Array(vertexCount)
	const projZ = new Float64Array(vertexCount)
	for (let i = 0; i < vertexCount; i++) {
		const x = vertices[i * 3]
		const y = vertices[i * 3 + 1]
		const z = vertices[i * 3 + 2]
		const rx = m00 * x + m01 * y + m02 * z
		const ry = m10 * x + m11 * y + m12 * z
		const rz = m20 * x + m21 * y + m22 * z
		const persp = CAMERA_DISTANCE / (CAMERA_DISTANCE + rz)
		projX[i] = centerX + rx * persp * scale
		projY[i] = centerY - (ry * persp * scale) / CELL_ASPECT
		projZ[i] = rz
	}

	const cellCount = columns * rows
	if (depthBuffer.length < cellCount) {
		depthBuffer = new Float64Array(cellCount)
		kindBuffer = new Uint8Array(cellCount)
	}
	depthBuffer.fill(Infinity, 0, cellCount)
	kindBuffer.fill(KIND_NONE, 0, cellCount)

	// Walk each edge with a DDA sampled at 2x cell density so lines stay
	// connected after rounding; nearer samples win the depth buffer.
	for (const [i0, i1] of edges) {
		const x0 = projX[i0]
		const y0 = projY[i0]
		const z0 = projZ[i0]
		const dx = projX[i1] - x0
		const dy = projY[i1] - y0
		const dz = projZ[i1] - z0
		const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 2))
		const inv = 1 / steps
		for (let s = 0; s <= steps; s++) {
			const t = s * inv
			const px = Math.round(x0 + dx * t)
			const py = Math.round(y0 + dy * t)
			if (px < 0 || px >= columns || py < 0 || py >= rows) continue
			const z = z0 + dz * t
			const idx = py * columns + px
			if (z < depthBuffer[idx]) {
				depthBuffer[idx] = z
				kindBuffer[idx] = KIND_EDGE
			}
		}
	}

	// Vertex markers win their own cell against their own edges (equal depth)
	// but lose to a genuinely nearer edge passing in front.
	for (let i = 0; i < vertexCount; i++) {
		const px = Math.round(projX[i])
		const py = Math.round(projY[i])
		if (px < 0 || px >= columns || py < 0 || py >= rows) continue
		const idx = py * columns + px
		if (projZ[i] <= depthBuffer[idx] + 1e-4) {
			if (projZ[i] < depthBuffer[idx]) depthBuffer[idx] = projZ[i]
			kindBuffer[idx] = KIND_VERTEX
		}
	}

	const brightestColor = depthColors[DEPTH_LEVELS - 1]
	const lines: AnsiScreen['lines'] = new Array(rows)
	for (let y = 0; y < rows; y++) {
		const line: AnsiScreen['lines'][number] = new Array(columns)
		const rowOffset = y * columns
		for (let x = 0; x < columns; x++) {
			const kind = kindBuffer[rowOffset + x]
			if (kind === KIND_NONE) {
				line[x] = { ch: ' ', fg: opts.bgColor, bg: opts.bgColor, bold: false }
			} else if (kind === KIND_VERTEX) {
				line[x] = { ch: opts.vertexChar, fg: opts.vertexColor, bg: opts.bgColor, bold: true }
			} else {
				// Nearness in [0, 1]: rotated z spans [-1, 1] for unit-radius shapes.
				const z = depthBuffer[rowOffset + x]
				const nearness = clampNumber((1 - z) / 2, 0, 1)
				const charIndex = Math.min(edgeCharCount - 1, Math.floor(nearness * edgeCharCount))
				const fg = opts.depthShading
					? depthColors[Math.min(DEPTH_LEVELS - 1, Math.floor(nearness * DEPTH_LEVELS))]
					: brightestColor
				line[x] = { ch: edgeChars[charIndex], fg, bg: opts.bgColor, bold: nearness > 0.75 }
			}
		}
		lines[y] = line
	}

	return { lines, columns }
}

/**
 * Create a reusable sampler for the wireframe at a specific frame.
 * Returns a function mapping (x, y) to an AnsiCell, wrapping at a fixed
 * virtual grid.
 */
export function createAsciiWireframeSampler(frame: number, options: AsciiWireframeOptions = {}) {
	const cols = 80
	const rows = 60
	const screen = generateAsciiWireframeFrame(frame, cols, rows, options)
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
