import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { generateAsciiJuliaFrame } from './asciiJuliaGenerator'

const COLUMNS = 40
const ROWS = 20

// Visibility is a property of the effect at the size it is watched at.
const WIDE_COLUMNS = 80
const WIDE_ROWS = 25

const RGB_RE = /^rgb\(\d{1,3},\d{1,3},\d{1,3}\)$/

/**
 * Fraction of cells that actually show something: a non-blank glyph drawn in a
 * colour that is not effectively black against the background.
 */
function visibleFraction(screen: ReturnType<typeof generateAsciiJuliaFrame>): number {
	let visible = 0
	for (const line of screen.lines) {
		for (const cell of line) {
			if (cell.ch === ' ') continue
			const match = String(cell.fg).match(/rgb\((\d+),(\d+),(\d+)\)/)
			if (!match) continue
			const peak = Math.max(Number(match[1]), Number(match[2]), Number(match[3]))
			if (peak >= 100) visible++
		}
	}
	return visible / (screen.lines.length * screen.columns)
}

describe('generateAsciiJuliaFrame', () => {
	it('returns a full rectangular screen', () => {
		const screen = generateAsciiJuliaFrame(5, COLUMNS, ROWS)
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
		const options = { maxIter: 32, morphSpeed: 0.02, radius: 0.75 }
		const a = generateAsciiJuliaFrame(17, COLUMNS, ROWS, options)
		const b = generateAsciiJuliaFrame(17, COLUMNS, ROWS, options)
		assert.deepEqual(a, b)
	})

	it('morphs over time — frame 0 and frame 40 differ', () => {
		const a = generateAsciiJuliaFrame(0, COLUMNS, ROWS)
		const b = generateAsciiJuliaFrame(40, COLUMNS, ROWS)
		assert.notDeepEqual(a, b)
	})

	it('stays visible all the way around the c-orbit, not just where the set is filled', () => {
		// The c-parameter orbit passes through angles where the Julia set is dust
		// (no filled interior at all). Those frames used to render near-black,
		// because the exterior escape bands were crushed into the dark, blank-glyph
		// end of the ramp. Sample the whole orbit and require real coverage at
		// every angle.
		const SAMPLES = 12
		const MORPH_SPEED = 0.015 // the default; frames are chosen to sweep theta evenly
		for (let sample = 0; sample < SAMPLES; sample++) {
			const theta = (sample / SAMPLES) * 2 * Math.PI
			const frame = Math.round(theta / MORPH_SPEED)
			const screen = generateAsciiJuliaFrame(frame, WIDE_COLUMNS, WIDE_ROWS)
			const visible = visibleFraction(screen)
			assert.ok(
				visible > 0.25,
				`theta ${((theta * 180) / Math.PI).toFixed(0)}deg (frame ${frame}) is only ${(visible * 100).toFixed(1)}% visible`,
			)
		}
	})

	it('renders every escaped cell with a color from the per-frame table (no stray formats)', () => {
		const bgColor = '#000000'
		const screen = generateAsciiJuliaFrame(9, COLUMNS, ROWS, { bgColor })
		for (const [rowIndex, line] of screen.lines.entries()) {
			for (const [colIndex, cell] of line.entries()) {
				const isInterior = cell.ch === ' ' && cell.fg === bgColor
				if (!isInterior) {
					assert.match(
						String(cell.fg),
						RGB_RE,
						`cell (${rowIndex},${colIndex}) has unexpected fg format: ${cell.fg}`,
					)
				}
				assert.equal(cell.bg, bgColor)
			}
		}
	})

	it('is non-escaping at maxIter for the interior cell z=0 with a small c', () => {
		// centerX/centerY = 0 puts the exact grid-center cell at z0 = (0, 0).
		// radius = 0 pins c = (0, 0) for every frame ("small" c — trivially
		// so). Iterating z = z^2 + 0 from z = 0 never leaves the origin, so
		// this cell must run the full maxIter without escaping.
		const maxIter = 50
		const bgColor = '#123456'
		const screen = generateAsciiJuliaFrame(3, COLUMNS, ROWS, {
			centerX: 0,
			centerY: 0,
			radius: 0,
			maxIter,
			bgColor,
		})

		const centerCell = screen.lines[ROWS / 2][COLUMNS / 2]
		assert.equal(centerCell.ch, ' ')
		assert.equal(centerCell.fg, bgColor)
		assert.equal(centerCell.bg, bgColor)
	})
})
