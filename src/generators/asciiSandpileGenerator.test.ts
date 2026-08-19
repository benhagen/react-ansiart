import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	createAsciiSandpileGenerator,
	generateAsciiSandpileFrame,
} from './asciiSandpileGenerator'
import { charToCp437Byte, CP437_TO_UNICODE } from '../utils/cp437'

const COLUMNS = 32
const ROWS = 14

type Screen = ReturnType<typeof generateAsciiSandpileFrame>

// Chars that make grain counts decodable from a rendered screen: chars[level] with
// level = min(count, 4), so counts 0-3 read back as digits and 'X' marks >= 4.
const DECODE_CHARS = [' ', '1', '2', '3', 'X']

function decodeCounts(screen: Screen): number[][] {
	return screen.lines.map((line) =>
		line.map((cell) => {
			if (cell.ch === ' ') return 0
			if (cell.ch === 'X') return 4
			return Number(cell.ch)
		}),
	)
}

function screenSignature(screen: Screen): string {
	return screen.lines
		.map((line) => line.map((cell) => `${cell.ch}${cell.fg}`).join(','))
		.join('|')
}

describe('generateAsciiSandpileFrame', () => {
	it('returns a full rectangular screen', () => {
		const screen = generateAsciiSandpileFrame(5, COLUMNS, ROWS)
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
		const options = { grainsPerStep: 5 }
		const a = generateAsciiSandpileFrame(9, COLUMNS, ROWS, options)
		const b = generateAsciiSandpileFrame(9, COLUMNS, ROWS, options)
		assert.deepEqual(a, b)
	})

	it('two fresh instances replaying the same frame sequence agree exactly', () => {
		const options = { grainsPerStep: 7, maxToppleSweeps: 12 }
		const a = createAsciiSandpileGenerator(options)
		const b = createAsciiSandpileGenerator(options)
		let lastA: Screen | null = null
		let lastB: Screen | null = null
		for (let frame = 0; frame <= 60; frame++) {
			lastA = a(frame, COLUMNS, ROWS) as Screen
			lastB = b(frame, COLUMNS, ROWS) as Screen
		}
		assert.deepEqual(lastA, lastB)
	})

	it('every emitted glyph is CP437-safe at 80x25', () => {
		const gen = createAsciiSandpileGenerator({})
		for (let frame = 0; frame <= 60; frame += 10) {
			const screen = gen(frame, 80, 25) as Screen
			for (const line of screen.lines) {
				for (const cell of line) {
					const byte = charToCp437Byte(cell.ch)
					assert.equal(
						CP437_TO_UNICODE[byte],
						cell.ch,
						`character ${JSON.stringify(cell.ch)} does not round-trip through CP437`,
					)
				}
			}
		}
	})

	it('degenerate options do not throw and still produce a full screen', () => {
		const degenerate = [
			{ grainsPerStep: Number.NaN, stepsPerFrame: Number.POSITIVE_INFINITY },
			{ maxToppleSweeps: -4, dropX: 55, dropY: -2 },
			{ dropX: Number.NaN, dropY: Number.NaN },
			{ palette: [] as string[], chars: [] as string[] },
			{ chars: ['*'] },
			{ grainsPerStep: 1e9 },
		]
		for (const options of degenerate) {
			const gen = createAsciiSandpileGenerator(options)
			for (let frame = 0; frame <= 3; frame++) {
				const screen = gen(frame, COLUMNS, ROWS) as Screen
				assert.equal(screen.lines.length, ROWS)
				for (const line of screen.lines) {
					assert.equal(line.length, COLUMNS)
					for (const cell of line) {
						assert.equal([...cell.ch].length, 1)
					}
				}
			}
		}
		// Tiny grids must also survive.
		const tiny = createAsciiSandpileGenerator({})
		for (let frame = 0; frame <= 3; frame++) {
			const screen = tiny(frame, 1, 1) as Screen
			assert.equal(screen.lines.length, 1)
		}
	})

	it('instance isolation: a rewind on one instance leaves another unaffected', () => {
		const a = createAsciiSandpileGenerator({ grainsPerStep: 8 })
		const b = createAsciiSandpileGenerator({ grainsPerStep: 3 })

		// Interleave calls, including a rewind on `a`, and confirm `a` replays identically.
		for (let frame = 0; frame <= 5; frame++) a(frame, COLUMNS, ROWS)
		const aExpected = screenSignature(a(6, COLUMNS, ROWS) as Screen)

		for (let frame = 0; frame <= 5; frame++) {
			b(frame, COLUMNS, ROWS)
			a(0, COLUMNS, ROWS) // rewind `a`'s own timeline, interleaved with `b`
		}
		for (let frame = 1; frame <= 6; frame++) a(frame, COLUMNS, ROWS)
		const aActual = screenSignature(a(6, COLUMNS, ROWS) as Screen)
		assert.equal(aActual, aExpected)

		// Same-options instances agree; different grain rates differ.
		const c = createAsciiSandpileGenerator({ grainsPerStep: 8 })
		for (let frame = 0; frame <= 6; frame++) c(frame, COLUMNS, ROWS)
		assert.equal(screenSignature(c(6, COLUMNS, ROWS) as Screen), aExpected)
		assert.notEqual(screenSignature(b(5, COLUMNS, ROWS) as Screen), aExpected)
	})

	it('conserves grains while the pile is far from the boundary', () => {
		// 61x61 with 30 substeps of 8 grains: 240 grains total, nowhere near the edge.
		// With an effectively unlimited sweep budget every substep fully stabilizes,
		// so decoded counts must sum to exactly the grains dropped and no cell may
		// render the mid-avalanche level.
		const size = 61
		const steps = 30
		const grainsPerStep = 8
		const gen = createAsciiSandpileGenerator({
			grainsPerStep,
			maxToppleSweeps: 10000,
			chars: DECODE_CHARS,
		})

		let screen: Screen | null = null
		for (let frame = 0; frame < steps; frame++) {
			screen = gen(frame, size, size) as Screen
		}
		const counts = decodeCounts(screen!)

		let total = 0
		let unstable = 0
		for (const row of counts) {
			for (const count of row) {
				total += count
				if (count >= 4) unstable++
			}
		}
		assert.equal(unstable, 0, 'a cell still renders the mid-avalanche level after full stabilization')
		assert.equal(total, steps * grainsPerStep)

		// The pile must not have reached the open boundary (or grains would have vanished).
		for (let i = 0; i < size; i++) {
			assert.equal(counts[0][i], 0)
			assert.equal(counts[size - 1][i], 0)
			assert.equal(counts[i][0], 0)
			assert.equal(counts[i][size - 1], 0)
		}
	})

	it('a centered drop on an odd grid stays left-right and up-down symmetric', () => {
		const size = 41
		const gen = createAsciiSandpileGenerator({
			grainsPerStep: 8,
			maxToppleSweeps: 10000,
			chars: DECODE_CHARS,
		})
		let screen: Screen | null = null
		for (let frame = 0; frame <= 60; frame++) {
			screen = gen(frame, size, size) as Screen
		}
		const counts = decodeCounts(screen!)
		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				assert.equal(counts[y][x], counts[y][size - 1 - x], `not mirror-symmetric at (${x}, ${y})`)
				assert.equal(counts[y][x], counts[size - 1 - y][x], `not flip-symmetric at (${x}, ${y})`)
			}
		}
	})

	it('a large frame jump stays cheap (catch-up is capped)', () => {
		const gen = createAsciiSandpileGenerator({})
		gen(0, 80, 25)
		const started = process.hrtime.bigint()
		gen(100_000, 80, 25)
		const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6
		assert.ok(elapsedMs < 250, `took ${elapsedMs.toFixed(0)}ms for a 100k-frame jump`)
	})
})
