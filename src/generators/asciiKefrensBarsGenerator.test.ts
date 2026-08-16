import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { AnsiScreen } from '../ansi/types'
import { generateAsciiKefrensBarsFrame } from './asciiKefrensBarsGenerator'

// Odd column count keeps centerX an integer, so the off-screen-oscillation test below isn't
// sensitive to floating-point epsilon nudging a barX that sits exactly on a .5 rounding boundary.
const COLUMNS = 41
const ROWS = 20

function screenToChars(screen: AnsiScreen): string[] {
	return screen.lines.map((line) => line.map((cell) => cell.ch).join(''))
}

function screenToCells(screen: AnsiScreen): string {
	return JSON.stringify(
		screen.lines.map((line) => line.map((cell) => [cell.ch, cell.fg, cell.bg, cell.bold])),
	)
}

describe('generateAsciiKefrensBarsFrame', () => {
	it('returns a full rectangular screen', () => {
		const screen = generateAsciiKefrensBarsFrame(3, COLUMNS, ROWS)
		assert.equal(screen.columns, COLUMNS)
		assert.equal(screen.lines.length, ROWS)
		for (const [index, line] of screen.lines.entries()) {
			assert.equal(line.length, COLUMNS, `row ${index} is ragged`)
			for (const cell of line) {
				assert.equal([...cell.ch].length, 1, `row ${index} has a non-single-character cell`)
			}
		}
	})

	it('is deterministic for the same frame/columns/rows/options', () => {
		const options = { barWidth: 5 }
		const a = generateAsciiKefrensBarsFrame(12, COLUMNS, ROWS, options)
		const b = generateAsciiKefrensBarsFrame(12, COLUMNS, ROWS, options)
		assert.equal(screenToCells(a), screenToCells(b))
	})

	it('is deterministic across independent calls with no shared instance', () => {
		for (let frame = 0; frame < 5; frame++) {
			const a = generateAsciiKefrensBarsFrame(frame, COLUMNS, ROWS)
			const b = generateAsciiKefrensBarsFrame(frame, COLUMNS, ROWS)
			assert.equal(screenToCells(a), screenToCells(b), `frame ${frame} mismatch`)
		}
	})

	it('advancing frames changes the output', () => {
		const first = screenToCells(generateAsciiKefrensBarsFrame(0, COLUMNS, ROWS))
		let changed = false
		for (let frame = 1; frame <= 30 && !changed; frame++) {
			const next = screenToCells(generateAsciiKefrensBarsFrame(frame, COLUMNS, ROWS))
			if (next !== first) changed = true
		}
		assert.ok(changed, 'output did not change across 30 frames')
	})

	it("a row's content only depends on rows 0..y, not on the total row count", () => {
		// Because the row buffer is drawn top-to-bottom and snapshotted immediately, row y's
		// content must be identical no matter how many further rows get generated below it.
		const shortRun = generateAsciiKefrensBarsFrame(7, COLUMNS, 5)
		const longRun = generateAsciiKefrensBarsFrame(7, COLUMNS, 25)

		for (let y = 0; y < 5; y++) {
			assert.deepEqual(
				shortRun.lines[y],
				longRun.lines[y],
				`row ${y} differs between a 5-row and a 25-row run`,
			)
		}
	})

	it('a bar painted into the row buffer persists into later rows unless overdrawn', () => {
		// Drive the primary wobble so far off-screen on odd rows that no bar is drawn there at
		// all, while even rows repaint at (numerically) the same center position. If the row
		// buffer really does carry state forward (rather than being cleared per row), every
		// row's character content must come out identical.
		const options = {
			amplitude1: COLUMNS * 2,
			frequency1: Math.PI / 2,
			speed1: 0,
			amplitude2: 0,
		}
		const screen = generateAsciiKefrensBarsFrame(0, COLUMNS, ROWS, options)
		const rowChars = screenToChars(screen)

		// Sanity: the bar actually painted something non-background.
		assert.ok(rowChars[0].trim().length > 0, 'row 0 should contain a painted bar')

		for (let y = 1; y < ROWS; y++) {
			assert.equal(rowChars[y], rowChars[0], `row ${y} lost the bar carried forward from row 0`)
		}
	})

	it('rows differ when the bar is free to move (overdrawing is actually happening)', () => {
		const screen = generateAsciiKefrensBarsFrame(0, COLUMNS, ROWS)
		const rowChars = screenToChars(screen)
		const distinct = new Set(rowChars)
		assert.ok(distinct.size > 1, 'expected the moving bar to produce differing rows')
	})
})
