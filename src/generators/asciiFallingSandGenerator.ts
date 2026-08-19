import type { AnsiScreen } from '../ansi/types'
import type { CharacterFrameGenerator } from '../types/types'
import { createGeneratorStateStore, type GeneratorStateStore } from './generatorState'
import type { AnsiPointerInput } from './pointerInput'
import { catchupSteps } from './simulationCatchup'

// Autonomous falling-sand toy. A handful of spouts near the top drift back and forth and
// drip sand; grains fall, pile against a few fixed wall ledges, and settle. Left alone the
// screen would eventually fill solid and go static, so once the pile covers more than
// ~55% of the grid a drain opens at the bottom row and deletes settling grains until the
// fill drops back under ~35% — the scene breathes forever instead of degenerating into a
// motionless block.
//
// Materials are sand-only (no water/liquid): water needs a second, laterally-spreading
// movement rule (checked before the sand fallback, with its own settle/viscosity
// tuning) to avoid looking like slow sand, which roughly doubles the physics pass and the
// option surface for a background effect. Sand alone already gives emitters, piling,
// ledges, and the drain breathing cycle — the interesting parts of the toy — so water is
// left out.
const MATERIAL_EMPTY = 0
const MATERIAL_WALL = 1
const MATERIAL_SAND_BASE = 2
// Three sand variants map 1:1 onto the three-glyph ░▒▓ ramp used for rendering (see
// SAND_CHARS below), so variant index and glyph index are always the same number.
const SAND_VARIANT_COUNT = 3
const SAND_CHARS = ['░', '▒', '▓']

const DEFAULT_SEED = 424242
const DEFAULT_STEPS_PER_FRAME = 1
const DEFAULT_SPOUT_COUNT = 3
const DEFAULT_SPOUT_RATE = 0.55
const DEFAULT_DRAIN_OPEN_THRESHOLD = 0.55
const DEFAULT_DRAIN_CLOSE_THRESHOLD = 0.35
const DEFAULT_POINTER_POUR_RATE = 4
const MAX_POINTER_POUR_RATE = 32
const DEFAULT_SAND_COLORS: [string, string, string] = ['#e8d18a', '#d1a94e', '#a97733']
const DEFAULT_WALL_COLOR = '#5c5c6b'
const DEFAULT_BG_COLOR = '#0a0a12'

export interface AsciiFallingSandOptions {
	/** Seed for wall-ledge placement, emitter jitter, and grain material/order choices. Default: 424242 */
	seed?: number
	/** Simulation steps per frame. Default: 1 */
	stepsPerFrame?: number
	/** Number of sand-emitting spouts near the top. Default: 3. Recommended range: 2-3 */
	spoutCount?: number
	/** Probability [0,1] each spout attempts to emit a grain per step. Default: 0.55 */
	spoutRate?: number
	/** Fill fraction (0-1) of non-wall cells at which the bottom drain opens. Default: 0.55 */
	drainOpenThreshold?: number
	/** Fill fraction (0-1) at which the bottom drain closes again. Default: 0.35 */
	drainCloseThreshold?: number
	/** CSS colors for the 3 sand variants, light to dark. Default: ['#e8d18a', '#d1a94e', '#a97733'] */
	sandColors?: [string, string, string]
	/** CSS color for wall ledges. Default: '#5c5c6b' */
	wallColor?: string
	/** Background color for empty cells. Default: '#0a0a12' */
	bgColor?: string
	/**
	 * Pointer input channel from the host display; sampled via `pointer.state`.
	 * While pressed, sand pours in at the pointer cell; hovering unpressed does nothing.
	 * Absent or inactive, behavior is identical to having no pointer at all.
	 */
	pointer?: AnsiPointerInput
	/** Grains poured per rendered frame while the pointer is pressed (0-32). Default: 4 */
	pointerPourRate?: number
}

// Deterministic RNG — same small LCG used across the other stateful generators in this
// package (see asciiGameOfLifeGenerator.ts / asciiReactionDiffusionGenerator.ts). Exposed
// here as a pure state-advance function (rather than a closure) because the simulation
// needs to persist the RNG's raw state across frames/steps inside GeneratorStateStore.
function advanceRngState(state: number): number {
	return (Math.imul(state, 1664525) + 1013904223) >>> 0
}

function rngFloat(state: number): number {
	return state / 0xffffffff
}

interface FallingSandState {
	// Mutated in place, no double buffer. Safe because each step scans rows bottom-up: by
	// the time row y is processed, row y+1 has already been fully resolved *for this step*,
	// so a grain moving from y into y+1 lands in a row that will not be revisited until the
	// next step. That ordering is what the parallel automata in this package (cyclic
	// automaton, Game of Life, reaction-diffusion) can't rely on — every one of their cells
	// updates "simultaneously" from the same source grid, which is exactly why those need a
	// second buffer. Falling sand's dependency only ever points to already-settled rows, so
	// one grid is enough.
	grid: Uint8Array
	cols: number
	rows: number
	lastFrame: number
	rngState: number
	drainActive: boolean
}

// State shared by all callers of generateAsciiFallingSandFrame. Prefer
// createAsciiFallingSandGenerator, which gives each instance its own.
const sharedStore = createGeneratorStateStore<FallingSandState>()

/**
 * Clear the falling-sand state shared by generateAsciiFallingSandFrame callers.
 * Instances from createAsciiFallingSandGenerator own their state and are unaffected.
 */
export function clearFallingSandState(): void {
	sharedStore.clear()
}

// Memoized state-key builder — avoids a JSON.stringify allocation every frame when the
// options driving the key haven't changed since the last call. Only params that affect
// *initialization* (grid size, seed -> wall ledges) belong in the key; emitter/drain
// tuning can change on an already-running simulation without needing a fresh grid.
let lastStateKeyParams: { columns: number; rows: number; seed: number } | null = null
let lastStateKey: string | null = null

function getStateKey(columns: number, rows: number, seed: number): string {
	if (
		lastStateKeyParams &&
		lastStateKeyParams.columns === columns &&
		lastStateKeyParams.rows === rows &&
		lastStateKeyParams.seed === seed &&
		lastStateKey
	) {
		return lastStateKey
	}
	lastStateKeyParams = { columns, rows, seed }
	// Plain field concatenation instead of JSON.stringify — no object-shape/property-order
	// ambiguity to worry about since every field here is a fixed-position number.
	lastStateKey = `${columns}:${rows}:${seed}`
	return lastStateKey
}

function initState(cols: number, rows: number, seed: number): FallingSandState {
	const grid = new Uint8Array(cols * rows) // all MATERIAL_EMPTY

	let rngState = seed >>> 0
	const rnd = (): number => {
		rngState = advanceRngState(rngState)
		return rngFloat(rngState)
	}

	// A few fixed wall ledges, deterministic from seed + dims, placed in the lower two
	// thirds of the grid so spouts near the top always have room to drop grains.
	const ledgeCount = 3 + Math.floor(rnd() * 3) // 3-5
	for (let i = 0; i < ledgeCount; i++) {
		const ledgeY = Math.min(rows - 2, Math.floor(rows * 0.35 + rnd() * rows * 0.55))
		const ledgeWidth = Math.max(2, Math.floor(cols * (0.15 + rnd() * 0.25)))
		const ledgeX = Math.floor(rnd() * Math.max(1, cols - ledgeWidth))
		const rowStart = ledgeY * cols
		for (let x = ledgeX; x < Math.min(cols, ledgeX + ledgeWidth); x++) {
			grid[rowStart + x] = MATERIAL_WALL
		}
	}

	return { grid, cols, rows, lastFrame: -1, rngState, drainActive: false }
}

function stepFallingSand(
	state: FallingSandState,
	frame: number,
	columns: number,
	rows: number,
	spoutCount: number,
	spoutRate: number,
	drainOpenThreshold: number,
	drainCloseThreshold: number,
): void {
	const grid = state.grid
	let rngState = state.rngState

	const nextRandom = (): number => {
		rngState = advanceRngState(rngState)
		return rngFloat(rngState)
	}

	// --- Emit ---
	// Spout x-positions drift sinusoidally with frame; jitter and material/emission
	// choices come from the persistent, seeded RNG so the whole sequence is deterministic
	// (including across catch-up jumps, which replay the same number of steps in order).
	for (let i = 0; i < spoutCount; i++) {
		const baseX = Math.round(((i + 1) * columns) / (spoutCount + 1))
		const amplitude = columns / 6
		const freq = 0.05 + i * 0.013
		const phase = (i * Math.PI * 2) / 3
		const drift = Math.sin(frame * freq + phase) * amplitude
		const jitter = Math.round((nextRandom() - 0.5) * 3)
		const spawnX = Math.min(columns - 1, Math.max(0, Math.round(baseX + drift) + jitter))

		if (nextRandom() < spoutRate) {
			if (grid[spawnX] === MATERIAL_EMPTY) {
				const variant = Math.min(SAND_VARIANT_COUNT - 1, Math.floor(nextRandom() * SAND_VARIANT_COUNT))
				grid[spawnX] = MATERIAL_SAND_BASE + variant
			}
		}
	}

	// --- Physics: bottom-up scan, alternating scan direction per row to avoid a
	// systematic left/right settling bias. ---
	for (let y = rows - 1; y >= 0; y--) {
		const row = y * columns

		if (y === rows - 1) {
			// Bottom row: grains have nowhere further to fall. While the drain is open,
			// anything that settles here is deleted instead of piling up forever.
			if (state.drainActive) {
				for (let x = 0; x < columns; x++) {
					const idx = row + x
					if (grid[idx] >= MATERIAL_SAND_BASE) grid[idx] = MATERIAL_EMPTY
				}
			}
			continue
		}

		const belowRow = row + columns
		const leftToRight = y % 2 === 0

		for (let xi = 0; xi < columns; xi++) {
			const x = leftToRight ? xi : columns - 1 - xi
			const idx = row + x
			const material = grid[idx]
			if (material < MATERIAL_SAND_BASE) continue // empty or wall: nothing to move

			const belowIdx = belowRow + x
			if (grid[belowIdx] === MATERIAL_EMPTY) {
				grid[belowIdx] = material
				grid[idx] = MATERIAL_EMPTY
				continue
			}

			// Blocked straight down: try down-left/down-right, order randomized per grain.
			const tryLeftFirst = nextRandom() < 0.5
			const leftX = x - 1
			const rightX = x + 1
			const leftIdx = leftX >= 0 ? belowRow + leftX : -1
			const rightIdx = rightX < columns ? belowRow + rightX : -1
			const firstIdx = tryLeftFirst ? leftIdx : rightIdx
			const secondIdx = tryLeftFirst ? rightIdx : leftIdx

			if (firstIdx !== -1 && grid[firstIdx] === MATERIAL_EMPTY) {
				grid[firstIdx] = material
				grid[idx] = MATERIAL_EMPTY
			} else if (secondIdx !== -1 && grid[secondIdx] === MATERIAL_EMPTY) {
				grid[secondIdx] = material
				grid[idx] = MATERIAL_EMPTY
			}
			// else: fully blocked, the grain stays put and piles up.
		}
	}

	// --- Anti-degeneration: hysteresis on fill fraction so the drain doesn't chatter
	// open/closed every step right at the boundary. ---
	let sandCount = 0
	for (let i = 0; i < grid.length; i++) {
		if (grid[i] >= MATERIAL_SAND_BASE) sandCount++
	}
	const fillFraction = sandCount / grid.length
	if (!state.drainActive && fillFraction > drainOpenThreshold) {
		state.drainActive = true
	} else if (state.drainActive && fillFraction < drainCloseThreshold) {
		state.drainActive = false
	}

	state.rngState = rngState
}

// Precomputed material -> {char, color} tables, rebuilt only when the palette options
// that shape them change.
let lastPaletteKey: string | null = null
let lastCharTable: string[] | null = null
let lastColorTable: string[] | null = null

function getRenderTables(
	sandColors: [string, string, string],
	wallColor: string,
	bgColor: string,
): { chars: string[]; colors: string[] } {
	const key = `${sandColors[0]}|${sandColors[1]}|${sandColors[2]}|${wallColor}|${bgColor}`
	if (lastPaletteKey === key && lastCharTable && lastColorTable) {
		return { chars: lastCharTable, colors: lastColorTable }
	}

	const size = MATERIAL_SAND_BASE + SAND_VARIANT_COUNT
	const chars = new Array<string>(size)
	const colors = new Array<string>(size)

	chars[MATERIAL_EMPTY] = ' '
	colors[MATERIAL_EMPTY] = bgColor
	chars[MATERIAL_WALL] = '█'
	colors[MATERIAL_WALL] = wallColor
	for (let i = 0; i < SAND_VARIANT_COUNT; i++) {
		chars[MATERIAL_SAND_BASE + i] = SAND_CHARS[i]
		colors[MATERIAL_SAND_BASE + i] = sandColors[i]
	}

	lastPaletteKey = key
	lastCharTable = chars
	lastColorTable = colors
	return { chars, colors }
}

function renderFallingSandFrame(
	store: GeneratorStateStore<FallingSandState>,
	frame: number,
	columns: number,
	rows: number,
	options: AsciiFallingSandOptions,
): AnsiScreen {
	const {
		seed = DEFAULT_SEED,
		stepsPerFrame = DEFAULT_STEPS_PER_FRAME,
		spoutCount = DEFAULT_SPOUT_COUNT,
		spoutRate = DEFAULT_SPOUT_RATE,
		drainOpenThreshold = DEFAULT_DRAIN_OPEN_THRESHOLD,
		drainCloseThreshold: rawDrainCloseThreshold = DEFAULT_DRAIN_CLOSE_THRESHOLD,
		sandColors = DEFAULT_SAND_COLORS,
		wallColor = DEFAULT_WALL_COLOR,
		bgColor = DEFAULT_BG_COLOR,
		pointer,
		pointerPourRate = DEFAULT_POINTER_POUR_RATE,
	} = options

	// Sample the pointer channel once per generate call so a mid-render host update
	// cannot tear a frame. Costs one property read when a pointer is attached, nothing
	// otherwise.
	const pointerState = pointer ? pointer.state : undefined

	// Clamp close <= open: a misconfigured close > open threshold would otherwise make the
	// drain flip open/closed every step once the fill fraction sits between them.
	const drainCloseThreshold = Math.min(rawDrainCloseThreshold, drainOpenThreshold)

	const stateKey = getStateKey(columns, rows, seed)

	let state = store.get(stateKey)
	if (!state || frame < state.lastFrame) {
		state = initState(columns, rows, seed)
		store.set(stateKey, state)
	}

	// Simulate forward, capped so a large jump (backgrounded tab, seek) cannot block the
	// main thread proportionally to the gap. The emitters' spout positions are a function
	// of the absolute frame number, so each real frame tick within the catch-up window
	// must be stepped with its own frame number -- reusing the outer `frame` argument for
	// every tick would make the emitters see the same spout phase repeatedly during a
	// catch-up jump, producing a different (and calling-pattern-dependent) result than
	// stepping through the same ticks one at a time. `stepsPerFrame` substeps within a
	// single tick intentionally do share that tick's frame number, the same way
	// asciiReactionDiffusionGenerator's substeps share one frame.
	const frameTicks = catchupSteps(frame, state.lastFrame)
	const boundedSpoutCount = Math.max(1, Math.floor(spoutCount))
	for (let tick = 0; tick < frameTicks; tick++) {
		const stepFrame = frame - (frameTicks - 1 - tick)
		for (let sub = 0; sub < stepsPerFrame; sub++) {
			stepFallingSand(
				state,
				stepFrame,
				columns,
				rows,
				boundedSpoutCount,
				spoutRate,
				drainOpenThreshold,
				drainCloseThreshold,
			)
		}
	}

	// --- Pointer pour ---
	// Injected once per generate call, AFTER catch-up simulation, rather than once per
	// catch-up tick: catchupSteps() may replay up to MAX_SIMULATION_CATCHUP ticks for a
	// single call, and pouring per tick would multiply the pour rate by a
	// calling-pattern-dependent tick count. One pour per rendered frame keeps the stream
	// density independent of frame gaps; the fresh grains sit at the pointer cell for this
	// render and fall as ordinary sand from the next step on. Gated on frameTicks > 0 so
	// re-rendering the same frame (a pure re-read) pours nothing and stays idempotent.
	// Jitter and variant choices come from the sim's persistent seeded RNG, so the whole
	// run stays a pure function of the frame + pointer-state sequences.
	if (pointerState && pointerState.pressed && frameTicks > 0) {
		const pourRate = Number.isFinite(pointerPourRate)
			? Math.max(0, Math.min(MAX_POINTER_POUR_RATE, Math.floor(pointerPourRate)))
			: DEFAULT_POINTER_POUR_RATE
		const px = Math.round(pointerState.x)
		const py = Math.round(pointerState.y)
		// Rows outside the grid have nowhere to pour; columns are checked per grain since
		// horizontal jitter can carry an edge-adjacent pour back into bounds.
		if (py >= 0 && py < rows && pourRate > 0) {
			const grid = state.grid
			let rngState = state.rngState
			const rowStart = py * columns
			for (let g = 0; g < pourRate; g++) {
				rngState = advanceRngState(rngState)
				const jitter = Math.round((rngFloat(rngState) - 0.5) * 4) // -2..2 cells
				rngState = advanceRngState(rngState)
				const variant = Math.min(SAND_VARIANT_COUNT - 1, Math.floor(rngFloat(rngState) * SAND_VARIANT_COUNT))
				const gx = px + jitter
				if (gx < 0 || gx >= columns) continue
				const idx = rowStart + gx
				if (grid[idx] === MATERIAL_EMPTY) {
					grid[idx] = MATERIAL_SAND_BASE + variant
				}
			}
			state.rngState = rngState
		}
	}

	state.lastFrame = frame

	const { chars, colors } = getRenderTables(sandColors, wallColor, bgColor)
	const grid = state.grid

	const lines: AnsiScreen['lines'] = []
	for (let y = 0; y < rows; y++) {
		const line: AnsiScreen['lines'][number] = []
		const row = y * columns
		for (let x = 0; x < columns; x++) {
			const material = grid[row + x]
			line.push({
				ch: chars[material],
				fg: colors[material],
				bg: bgColor,
				bold: material === MATERIAL_WALL,
			})
		}
		lines.push(line)
	}

	return { lines, columns }
}

/**
 * Generate an ASCII falling-sand frame — autonomous emitters drip sand that piles against
 * fixed wall ledges, with a self-regulating drain that keeps the scene from ever filling
 * up solid.
 *
 * Uses process-wide state keyed on dimensions and options, so separate components with
 * matching options will interfere with each other. Prefer
 * {@link createAsciiFallingSandGenerator} when rendering more than one instance.
 */
export function generateAsciiFallingSandFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiFallingSandOptions = {},
): AnsiScreen {
	return renderFallingSandFrame(sharedStore, frame, columns, rows, options)
}

/**
 * Create a falling-sand generator that owns its simulation state.
 * Each call returns an independent instance safe to render alongside others.
 */
export function createAsciiFallingSandGenerator(
	options: AsciiFallingSandOptions = {},
): CharacterFrameGenerator {
	const store = createGeneratorStateStore<FallingSandState>()
	return (frame: number, columns: number, rows: number) =>
		renderFallingSandFrame(store, frame, columns, rows, options)
}

/**
 * Create a reusable sampler for falling sand at a specific frame.
 * Returns a function that maps world coordinates (x, y) to an ANSI cell.
 */
export function createAsciiFallingSandSampler(
	frame: number,
	options: AsciiFallingSandOptions = {},
) {
	const { bgColor = DEFAULT_BG_COLOR } = options

	const cols = 120
	const rows = 60
	const screen = generateAsciiFallingSandFrame(frame, cols, rows, options)

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
