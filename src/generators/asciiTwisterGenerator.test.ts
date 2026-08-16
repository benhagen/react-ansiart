import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { AnsiScreen } from '../ansi/types'
import { generateAsciiTwisterFrame } from './asciiTwisterGenerator'

const COLUMNS = 40
const ROWS = 20
const BG_CHAR = ' '

function screenToCells(screen: AnsiScreen): string {
	return JSON.stringify(
		screen.lines.map((line) => line.map((cell) => [cell.ch, cell.fg, cell.bg, cell.bold])),
	)
}

// Indices of non-background cells in a row, in ascending order.
function paintedIndices(line: AnsiScreen['lines'][number]): number[] {
	const indices: number[] = []
	for (let x = 0; x < line.length; x++) {
		if (line[x].ch !== BG_CHAR) indices.push(x)
	}
	return indices
}

describe('generateAsciiTwisterFrame', () => {
	it('returns a full rectangular screen', () => {
		const screen = generateAsciiTwisterFrame(3, COLUMNS, ROWS)
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
		const options = { width: 10, rotationSpeed: 0.07 }
		const a = generateAsciiTwisterFrame(12, COLUMNS, ROWS, options)
		const b = generateAsciiTwisterFrame(12, COLUMNS, ROWS, options)
		assert.equal(screenToCells(a), screenToCells(b))
	})

	it('is deterministic across independent calls with no shared instance', () => {
		for (let frame = 0; frame < 5; frame++) {
			const a = generateAsciiTwisterFrame(frame, COLUMNS, ROWS)
			const b = generateAsciiTwisterFrame(frame, COLUMNS, ROWS)
			assert.equal(screenToCells(a), screenToCells(b), `frame ${frame} mismatch`)
		}
	})

	it('advancing frames changes the output', () => {
		const first = screenToCells(generateAsciiTwisterFrame(0, COLUMNS, ROWS))
		let changed = false
		for (let frame = 1; frame <= 30 && !changed; frame++) {
			const next = screenToCells(generateAsciiTwisterFrame(frame, COLUMNS, ROWS))
			if (next !== first) changed = true
		}
		assert.ok(changed, 'output did not change across 30 frames')
	})

	it('the ribbon occupies one contiguous horizontal span per row', () => {
		const screen = generateAsciiTwisterFrame(11, COLUMNS, ROWS)
		for (const [y, line] of screen.lines.entries()) {
			const indices = paintedIndices(line)
			assert.ok(indices.length > 0, `row ${y} has no visible ribbon`)
			const span = indices[indices.length - 1] - indices[0] + 1
			assert.equal(indices.length, span, `row ${y} ribbon is not contiguous: ${indices.join(',')}`)
		}
	})

	it('the ribbon span position changes across rows', () => {
		const screen = generateAsciiTwisterFrame(11, COLUMNS, ROWS)
		const leftEdges = screen.lines.map((line) => paintedIndices(line)[0])
		const distinct = new Set(leftEdges)
		assert.ok(distinct.size > 1, 'expected the twist wave to move the ribbon across rows')
	})

	it('the ribbon span position changes across frames at a fixed row', () => {
		const row = 5
		const leftEdgesOverTime = new Set<number>()
		for (let frame = 0; frame < 40; frame++) {
			const screen = generateAsciiTwisterFrame(frame, COLUMNS, ROWS)
			leftEdgesOverTime.add(paintedIndices(screen.lines[row])[0])
		}
		assert.ok(leftEdgesOverTime.size > 1, 'expected rotation to move the ribbon over time')
	})
})
