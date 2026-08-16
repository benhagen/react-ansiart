import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	createAsciiCyclicAutomatonGenerator,
	generateAsciiCyclicAutomatonFrame,
} from './asciiCyclicAutomatonGenerator'

const COLUMNS = 24
const ROWS = 12

function digitChars(n: number): string[] {
	return Array.from({ length: n }, (_, i) => String(i))
}

// Decode a rendered screen back into raw state numbers. Only valid when `chars` was set
// to digitChars(states), which makes chars[state] === String(state).
function decodeStates(screen: ReturnType<typeof generateAsciiCyclicAutomatonFrame>): number[][] {
	return screen.lines.map((line) => line.map((cell) => Number(cell.ch)))
}

// Independent reference implementation of the cyclic CA rule (toroidal Moore
// neighborhood, plain modulo wrap) used to cross-check the generator's optimized,
// hoisted-offset step against a straightforward hand-written one.
function referenceStep(grid: number[][], states: number, threshold: number): number[][] {
	const rows = grid.length
	const columns = grid[0].length
	const next: number[][] = Array.from({ length: rows }, () => new Array<number>(columns))

	for (let y = 0; y < rows; y++) {
		for (let x = 0; x < columns; x++) {
			const s = grid[y][x]
			const target = (s + 1) % states
			let count = 0
			for (let dy = -1; dy <= 1; dy++) {
				for (let dx = -1; dx <= 1; dx++) {
					if (dx === 0 && dy === 0) continue
					const ny = ((y + dy) % rows + rows) % rows
					const nx = ((x + dx) % columns + columns) % columns
					if (grid[ny][nx] === target) count++
				}
			}
			next[y][x] = count >= threshold ? target : s
		}
	}

	return next
}

describe('generateAsciiCyclicAutomatonFrame', () => {
	it('returns a full rectangular screen', () => {
		const screen = generateAsciiCyclicAutomatonFrame(5, COLUMNS, ROWS)
		assert.equal(screen.columns, COLUMNS)
		assert.equal(screen.lines.length, ROWS)
		for (const [index, line] of screen.lines.entries()) {
			assert.equal(line.length, COLUMNS, `row ${index} is ragged`)
			for (const cell of line) {
				assert.equal([...cell.ch].length, 1, `row ${index} has a non-single-character cell`)
			}
		}
	})

	it('is deterministic for the same (frame, dims, options)', () => {
		const options = { states: 10, seed: 55, threshold: 2 }
		const a = generateAsciiCyclicAutomatonFrame(9, COLUMNS, ROWS, options)
		const b = generateAsciiCyclicAutomatonFrame(9, COLUMNS, ROWS, options)
		assert.deepEqual(a, b)
	})

	it('state values are always in [0, N)', () => {
		const states = 8
		const gen = createAsciiCyclicAutomatonGenerator({ states, seed: 3, chars: digitChars(states) })
		for (let frame = 0; frame <= 15; frame++) {
			const decoded = decodeStates(gen(frame, COLUMNS, ROWS) as ReturnType<typeof generateAsciiCyclicAutomatonFrame>)
			for (const row of decoded) {
				for (const s of row) {
					assert.ok(Number.isInteger(s) && s >= 0 && s < states, `state ${s} out of range [0, ${states})`)
				}
			}
		}
	})

	it('a known small-grid step matches an independently hand-written reference implementation', () => {
		const states = 3
		const threshold = 1
		const options = { states, threshold, neighborhood: 'moore' as const, seed: 4242, chars: digitChars(states) }
		const width = 9
		const height = 7

		const gen = createAsciiCyclicAutomatonGenerator(options)

		let previous = decodeStates(gen(0, width, height) as ReturnType<typeof generateAsciiCyclicAutomatonFrame>)
		for (let frame = 1; frame <= 5; frame++) {
			const expected = referenceStep(previous, states, threshold)
			const actual = decodeStates(gen(frame, width, height) as ReturnType<typeof generateAsciiCyclicAutomatonFrame>)
			assert.deepEqual(actual, expected, `frame ${frame} diverged from the hand-written reference step`)
			previous = actual
		}
	})

	it('von Neumann neighborhood step matches its own independent reference', () => {
		const states = 4
		const threshold = 1
		const options = {
			states,
			threshold,
			neighborhood: 'vonNeumann' as const,
			seed: 77,
			chars: digitChars(states),
		}
		const width = 8
		const height = 6

		function referenceVonNeumannStep(grid: number[][]): number[][] {
			const rows = grid.length
			const columns = grid[0].length
			const next: number[][] = Array.from({ length: rows }, () => new Array<number>(columns))
			for (let y = 0; y < rows; y++) {
				for (let x = 0; x < columns; x++) {
					const s = grid[y][x]
					const target = (s + 1) % states
					let count = 0
					const neighbors = [
						[y - 1, x],
						[y + 1, x],
						[y, x - 1],
						[y, x + 1],
					]
					for (const [ny, nx] of neighbors) {
						const wy = ((ny % rows) + rows) % rows
						const wx = ((nx % columns) + columns) % columns
						if (grid[wy][wx] === target) count++
					}
					next[y][x] = count >= threshold ? target : s
				}
			}
			return next
		}

		const gen = createAsciiCyclicAutomatonGenerator(options)
		let previous = decodeStates(gen(0, width, height) as ReturnType<typeof generateAsciiCyclicAutomatonFrame>)
		for (let frame = 1; frame <= 4; frame++) {
			const expected = referenceVonNeumannStep(previous)
			const actual = decodeStates(gen(frame, width, height) as ReturnType<typeof generateAsciiCyclicAutomatonFrame>)
			assert.deepEqual(actual, expected, `frame ${frame} diverged from the von Neumann reference step`)
			previous = actual
		}
	})

	it('instance isolation: two instances with different seeds advance independently', () => {
		const a = createAsciiCyclicAutomatonGenerator({ seed: 1 })
		const b = createAsciiCyclicAutomatonGenerator({ seed: 2 })

		const asText = (screen: ReturnType<typeof generateAsciiCyclicAutomatonFrame>) =>
			screen.lines.map((line) => line.map((cell) => cell.fg).join(',')).join('|')

		// Interleave calls, including a rewind on `b`, and confirm `a` is unaffected.
		for (let frame = 0; frame <= 5; frame++) a(frame, COLUMNS, ROWS)
		const aExpected = asText(a(6, COLUMNS, ROWS))

		for (let frame = 0; frame <= 5; frame++) {
			b(frame, COLUMNS, ROWS)
			a(0, COLUMNS, ROWS) // rewind `a`'s own timeline, interleaved with `b`
		}
		// `a` was rewound and replayed above, but should still land on the same frame-6 state.
		for (let frame = 1; frame <= 6; frame++) a(frame, COLUMNS, ROWS)
		const aActual = asText(a(6, COLUMNS, ROWS))
		assert.equal(aActual, aExpected)

		// Two fresh same-seed instances agree with each other.
		const c = createAsciiCyclicAutomatonGenerator({ seed: 9 })
		const d = createAsciiCyclicAutomatonGenerator({ seed: 9 })
		for (let frame = 0; frame <= 4; frame++) {
			c(frame, COLUMNS, ROWS)
			d(frame, COLUMNS, ROWS)
		}
		assert.equal(asText(c(5, COLUMNS, ROWS)), asText(d(5, COLUMNS, ROWS)))

		// Different seeds produce different output.
		assert.notEqual(asText(c(5, COLUMNS, ROWS)), asText(b(5, COLUMNS, ROWS)))
	})

	it('still has live spiral activity after 1500 steps at 80x25 defaults', () => {
		// The old default of 14 states burned the board down to a single uniform
		// colour within a few hundred steps at this size. A healthy cyclic CA keeps
		// its spiral waves running indefinitely.
		const gen = createAsciiCyclicAutomatonGenerator({})
		const columns = 80
		const rows = 25
		const total = columns * rows

		const colorsAt = (frame: number): string[] =>
			gen(frame, columns, rows).lines.flatMap((line) => line.map((cell) => String(cell.fg)))

		let previous = colorsAt(0)
		for (let frame = 1; frame <= 1450; frame++) previous = colorsAt(frame)

		let changedTotal = 0
		for (let frame = 1451; frame <= 1500; frame++) {
			const current = colorsAt(frame)
			for (let i = 0; i < current.length; i++) if (current[i] !== previous[i]) changedTotal++
			previous = current
		}

		const distinct = new Set(previous).size
		assert.ok(distinct >= 3, `only ${distinct} distinct states remain after 1500 steps`)

		const changedFraction = changedTotal / (total * 50)
		assert.ok(
			changedFraction > 0.05,
			`only ${(changedFraction * 100).toFixed(2)}% of cells changed per step over the last 50 steps`,
		)
	})

	it('recovers from a board that has fixated instead of staying frozen forever', () => {
		// Parameters outside the spiral regime lock the board solid. The stall
		// detector must notice and re-seed a patch so the effect never dies.
		const columns = 48
		const rows = 20
		const gen = createAsciiCyclicAutomatonGenerator({ states: 24, threshold: 4, seed: 4242 })

		const colorsAt = (frame: number): string[] =>
			gen(frame, columns, rows).lines.flatMap((line) => line.map((cell) => String(cell.fg)))

		let previous = colorsAt(0)
		for (let frame = 1; frame <= 300; frame++) previous = colorsAt(frame)

		let changedTotal = 0
		for (let frame = 301; frame <= 400; frame++) {
			const current = colorsAt(frame)
			for (let i = 0; i < current.length; i++) if (current[i] !== previous[i]) changedTotal++
			previous = current
		}

		assert.ok(changedTotal > 0, 'a fixated board never recovered — nothing changed over 100 steps')
	})

	it('a large frame jump stays cheap (catch-up is capped)', () => {
		const gen = createAsciiCyclicAutomatonGenerator({ seed: 7 })
		gen(0, COLUMNS, ROWS)
		const started = process.hrtime.bigint()
		gen(100_000, COLUMNS, ROWS)
		const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6
		assert.ok(elapsedMs < 250, `took ${elapsedMs.toFixed(0)}ms for a 100k-frame jump`)
	})
})
