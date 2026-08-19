import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { AnsiScreen } from '../ansi/types'
import { charToCp437Byte } from '../utils/cp437'
import { generateAsciiDonutFrame, createAsciiDonutSampler } from './asciiDonutGenerator'

const COLUMNS = 24
const ROWS = 12

// The torus proportions are a property of the effect at the size it is
// watched at.
const WIDE_COLUMNS = 80
const WIDE_ROWS = 25

function nonSpaceFraction(screen: AnsiScreen): number {
	let on = 0
	let total = 0
	for (const line of screen.lines) {
		for (const cell of line) {
			total++
			if (cell.ch !== ' ') on++
		}
	}
	return on / total
}

describe('generateAsciiDonutFrame', () => {
	it('returns a full rectangular screen', () => {
		const screen = generateAsciiDonutFrame(5, COLUMNS, ROWS)
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
		const options = { speedA: 0.05, speedB: 0.02, size: 0.8, baseColor: '#33ccff' }
		const a = generateAsciiDonutFrame(23, WIDE_COLUMNS, WIDE_ROWS, options)
		const b = generateAsciiDonutFrame(23, WIDE_COLUMNS, WIDE_ROWS, options)
		assert.deepEqual(a, b)
	})

	it('emits only CP437-encodable characters over several frames at 80x25', () => {
		const seen = new Set<string>()
		for (const frame of [0, 7, 20, 33, 46, 120]) {
			const screen = generateAsciiDonutFrame(frame, WIDE_COLUMNS, WIDE_ROWS)
			for (const line of screen.lines) for (const cell of line) seen.add(cell.ch)
		}
		for (const ch of seen) {
			assert.notEqual(charToCp437Byte(ch), null, `unmapped glyph ${JSON.stringify(ch)}`)
		}
	})

	it('does not throw on degenerate options and still returns a full screen', () => {
		const degenerate = [
			{ size: NaN, speedA: Infinity, speedB: -Infinity, tubeRatio: NaN },
			{ size: -3, tubeRatio: -1, phaseA: NaN, phaseB: Infinity },
			{ size: Infinity, tubeRatio: Infinity, chars: [] },
		]
		for (const options of degenerate) {
			const screen = generateAsciiDonutFrame(9, COLUMNS, ROWS, options)
			assert.equal(screen.lines.length, ROWS)
			for (const line of screen.lines) {
				assert.equal(line.length, COLUMNS)
				for (const cell of line) {
					assert.equal([...cell.ch].length, 1)
				}
			}
		}
	})

	it('draws a substantial torus that rotates between frames at 80x25', () => {
		const a = generateAsciiDonutFrame(0, WIDE_COLUMNS, WIDE_ROWS)
		const b = generateAsciiDonutFrame(40, WIDE_COLUMNS, WIDE_ROWS)
		assert.notDeepEqual(
			a.lines.map(l => l.map(c => c.ch).join('')),
			b.lines.map(l => l.map(c => c.ch).join('')),
			'frame 0 and frame 40 should differ (the donut rotates)',
		)
		for (const [frame, screen] of [[0, a], [40, b]] as const) {
			const fraction = nonSpaceFraction(screen)
			assert.ok(
				fraction > 0.08 && fraction < 0.7,
				`frame ${frame}: non-space fraction ${fraction.toFixed(3)} is not a screen-filling torus`,
			)
		}
	})

	it('uses a wide span of the luminance ramp', () => {
		const screen = generateAsciiDonutFrame(60, WIDE_COLUMNS, WIDE_ROWS)
		const glyphs = new Set<string>()
		for (const line of screen.lines) {
			for (const cell of line) if (cell.ch !== ' ') glyphs.add(cell.ch)
		}
		assert.ok(glyphs.size >= 6, `expected >= 6 distinct shading glyphs, saw ${glyphs.size}`)
	})
})

describe('createAsciiDonutSampler', () => {
	it('returns cells for any coordinate, wrapping the backing grid', () => {
		const sample = createAsciiDonutSampler(12)
		for (const [x, y] of [[0, 0], [40, 30], [-5, -7], [200, 500]]) {
			const cell = sample(x, y)
			assert.equal([...cell.ch].length, 1)
			assert.equal(typeof cell.bold, 'boolean')
		}
		assert.deepEqual(sample(3, 4), sample(83, 64), 'sampler should wrap at the backing grid')
	})
})
