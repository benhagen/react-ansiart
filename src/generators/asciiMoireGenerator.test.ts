import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { AnsiScreen } from '../ansi/types'
import { generateAsciiMoireFrame } from './asciiMoireGenerator'

const COLUMNS = 24
const ROWS = 12

// Band structure is a property of the effect at the size it is watched at.
const WIDE_COLUMNS = 80
const WIDE_ROWS = 25

/** Mean horizontal run length of the on/off interference pattern, and its on-fraction. */
function bandStats(screen: AnsiScreen): { meanRun: number; onFraction: number } {
	const rows = screen.lines.length
	const cols = screen.columns
	let runs = 0
	let on = 0
	for (let y = 0; y < rows; y++) {
		runs++
		for (let x = 0; x < cols; x++) {
			const isOn = screen.lines[y][x].ch !== ' '
			if (isOn) on++
			if (x > 0 && isOn !== (screen.lines[y][x - 1].ch !== ' ')) runs++
		}
	}
	return { meanRun: (rows * cols) / runs, onFraction: on / (rows * cols) }
}

describe('generateAsciiMoireFrame', () => {
	it('returns a full rectangular screen', () => {
		const screen = generateAsciiMoireFrame(5, COLUMNS, ROWS)
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
		const options = { ringWidth: 2, speed1: 0.02, speed2: 0.03 }
		const a = generateAsciiMoireFrame(23, COLUMNS, ROWS, options)
		const b = generateAsciiMoireFrame(23, COLUMNS, ROWS, options)
		assert.deepEqual(a, b)
	})

	it('produces no interference (all cells off) when both centers coincide at mid', () => {
		// orbitRadius 0 on both fields pins center1 === center2 === grid mid for
		// every frame, so dist1 === dist2 everywhere, ring1 === ring2, and the
		// XOR of matching parities is always 0 -- no cell should ever be "on".
		const screen = generateAsciiMoireFrame(11, COLUMNS, ROWS, {
			orbitRadius1: 0,
			orbitRadius2: 0,
		})
		const bg = '#000000'
		for (const line of screen.lines) {
			for (const cell of line) {
				assert.equal(cell.ch, ' ')
				assert.equal(cell.fg, bg)
				assert.equal(cell.bg, bg)
			}
		}
	})

	it('forms connected bands rather than salt-and-pepper noise at 80x25', () => {
		// The original ringWidth of 1.5 put an interference band inside a single
		// character cell, so the "rings" degenerated into per-cell noise (mean
		// horizontal run length of the on/off pattern was ~2). Readable curved
		// bands need runs several cells long.
		for (const frame of [0, 37, 91, 158, 264, 399]) {
			const screen = generateAsciiMoireFrame(frame, WIDE_COLUMNS, WIDE_ROWS)
			const { meanRun, onFraction } = bandStats(screen)
			assert.ok(
				meanRun >= 3,
				`frame ${frame}: mean on/off run length ${meanRun.toFixed(2)} reads as noise, not bands`,
			)
			// Both phases must be present — a screen that is all-on or all-blank has
			// no interference structure left to look at.
			assert.ok(
				onFraction > 0.15 && onFraction < 0.85,
				`frame ${frame}: on-cell fraction ${onFraction.toFixed(2)} has collapsed to a single phase`,
			)
		}
	})

	it('produces on and off cells in the expected proportion once centers separate', () => {
		const screen = generateAsciiMoireFrame(11, COLUMNS, ROWS, {
			orbitRadius1: 0.4,
			orbitRadius2: 0.4,
			ringWidth: 1.5,
		})
		let onCount = 0
		let offCount = 0
		for (const line of screen.lines) {
			for (const cell of line) {
				if (cell.ch === ' ') offCount++
				else onCount++
			}
		}
		assert.ok(onCount > 0, 'expected at least some interference cells to be on')
		assert.ok(offCount > 0, 'expected at least some cells to remain off')
	})
})
