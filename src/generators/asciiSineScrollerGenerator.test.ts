import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { AnsiScreen } from '../ansi/types'
import { charToCp437Byte } from '../utils/cp437'
import {
	generateAsciiSineScrollerFrame,
	getVgaGlyphBytes,
	type AsciiSineScrollerOptions,
} from './asciiSineScrollerGenerator'

const COLUMNS = 100
const ROWS = 25
const FG_CHAR = '█'

/**
 * The IBM VGA 8x16 bitmap for 'A' (CP437 0x41), as decoded from the embedded font.
 * Rendered MSB-first the rows read:
 *   ........  ........  ...#....  ..###...  .##.##..  ##...##.  ##...##.  #######.
 *   ##...##.  ##...##.  ##...##.  ##...##.  ........  ........  ........  ........
 */
const GLYPH_A = [0, 0, 16, 56, 108, 198, 198, 254, 198, 198, 198, 198, 0, 0, 0, 0]

function screenToText(screen: AnsiScreen): string {
	return screen.lines.map((line) => line.map((cell) => cell.ch).join('')).join('\n')
}

function countChar(screen: AnsiScreen, ch: string): number {
	let count = 0
	for (const line of screen.lines) {
		for (const cell of line) {
			if (cell.ch === ch) count++
		}
	}
	return count
}

describe('getVgaGlyphBytes', () => {
	it('decodes 256 glyphs of 16 rows without any canvas dependency', () => {
		const bytes = getVgaGlyphBytes()
		assert.ok(bytes instanceof Uint8Array)
		assert.equal(bytes.length, 4096)
	})

	it('caches the decoded font in a module singleton', () => {
		assert.equal(getVgaGlyphBytes(), getVgaGlyphBytes())
	})

	it("decodes the 'A' glyph bitmap exactly", () => {
		const bytes = getVgaGlyphBytes()
		const code = charToCp437Byte('A')
		assert.equal(code, 0x41)
		assert.deepEqual(Array.from(bytes.subarray(code * 16, code * 16 + 16)), GLYPH_A)
	})

	it('decodes space as a fully blank glyph and the full block as fully lit', () => {
		const bytes = getVgaGlyphBytes()
		const space = charToCp437Byte(' ')
		const block = charToCp437Byte(FG_CHAR)
		assert.equal(block, 0xdb)
		assert.ok(
			Array.from(bytes.subarray(space * 16, space * 16 + 16)).every((b) => b === 0),
			'space glyph should have no lit pixels',
		)
		assert.ok(
			Array.from(bytes.subarray(block * 16, block * 16 + 16)).filter((b) => b === 0xff).length >= 8,
			'full block glyph should be mostly saturated rows',
		)
	})

	it('has a non-empty glyph for every non-space character of the default message', () => {
		const bytes = getVgaGlyphBytes()
		// Same literal as the generator default — every character must round-trip
		// through CP437 and land on a real glyph rather than the space fallback.
		const defaultText = 'REACT-ANSIART ♦ GREETINGS TO THE SCENE ♦ '
		for (const ch of defaultText) {
			if (ch === ' ') continue
			const code = charToCp437Byte(ch)
			assert.notEqual(code, 32, `'${ch}' does not map to a CP437 byte`)
			const lit = Array.from(bytes.subarray(code * 16, code * 16 + 16)).some((b) => b !== 0)
			assert.ok(lit, `'${ch}' (0x${code.toString(16)}) has an empty glyph`)
		}
	})
})

describe('generateAsciiSineScrollerFrame', () => {
	it('produces a grid of the requested size', () => {
		const screen = generateAsciiSineScrollerFrame(0, COLUMNS, ROWS)
		assert.equal(screen.columns, COLUMNS)
		assert.equal(screen.lines.length, ROWS)
		for (const line of screen.lines) {
			assert.equal(line.length, COLUMNS)
		}
	})

	it('is deterministic for identical inputs', () => {
		const a = generateAsciiSineScrollerFrame(17, COLUMNS, ROWS)
		const b = generateAsciiSineScrollerFrame(17, COLUMNS, ROWS)
		assert.deepEqual(a, b)
	})

	it('is deterministic even after an intervening frame of a different size', () => {
		const a = generateAsciiSineScrollerFrame(9, COLUMNS, ROWS)
		generateAsciiSineScrollerFrame(40, 33, 9, { text: 'OTHER', scale: 2 })
		const b = generateAsciiSineScrollerFrame(9, COLUMNS, ROWS)
		assert.deepEqual(a, b)
	})

	it('renders text pixels from the bitmap font', () => {
		const screen = generateAsciiSineScrollerFrame(0, COLUMNS, ROWS, { shadow: false })
		const lit = countChar(screen, FG_CHAR)
		assert.ok(lit > 50, `expected many lit text cells, got ${lit}`)
	})

	it('colors lit cells from the precomputed rainbow table', () => {
		const screen = generateAsciiSineScrollerFrame(0, COLUMNS, ROWS, { shadow: false })
		const litCells = screen.lines.flat().filter((cell) => cell.ch === FG_CHAR)
		assert.ok(litCells.length > 0)
		for (const cell of litCells) {
			assert.match(String(cell.fg), /^rgb\(\d+,\d+,\d+\)$/)
		}
		// The rainbow cycles along the strip, so a wide frame uses several hues.
		assert.ok(new Set(litCells.map((cell) => cell.fg)).size > 1)
	})

	it('scrolls: a later frame differs from frame 0', () => {
		const first = generateAsciiSineScrollerFrame(0, COLUMNS, ROWS)
		const later = generateAsciiSineScrollerFrame(30, COLUMNS, ROWS)
		assert.notEqual(screenToText(first), screenToText(later))
	})

	it('loops the message seamlessly', () => {
		// One full strip revolution: text.length * 8 pixels at speed 1 => identical glyphs.
		const text = 'LOOP '
		const options: AsciiSineScrollerOptions = {
			text,
			speed: 1,
			waveSpeed: 0,
			hueSpeed: 0,
			amplitude: 0,
		}
		const period = text.length * 8
		const a = generateAsciiSineScrollerFrame(0, COLUMNS, ROWS, options)
		const b = generateAsciiSineScrollerFrame(period, COLUMNS, ROWS, options)
		assert.equal(screenToText(a), screenToText(b))
	})

	it('clips the wave to the screen instead of writing out of bounds', () => {
		for (const amplitude of [0, 40, 500]) {
			for (const rows of [1, 4, 25]) {
				const screen = generateAsciiSineScrollerFrame(7, 40, rows, { amplitude })
				assert.equal(screen.lines.length, rows)
				for (const line of screen.lines) {
					assert.equal(line.length, 40)
					for (const cell of line) {
						assert.equal(typeof cell.ch, 'string')
						assert.equal(cell.ch.length, 1)
					}
				}
			}
		}
	})

	it('returns an empty screen for degenerate dimensions', () => {
		const screen = generateAsciiSineScrollerFrame(3, 0, 0)
		assert.deepEqual(screen.lines, [])
		assert.equal(screen.columns, 0)
	})

	it('fills with background cells when the message has no lit pixels', () => {
		const screen = generateAsciiSineScrollerFrame(0, 20, 10, {
			text: '    ',
			bgColor: '#123456',
			backgroundChar: '.',
		})
		for (const line of screen.lines) {
			for (const cell of line) {
				assert.equal(cell.ch, '.')
				assert.equal(cell.fg, '#123456')
				assert.equal(cell.bg, '#123456')
			}
		}
	})

	it('honours a fixed fgColor override', () => {
		const screen = generateAsciiSineScrollerFrame(0, COLUMNS, ROWS, {
			fgColor: '#00ff00',
			shadow: false,
		})
		const litCells = screen.lines.flat().filter((cell) => cell.ch === FG_CHAR)
		assert.ok(litCells.length > 0)
		for (const cell of litCells) {
			assert.equal(cell.fg, '#00ff00')
		}
	})

	it('draws a drop shadow only when enabled', () => {
		const shadowColor = '#111122'
		const withShadow = generateAsciiSineScrollerFrame(0, COLUMNS, ROWS, { shadowColor })
		const withoutShadow = generateAsciiSineScrollerFrame(0, COLUMNS, ROWS, { shadow: false })

		const shadowCells = withShadow.lines.flat().filter((cell) => cell.fg === shadowColor)
		assert.ok(shadowCells.length > 0, 'expected shadow cells')
		assert.equal(withoutShadow.lines.flat().filter((cell) => cell.fg === shadowColor).length, 0)
	})

	it('uses a custom lit character', () => {
		const screen = generateAsciiSineScrollerFrame(0, COLUMNS, ROWS, { char: '#', shadow: false })
		assert.ok(countChar(screen, '#') > 50)
		assert.equal(countChar(screen, FG_CHAR), 0)
	})

	it('scale 2 renders each font pixel two cells wide', () => {
		const options: AsciiSineScrollerOptions = { scale: 2, shadow: false, speed: 0 }
		const screen = generateAsciiSineScrollerFrame(0, COLUMNS, ROWS, options)
		for (const line of screen.lines) {
			for (let x = 0; x + 1 < COLUMNS; x += 2) {
				assert.equal(line[x].ch, line[x + 1].ch, `column pair ${x} should match`)
				assert.equal(line[x].fg, line[x + 1].fg)
			}
		}
		assert.ok(countChar(screen, FG_CHAR) > 50)
	})

	it('ignores non-finite and out-of-range option values', () => {
		const screen = generateAsciiSineScrollerFrame(5, 40, 25, {
			speed: Number.NaN,
			amplitude: -10,
			waveFreq: Number.POSITIVE_INFINITY,
			saturation: 5,
			lightness: -1,
			text: '',
			char: '',
		})
		assert.equal(screen.lines.length, 25)
		// NaN/Infinity fall back to the defaults; amplitude clamps to 0 and
		// saturation/lightness clamp into [0, 1].
		assert.deepEqual(
			screen,
			generateAsciiSineScrollerFrame(5, 40, 25, { amplitude: 0, saturation: 1, lightness: 0 }),
		)
	})
})
