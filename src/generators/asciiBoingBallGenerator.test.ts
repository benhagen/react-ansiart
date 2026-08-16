import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { AnsiScreen } from '../ansi/types'
import {
	generateAsciiBoingBallFrame,
	type AsciiBoingBallOptions,
} from './asciiBoingBallGenerator'

const COLUMNS = 60
const ROWS = 30

const DEFAULT_OPTIONS: AsciiBoingBallOptions = {
	ballRedColor: '#cc2222',
	ballWhiteColor: '#f2f2f2',
}

function screenSignature(screen: AnsiScreen): string {
	return screen.lines
		.map((line) => line.map((cell) => `${cell.ch}${cell.fg}${cell.bg}${cell.bold ? 1 : 0}`).join('|'))
		.join('\n')
}

describe('generateAsciiBoingBallFrame', () => {
	it('returns a full rectangular screen matching the requested dimensions', () => {
		const screen = generateAsciiBoingBallFrame(0, COLUMNS, ROWS, DEFAULT_OPTIONS)
		assert.equal(screen.columns, COLUMNS)
		assert.equal(screen.lines.length, ROWS)
		for (const [index, line] of screen.lines.entries()) {
			assert.equal(line.length, COLUMNS, `row ${index} is ragged`)
			for (const cell of line) {
				assert.equal([...cell.ch].length, 1, `row ${index} has a non-single-character cell`)
			}
		}
	})

	it('is deterministic — same frame/columns/rows/options produce identical output', () => {
		const a = generateAsciiBoingBallFrame(17, COLUMNS, ROWS, DEFAULT_OPTIONS)
		const b = generateAsciiBoingBallFrame(17, COLUMNS, ROWS, DEFAULT_OPTIONS)
		assert.equal(screenSignature(a), screenSignature(b))
	})

	it('is deterministic across many frames (pure function of frame, no hidden state)', () => {
		// Generate frames out of order and re-generate frame 5 -- must match regardless
		// of what other frames were rendered before it (no internal mutable state leaks).
		generateAsciiBoingBallFrame(40, COLUMNS, ROWS, DEFAULT_OPTIONS)
		generateAsciiBoingBallFrame(1, COLUMNS, ROWS, DEFAULT_OPTIONS)
		const first = screenSignature(generateAsciiBoingBallFrame(5, COLUMNS, ROWS, DEFAULT_OPTIONS))
		generateAsciiBoingBallFrame(999, COLUMNS, ROWS, DEFAULT_OPTIONS)
		const second = screenSignature(generateAsciiBoingBallFrame(5, COLUMNS, ROWS, DEFAULT_OPTIONS))
		assert.equal(first, second)
	})

	it('renders visible ball surface cells using the red and white checker colors', () => {
		const opts: AsciiBoingBallOptions = { ballRedColor: 'rgb(255,0,0)', ballWhiteColor: 'rgb(255,255,255)' }
		const screen = generateAsciiBoingBallFrame(0, COLUMNS, ROWS, opts)

		let sawRedish = false
		let sawWhiteish = false
		for (const line of screen.lines) {
			for (const cell of line) {
				if (typeof cell.fg !== 'string') continue
				const match = cell.fg.match(/rgb\((\d+),(\d+),(\d+)\)/)
				if (!match) continue
				const [, r, g, b] = match.map(Number)
				// Red ramp variants: high R, low G, low B.
				if (r > 40 && g < r * 0.5 && b < r * 0.5) sawRedish = true
				// White ramp variants: R, G, B all roughly equal and reasonably bright.
				if (r > 40 && Math.abs(r - g) < 5 && Math.abs(g - b) < 5) sawWhiteish = true
			}
		}
		assert.ok(sawRedish, 'expected at least one red checker cell inside the ball')
		assert.ok(sawWhiteish, 'expected at least one white checker cell inside the ball')
	})

	it('ball moves — the red/white cell centroid differs between frame 0 and frame 20', () => {
		function centroid(frame: number): { x: number; y: number; count: number } {
			const screen = generateAsciiBoingBallFrame(frame, COLUMNS, ROWS, DEFAULT_OPTIONS)
			let sx = 0
			let sy = 0
			let count = 0
			for (let y = 0; y < screen.lines.length; y++) {
				const line = screen.lines[y]
				for (let x = 0; x < line.length; x++) {
					const cell = line[x]
					if (cell.ch === '▒' || cell.ch === '▓' || cell.ch === '█') {
						sx += x
						sy += y
						count++
					}
				}
			}
			return { x: count ? sx / count : 0, y: count ? sy / count : 0, count }
		}

		const c0 = centroid(0)
		const c20 = centroid(20)

		assert.ok(c0.count > 0, 'expected ball cells at frame 0')
		assert.ok(c20.count > 0, 'expected ball cells at frame 20')

		const moved = Math.abs(c0.x - c20.x) > 0.5 || Math.abs(c0.y - c20.y) > 0.5
		assert.ok(moved, `expected centroid to move; frame0=${JSON.stringify(c0)} frame20=${JSON.stringify(c20)}`)
	})

	it('background cells outside the ball are identical across frames with the same options', () => {
		const a = generateAsciiBoingBallFrame(0, COLUMNS, ROWS, DEFAULT_OPTIONS)
		const b = generateAsciiBoingBallFrame(50, COLUMNS, ROWS, DEFAULT_OPTIONS)

		// Row 0 sits on the back wall, well above where the ball ever travels
		// (ball is bounded to the lower ~2/3 of the screen near the horizon),
		// so it must be identical between any two frames given identical options.
		const rowA = a.lines[0]
		const rowB = b.lines[0]
		for (let x = 0; x < COLUMNS; x++) {
			assert.equal(rowA[x].ch, rowB[x].ch, `row 0 col ${x} ch differs`)
			assert.equal(rowA[x].fg, rowB[x].fg, `row 0 col ${x} fg differs`)
			assert.equal(rowA[x].bg, rowB[x].bg, `row 0 col ${x} bg differs`)
		}
	})

	it('shared background/shadow cache cells are not mutated by the ball passing over them (frame 20 vs 45 vs 20 again)', () => {
		// Row 0 alone can't catch a cache-mutation bug, since the ball/shadow never
		// reaches it. This test targets cells the ball or shadow *do* cover in one
		// frame but not in another, to prove the cached background/shadow cell
		// objects are only ever read, never mutated in place.
		const first20 = generateAsciiBoingBallFrame(20, COLUMNS, ROWS, DEFAULT_OPTIONS)
		const mid45 = generateAsciiBoingBallFrame(45, COLUMNS, ROWS, DEFAULT_OPTIONS)
		const second20 = generateAsciiBoingBallFrame(20, COLUMNS, ROWS, DEFAULT_OPTIONS)

		// Sanity check: frame 45 must actually paint ball/shadow over at least one
		// cell that is plain background (' ') at frame 20 -- otherwise this test
		// wouldn't exercise the regression it's guarding against.
		let sawDivergentCell = false
		for (let y = 0; y < ROWS && !sawDivergentCell; y++) {
			const row20 = first20.lines[y]
			const row45 = mid45.lines[y]
			for (let x = 0; x < COLUMNS; x++) {
				if (row20[x].ch === ' ' && row45[x].ch !== ' ') {
					sawDivergentCell = true
					break
				}
			}
		}
		assert.ok(
			sawDivergentCell,
			'expected frame 45 to draw ball/shadow over at least one cell that is background at frame 20'
		)

		// The real assertion: re-rendering frame 20 after frame 45 must reproduce
		// byte-identical output across every cell -- proving the cache is read-only.
		assert.equal(screenSignature(first20), screenSignature(second20))
	})

	it('draws the room as a light gray field with thin grid lines, not a purple slab', () => {
		// The Amiga backdrop is a light gray wall/floor crossed by thin purple
		// lines. The first cut painted every grid cell as a solid block of grid
		// colour and, on a short floor, put a perspective line on literally every
		// floor row -- so the lower third of the screen came out as one purple
		// slab. The grid is now a single-cell-wide glyph stroke over the field
		// colour, so no cell is filled with the grid colour at all.
		const gridColor = '#a239d6'
		const fieldColor = '#c9c9cf'
		const opts: AsciiBoingBallOptions = { gridColor, bgColor: fieldColor }

		for (const frame of [0, 7, 20, 33]) {
			const screen = generateAsciiBoingBallFrame(frame, 80, 25, opts)
			const total = screen.lines.length * screen.columns
			let gridFilled = 0
			let fieldFilled = 0
			let gridStrokes = 0
			for (const line of screen.lines) {
				for (const cell of line) {
					if (cell.bg === gridColor) gridFilled++
					if (cell.bg === fieldColor) fieldFilled++
					if (cell.fg === gridColor && cell.ch !== ' ') gridStrokes++
				}
			}

			assert.ok(
				gridFilled / total < 0.25,
				`frame ${frame}: ${((gridFilled / total) * 100).toFixed(1)}% of cells are filled with the grid colour`,
			)
			assert.ok(
				fieldFilled / total > 0.75,
				`frame ${frame}: the gray field only backs ${((fieldFilled / total) * 100).toFixed(1)}% of the screen`,
			)
			assert.ok(gridStrokes > 0, `frame ${frame}: the grid lines disappeared entirely`)
		}
	})

	it('never puts a floor perspective line on two neighbouring rows', () => {
		// A fixed line count on a short floor rounds several lines onto adjacent
		// rows, which reads as a filled band rather than as receding lines.
		const screen = generateAsciiBoingBallFrame(0, 80, 25, DEFAULT_OPTIONS)
		const fullLineRows: number[] = []
		for (const [index, line] of screen.lines.entries()) {
			if (line.every((cell) => cell.ch === '─' || cell.ch === '┼')) fullLineRows.push(index)
		}
		assert.ok(fullLineRows.length >= 2, 'expected at least a couple of full-width grid lines')
		for (let i = 1; i < fullLineRows.length; i++) {
			assert.ok(
				fullLineRows[i] - fullLineRows[i - 1] >= 2,
				`grid lines on adjacent rows ${fullLineRows[i - 1]} and ${fullLineRows[i]}`,
			)
		}
	})

	it('produces a fully rectangular screen for a range of frames and small dimensions', () => {
		const smallCols = 20
		const smallRows = 12
		for (let frame = 0; frame < 10; frame++) {
			const screen = generateAsciiBoingBallFrame(frame, smallCols, smallRows, DEFAULT_OPTIONS)
			assert.equal(screen.columns, smallCols)
			assert.equal(screen.lines.length, smallRows)
			for (const line of screen.lines) {
				assert.equal(line.length, smallCols)
			}
		}
	})
})
