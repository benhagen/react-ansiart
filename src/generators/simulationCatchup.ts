/**
 * Shared catch-up policy for generators that advance a simulation one step per frame.
 *
 * These generators keep a `lastFrame` and simulate forward across the gap when the caller
 * jumps ahead. The gap is not bounded by anything the generator controls: requestAnimationFrame
 * stops firing in a backgrounded tab, and callers may seek arbitrarily. Simulating the whole
 * gap would block the main thread proportionally to it, so the gap is capped and the most
 * recent steps are the ones that run.
 */
export const MAX_SIMULATION_CATCHUP = 8

/**
 * Number of simulation steps to run to reach `frame`, capped at {@link MAX_SIMULATION_CATCHUP}.
 * Returns 0 when the simulation is already at or ahead of `frame`.
 */
export function catchupSteps(frame: number, lastFrame: number): number {
	return Math.min(MAX_SIMULATION_CATCHUP, Math.max(0, frame - lastFrame))
}
