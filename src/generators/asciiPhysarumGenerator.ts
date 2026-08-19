import type { AnsiScreen } from '../ansi/types'
import type { CharacterFrameGenerator } from '../types/types'
import { createGeneratorStateStore, type GeneratorStateStore } from './generatorState'
import { catchupSteps } from './simulationCatchup'
import { buildCharLookup } from './charLookup'

// Physarum polycephalum (slime mold) agent simulation — the classic Jones 2010 model.
// A few hundred to a few thousand agents wander a shared trail field: each agent senses
// the field at three points fanned out ahead of it, steers toward the strongest reading,
// moves forward, and deposits trail where it lands. The field is then diffused with a
// 3x3 mean and evaporated. Positive feedback (agents follow trail, trail marks agent
// paths) plus diffusion/decay makes the swarm self-organize into a branching, constantly
// rewiring transport network of filaments — the point of the effect. Early frames look
// like drifting noise; the network emerges over the first ~100 frames and never settles.
//
// The simulation runs on the character grid, but character cells are ~2x taller than
// wide (CELL_ASPECT). Headings and distances live in "column-width" world units, and
// every y-displacement (movement and sensor offsets) is divided by CELL_ASPECT when
// converted to rows, so motion and sensing are isotropic *on screen* — without this the
// networks stretch vertically and agents orbit in tall ellipses.

/**
 * Row-height / column-width ratio for a typical 8x16 VGA bitmap font: a cell is twice
 * as tall as it is wide. World-space y displacements are divided by this when applied
 * to the row axis so that motion and sensing are isotropic on screen.
 */
const CELL_ASPECT = 2

const DEFAULT_SEED = 1337
const DEFAULT_AGENT_DENSITY = 0.6
const MIN_AGENTS = 64
const MAX_AGENTS = 6000
const DEFAULT_SENSOR_ANGLE = 0.45
const DEFAULT_SENSOR_DISTANCE = 4
const DEFAULT_TURN_SPEED = 0.75
const DEFAULT_MOVE_SPEED = 1
const DEFAULT_DEPOSIT_AMOUNT = 1
const DEFAULT_EVAPORATION = 0.85
const DEFAULT_STEPS_PER_FRAME = 1
const DEFAULT_CHARS = ' ·:░▒▓█' // all CP437-safe: 0x20, 0xFA, 0x3A, 0xB0-0xB2, 0xDB
const DEFAULT_PALETTE = ['#000000', '#0a4040', '#00d8d8', '#ffffff']
const DEFAULT_BG_COLOR = '#000000'

// Trail value at which the render ramp reaches its midpoint: rendered intensity is
// v / (v + TRAIL_HALF), which maps the unbounded trail field smoothly onto [0, 1)
// without a per-frame max scan (which would make brightness flicker globally).
const TRAIL_HALF = 6

// Small deterministic per-step heading jitter (radians, +/- half of this). Without it
// the network anneals into a frozen set of trunks after ~150 steps; with it filaments
// keep breaking, merging, and rewiring indefinitely — Jones' "pre-pattern" stays live.
const HEADING_JITTER = 0.5

// Probability per agent per step of discarding the heading entirely for a fresh random
// one (Jones' pID rule). This is what keeps the network *rewiring*: without it the
// swarm anneals into one or two permanent cords and the effect goes static.
const RANDOM_REDIRECT_CHANCE = 0.02

// Per-cell crowding limit for the particle-exclusion rule. Strict single occupancy at
// the default density (0.6 agents/cell) blocks most moves and degenerates the swarm
// into a random-walk gas; no limit at all lets the whole population collapse into one
// or two dense permanent cords. A small cap does neither: filaments can run a few
// agents deep, but the population is forced to spread over a real network.
const MAX_OCCUPANCY = 3

// Fraction of each cell's value replaced by the 3x3 neighborhood mean per step. A full
// mean (1.0) smears the field so much that the whole swarm consolidates into one blob;
// a partial mix keeps trail gradients steep and local, which is what holds many thin
// competing filaments apart on a grid this small.
const DIFFUSE_RATE = 0.5

// Moving "food" attractants. Left alone on a torus, the swarm anneals its network down
// to one or two straight permanent cords (shortest closed loops) and the effect goes
// static. Real physarum keeps rewiring because it forages; these deterministic slow
// Lissajous-orbiting deposit sources play that role, forcing the network to keep
// re-routing between them forever. Positions are a pure function of (seed, step count).
const FOOD_COUNT = 6
const FOOD_DEPOSIT_SCALE = 30 // multiple of depositAmount laid down per source per step
const FOOD_BASE_SPEED = 0.008 // radians of orbit phase per simulation step

export interface AsciiPhysarumOptions {
	/** Seed for initial agent positions/headings and the random-turn tiebreaker. Default: 1337 */
	seed?: number
	/**
	 * Agents per grid cell; the agent count is round(columns * rows * agentDensity),
	 * clamped to [64, 6000] (~1200 at 80x25). Default: 0.6
	 */
	agentDensity?: number
	/** Angle (radians) between the forward sensor and each side sensor. Default: 0.45 */
	sensorAngle?: number
	/** Sensor distance ahead of the agent, in column-width world units. Default: 4 */
	sensorDistance?: number
	/** Heading change (radians) applied when steering toward a side sensor. Default: 0.75 */
	turnSpeed?: number
	/** Distance moved per step, in column-width world units. Default: 1 */
	moveSpeed?: number
	/** Trail deposited into the agent's cell after each move. Default: 1 */
	depositAmount?: number
	/** Per-step multiplicative trail retention after diffusion (0-0.99). Default: 0.85 */
	evaporation?: number
	/** Simulation substeps per frame. Default: 1 */
	stepsPerFrame?: number
	/** Character ramp from empty to densest trail, dimmest first. Default: ' ·:░▒▓█' */
	chars?: string
	/** Trail color gradient stops (CSS hex), low to high. Default: black → deep teal → cyan → white */
	palette?: string[]
	/** Background color (CSS color string). Default: '#000000' */
	bgColor?: string
}

function clampNum(v: number | undefined, min: number, max: number, fallback: number): number {
	if (v === undefined || !Number.isFinite(v)) return fallback
	return Math.min(max, Math.max(min, v))
}

interface ResolvedPhysarumOptions {
	seed: number
	agentDensity: number
	sensorAngle: number
	sensorDistance: number
	turnSpeed: number
	moveSpeed: number
	depositAmount: number
	evaporation: number
	stepsPerFrame: number
	chars: string
	palette: string[]
	bgColor: string
}

// Resolve and clamp every option in one place — non-finite or out-of-range input falls
// back to the default, so nothing NaN can reach a trail index or a heading.
function resolveOptions(options: AsciiPhysarumOptions): ResolvedPhysarumOptions {
	return {
		seed: Number.isFinite(options.seed) ? (options.seed as number) >>> 0 : DEFAULT_SEED,
		agentDensity: clampNum(options.agentDensity, 0, 10, DEFAULT_AGENT_DENSITY),
		sensorAngle: clampNum(options.sensorAngle, 0, Math.PI, DEFAULT_SENSOR_ANGLE),
		sensorDistance: clampNum(options.sensorDistance, 0.5, 40, DEFAULT_SENSOR_DISTANCE),
		turnSpeed: clampNum(options.turnSpeed, 0, Math.PI, DEFAULT_TURN_SPEED),
		moveSpeed: clampNum(options.moveSpeed, 0.05, 5, DEFAULT_MOVE_SPEED),
		depositAmount: clampNum(options.depositAmount, 0, 100, DEFAULT_DEPOSIT_AMOUNT),
		evaporation: clampNum(options.evaporation, 0, 0.99, DEFAULT_EVAPORATION),
		stepsPerFrame: Math.round(clampNum(options.stepsPerFrame, 1, 10, DEFAULT_STEPS_PER_FRAME)),
		chars: options.chars !== undefined && options.chars.length > 0 ? options.chars : DEFAULT_CHARS,
		palette: options.palette !== undefined && options.palette.length > 0 ? options.palette : DEFAULT_PALETTE,
		bgColor: options.bgColor ?? DEFAULT_BG_COLOR,
	}
}

/** Parse hex color to [r, g, b] 0-255 */
function parseHex(hex: string): [number, number, number] {
	const h = hex.startsWith('#') ? hex.slice(1) : hex
	return [
		parseInt(h.slice(0, 2), 16) || 0,
		parseInt(h.slice(2, 4), 16) || 0,
		parseInt(h.slice(4, 6), 16) || 0,
	]
}

// ---- Memoized intensity -> rgb() gradient table (256 entries) ----
// Rebuilt only when the palette stops change; every cell looks its color up here
// instead of building an rgb() string per cell per frame.
const PALETTE_STEPS = 256
let lastPaletteKey: string | null = null
let lastPaletteTable: string[] | null = null

function getPaletteTable(palette: string[]): string[] {
	// Delimited concatenation, never JSON.stringify — fixed field order, no shape ambiguity.
	const key = palette.join('|')
	if (key === lastPaletteKey && lastPaletteTable) return lastPaletteTable

	let stops = palette
	if (stops.length === 1) stops = [stops[0], stops[0]]

	const stopRGB = stops.map(parseHex)
	const segments = stopRGB.length - 1

	const table = new Array<string>(PALETTE_STEPS)
	for (let i = 0; i < PALETTE_STEPS; i++) {
		const t = i / (PALETTE_STEPS - 1)
		const scaled = t * segments
		const segIndex = Math.min(segments - 1, Math.floor(scaled))
		const localT = scaled - segIndex
		const a = stopRGB[segIndex]
		const b = stopRGB[segIndex + 1]
		const r = Math.round(a[0] + (b[0] - a[0]) * localT)
		const g = Math.round(a[1] + (b[1] - a[1]) * localT)
		const bl = Math.round(a[2] + (b[2] - a[2]) * localT)
		table[i] = `rgb(${r},${g},${bl})`
	}

	lastPaletteKey = key
	lastPaletteTable = table
	return table
}

// ---- Memoized char ramp lookup (256 entries) ----
let lastChars: string | null = null
let lastCharLookup: string[] | null = null

function getCharLookup(chars: string): string[] {
	if (lastChars === chars && lastCharLookup) return lastCharLookup
	lastCharLookup = buildCharLookup(Array.from(chars))
	lastChars = chars
	return lastCharLookup
}

interface PhysarumState {
	/**
	 * Trail field, one value per cell. Float64Array (never Float32Array): these values
	 * feed the char-ramp and gradient thresholds, and float32 truncation flips
	 * threshold comparisons into visible banding.
	 */
	trail: Float64Array
	/** Ping-pong partner for the diffusion pass; swapped by rebinding, never copied. */
	trailNext: Float64Array
	/** Agent (x, y, heading) triples. x/y in cell units, heading in world radians. */
	agents: Float64Array
	/**
	 * Agents per cell. Jones' particle-exclusion rule (a move into an occupied cell is
	 * blocked and the agent re-orients randomly) is what makes the swarm form spread-out
	 * networks instead of collapsing into one or two dense permanent cords.
	 */
	occupancy: Uint8Array
	/** Per-food-source (freqX, freqY, phaseX, phaseY) quadruples for the orbit paths. */
	foodParams: Float64Array
	/** LCG state for the random-turn tiebreaker, persisted so replays are reproducible. */
	rng: number
	/** Total simulation substeps run; drives the food-source orbit positions. */
	steps: number
	lastFrame: number
}

// State shared by all callers of generateAsciiPhysarumFrame. Prefer
// createAsciiPhysarumGenerator, which gives each instance its own.
const sharedStore = createGeneratorStateStore<PhysarumState>()

/**
 * Clear the physarum state shared by generateAsciiPhysarumFrame callers.
 * Instances from createAsciiPhysarumGenerator own their state and are unaffected.
 */
export function clearPhysarumState(): void {
	sharedStore.clear()
}

function agentCountFor(columns: number, rows: number, agentDensity: number): number {
	const raw = Math.round(columns * rows * agentDensity)
	if (!Number.isFinite(raw)) return MIN_AGENTS
	return Math.max(MIN_AGENTS, Math.min(MAX_AGENTS, raw))
}

function initState(columns: number, rows: number, seed: number, agentCount: number): PhysarumState {
	const total = columns * rows
	const agents = new Float64Array(agentCount * 3)
	let rng = seed >>> 0
	const next = () => {
		rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0
		return rng / 0xffffffff
	}
	const occupancy = new Uint8Array(total)
	for (let i = 0; i < agentCount; i++) {
		const x = next() * columns
		const y = next() * rows
		agents[i * 3] = x
		agents[i * 3 + 1] = y
		agents[i * 3 + 2] = next() * Math.PI * 2
		const cell = Math.floor(y) * columns + Math.floor(x)
		if (occupancy[cell] < 255) occupancy[cell]++
	}
	const foodParams = new Float64Array(FOOD_COUNT * 4)
	for (let k = 0; k < FOOD_COUNT; k++) {
		foodParams[k * 4] = FOOD_BASE_SPEED * (0.6 + 0.8 * next())
		foodParams[k * 4 + 1] = FOOD_BASE_SPEED * (0.6 + 0.8 * next())
		foodParams[k * 4 + 2] = next() * Math.PI * 2
		foodParams[k * 4 + 3] = next() * Math.PI * 2
	}
	return {
		trail: new Float64Array(total),
		trailNext: new Float64Array(total),
		agents,
		occupancy,
		foodParams,
		rng,
		steps: 0,
		lastFrame: -1,
	}
}

// Memoized state-key builder — avoids rebuilding the key string every frame when the
// options driving it haven't changed. Only params that affect *initialization* belong
// in the key: sensor/steering/evaporation params only shape the step rule and can
// change on an already-running simulation without needing a fresh field.
let lastStateKeyParams: { columns: number; rows: number; seed: number; agentCount: number } | null = null
let lastStateKey: string | null = null

function getStateKey(columns: number, rows: number, seed: number, agentCount: number): string {
	if (
		lastStateKeyParams &&
		lastStateKeyParams.columns === columns &&
		lastStateKeyParams.rows === rows &&
		lastStateKeyParams.seed === seed &&
		lastStateKeyParams.agentCount === agentCount &&
		lastStateKey
	) {
		return lastStateKey
	}
	lastStateKeyParams = { columns, rows, seed, agentCount }
	lastStateKey = `${columns}:${rows}:${seed}:${agentCount}`
	return lastStateKey
}

// Sample the trail at a world-space offset (dx, dy) from (x, y). dy is a world-unit
// displacement and is divided by CELL_ASPECT to become a row offset. The arena is
// bounded (see stepPhysarum), so out-of-range samples clamp to the edge cell.
function sampleTrail(
	trail: Float64Array,
	columns: number,
	rows: number,
	x: number,
	y: number,
	dx: number,
	dy: number,
): number {
	let sx = Math.floor(x + dx)
	if (sx < 0) sx = 0
	else if (sx >= columns) sx = columns - 1
	let sy = Math.floor(y + dy / CELL_ASPECT)
	if (sy < 0) sy = 0
	else if (sy >= rows) sy = rows - 1
	return trail[sy * columns + sx]
}

/**
 * One simulation substep: sense/steer/move/deposit for every agent, then one 3x3
 * mean-diffusion + evaporation pass over the trail field. Returns the new rng state.
 */
function stepPhysarum(
	state: PhysarumState,
	columns: number,
	rows: number,
	opts: ResolvedPhysarumOptions,
): void {
	const { agents, occupancy } = state
	const trail = state.trail
	const count = agents.length / 3
	const { sensorAngle, sensorDistance, turnSpeed, moveSpeed, depositAmount } = opts
	let rng = state.rng

	for (let i = 0; i < count; i++) {
		const base = i * 3
		let x = agents[base]
		let y = agents[base + 1]
		let h = agents[base + 2]
		const oldX = x
		const oldY = y

		// Sense at three points fanned ahead of the agent (world-space offsets;
		// sampleTrail applies the aspect correction to the y component).
		const hl = h - sensorAngle
		const hr = h + sensorAngle
		const cF = sampleTrail(trail, columns, rows, x, y, Math.cos(h) * sensorDistance, Math.sin(h) * sensorDistance)
		const cL = sampleTrail(trail, columns, rows, x, y, Math.cos(hl) * sensorDistance, Math.sin(hl) * sensorDistance)
		const cR = sampleTrail(trail, columns, rows, x, y, Math.cos(hr) * sensorDistance, Math.sin(hr) * sensorDistance)

		// Classic Jones steering rules.
		if (cF >= cL && cF >= cR) {
			// straight ahead is (weakly) strongest — keep heading
		} else if (cF < cL && cF < cR) {
			// both sides beat the center — random turn breaks the tie
			rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0
			h += rng >>> 31 ? turnSpeed : -turnSpeed
		} else if (cL > cR) {
			h -= turnSpeed
		} else {
			h += turnSpeed
		}

		// Constant small heading jitter plus a rare full random redirect keep the
		// network rewiring instead of freezing into permanent cords.
		rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0
		const noise = rng / 0xffffffff
		if (noise < RANDOM_REDIRECT_CHANCE) {
			rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0
			h = (rng / 0xffffffff) * Math.PI * 2
		} else {
			h += (noise - 0.5) * HEADING_JITTER
		}

		// Move (y displacement halved: rows are CELL_ASPECT taller than columns).
		// The arena is bounded, and walls *scatter*: an agent that hits one is turned
		// to a random inward heading. Both choices are deliberate — on a torus the
		// swarm anneals into straight wrap-around cords (the shortest closed loops),
		// and mirror-reflecting walls allow stable wall-to-wall bounce orbits that do
		// the same. Scattering walls leave the moving food sources as the only stable
		// attractors, which keeps the network rewiring forever.
		const mx = Math.cos(h)
		const my = Math.sin(h)
		x += mx * moveSpeed
		if (x < 0 || x >= columns) {
			rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0
			const inward = (rng / 0xffffffff - 0.5) * 0.8 * Math.PI
			h = x < 0 ? inward : Math.PI - inward
			x = clampNum(x < 0 ? -x : 2 * columns - x, 0, columns - 1e-9, 0)
		}
		y += (my * moveSpeed) / CELL_ASPECT
		if (y < 0 || y >= rows) {
			rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0
			const inward = (0.1 + 0.8 * (rng / 0xffffffff)) * Math.PI
			h = y < 0 ? inward : -inward
			y = clampNum(y < 0 ? -y : 2 * rows - y, 0, rows - 1e-9, 0)
		}

		// Particle exclusion (Jones): a move into an already-occupied cell is blocked —
		// the agent stays put and re-orients randomly. Deposit happens only on a
		// successful move, scaled by the *cell-space* step length relative to the world
		// step: a vertically moving agent crosses rows at half the rate it crosses
		// columns, so it would deposit twice per cell and bias the network vertical.
		// Scaling by sqrt(cos^2 + sin^2/aspect^2) equalizes deposit per cell of path.
		const oldCell = Math.floor(oldY) * columns + Math.floor(oldX)
		const newCell = Math.floor(y) * columns + Math.floor(x)
		if (newCell !== oldCell && occupancy[newCell] >= MAX_OCCUPANCY) {
			rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0
			h = (rng / 0xffffffff) * Math.PI * 2
			x = oldX
			y = oldY
		} else {
			if (newCell !== oldCell) {
				occupancy[oldCell]--
				if (occupancy[newCell] < 255) occupancy[newCell]++
			}
			const cellStepScale = Math.sqrt(mx * mx + (my * my) / (CELL_ASPECT * CELL_ASPECT))
			trail[newCell] += depositAmount * cellStepScale
		}
		agents[base] = x
		agents[base + 1] = y
		agents[base + 2] = h
	}

	state.rng = rng

	// Lay down the moving food attractants for this step. Orbit amplitude keeps the
	// sources away from the exact edge, and the y radius is expressed in rows directly
	// (the orbit is already screen-space, so no aspect division here).
	const foodParams = state.foodParams
	const t = state.steps
	const foodDeposit = depositAmount * FOOD_DEPOSIT_SCALE
	for (let k = 0; k < FOOD_COUNT; k++) {
		const fx = (0.5 + 0.42 * Math.sin(foodParams[k * 4] * t + foodParams[k * 4 + 2])) * columns
		const fy = (0.5 + 0.42 * Math.sin(foodParams[k * 4 + 1] * t + foodParams[k * 4 + 3])) * rows
		const fxi = Math.min(columns - 1, Math.floor(fx))
		const fyi = Math.min(rows - 1, Math.floor(fy))
		trail[fyi * columns + fxi] += foodDeposit
	}
	state.steps = t + 1

	// Diffuse (3x3 toroidal mean) and evaporate into the ping-pong buffer, then swap by
	// rebinding — the diffuse+decay pass is what turns raw agent tracks into smooth,
	// self-reinforcing filament networks.
	// Absorbing boundary: out-of-range neighbors contribute 0 but the divisor stays 9,
	// so trail leaks off the edges. That gently discourages edge-hugging filaments.
	const next = state.trailNext
	const meanFactor = (opts.evaporation * DIFFUSE_RATE) / 9
	const centerFactor = opts.evaporation * (1 - DIFFUSE_RATE)
	for (let y = 0; y < rows; y++) {
		const row = y * columns
		const rowUp = row - columns
		const rowDown = row + columns
		const hasUp = y > 0
		const hasDown = y < rows - 1
		for (let x = 0; x < columns; x++) {
			const idx = row + x
			const hasL = x > 0
			const hasR = x < columns - 1
			const center = trail[idx]
			let sum = center
			if (hasL) sum += trail[idx - 1]
			if (hasR) sum += trail[idx + 1]
			if (hasUp) {
				sum += trail[rowUp + x]
				if (hasL) sum += trail[rowUp + x - 1]
				if (hasR) sum += trail[rowUp + x + 1]
			}
			if (hasDown) {
				sum += trail[rowDown + x]
				if (hasL) sum += trail[rowDown + x - 1]
				if (hasR) sum += trail[rowDown + x + 1]
			}
			next[idx] = sum * meanFactor + center * centerFactor
		}
	}
	state.trailNext = trail
	state.trail = next
}

function renderPhysarumFrame(
	store: GeneratorStateStore<PhysarumState>,
	frame: number,
	columns: number,
	rows: number,
	options: AsciiPhysarumOptions,
): AnsiScreen {
	const opts = resolveOptions(options)
	const agentCount = agentCountFor(columns, rows, opts.agentDensity)
	const stateKey = getStateKey(columns, rows, opts.seed, agentCount)

	let state = store.get(stateKey)
	if (!state || frame < state.lastFrame) {
		state = initState(columns, rows, opts.seed, agentCount)
		store.set(stateKey, state)
	}

	// Simulate forward, capped so a large jump (backgrounded tab, seek) cannot block the
	// main thread proportionally to the gap. Discontinuous jumps just skip simulation
	// time; the network keeps evolving from wherever it is.
	const cappedSteps = catchupSteps(frame, state.lastFrame) * opts.stepsPerFrame
	for (let step = 0; step < cappedSteps; step++) {
		stepPhysarum(state, columns, rows, opts)
	}
	state.lastFrame = frame

	const trail = state.trail
	const paletteTable = getPaletteTable(opts.palette)
	const charLookup = getCharLookup(opts.chars)
	const bgColor = opts.bgColor

	const lines: AnsiScreen['lines'] = []
	for (let y = 0; y < rows; y++) {
		const line: AnsiScreen['lines'][number] = []
		const row = y * columns
		for (let x = 0; x < columns; x++) {
			const v = trail[row + x]
			// Smooth saturating map of the unbounded trail value onto [0, 1).
			const idx = ((v / (v + TRAIL_HALF)) * 255) | 0
			line.push({ ch: charLookup[idx], fg: paletteTable[idx], bg: bgColor, bold: false })
		}
		lines.push(line)
	}

	return { lines, columns }
}

/**
 * Generate an ASCII physarum (slime mold) frame — an agent swarm whose sense/steer/
 * deposit feedback loop self-organizes into branching, constantly rewiring filament
 * networks over the first ~100 frames.
 *
 * Uses process-wide state keyed on dimensions and options, so separate components with
 * matching options will interfere with each other. Prefer
 * {@link createAsciiPhysarumGenerator} when rendering more than one instance.
 */
export function generateAsciiPhysarumFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiPhysarumOptions = {},
): AnsiScreen {
	return renderPhysarumFrame(sharedStore, frame, columns, rows, options)
}

/**
 * Create a physarum generator that owns its simulation state.
 * Each call returns an independent instance safe to render alongside others.
 */
export function createAsciiPhysarumGenerator(
	options: AsciiPhysarumOptions = {},
): CharacterFrameGenerator {
	const store = createGeneratorStateStore<PhysarumState>()
	return (frame: number, columns: number, rows: number) =>
		renderPhysarumFrame(store, frame, columns, rows, options)
}

/**
 * Create a reusable sampler for the physarum simulation at a specific frame.
 * Returns a function that maps world coordinates (x, y) to an ANSI cell.
 */
export function createAsciiPhysarumSampler(
	frame: number,
	options: AsciiPhysarumOptions = {},
) {
	const { bgColor = DEFAULT_BG_COLOR } = options

	const cols = 120
	const rows = 60
	const screen = generateAsciiPhysarumFrame(frame, cols, rows, options)

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
