import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { CP437_TO_UNICODE, charToCp437Byte } from '../utils/cp437'
import { generateAsciiMunchingSquaresFrame } from './asciiMunchingSquaresGenerator'

const COLUMNS = 24
const ROWS = 12

const WIDE_COLUMNS = 80
const WIDE_ROWS = 25

describe('generateAsciiMunchingSquaresFrame', () => {
	it('returns a full rectangular screen', () => {
		const screen = generateAsciiMunchingSquaresFrame(5, COLUMNS, ROWS)
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
		const options = { speed: 2, size: 16, invert: true }
		const a = generateAsciiMunchingSquaresFrame(23, COLUMNS, ROWS, options)
		const b = generateAsciiMunchingSquaresFrame(23, COLUMNS, ROWS, options)
		assert.deepEqual(a, b)
	})

	it('emits only CP437-safe glyphs over several frames at 80x25', () => {
		for (const frame of [0, 15, 40, 90, 200]) {
			const screen = generateAsciiMunchingSquaresFrame(frame, WIDE_COLUMNS, WIDE_ROWS)
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
			{ speed: NaN, size: Infinity },
			{ speed: -4, size: -16 },
			{ speed: Infinity, size: NaN },
			{ size: 13 }, // non-power-of-two must be rounded, not trusted
			{ chars: [], palette: [] },
		]
		for (const options of degenerate) {
			for (const frame of [0, 7]) {
				const screen = generateAsciiMunchingSquaresFrame(frame, COLUMNS, ROWS, options)
				assert.equal(screen.lines.length, ROWS)
				for (const line of screen.lines) {
					for (const cell of line) {
						assert.equal(typeof cell.ch, 'string')
						assert.ok(cell.ch.length >= 1, 'a degenerate option produced an empty cell char')
						assert.equal(typeof cell.fg, 'string')
					}
				}
			}
		}
	})

	it('cells match the HAKMEM formula v = ((x\' ^ y\') + t) mod size', () => {
		// 16 distinct chars with size 16 make chars[v] an identity mapping, so every
		// cell's ch directly reveals its v value.
		const size = 16
		const chars = [...'0123456789ABCDEF']
		const frame = 7
		const speed = 1
		const screen = generateAsciiMunchingSquaresFrame(frame, WIDE_COLUMNS, WIDE_ROWS, { size, chars, speed })

		const t = Math.floor(frame * speed) % size
		const spots: Array<[number, number]> = [[0, 0], [5, 3], [13, 9], [31, 17], [62, 20], [79, 24]]
		for (const [x, y] of spots) {
			// x' halves x to compensate the 2:1 cell aspect; both coords wrap into the
			// power-of-two domain.
			const sx = (x >> 1) % size
			const sy = y % size
			const v = ((sx ^ sy) + t) % size
			assert.equal(
				screen.lines[y][x].ch,
				chars[v],
				`cell (${x},${y}) does not match ((${sx}^${sy})+${t})%${size} = ${v}`,
			)
		}
	})

	it('is symmetric under swapping scaled coordinates (XOR commutes)', () => {
		const screen = generateAsciiMunchingSquaresFrame(11, WIDE_COLUMNS, WIDE_ROWS)
		// Cell (2a, b) has scaled coords (a, b); cell (2b, a) has (b, a). XOR is
		// commutative, so the two cells must render identically.
		for (let a = 0; a < 16; a++) {
			for (let b = 0; b < 16; b++) {
				const cellAB = screen.lines[b][2 * a]
				const cellBA = screen.lines[a][2 * b]
				assert.equal(cellAB.ch, cellBA.ch, `ch asymmetry at scaled (${a},${b})`)
				assert.equal(cellAB.fg, cellBA.fg, `fg asymmetry at scaled (${a},${b})`)
				assert.equal(cellAB.bold, cellBA.bold, `bold asymmetry at scaled (${a},${b})`)
			}
		}
	})

	it('cycles with period size/speed frames', () => {
		const a = generateAsciiMunchingSquaresFrame(8, WIDE_COLUMNS, WIDE_ROWS)
		const b = generateAsciiMunchingSquaresFrame(8 + 32, WIDE_COLUMNS, WIDE_ROWS)
		assert.deepEqual(a, b)

		// ...and actually animates within the period.
		const c = generateAsciiMunchingSquaresFrame(9, WIDE_COLUMNS, WIDE_ROWS)
		assert.notDeepEqual(a, c)
	})
})
