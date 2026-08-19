import type { AnsiCell, AnsiScreen } from '../ansi/types'
import type { CharacterFrameGenerator, CharacterFrameGeneratorWithMetadata } from '../types/types'

/**
 * Transitions between frame generators.
 *
 * {@link createAnsiTransition} plays one generator, then hands the screen over to a second
 * one through a per-cell transition (dissolve, directional wipes, or block glitch).
 * {@link createAnsiGeneratorCycle} chains that idea into an endless screensaver: a list of
 * generators shown `holdFrames` at a time, each handoff animated.
 *
 * Both return a plain {@link CharacterFrameGenerator}, so the result drops straight into
 * `AnsiVirtualDisplay` and can itself be wrapped in `composeAnsiEffects`.
 *
 * ## Aliasing contract
 *
 * Outside a transition window the source generator's screen is returned as-is (same
 * lifetime as that generator's own output). During a transition the returned screen's
 * row arrays are owned by this instance and REUSED across frames, and its cells are
 * references to the two source screens' cells — nothing is ever mutated. As with post
 * effects, the returned screen is only valid until the same instance is called again.
 *
 * Everything is deterministic in `(frame, seed)`: no wall clock, no `Math.random`.
 */

/** How a transition reveals the incoming screen. */
export type TransitionKind =
	| 'dissolve'
	| 'wipeRight'
	| 'wipeLeft'
	| 'wipeDown'
	| 'wipeUp'
	| 'blocks'

export interface AnsiTransitionOptions {
	/** Frame at which the transition begins. Default: 0 */
	startFrame?: number
	/** How many frames the transition lasts. Default: 60 */
	durationFrames?: number
	/**
	 * Transition style. `'dissolve'` flips cells in a deterministic random order;
	 * `'wipeRight'`/`'wipeLeft'`/`'wipeDown'`/`'wipeUp'` sweep a dithered front across the
	 * screen in that direction; `'blocks'` flips 8x4-cell tiles in random order. Default: 'dissolve'
	 */
	kind?: TransitionKind
	/** Seed for the deterministic dissolve/dither/block ordering. Default: 96337 */
	seed?: number
	/**
	 * Width of the dithered edge on wipes, as a fraction of the wipe axis (0 = hard edge).
	 * Default: 0.15
	 */
	softness?: number
}

const DEFAULT_DURATION_FRAMES = 60
const DEFAULT_SEED = 96337
const DEFAULT_SOFTNESS = 0.15
const BLOCK_WIDTH = 8
const BLOCK_HEIGHT = 4

/** Fallback cell for out-of-range samples (a source returned fewer rows/columns than asked). */
const BLANK_CELL: AnsiCell = { ch: ' ', fg: '#000000', bg: '#000000', bold: false }

function clampIntOption(v: number | undefined, fallback: number, min: number, max: number): number {
	if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
	const n = Math.floor(v)
	return n < min ? min : n > max ? max : n
}

function clamp01Option(v: number | undefined, fallback: number): number {
	if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
	return v < 0 ? 0 : v > 1 ? 1 : v
}

/** Deterministic 32-bit coordinate hash (same mixing as the post-effects module). */
function hash2D(x: number, y: number, seed: number): number {
	let h = (x * 0x9e3779b1) ^ (y * 0x85ebca6b) ^ seed
	h ^= h >>> 16
	h = Math.imul(h, 0x7feb352d)
	h ^= h >>> 15
	h = Math.imul(h, 0x846ca68b)
	h ^= h >>> 16
	return h >>> 0
}

function hash01(x: number, y: number, seed: number): number {
	return hash2D(x, y, seed) / 0xffffffff
}

/**
 * Per-cell reveal progress in [0, 1]: the incoming screen shows at this cell once the
 * transition's progress passes this value (plus dither). Lower = revealed earlier.
 */
function cellProgress(
	kind: TransitionKind,
	x: number,
	y: number,
	columns: number,
	rows: number,
	seed: number
): number {
	switch (kind) {
		case 'wipeRight':
			return columns > 1 ? x / (columns - 1) : 0
		case 'wipeLeft':
			return columns > 1 ? 1 - x / (columns - 1) : 0
		case 'wipeDown':
			return rows > 1 ? y / (rows - 1) : 0
		case 'wipeUp':
			return rows > 1 ? 1 - y / (rows - 1) : 0
		case 'blocks':
			return hash01(Math.floor(x / BLOCK_WIDTH), Math.floor(y / BLOCK_HEIGHT), seed)
		case 'dissolve':
		default:
			return hash01(x, y, seed)
	}
}

/** Wipes dither their front; dissolve and blocks are already noise-ordered. */
function isWipe(kind: TransitionKind): boolean {
	return kind === 'wipeRight' || kind === 'wipeLeft' || kind === 'wipeDown' || kind === 'wipeUp'
}

/**
 * Fill `outLines` (reused, instance-owned) with per-cell picks from `a` (outgoing) and
 * `b` (incoming) at transition progress `t` in (0, 1).
 */
function blendScreens(
	outLines: AnsiCell[][],
	a: AnsiScreen,
	b: AnsiScreen,
	t: number,
	kind: TransitionKind,
	seed: number,
	softness: number,
	columns: number,
	rows: number
): void {
	const dither = isWipe(kind) ? softness : 0
	// Map t so the front (including its dither band) fully clears both ends.
	const threshold = t * (1 + dither) - dither / 2

	if (outLines.length !== rows) outLines.length = rows
	for (let y = 0; y < rows; y++) {
		let row = outLines[y]
		if (row === undefined) {
			row = []
			outLines[y] = row
		}
		if (row.length !== columns) row.length = columns

		const aRow = a.lines[y]
		const bRow = b.lines[y]

		for (let x = 0; x < columns; x++) {
			let progress = cellProgress(kind, x, y, columns, rows, seed)
			if (dither > 0) progress += (hash01(x, y, seed ^ 0x51ed270b) - 0.5) * dither
			const source = progress < threshold ? bRow : aRow
			row[x] = (source !== undefined ? source[x] : undefined) ?? BLANK_CELL
		}
	}
}

/**
 * Play `from`, then transition to `to` over a frame window.
 *
 * Before `startFrame` the composed generator returns `from`'s screens untouched; from
 * `startFrame + durationFrames` on it returns `to`'s screens untouched. In between, both
 * generators run and each cell shows one or the other according to the transition kind.
 * Both generators are called with the raw frame number, so stateful simulations keep
 * their own timelines (and see a normal capped catch-up jump when the transition first
 * needs them).
 */
export function createAnsiTransition(
	from: CharacterFrameGenerator,
	to: CharacterFrameGenerator,
	options: AnsiTransitionOptions = {}
): CharacterFrameGeneratorWithMetadata {
	const startFrame = clampIntOption(options.startFrame, 0, 0, Number.MAX_SAFE_INTEGER)
	const durationFrames = clampIntOption(
		options.durationFrames,
		DEFAULT_DURATION_FRAMES,
		1,
		Number.MAX_SAFE_INTEGER
	)
	const kind: TransitionKind = options.kind ?? 'dissolve'
	const seed = clampIntOption(options.seed, DEFAULT_SEED, 0, 0xffffffff)
	const softness = clamp01Option(options.softness, DEFAULT_SOFTNESS)

	const outLines: AnsiCell[][] = []

	return (frame: number, columns: number, rows: number): AnsiScreen => {
		if (frame < startFrame) return from(frame, columns, rows)
		if (frame >= startFrame + durationFrames) return to(frame, columns, rows)

		const t = (frame - startFrame + 1) / (durationFrames + 1)
		const a = from(frame, columns, rows)
		const b = to(frame, columns, rows)
		blendScreens(outLines, a, b, t, kind, seed, softness, columns, rows)
		return { lines: outLines, columns }
	}
}

export interface AnsiGeneratorCycleOptions {
	/** Frames each generator is shown between transitions. Default: 360 */
	holdFrames?: number
	/** Frames each transition lasts. Default: 48 */
	transitionFrames?: number
	/**
	 * Transition style(s). A single kind uses it for every handoff; an array is cycled
	 * through in order, one kind per handoff. Default: all kinds, cycled.
	 */
	kind?: TransitionKind | TransitionKind[]
	/** Seed for the deterministic per-handoff dissolve/dither/block ordering. Default: 96337 */
	seed?: number
	/** Dither width for wipe fronts, as a fraction of the wipe axis. Default: 0.15 */
	softness?: number
}

const DEFAULT_HOLD_FRAMES = 360
const DEFAULT_TRANSITION_FRAMES = 48
const ALL_TRANSITION_KINDS: TransitionKind[] = [
	'dissolve',
	'wipeRight',
	'blocks',
	'wipeDown',
	'wipeLeft',
	'wipeUp',
]

/**
 * Endless screensaver rotation over a list of generators.
 *
 * Each generator holds the screen for `holdFrames`, then hands off to the next over
 * `transitionFrames` (wrapping from the last back to the first). Only the generators
 * involved in the current hold or handoff are invoked on any given frame, so idle
 * simulations simply see a frame jump — which their capped catch-up already handles.
 *
 * Deterministic in `(frame, seed)`; each handoff gets its own derived seed so two
 * dissolves never flip cells in the same order.
 */
export function createAnsiGeneratorCycle(
	generators: CharacterFrameGenerator[],
	options: AnsiGeneratorCycleOptions = {}
): CharacterFrameGeneratorWithMetadata {
	const list = generators.filter((generator) => typeof generator === 'function')
	const holdFrames = clampIntOption(options.holdFrames, DEFAULT_HOLD_FRAMES, 1, Number.MAX_SAFE_INTEGER)
	const transitionFrames = clampIntOption(
		options.transitionFrames,
		DEFAULT_TRANSITION_FRAMES,
		1,
		Number.MAX_SAFE_INTEGER
	)
	const seed = clampIntOption(options.seed, DEFAULT_SEED, 0, 0xffffffff)
	const softness = clamp01Option(options.softness, DEFAULT_SOFTNESS)
	const kinds: TransitionKind[] = Array.isArray(options.kind)
		? options.kind.length > 0
			? options.kind
			: ALL_TRANSITION_KINDS
		: options.kind !== undefined
			? [options.kind]
			: ALL_TRANSITION_KINDS

	const outLines: AnsiCell[][] = []

	if (list.length === 0) {
		return (frame: number, columns: number, rows: number): AnsiScreen => {
			void frame
			const lines: AnsiCell[][] = []
			for (let y = 0; y < rows; y++) {
				const row: AnsiCell[] = []
				for (let x = 0; x < columns; x++) row.push(BLANK_CELL)
				lines.push(row)
			}
			return { lines, columns }
		}
	}
	if (list.length === 1) {
		return (frame: number, columns: number, rows: number) => list[0](frame, columns, rows)
	}

	const period = holdFrames + transitionFrames

	return (frame: number, columns: number, rows: number): AnsiScreen => {
		const safeFrame = Number.isFinite(frame) && frame >= 0 ? Math.floor(frame) : 0
		const segment = Math.floor(safeFrame / period)
		const local = safeFrame - segment * period
		const current = list[segment % list.length]

		if (local < holdFrames) return current(safeFrame, columns, rows)

		const next = list[(segment + 1) % list.length]
		const kind = kinds[segment % kinds.length]
		const handoffSeed = (seed ^ Math.imul(segment + 1, 0x9e3779b1)) >>> 0
		const t = (local - holdFrames + 1) / (transitionFrames + 1)
		const a = current(safeFrame, columns, rows)
		const b = next(safeFrame, columns, rows)
		blendScreens(outLines, a, b, t, kind, handoffSeed, softness, columns, rows)
		return { lines: outLines, columns }
	}
}
