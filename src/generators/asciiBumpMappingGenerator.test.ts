import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { generateAsciiBumpMappingFrame } from './asciiBumpMappingGenerator'

const COLUMNS = 32
const ROWS = 16

describe('generateAsciiBumpMappingFrame', () => {
	it('returns a full rectangular screen', () => {
		const screen = generateAsciiBumpMappingFrame(5, COLUMNS, ROWS)
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
		const options = { seed: 42, noiseScale: 0.2, orbitSpeed: 0.03 }
		const a = generateAsciiBumpMappingFrame(11, COLUMNS, ROWS, options)
		const b = generateAsciiBumpMappingFrame(11, COLUMNS, ROWS, options)
		assert.deepEqual(a, b)
	})

	it('keeps the heightfield static: with orbitSpeed 0 two different frames are identical', () => {
		// orbitSpeed 0 pins theta = frame * 0 = 0 for every frame, so the
		// light position (and therefore all per-cell lighting) never
		// changes. The only thing that could differ between frames is the
		// (cached, static) heightfield itself, which does not depend on
		// `frame` either — so output must be byte-for-byte identical.
		const options = { orbitSpeed: 0, seed: 777 }
		const a = generateAsciiBumpMappingFrame(0, COLUMNS, ROWS, options)
		const b = generateAsciiBumpMappingFrame(90, COLUMNS, ROWS, options)
		assert.deepEqual(a, b)
	})

	it('moves the light: with nonzero orbitSpeed, frames differ', () => {
		const options = { orbitSpeed: 0.1, seed: 777 }
		const a = generateAsciiBumpMappingFrame(0, COLUMNS, ROWS, options)
		const b = generateAsciiBumpMappingFrame(30, COLUMNS, ROWS, options)
		assert.notDeepEqual(a, b)
	})

	it('produces only fg colors from the palette table (no stray rgb formats), constant bg', () => {
		const bgColor = '#010203'
		const RGB_RE = /^rgb\(\d{1,3},\d{1,3},\d{1,3}\)$/
		const screen = generateAsciiBumpMappingFrame(4, COLUMNS, ROWS, { bgColor })
		for (const [rowIndex, line] of screen.lines.entries()) {
			for (const [colIndex, cell] of line.entries()) {
				assert.match(
					String(cell.fg),
					RGB_RE,
					`cell (${rowIndex},${colIndex}) has unexpected fg format: ${cell.fg}`,
				)
				assert.equal(cell.bg, bgColor)
			}
		}
	})
})
