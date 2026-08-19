import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { CP437_TO_UNICODE, charToCp437Byte } from '../utils/cp437'
import {
	createAsciiShadebobsGenerator,
	generateAsciiShadebobsFrame,
} from './asciiShadebobsGenerator'

const COLUMNS = 24
const ROWS = 12

// Feature scale is judged at the size the effect is watched at.
const WIDE_COLUMNS = 80
const WIDE_ROWS = 25

describe('generateAsciiShadebobsFrame', () => {
	it('returns a full rectangular screen', () => {
		const screen = generateAsciiShadebobsFrame(5, COLUMNS, ROWS)
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
		const options = { bobCount: 3, seed: 42, trailDecay: 0.9 }
		const a = generateAsciiShadebobsFrame(9, COLUMNS, ROWS, options)
		const b = generateAsciiShadebobsFrame(9, COLUMNS, ROWS, options)
		assert.deepEqual(a, b)
	})

	it('emits only CP437-safe glyphs over several frames at 80x25', () => {
		const gen = createAsciiShadebobsGenerator({})
		for (const frame of [0, 3, 10, 25, 60, 120]) {
			const screen = gen(frame, WIDE_COLUMNS, WIDE_ROWS)
			for (const line of screen.lines) {
				for (const cell of line) {
					const byte = charToCp437Byte(cell.ch)
					assert.equal(
						CP437_TO_UNICODE[byte],
						cell.ch,
						`glyph ${JSON.stringify(cell.ch)} does not round-trip through CP437 at frame ${frame}`,
					)
				}
			}
		}
	})

	it('does not throw or emit broken cells on degenerate options', () => {
		const degenerate = [
			{ bobCount: NaN, bobSize: Infinity, trailDecay: -3, speed: NaN, seed: Infinity },
			{ bobCount: -5, bobSize: 0, trailDecay: NaN, speed: -1 },
			{ bobCount: Infinity, bobSize: NaN, trailDecay: 99, speed: Infinity },
			{ chars: [], palette: [] },
		]
		for (const options of degenerate) {
			const gen = createAsciiShadebobsGenerator(options)
			for (let frame = 0; frame <= 3; frame++) {
				const screen = gen(frame, COLUMNS, ROWS)
				assert.equal(screen.lines.length, ROWS)
				for (const line of screen.lines) {
					for (const cell of line) {
						assert.equal(typeof cell.ch, 'string')
						assert.ok(cell.ch.length >= 1, 'a degenerate option produced an empty cell char')
						assert.ok(typeof cell.fg === 'string' && !cell.fg.includes('NaN'), `NaN leaked into color ${cell.fg}`)
					}
				}
			}
		}
	})

	it('instance isolation: two instances advance independently', () => {
		const a = createAsciiShadebobsGenerator({ seed: 1 })
		const b = createAsciiShadebobsGenerator({ seed: 2 })

		const asText = (screen: ReturnType<typeof generateAsciiShadebobsFrame>) =>
			screen.lines.map((line) => line.map((cell) => `${cell.ch}${cell.fg}`).join(',')).join('|')

		// Interleave calls, including a rewind on `a`, and confirm `a` still lands
		// on the state it would have reached alone.
		for (let frame = 0; frame <= 5; frame++) a(frame, COLUMNS, ROWS)
		const aExpected = asText(a(6, COLUMNS, ROWS))

		for (let frame = 0; frame <= 5; frame++) {
			b(frame, COLUMNS, ROWS)
			a(0, COLUMNS, ROWS) // rewind `a`'s own timeline, interleaved with `b`
		}
		for (let frame = 1; frame <= 6; frame++) a(frame, COLUMNS, ROWS)
		const aActual = asText(a(6, COLUMNS, ROWS))
		assert.equal(aActual, aExpected)

		// Two fresh same-seed instances stepping frame-by-frame agree.
		const c = createAsciiShadebobsGenerator({ seed: 9 })
		const d = createAsciiShadebobsGenerator({ seed: 9 })
		for (let frame = 0; frame <= 4; frame++) {
			c(frame, COLUMNS, ROWS)
			d(frame, COLUMNS, ROWS)
		}
		assert.equal(asText(c(5, COLUMNS, ROWS)), asText(d(5, COLUMNS, ROWS)))

		// Different seeds produce different output.
		assert.notEqual(asText(c(5, COLUMNS, ROWS)), asText(b(5, COLUMNS, ROWS)))
	})

	it('a large frame jump stays cheap (catch-up is capped)', () => {
		const gen = createAsciiShadebobsGenerator({ seed: 7 })
		gen(0, COLUMNS, ROWS)
		const started = process.hrtime.bigint()
		gen(100_000, COLUMNS, ROWS)
		const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6
		assert.ok(elapsedMs < 250, `took ${elapsedMs.toFixed(0)}ms for a 100k-frame jump`)
	})

	it('trails decay: coverage stays bounded and recedes instead of filling the screen', () => {
		const gen = createAsciiShadebobsGenerator({})
		const total = WIDE_COLUMNS * WIDE_ROWS

		const nonSpaceCount = (frame: number): number => {
			const screen = gen(frame, WIDE_COLUMNS, WIDE_ROWS)
			let count = 0
			for (const line of screen.lines) {
				for (const cell of line) if (cell.ch !== ' ') count++
			}
			return count
		}

		const counts: number[] = []
		for (let frame = 0; frame <= 400; frame++) counts.push(nonSpaceCount(frame))

		// Bounded: without decay the additive deposits would light every cell for good.
		const max = Math.max(...counts)
		assert.ok(max < total * 0.95, `coverage peaked at ${max}/${total} — trails are not decaying`)

		// Receding: once the effect is warmed up, lit cells must return to background
		// after the bobs move away, so coverage falls between some consecutive frames
		// rather than growing monotonically.
		let decreases = 0
		for (let i = 51; i < counts.length; i++) {
			if (counts[i] < counts[i - 1]) decreases++
		}
		assert.ok(decreases > 0, 'non-space count grew monotonically — lit cells never fade back')
	})

	it('crossings glow brighter than a single trail (additive accumulation)', () => {
		// With two bobs the peak rendered level can only exceed a single bob's clamped
		// peak where deposits overlap. Indirect but frame-exact check: somewhere on a
		// warmed-up 80x25 screen the top-of-ramp char must appear (energy >= 1), which
		// a single decayed trail sample alone would rarely hold everywhere it appears.
		const gen = createAsciiShadebobsGenerator({})
		let sawTopChar = false
		for (let frame = 0; frame <= 120 && !sawTopChar; frame++) {
			const screen = gen(frame, WIDE_COLUMNS, WIDE_ROWS)
			for (const line of screen.lines) {
				for (const cell of line) {
					if (cell.ch === '█') sawTopChar = true
				}
			}
		}
		assert.ok(sawTopChar, 'energy never accumulated to the top of the ramp in 120 frames')
	})
})
