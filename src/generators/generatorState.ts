/**
 * Bounded store for the mutable simulation state that stateful generators carry between frames.
 *
 * Generators are invoked as `(frame, columns, rows)` with their options already bound, so they
 * have no instance identity to key state on. Keying a single module-level map on the options
 * instead makes every component with matching options share one simulation: whichever caller
 * is furthest behind trips the backwards-seek reset and rewinds the others, every frame.
 *
 * So state is owned by a store, and each generator instance gets its own. The dimension/option
 * key still exists inside a store because one instance can legitimately be asked for several
 * sizes (viewport resize, sampler backing grids).
 */
export interface GeneratorStateStore<S> {
	get(key: string): S | undefined
	set(key: string, value: S): void
	clear(): void
}

const DEFAULT_MAX_ENTRIES = 32

/**
 * Create an insertion-ordered store that evicts its oldest entry past `maxEntries`.
 * Bounded because a resize or option tweak mints a new key rather than replacing one.
 */
export function createGeneratorStateStore<S>(
	maxEntries: number = DEFAULT_MAX_ENTRIES
): GeneratorStateStore<S> {
	const entries = new Map<string, S>()
	return {
		get(key: string): S | undefined {
			return entries.get(key)
		},
		set(key: string, value: S): void {
			entries.set(key, value)
			while (entries.size > maxEntries) {
				const oldest = entries.keys().next().value
				if (oldest === undefined) break
				entries.delete(oldest)
			}
		},
		clear(): void {
			entries.clear()
		},
	}
}
