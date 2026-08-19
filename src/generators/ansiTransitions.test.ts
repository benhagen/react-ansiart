import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { AnsiCell, AnsiScreen } from '../ansi/types'
import type { CharacterFrameGenerator } from '../types/types'
import {
	createAnsiGeneratorCycle,
	createAnsiTransition,
	type TransitionKind,
} from './ansiTransitions'

/** Generator whose every cell is the given char (frame-independent, easy to count). */
function solid(ch: string): CharacterFrameGenerator {
	return (frame, columns, rows) => {
		void frame
		const lines: AnsiCell[][] = []
		for (let y = 0; y < rows; y++) {
			const line: AnsiCell[] = []
			for (let x = 0; x < columns; x++) {
				line.push({ ch, fg: 'rgb(200,200,200)', bg: '#000000', bold: false })
			}
			lines.push(line)
		}
		return { lines, columns }
	}
}

function countChar(screen: AnsiScreen, ch: string): number {
	let n = 0
	for (const line of screen.lines) for (const cell of line) if (cell.ch === ch) n++
	return n
}

const COLUMNS = 40
const ROWS = 20
const TOTAL = COLUMNS * ROWS

describe('createAnsiTransition', () => {
	it('returns pure A before the window and pure B after it', () => {
		const gen = createAnsiTransition(solid('A'), solid('B'), {
			startFrame: 10,
			durationFrames: 20,
		})
		assert.equal(countChar(gen(0, COLUMNS, ROWS), 'A'), TOTAL)
		assert.equal(countChar(gen(9, COLUMNS, ROWS), 'A'), TOTAL)
		assert.equal(countChar(gen(30, COLUMNS, ROWS), 'B'), TOTAL)
		assert.equal(countChar(gen(1000, COLUMNS, ROWS), 'B'), TOTAL)
	})

	it('dissolve reveals B monotonically across the window', () => {
		const gen = createAnsiTransition(solid('A'), solid('B'), {
			startFrame: 0,
			durationFrames: 30,
			kind: 'dissolve',
		})
		let previous = 0
		for (let frame = 0; frame < 30; frame++) {
			const b = countChar(gen(frame, COLUMNS, ROWS), 'B')
			const a = countChar(gen(frame, COLUMNS, ROWS), 'A')
			assert.equal(a + b, TOTAL, `frame ${frame}: cells are neither A nor B`)
			assert.ok(b >= previous, `frame ${frame}: dissolve went backwards (${previous} -> ${b})`)
			previous = b
		}
		// Mid-transition really is mixed.
		const mid = countChar(gen(15, COLUMNS, ROWS), 'B')
		assert.ok(mid > TOTAL * 0.2 && mid < TOTAL * 0.8, `mid-dissolve fraction ${mid / TOTAL}`)
	})

	it('is deterministic for the same frame', () => {
		const make = () =>
			createAnsiTransition(solid('A'), solid('B'), { durationFrames: 24, kind: 'dissolve', seed: 7 })
		const x = make()
		const y = make()
		for (const frame of [0, 5, 12, 23]) {
			const a = x(frame, COLUMNS, ROWS).lines.map((l) => l.map((c) => c.ch).join('')).join('\n')
			const b = y(frame, COLUMNS, ROWS).lines.map((l) => l.map((c) => c.ch).join('')).join('\n')
			assert.equal(a, b, `instances diverged at frame ${frame}`)
		}
	})

	it('wipeRight reveals the left side first, wipeDown the top first', () => {
		const right = createAnsiTransition(solid('A'), solid('B'), {
			durationFrames: 40,
			kind: 'wipeRight',
			softness: 0,
		})
		const halfway = right(20, COLUMNS, ROWS)
		assert.equal(halfway.lines[10][0].ch, 'B', 'left edge should be revealed at halfway')
		assert.equal(halfway.lines[10][COLUMNS - 1].ch, 'A', 'right edge should still be outgoing')

		const down = createAnsiTransition(solid('A'), solid('B'), {
			durationFrames: 40,
			kind: 'wipeDown',
			softness: 0,
		})
		const mid = down(20, COLUMNS, ROWS)
		assert.equal(mid.lines[0][5].ch, 'B', 'top row should be revealed at halfway')
		assert.equal(mid.lines[ROWS - 1][5].ch, 'A', 'bottom row should still be outgoing')
	})

	it('every kind completes: full B by the end frame and full A before the start', () => {
		const kinds: TransitionKind[] = ['dissolve', 'wipeRight', 'wipeLeft', 'wipeDown', 'wipeUp', 'blocks']
		for (const kind of kinds) {
			const gen = createAnsiTransition(solid('A'), solid('B'), {
				startFrame: 5,
				durationFrames: 25,
				kind,
			})
			assert.equal(countChar(gen(4, COLUMNS, ROWS), 'A'), TOTAL, `${kind}: pre-window not pure A`)
			assert.equal(countChar(gen(30, COLUMNS, ROWS), 'B'), TOTAL, `${kind}: post-window not pure B`)
			// The very last transitional frame should be nearly all B for wipes.
			const last = countChar(gen(29, COLUMNS, ROWS), 'B')
			assert.ok(last > TOTAL * 0.85, `${kind}: last transitional frame only ${last}/${TOTAL} B`)
		}
	})

	it('blocks kind flips aligned tiles, not individual cells', () => {
		const gen = createAnsiTransition(solid('A'), solid('B'), {
			durationFrames: 30,
			kind: 'blocks',
		})
		const mid = gen(15, COLUMNS, ROWS)
		// Within any 8x4 tile every cell agrees.
		for (let by = 0; by < ROWS; by += 4) {
			for (let bx = 0; bx < COLUMNS; bx += 8) {
				const expected = mid.lines[by][bx].ch
				for (let y = by; y < Math.min(by + 4, ROWS); y++) {
					for (let x = bx; x < Math.min(bx + 8, COLUMNS); x++) {
						assert.equal(mid.lines[y][x].ch, expected, `tile at ${bx},${by} is torn at ${x},${y}`)
					}
				}
			}
		}
	})

	it('does not mutate either source screen and reuses its own rows', () => {
		const retainedA = solid('A')(0, COLUMNS, ROWS)
		const retainedB = solid('B')(0, COLUMNS, ROWS)
		const genA: CharacterFrameGenerator = () => retainedA
		const genB: CharacterFrameGenerator = () => retainedB
		const gen = createAnsiTransition(genA, genB, { durationFrames: 20 })

		const out1 = gen(10, COLUMNS, ROWS)
		const rows1 = out1.lines
		gen(11, COLUMNS, ROWS)

		assert.equal(countChar(retainedA, 'A'), TOTAL, 'source A was mutated')
		assert.equal(countChar(retainedB, 'B'), TOTAL, 'source B was mutated')
		const out2 = gen(12, COLUMNS, ROWS)
		assert.equal(out2.lines, rows1, 'expected the instance to reuse its own lines buffer')
	})
})

describe('createAnsiGeneratorCycle', () => {
	it('holds each generator, then transitions to the next, wrapping around', () => {
		const cycle = createAnsiGeneratorCycle([solid('A'), solid('B'), solid('C')], {
			holdFrames: 50,
			transitionFrames: 10,
			kind: 'dissolve',
		})
		// Hold windows: pure screens.
		assert.equal(countChar(cycle(0, COLUMNS, ROWS), 'A'), TOTAL)
		assert.equal(countChar(cycle(49, COLUMNS, ROWS), 'A'), TOTAL)
		assert.equal(countChar(cycle(60, COLUMNS, ROWS), 'B'), TOTAL)
		assert.equal(countChar(cycle(120, COLUMNS, ROWS), 'C'), TOTAL)
		// Wraps back to the first generator.
		assert.equal(countChar(cycle(180, COLUMNS, ROWS), 'A'), TOTAL)

		// Mid-handoff is a mix of the two adjacent generators only.
		const mid = cycle(55, COLUMNS, ROWS)
		const a = countChar(mid, 'A')
		const b = countChar(mid, 'B')
		assert.equal(a + b, TOTAL)
		assert.ok(a > 0 && b > 0, 'handoff frame should mix both generators')
	})

	it('single-generator and empty lists degrade gracefully', () => {
		const single = createAnsiGeneratorCycle([solid('X')], { holdFrames: 5, transitionFrames: 5 })
		assert.equal(countChar(single(1000, COLUMNS, ROWS), 'X'), TOTAL)

		const empty = createAnsiGeneratorCycle([])
		const screen = empty(3, 10, 4)
		assert.equal(screen.lines.length, 4)
		for (const line of screen.lines) {
			assert.equal(line.length, 10)
			for (const cell of line) assert.equal(cell.ch, ' ')
		}
	})

	it('is deterministic and handoffs differ from each other', () => {
		const make = () =>
			createAnsiGeneratorCycle([solid('A'), solid('B'), solid('C')], {
				holdFrames: 20,
				transitionFrames: 16,
				kind: 'dissolve',
				seed: 99,
			})
		const x = make()
		const y = make()
		const dump = (s: AnsiScreen) => s.lines.map((l) => l.map((c) => c.ch).join('')).join('\n')
		for (const frame of [0, 25, 30, 61, 66]) {
			assert.equal(dump(x(frame, COLUMNS, ROWS)), dump(y(frame, COLUMNS, ROWS)), `frame ${frame}`)
		}

		// Same relative progress in two different handoffs flips a different cell pattern
		// (per-handoff derived seeds).
		const first = x(28, COLUMNS, ROWS) // A -> B handoff, halfway-ish
		const firstPattern = first.lines.map((l) => l.map((c) => (c.ch === 'B' ? 1 : 0)).join('')).join('')
		const second = x(64, COLUMNS, ROWS) // B -> C handoff, same local offset
		const secondPattern = second.lines
			.map((l) => l.map((c) => (c.ch === 'C' ? 1 : 0)).join(''))
			.join('')
		assert.notEqual(firstPattern, secondPattern, 'handoffs share a flip order')
	})

	it('only invokes the generators involved in the current frame', () => {
		const calls = [0, 0, 0]
		const counting = (index: number, ch: string): CharacterFrameGenerator => {
			const inner = solid(ch)
			return (frame, columns, rows) => {
				calls[index]++
				return inner(frame, columns, rows)
			}
		}
		const cycle = createAnsiGeneratorCycle([counting(0, 'A'), counting(1, 'B'), counting(2, 'C')], {
			holdFrames: 10,
			transitionFrames: 5,
		})
		cycle(3, COLUMNS, ROWS) // hold on A
		assert.deepEqual(calls, [1, 0, 0])
		cycle(12, COLUMNS, ROWS) // A -> B handoff
		assert.deepEqual(calls, [2, 1, 0])
	})
})
