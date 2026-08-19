/**
 * Pointer input for interactive generators.
 *
 * Generators are pure functions of `(frame, columns, rows, options)`; interactivity is fed
 * in through an explicit, injectable input object rather than by widening that signature.
 * The host (typically `AnsiVirtualDisplay` via its `pointerInput` prop) writes the current
 * pointer state into an {@link AnsiPointerInput}; a generator given the same object through
 * its `pointer` option samples `input.state` once per frame.
 *
 * Determinism is preserved in the way that matters for this library: a generator's output
 * is a pure function of its frame sequence *and* the pointer-state sequence, and tests can
 * drive the same object programmatically to replay any interaction exactly. A generator
 * whose pointer is absent — or present but never activated — must behave byte-for-byte
 * identically to one with no pointer at all.
 *
 * Coordinates are in fractional character cells of the generator's grid (`x` in
 * `[0, columns)`, `y` in `[0, rows)`), already offset into the virtual world when the host
 * renders a windowed viewport. Positions may be sampled outside the grid while dragging
 * past an edge; consumers clamp as needed.
 */

/** Snapshot of the pointer as of the most recent host event. */
export interface AnsiPointerState {
	/** Horizontal position in fractional cell coordinates. */
	x: number
	/** Vertical position in fractional cell coordinates. */
	y: number
	/** True while the pointer is over the display (between enter and leave). */
	active: boolean
	/** True while a button/touch is held down. */
	pressed: boolean
}

/**
 * Shared mutable pointer channel between a host component and any generators observing it.
 *
 * `state` is replaced (not mutated) on every update, so a consumer may safely hold the
 * snapshot it sampled at the start of a frame.
 */
export interface AnsiPointerInput {
	/** Current pointer snapshot. Sample once per frame. */
	readonly state: AnsiPointerState
	/** Move the pointer to a cell position (marks it active). */
	move(x: number, y: number): void
	/** Press at the current position, or at (x, y) when given. */
	down(x?: number, y?: number): void
	/** Release the press, optionally updating the position. */
	up(x?: number, y?: number): void
	/** Pointer left the display: clears `active` and `pressed`, keeps the last position. */
	leave(): void
	/** Reset to the initial inactive state. */
	reset(): void
}

const INITIAL_STATE: AnsiPointerState = Object.freeze({
	x: 0,
	y: 0,
	active: false,
	pressed: false,
})

function finiteOr(value: number | undefined, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Create an independent pointer input channel (one per interactive display). */
export function createAnsiPointerInput(): AnsiPointerInput {
	let state: AnsiPointerState = INITIAL_STATE

	return {
		get state() {
			return state
		},
		move(x: number, y: number): void {
			state = { x: finiteOr(x, state.x), y: finiteOr(y, state.y), active: true, pressed: state.pressed }
		},
		down(x?: number, y?: number): void {
			state = { x: finiteOr(x, state.x), y: finiteOr(y, state.y), active: true, pressed: true }
		},
		up(x?: number, y?: number): void {
			state = { x: finiteOr(x, state.x), y: finiteOr(y, state.y), active: true, pressed: false }
		},
		leave(): void {
			state = { x: state.x, y: state.y, active: false, pressed: false }
		},
		reset(): void {
			state = INITIAL_STATE
		},
	}
}

/** The subset of a DOMRect the cell mapping needs (plain numbers, DOM-free). */
export interface CellMappingRect {
	left: number
	top: number
	width: number
	height: number
}

/**
 * Map a client-space position (e.g. `PointerEvent.clientX/Y`) over a display rectangle to
 * fractional cell coordinates of a `columns` x `rows` grid, plus an optional virtual-world
 * viewport offset. Pure math, unit-testable without a DOM.
 *
 * The result is NOT clamped to the grid — a drag can leave the rectangle before the host
 * receives the leave event — except that a degenerate (zero-area) rectangle maps to (0, 0).
 */
export function mapClientToCell(
	rect: CellMappingRect,
	clientX: number,
	clientY: number,
	columns: number,
	rows: number,
	viewX = 0,
	viewY = 0
): { x: number; y: number } {
	if (
		!Number.isFinite(rect.width) ||
		!Number.isFinite(rect.height) ||
		rect.width <= 0 ||
		rect.height <= 0 ||
		!Number.isFinite(clientX) ||
		!Number.isFinite(clientY)
	) {
		return { x: 0, y: 0 }
	}
	const x = ((clientX - rect.left) / rect.width) * columns + viewX
	const y = ((clientY - rect.top) / rect.height) * rows + viewY
	return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 }
}
