import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { AnsiScreen } from '../ansi/types'
import { generateAsciiRotozoomerFrame } from './asciiRotozoomerGenerator'

const COLUMNS = 24
const ROWS = 12

// The visual-defect assertions below are checked at the size the effect is
// actually watched at, where feature scale relative to the cell grid matters.
const WIDE_COLUMNS = 80
const WIDE_ROWS = 25

/** Mean run length of identical glyphs scanning rows, and scanning columns. */
function meanRunLengths(screen: AnsiScreen): { meanH: number; meanV: number } {
	const rows = screen.lines.length
	const cols = screen.columns
	let hRuns = 0
	let vRuns = 0
	for (let y = 0; y < rows; y++) {
		hRuns++
		for (let x = 1; x < cols; x++) if (screen.lines[y][x].ch !== screen.lines[y][x - 1].ch) hRuns++
	}
	for (let x = 0; x < cols; x++) {
		vRuns++
		for (let y = 1; y < rows; y++) if (screen.lines[y][x].ch !== screen.lines[y - 1][x].ch) vRuns++
	}
	return { meanH: (rows * cols) / hRuns, meanV: (rows * cols) / vRuns }
}

/**
 * How axis-aligned the texture lattice is: an unrotated lattice paints whole
 * rows and whole columns of lattice cells, a tilted one paints none of either.
 */
function latticeAlignment(
	screen: AnsiScreen,
	latticeColor: string,
): { fullRows: number; fullCols: number; coverage: number } {
	const rows = screen.lines.length
	const cols = screen.columns
	let fullRows = 0
	let fullCols = 0
	let count = 0

	for (let y = 0; y < rows; y++) {
		let all = true
		for (let x = 0; x < cols; x++) {
			if (screen.lines[y][x].fg === latticeColor) count++
			else all = false
		}
		if (all) fullRows++
	}
	for (let x = 0; x < cols; x++) {
		let all = true
		for (let y = 0; y < rows; y++) {
			if (screen.lines[y][x].fg !== latticeColor) {
				all = false
				break
			}
		}
		if (all) fullCols++
	}

	return { fullRows, fullCols, coverage: count / (rows * cols) }
}

describe('generateAsciiRotozoomerFrame', () => {
	it('returns a full rectangular screen', () => {
		const screen = generateAsciiRotozoomerFrame(5, COLUMNS, ROWS)
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
		const options = { rotationSpeed: 0.05, zoomSpeed: 0.04, pattern: 'xor' as const }
		const a = generateAsciiRotozoomerFrame(17, COLUMNS, ROWS, options)
		const b = generateAsciiRotozoomerFrame(17, COLUMNS, ROWS, options)
		assert.deepEqual(a, b)
	})

	it('produces different output for different frames (rotation/zoom advance)', () => {
		const frame0 = generateAsciiRotozoomerFrame(0, COLUMNS, ROWS)
		const frameN = generateAsciiRotozoomerFrame(40, COLUMNS, ROWS)

		const asText = (screen: typeof frame0) =>
			screen.lines.map((line) => line.map((cell) => cell.ch + cell.fg).join('')).join('\n')

		assert.notEqual(asText(frame0), asText(frameN))
	})

	it('supports both checker and xor patterns without throwing and stays in-bounds', () => {
		for (const pattern of ['checker', 'xor'] as const) {
			const screen = generateAsciiRotozoomerFrame(3, COLUMNS, ROWS, { pattern })
			assert.equal(screen.lines.length, ROWS)
			for (const line of screen.lines) {
				for (const cell of line) {
					assert.equal(typeof cell.fg, 'string')
					assert.equal(typeof cell.ch, 'string')
				}
			}
		}
	})

	it('draws texture features coarse enough to resolve on the character grid', () => {
		// The original defaults sampled 4-texture-unit tiles at zoom ~1, i.e. tiles
		// 4 columns by 2 rows -- at that scale a rotated checkerboard aliases into
		// hash and its tilt is unresolvable, which is what made the effect look
		// like it never rotated. Guard the feature scale directly.
		const screen = generateAsciiRotozoomerFrame(0, WIDE_COLUMNS, WIDE_ROWS)
		const { meanH, meanV } = meanRunLengths(screen)
		assert.ok(meanH >= 7, `mean horizontal run length ${meanH.toFixed(2)} is too fine to read`)
		assert.ok(meanV >= 3, `mean vertical run length ${meanV.toFixed(2)} is too fine to read`)
	})

	it('visibly rotates: the lattice is axis-aligned at frame 0 and tilted within 60 frames', () => {
		// Identify lattice cells by color rather than by glyph so the assertion does
		// not depend on where the lattice char lands in the ramp.
		const options = { fgColors: ['#101010', '#202020', '#303030'] }
		const LATTICE = '#303030'

		const first = generateAsciiRotozoomerFrame(0, WIDE_COLUMNS, WIDE_ROWS, options)
		const firstAlignment = latticeAlignment(first, LATTICE)
		assert.ok(
			firstAlignment.fullRows > 0 && firstAlignment.fullCols > 0,
			'frame 0 should be axis-aligned (whole rows and columns of lattice)',
		)

		// Somewhere inside the first 60 frames the lattice must be tilted far enough
		// that no row and no column is a straight lattice line any more -- while the
		// lattice itself is still on screen (i.e. it tilted, it did not dissolve).
		let tiltedFrame = -1
		for (let frame = 1; frame <= 60; frame++) {
			const screen = generateAsciiRotozoomerFrame(frame, WIDE_COLUMNS, WIDE_ROWS, options)
			const alignment = latticeAlignment(screen, LATTICE)
			if (alignment.fullRows === 0 && alignment.fullCols === 0 && alignment.coverage >= 0.15) {
				tiltedFrame = frame
				break
			}
		}
		assert.notEqual(
			tiltedFrame,
			-1,
			'expected the texture lattice to be visibly tilted within the first 60 frames',
		)
	})

	it('handles the zoom crossing near zero without collapsing to NaN', () => {
		// baseZoom=1, zoomAmplitude=1 drives the raw zoom arbitrarily close to 0
		// across these frames (it need not hit exactly 0); the near-zero guard
		// must keep every cell well-defined whenever it does.
		for (let frame = 0; frame < 60; frame++) {
			const screen = generateAsciiRotozoomerFrame(frame, COLUMNS, ROWS, {
				baseZoom: 1,
				zoomAmplitude: 1,
				zoomSpeed: 0.1,
			})
			for (const line of screen.lines) {
				for (const cell of line) {
					assert.notEqual(cell.ch, undefined)
					assert.notEqual(cell.fg, undefined)
					assert.equal(Number.isNaN(cell.fg as unknown as number) && typeof cell.fg !== 'string', false)
				}
			}
		}
	})
})
