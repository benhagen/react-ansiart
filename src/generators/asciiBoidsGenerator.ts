import type { AnsiScreen } from '../ansi/types'
import type { CharacterFrameGenerator } from '../types/types'
import type { AnsiPointerInput } from './pointerInput'
import { createGeneratorStateStore, type GeneratorStateStore } from './generatorState'
import { catchupSteps } from './simulationCatchup'

const DEFAULT_COUNT = 60
const MIN_COUNT = 40
const MAX_COUNT = 120
const DEFAULT_MAX_SPEED = 1.2
const DEFAULT_MIN_SPEED = 0.4
const DEFAULT_SEP_RADIUS = 2.5
const DEFAULT_ALIGN_RADIUS = 5
const DEFAULT_COH_RADIUS = 6
const DEFAULT_SEP_WEIGHT = 1.4
const DEFAULT_ALIGN_WEIGHT = 1.0
const DEFAULT_COH_WEIGHT = 0.8
const DEFAULT_WANDER = 0.3
const DEFAULT_SCATTER_INTERVAL = 240
const DEFAULT_TRAIL_DECAY = 0.88
const DEFAULT_HEAD_COLOR = '#eafcff'
const DEFAULT_TRAIL_PALETTE: [string, string] = ['#00e5ff', '#02040f']
const DEFAULT_CHARS = ' .:■' // ' ', '.', ':', '■' — dim trail ramp
const DEFAULT_SEED = 9001
const DEFAULT_BG_COLOR = '#000006'
const DEFAULT_POINTER_MODE = 'flee'
const DEFAULT_POINTER_RADIUS = 14
const DEFAULT_POINTER_WEIGHT = 2.5

/**
 * Row-height / column-width ratio for a typical 8x16 VGA bitmap font: a cell is twice as
 * tall as it is wide. The simulation runs entirely in "column-width" units (so distances,
 * radii, and headings are physically uniform in x and y), and this constant is the single
 * place that converts between that uniform world space and the squashed character grid:
 * worldY / CELL_ASPECT -> screen row, and worldHeight = rows * CELL_ASPECT. Without this
 * correction a circling flock would trace a tall ellipse on screen instead of a circle.
 */
const CELL_ASPECT = 2

export interface AsciiBoidsOptions {
	/** Number of boids in the flock, clamped to [40, 120]. Default: 60 */
	count?: number
	/** Maximum boid speed (world units/frame). Default: 1.2 */
	maxSpeed?: number
	/** Minimum boid speed (world units/frame) — keeps boids from stalling. Default: 0.4 */
	minSpeed?: number
	/** Radius within which boids steer apart. Default: 2.5 */
	sepRadius?: number
	/** Radius within which boids match heading. Default: 5 */
	alignRadius?: number
	/** Radius within which boids steer toward the local flock center. Default: 6 */
	cohRadius?: number
	/** Separation steering weight. Default: 1.4 */
	sepWeight?: number
	/** Alignment steering weight. Default: 1.0 */
	alignWeight?: number
	/** Cohesion steering weight. Default: 0.8 */
	cohWeight?: number
	/** Strength of the gentle per-boid seeded wander term. Default: 0.3 */
	wander?: number
	/** Frames between deterministic "predator ghost" scatter impulses. Default: 240 */
	scatterInterval?: number
	/** Per-frame multiplicative decay of the trail intensity buffer. Default: 0.88 */
	trailDecay?: number
	/** Boid head color (CSS). Default: '#eafcff' */
	headColor?: string
	/** Trail color pair [near, far] the trail fades between (CSS). Default: cyan -> deep blue-black */
	trailPalette?: [string, string]
	/** Trail intensity -> character ramp, dimmest first. Default: ' .:■' */
	chars?: string
	/** RNG seed. Default: 9001 */
	seed?: number
	/** Background color (CSS). Default: '#000006' */
	bgColor?: string
	/** Pointer input channel from the host display; sampled via `pointer.state`. Default: none */
	pointer?: AnsiPointerInput
	/**
	 * How an active pointer steers the flock: 'flee' makes it a predator boids scatter
	 * from, 'attract' makes it a lure, 'none' ignores the pointer entirely. Default: 'flee'
	 */
	pointerMode?: 'flee' | 'attract' | 'none'
	/** Pointer influence radius in cells (column-width world units), clamped to [2, 100]. Default: 14 */
	pointerRadius?: number
	/** Pointer steering weight (same scale as sep/align/coh weights), clamped to [0, 10]. Default: 2.5 */
	pointerWeight?: number
}

/**
 * Resolved scalar options. The `pointer` channel is intentionally excluded: it is a live
 * input object sampled once per generate call, not a value with a default to clamp.
 */
type ResolvedAsciiBoidsOptions = Required<Omit<AsciiBoidsOptions, 'pointer'>>

function clampInt(v: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, Math.round(v)))
}

function clampNum(v: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, v))
}

// Deterministic RNG (same LCG convention as the other generators)
function createRandom(seed: number) {
	let state = seed >>> 0
	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0
		return state / 0xffffffff
	}
}

function wrap(v: number, size: number): number {
	const r = v % size
	return r < 0 ? r + size : r
}

// Shortest signed delta between two coordinates on a toroidal axis of the given size —
// used so separation/alignment/cohesion pull boids toward the nearer copy of a neighbor
// across the wrap seam instead of the far one.
function wrapDelta(d: number, size: number): number {
	const half = size / 2
	if (d > half) return d - size
	if (d < -half) return d + size
	return d
}

// 8-way head glyph table, indexed by octant (0 = east, going counterclockwise with north
// "up" on screen). Cardinal directions use the CP437 arrow glyphs at bytes 0x18-0x1B
// (verified via charToCp437Byte in asciiBoidsGenerator.test.ts). The diagonal Unicode
// arrows (↗ ↘ ↙ ↖) are NOT present in CP437 — charToCp437Byte falls back to their raw
// code point, which is > 255 and collapses to a blank space glyph. So diagonals use '/'
// and '\', which round-trip through CP437 exactly (they sit in the printable ASCII range).
const HEAD_GLYPHS = ['→', '/', '↑', '\\', '←', '/', '↓', '\\'] as const

function octantIndex(dx: number, dy: number): number {
	// dy is screen-space (down-positive); flip for a conventional up-positive angle.
	const angle = Math.atan2(-dy, dx)
	const normalized = angle < 0 ? angle + Math.PI * 2 : angle
	return Math.round(normalized / (Math.PI / 4)) & 7
}

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

function lerpColor(a: [number, number, number], b: [number, number, number], t: number): string {
	const r = Math.round(a[0] + (b[0] - a[0]) * t)
	const g = Math.round(a[1] + (b[1] - a[1]) * t)
	const bl = Math.round(a[2] + (b[2] - a[2]) * t)
	return `rgb(${r},${g},${bl})`
}

const FADE_TABLE_STEPS = 256

// Trail fade-color table: trailPalette is fixed for a render, so the near->far
// interpolation is precomputed once into a 256-step table (matrix-rain / water-ripple
// convention) instead of building an rgb() string per cell.
let lastFadeKey: string | null = null
let lastFadeTable: string[] | null = null

function getFadeTable(nearColor: string, farColor: string): string[] {
	const key = `${nearColor}|${farColor}`
	if (lastFadeKey === key && lastFadeTable) return lastFadeTable
	const near = parseColor(nearColor)
	const far = parseColor(farColor)
	const table = new Array<string>(FADE_TABLE_STEPS)
	for (let i = 0; i < FADE_TABLE_STEPS; i++) {
		table[i] = lerpColor(far, near, i / (FADE_TABLE_STEPS - 1))
	}
	lastFadeKey = key
	lastFadeTable = table
	return table
}

// Memoized char ramp split (chars is constant per generator instance).
let lastChars: string | null = null
let lastCharPool: string[] | null = null

function getCharPool(chars: string): string[] {
	if (lastChars === chars && lastCharPool) return lastCharPool
	lastCharPool = Array.from(chars)
	lastChars = chars
	return lastCharPool
}

interface BoidsState {
	px: Float64Array
	py: Float64Array
	vx: Float64Array
	vy: Float64Array
	wanderAngle: Float64Array
	trail: Float64Array // intensity per cell, columns*rows, decayed each frame
	trailCols: number
	trailRows: number
	lastFrame: number
}

// State shared by all callers of generateAsciiBoidsFrame. Prefer createAsciiBoidsGenerator,
// which gives each instance its own store (see generatorState.ts for why this matters).
const sharedStore = createGeneratorStateStore<BoidsState>()

// Memoized JSON.stringify state key.
let lastKeyInputs: {
	columns: number
	rows: number
	seed: number
	count: number
	sepRadius: number
	alignRadius: number
	cohRadius: number
} | null = null
let lastKeyStr: string | null = null

function getStateKey(
	columns: number,
	rows: number,
	seed: number,
	count: number,
	sepRadius: number,
	alignRadius: number,
	cohRadius: number,
): string {
	const prev = lastKeyInputs
	if (
		prev &&
		lastKeyStr &&
		prev.columns === columns &&
		prev.rows === rows &&
		prev.seed === seed &&
		prev.count === count &&
		prev.sepRadius === sepRadius &&
		prev.alignRadius === alignRadius &&
		prev.cohRadius === cohRadius
	) {
		return lastKeyStr
	}
	lastKeyInputs = { columns, rows, seed, count, sepRadius, alignRadius, cohRadius }
	// Plain field concatenation instead of JSON.stringify — no object-shape/property-order
	// ambiguity to worry about since every field here is a fixed-position number.
	lastKeyStr = `${columns}:${rows}:${seed}:${count}:${sepRadius}:${alignRadius}:${cohRadius}`
	return lastKeyStr
}

function initState(columns: number, rows: number, count: number, seed: number, maxSpeed: number): BoidsState {
	const rng = createRandom(seed)
	const worldW = columns
	const worldH = rows * CELL_ASPECT
	const px = new Float64Array(count)
	const py = new Float64Array(count)
	const vx = new Float64Array(count)
	const vy = new Float64Array(count)
	const wanderAngle = new Float64Array(count)
	for (let i = 0; i < count; i++) {
		px[i] = rng() * worldW
		py[i] = rng() * worldH
		const heading = rng() * Math.PI * 2
		const speed = maxSpeed * (0.4 + rng() * 0.6)
		vx[i] = Math.cos(heading) * speed
		vy[i] = Math.sin(heading) * speed
		wanderAngle[i] = heading
	}
	return {
		px,
		py,
		vx,
		vy,
		wanderAngle,
		trail: new Float64Array(columns * rows),
		trailCols: columns,
		trailRows: rows,
		lastFrame: -1,
	}
}

/**
 * Advance the flock simulation by exactly one step (one frame). Uses squared distances for
 * every pairwise comparison in the O(n^2) neighbor scan; sqrt is only taken once per boid,
 * after the scan, to normalize the accumulated steering vector and to clamp final speed.
 */
function stepBoids(
	state: BoidsState,
	columns: number,
	rows: number,
	opts: ResolvedAsciiBoidsOptions,
	simFrame: number,
	// Pointer force, already resolved by the caller from the ONE pointer-state sample taken
	// per generate call: when catch-up runs several substeps for a single call, every substep
	// applies the same sampled pointer position — the host only updates the channel between
	// frames, so a fresher sample cannot exist mid-call and replays stay a pure function of
	// the (frame, pointer-state) sequence. pointerAway is +1 to flee, -1 to attract, 0 = off.
	pointerX: number,
	pointerY: number,
	pointerAway: number,
): void {
	const { px, py, vx, vy, wanderAngle } = state
	const count = px.length
	const worldW = columns
	const worldH = rows * CELL_ASPECT

	const sepR2 = opts.sepRadius * opts.sepRadius
	const alignR2 = opts.alignRadius * opts.alignRadius
	const cohR2 = opts.cohRadius * opts.cohRadius

	// Deterministic "predator ghost" scatter impulse: every scatterInterval frames, a random
	// point (from the seeded PRNG, keyed on this simulated frame so it is reproducible under
	// catch-up) startles nearby boids with an outward speed boost.
	let scatterX = 0
	let scatterY = 0
	let scattering = false
	if (opts.scatterInterval > 0 && simFrame > 0 && simFrame % opts.scatterInterval === 0) {
		const rng = createRandom(opts.seed + simFrame * 104729)
		scatterX = rng() * worldW
		scatterY = rng() * worldH
		scattering = true
	}
	const scatterR2 = (Math.max(worldW, worldH) * 0.35) ** 2

	// Hoisted pointer-force invariants (rule 6): radius² for the cheap in-range test, and
	// the weight both boids-loop iterations share. All zero-cost when pointerAway === 0.
	const pointerR2 = opts.pointerRadius * opts.pointerRadius
	const pointerForce = opts.pointerWeight * pointerAway

	const wanderRng = createRandom(opts.seed + simFrame * 7919 + 17)

	const newVx = new Float64Array(count)
	const newVy = new Float64Array(count)

	for (let i = 0; i < count; i++) {
		let sepX = 0
		let sepY = 0
		let alignVX = 0
		let alignVY = 0
		let alignCount = 0
		let cohX = 0
		let cohY = 0
		let cohCount = 0

		for (let j = 0; j < count; j++) {
			if (j === i) continue
			const dx = wrapDelta(px[j] - px[i], worldW)
			const dy = wrapDelta(py[j] - py[i], worldH)
			const distSq = dx * dx + dy * dy
			if (distSq <= 0.0001) continue

			if (distSq < sepR2) {
				// Push away, weighted ~1/distance (dx/distSq = unit direction / distance) — no
				// sqrt needed to get an inverse-distance falloff.
				sepX -= dx / distSq
				sepY -= dy / distSq
			}
			if (distSq < alignR2) {
				alignVX += vx[j]
				alignVY += vy[j]
				alignCount++
			}
			if (distSq < cohR2) {
				cohX += dx
				cohY += dy
				cohCount++
			}
		}

		let steerX = 0
		let steerY = 0

		if (sepX !== 0 || sepY !== 0) {
			const mag = Math.sqrt(sepX * sepX + sepY * sepY)
			steerX += (sepX / mag) * opts.sepWeight
			steerY += (sepY / mag) * opts.sepWeight
		}
		if (alignCount > 0) {
			const avgVX = alignVX / alignCount
			const avgVY = alignVY / alignCount
			const mag = Math.sqrt(avgVX * avgVX + avgVY * avgVY)
			if (mag > 0.0001) {
				steerX += (avgVX / mag) * opts.alignWeight
				steerY += (avgVY / mag) * opts.alignWeight
			}
		}
		if (cohCount > 0) {
			const avgX = cohX / cohCount
			const avgY = cohY / cohCount
			const mag = Math.sqrt(avgX * avgX + avgY * avgY)
			if (mag > 0.0001) {
				steerX += (avgX / mag) * opts.cohWeight
				steerY += (avgY / mag) * opts.cohWeight
			}
		}

		// Gentle seeded wander: each boid's wander angle drifts by a small deterministic step.
		wanderAngle[i] += (wanderRng() - 0.5) * 0.6
		steerX += Math.cos(wanderAngle[i]) * opts.wander
		steerY += Math.sin(wanderAngle[i]) * opts.wander

		if (scattering) {
			const dx = wrapDelta(px[i] - scatterX, worldW)
			const dy = wrapDelta(py[i] - scatterY, worldH)
			const distSq = dx * dx + dy * dy
			if (distSq < scatterR2 && distSq > 0.0001) {
				const dist = Math.sqrt(distSq)
				const falloff = 1 - dist / Math.sqrt(scatterR2)
				const impulse = opts.maxSpeed * 2.5 * falloff
				steerX += (dx / dist) * impulse
				steerY += (dy / dist) * impulse
			}
		}

		// Pointer predator/lure: a steering force away from (flee) or toward (attract) the
		// pointer, linear falloff to 0 at pointerRadius. It joins the same steering
		// accumulator as every flocking rule, so the existing steer * 0.15 integration and
		// the max/min speed clamp below bound it — fleeing boids cannot exceed maxSpeed.
		// Distances use the identical toroidal wrapDelta/world-unit convention the neighbor
		// scan uses (dy is in CELL_ASPECT-corrected world units).
		if (pointerAway !== 0) {
			const dx = wrapDelta(px[i] - pointerX, worldW)
			const dy = wrapDelta(py[i] - pointerY, worldH)
			const distSq = dx * dx + dy * dy
			if (distSq < pointerR2 && distSq > 0.0001) {
				const dist = Math.sqrt(distSq)
				const falloff = 1 - dist / opts.pointerRadius
				steerX += (dx / dist) * pointerForce * falloff
				steerY += (dy / dist) * pointerForce * falloff
			}
		}

		let nvx = vx[i] + steerX * 0.15
		let nvy = vy[i] + steerY * 0.15

		const speed = Math.sqrt(nvx * nvx + nvy * nvy)
		if (speed > opts.maxSpeed) {
			const scale = opts.maxSpeed / speed
			nvx *= scale
			nvy *= scale
		} else if (speed < opts.minSpeed && speed > 0.0001) {
			const scale = opts.minSpeed / speed
			nvx *= scale
			nvy *= scale
		} else if (speed <= 0.0001) {
			// Degenerate zero-velocity boid — nudge it back to life along its wander heading.
			nvx = Math.cos(wanderAngle[i]) * opts.minSpeed
			nvy = Math.sin(wanderAngle[i]) * opts.minSpeed
		}

		newVx[i] = nvx
		newVy[i] = nvy
	}

	for (let i = 0; i < count; i++) {
		vx[i] = newVx[i]
		vy[i] = newVy[i]
		px[i] = wrap(px[i] + vx[i], worldW)
		py[i] = wrap(py[i] + vy[i], worldH)
	}

	// Decay the trail buffer, then stamp each boid's current cell at full intensity.
	const trail = state.trail
	for (let k = 0; k < trail.length; k++) {
		trail[k] *= opts.trailDecay
	}
	for (let i = 0; i < count; i++) {
		const col = Math.floor(wrap(px[i], worldW)) % columns
		const row = Math.floor(wrap(py[i], worldH) / CELL_ASPECT) % rows
		trail[row * columns + col] = 1
	}
}

function resolveOptions(options: AsciiBoidsOptions): ResolvedAsciiBoidsOptions {
	// minSpeed must be clamped against the RESOLVED maxSpeed (post clamp-to-[0.05,20]), not
	// the raw input — otherwise a pathological maxSpeed:5000 lets minSpeed clamp up to 20
	// (resolved maxSpeed) as its ceiling would be fine, but the reverse — maxSpeed:5000,
	// minSpeed:1000 — would resolve maxSpeed down to 20 while minSpeed clamps against the
	// raw 5000 ceiling and comes out well above it, leaving minSpeed > maxSpeed and boids
	// permanently clamped to an out-of-range speed.
	const resolvedMaxSpeed = clampNum(options.maxSpeed ?? DEFAULT_MAX_SPEED, 0.05, 20)
	return {
		count: clampInt(options.count ?? DEFAULT_COUNT, MIN_COUNT, MAX_COUNT),
		maxSpeed: resolvedMaxSpeed,
		minSpeed: clampNum(options.minSpeed ?? DEFAULT_MIN_SPEED, 0, resolvedMaxSpeed),
		sepRadius: clampNum(options.sepRadius ?? DEFAULT_SEP_RADIUS, 0.1, 100),
		alignRadius: clampNum(options.alignRadius ?? DEFAULT_ALIGN_RADIUS, 0.1, 100),
		cohRadius: clampNum(options.cohRadius ?? DEFAULT_COH_RADIUS, 0.1, 100),
		sepWeight: options.sepWeight ?? DEFAULT_SEP_WEIGHT,
		alignWeight: options.alignWeight ?? DEFAULT_ALIGN_WEIGHT,
		cohWeight: options.cohWeight ?? DEFAULT_COH_WEIGHT,
		wander: options.wander ?? DEFAULT_WANDER,
		scatterInterval: clampInt(options.scatterInterval ?? DEFAULT_SCATTER_INTERVAL, 0, 100000),
		trailDecay: clampNum(options.trailDecay ?? DEFAULT_TRAIL_DECAY, 0, 0.999),
		headColor: options.headColor ?? DEFAULT_HEAD_COLOR,
		trailPalette: options.trailPalette ?? DEFAULT_TRAIL_PALETTE,
		chars: options.chars ?? DEFAULT_CHARS,
		seed: options.seed ?? DEFAULT_SEED,
		bgColor: options.bgColor ?? DEFAULT_BG_COLOR,
		pointerMode: options.pointerMode ?? DEFAULT_POINTER_MODE,
		// NaN pointerRadius/pointerWeight degrade safely: every use is gated by a comparison
		// (distSq < radius², weight > 0) that is false for NaN, so the force just stays off —
		// nothing non-finite can reach a position or velocity.
		pointerRadius: clampNum(options.pointerRadius ?? DEFAULT_POINTER_RADIUS, 2, 100),
		pointerWeight: clampNum(options.pointerWeight ?? DEFAULT_POINTER_WEIGHT, 0, 10),
	}
}

function renderBoidsFrame(
	store: GeneratorStateStore<BoidsState>,
	frame: number,
	columns: number,
	rows: number,
	options: AsciiBoidsOptions,
): AnsiScreen {
	const opts = resolveOptions(options)
	const stateKey = getStateKey(columns, rows, opts.seed, opts.count, opts.sepRadius, opts.alignRadius, opts.cohRadius)

	let state = store.get(stateKey)
	if (!state || frame < state.lastFrame || state.trailCols !== columns || state.trailRows !== rows) {
		state = initState(columns, rows, opts.count, opts.seed, opts.maxSpeed)
		store.set(stateKey, state)
	}

	// Sample the pointer channel ONCE per generate call (never per substep): the host only
	// replaces `pointer.state` between frames, and one sample per call keeps the output a
	// pure function of the frame sequence plus the pointer-state sequence. With no pointer,
	// or an inactive one, this resolves to pointerAway === 0 and stepBoids is byte-identical
	// to the pointer-less code path at near-zero cost (three untaken branches).
	const pointerState = options.pointer !== undefined ? options.pointer.state : null
	let pointerX = 0
	let pointerY = 0
	let pointerAway = 0
	if (
		pointerState !== null &&
		pointerState.active &&
		opts.pointerMode !== 'none' &&
		opts.pointerWeight > 0 &&
		Number.isFinite(pointerState.x) &&
		Number.isFinite(pointerState.y)
	) {
		// Fractional-cell pointer coords can lie outside the grid (drags past an edge); the
		// world is toroidal, so wrap them onto it — matching how boid positions themselves
		// wrap — before any distance math. y additionally converts rows -> world units.
		pointerX = wrap(pointerState.x, columns)
		pointerY = wrap(pointerState.y * CELL_ASPECT, rows * CELL_ASPECT)
		pointerAway = opts.pointerMode === 'attract' ? -1 : 1
	}

	// Simulate forward, capped so a large jump (backgrounded tab, seek) cannot block the
	// main thread proportionally to the gap. The most recent steps run first when capped, so
	// scatter timing stays in phase with the true frame number. All catch-up substeps share
	// the single pointer-state sample taken above.
	const stepsToRun = catchupSteps(frame, state.lastFrame)
	const firstSimFrame = frame - stepsToRun + 1
	for (let s = 0; s < stepsToRun; s++) {
		stepBoids(state, columns, rows, opts, firstSimFrame + s, pointerX, pointerY, pointerAway)
	}
	state.lastFrame = frame

	const charPool = getCharPool(opts.chars)
	const fadeTable = getFadeTable(opts.trailPalette[0], opts.trailPalette[1])
	const fadeMax = fadeTable.length - 1
	const charMax = charPool.length - 1

	const lines: AnsiScreen['lines'] = []
	for (let row = 0; row < rows; row++) {
		const line: AnsiScreen['lines'][number] = []
		for (let col = 0; col < columns; col++) {
			const intensity = state.trail[row * columns + col]
			if (intensity <= 0.003) {
				line.push({ ch: ' ', fg: opts.bgColor, bg: opts.bgColor, bold: false })
				continue
			}
			const clamped = intensity > 1 ? 1 : intensity
			const ch = charPool[Math.min(charMax, Math.floor(clamped * (charMax + 0.999)))]
			const fg = fadeTable[Math.min(fadeMax, Math.round(clamped * fadeMax))]
			line.push({ ch, fg, bg: opts.bgColor, bold: false })
		}
		lines.push(line)
	}

	// Stamp boid heads last so they always draw over their own trail cell.
	const worldW = columns
	const worldH = rows * CELL_ASPECT
	for (let i = 0; i < opts.count; i++) {
		const col = Math.floor(wrap(state.px[i], worldW)) % columns
		const row = Math.floor(wrap(state.py[i], worldH) / CELL_ASPECT) % rows
		const dir = octantIndex(state.vx[i], state.vy[i] / CELL_ASPECT)
		const ch = HEAD_GLYPHS[dir]
		const line = lines[row]
		if (line) {
			line[col] = { ch, fg: opts.headColor, bg: opts.bgColor, bold: true }
		}
	}

	return { lines, columns }
}

/**
 * Generate an ASCII BOIDS flocking frame: a flock of boids flying over the grid with
 * fading trails, following classic separation/alignment/cohesion rules plus a gentle
 * seeded wander and occasional scatter ("predator ghost") impulses.
 *
 * Uses process-wide state keyed on dimensions and options, so separate components with
 * matching options will interfere with each other. Prefer {@link createAsciiBoidsGenerator}
 * when rendering more than one instance.
 */
export function generateAsciiBoidsFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiBoidsOptions = {},
): AnsiScreen {
	return renderBoidsFrame(sharedStore, frame, columns, rows, options)
}

/**
 * Create a BOIDS generator that owns its flock/trail state.
 * Each call returns an independent instance safe to render alongside others.
 */
export function createAsciiBoidsGenerator(options: AsciiBoidsOptions = {}): CharacterFrameGenerator {
	const store = createGeneratorStateStore<BoidsState>()
	return (frame: number, columns: number, rows: number) => renderBoidsFrame(store, frame, columns, rows, options)
}

/**
 * Clear all BOIDS state shared by generateAsciiBoidsFrame callers.
 * Instances from createAsciiBoidsGenerator own their state and are unaffected.
 */
export function clearBoidsState(): void {
	sharedStore.clear()
}
