import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { AnsiScreen } from '../ansi/types'
import { generateAsciiAquariumFrame } from './asciiAquariumGenerator'
import { charToCp437Byte } from '../utils/cp437'

const COLUMNS = 24
const ROWS = 12

// The scene is tuned for the default watching size.
const WIDE_COLUMNS = 80
const WIDE_ROWS = 25

// Every fish sprite the generator can draw (right- and left-facing)
const FISH_SPRITES = ['><(((·>', '<·)))><', '><=·>', '<·=><', '><>', '<><']

function rowStrings(screen: AnsiScreen): string[] {
	return screen.lines.map(line => line.map(cell => cell.ch).join(''))
}

function countSpriteMatches(screen: AnsiScreen): number {
	let matches = 0
	for (const row of rowStrings(screen)) {
		// Longest sprites first so '><>' does not double-count inside '><(((·>'
		let remaining = row
		for (const sprite of FISH_SPRITES) {
			let index = remaining.indexOf(sprite)
			while (index !== -1) {
				matches++
				remaining = remaining.slice(0, index) + ' '.repeat(sprite.length) + remaining.slice(index + sprite.length)
				index = remaining.indexOf(sprite)
			}
		}
	}
	return matches
}

describe('generateAsciiAquariumFrame', () => {
	it('returns a full rectangular screen', () => {
		const screen = generateAsciiAquariumFrame(5, COLUMNS, ROWS)
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
		const options = { seed: 7, fishCount: 5, bubbleDensity: 0.3 }
		const a = generateAsciiAquariumFrame(64, WIDE_COLUMNS, WIDE_ROWS, options)
		const b = generateAsciiAquariumFrame(64, WIDE_COLUMNS, WIDE_ROWS, options)
		assert.deepEqual(a, b)
	})

	it('is stateless: out-of-order frames reproduce identical output', () => {
		// The point of the closed-form design — seeking backward must not change
		// what any frame looks like.
		const first = generateAsciiAquariumFrame(100, WIDE_COLUMNS, WIDE_ROWS)
		generateAsciiAquariumFrame(10, WIDE_COLUMNS, WIDE_ROWS)
		const again = generateAsciiAquariumFrame(100, WIDE_COLUMNS, WIDE_ROWS)
		assert.deepEqual(first, again)
	})

	it('emits only CP437-encodable characters', () => {
		const seen = new Set<string>()
		for (const frame of [0, 30, 77, 150, 400]) {
			const screen = generateAsciiAquariumFrame(frame, WIDE_COLUMNS, WIDE_ROWS)
			for (const line of screen.lines) for (const cell of line) seen.add(cell.ch)
		}
		for (const ch of seen) {
			assert.notEqual(charToCp437Byte(ch), null, `unmapped glyph ${JSON.stringify(ch)}`)
		}
	})

	it('tolerates degenerate options without throwing', () => {
		const degenerate = [
			{ seed: Number.NaN, fishCount: -3, bubbleDensity: 5 },
			{ seaweedDensity: -1, speed: Number.NaN, swaySpeed: Number.POSITIVE_INFINITY },
			{ palette: [], bgColor: '#123456' },
			{ fishCount: Number.POSITIVE_INFINITY },
		]
		for (const options of degenerate) {
			const screen = generateAsciiAquariumFrame(42, COLUMNS, ROWS, options)
			assert.equal(screen.lines.length, ROWS)
			for (const line of screen.lines) {
				assert.equal(line.length, COLUMNS)
				for (const cell of line) {
					assert.equal([...cell.ch].length, 1)
				}
			}
		}
	})

	it('renders tiny grids without throwing', () => {
		for (const [cols, rows] of [[1, 1], [3, 2], [8, 3]] as const) {
			const screen = generateAsciiAquariumFrame(10, cols, rows)
			assert.equal(screen.lines.length, rows)
			for (const line of screen.lines) assert.equal(line.length, cols)
		}
	})

	it('fills the bottom row with sea-floor glyphs', () => {
		const screen = generateAsciiAquariumFrame(33, WIDE_COLUMNS, WIDE_ROWS)
		for (const cell of screen.lines[WIDE_ROWS - 1]) {
			assert.ok(cell.ch === '▒' || cell.ch === '░', `floor cell was ${JSON.stringify(cell.ch)}`)
		}
	})

	it('draws recognizable fish sprites and moves them over time', () => {
		const at0 = generateAsciiAquariumFrame(0, WIDE_COLUMNS, WIDE_ROWS)
		assert.ok(
			countSpriteMatches(at0) >= 5,
			`expected >= 5 full fish sprites at frame 0, saw ${countSpriteMatches(at0)}`,
		)
		// Fish swim: the char grid must differ between two frames 40 apart
		const at40 = generateAsciiAquariumFrame(40, WIDE_COLUMNS, WIDE_ROWS)
		assert.notDeepEqual(rowStrings(at0), rowStrings(at40))
	})

	it('draws no fish when fishCount is 0', () => {
		// '<' and '>' only ever come from fish sprites
		const screen = generateAsciiAquariumFrame(25, WIDE_COLUMNS, WIDE_ROWS, { fishCount: 0 })
		for (const row of rowStrings(screen)) {
			assert.ok(!row.includes('<') && !row.includes('>'), `unexpected fish glyph in ${JSON.stringify(row)}`)
		}
	})

	it('sways the seaweed: a stalk cell flips between ( and )', () => {
		const a = rowStrings(generateAsciiAquariumFrame(0, WIDE_COLUMNS, WIDE_ROWS, { fishCount: 0 }))
		const b = rowStrings(generateAsciiAquariumFrame(40, WIDE_COLUMNS, WIDE_ROWS, { fishCount: 0 }))
		let flipped = false
		for (let y = 0; y < WIDE_ROWS && !flipped; y++) {
			for (let x = 0; x < WIDE_COLUMNS; x++) {
				const ca = a[y][x]
				const cb = b[y][x]
				if ((ca === '(' && cb === ')') || (ca === ')' && cb === '(')) {
					flipped = true
					break
				}
			}
		}
		assert.ok(flipped, 'expected at least one seaweed cell to sway between ( and )')
	})

	it('bubbles rise toward the surface', () => {
		// 'o'/'O' only ever come from bubbles. Find a bubble at frame f and the
		// same bubble ~2-3 rows higher (wobble allows ±2 columns) 8 frames later.
		const options = { fishCount: 0, bubbleDensity: 0.4 }
		let rose = false
		for (let frame = 0; frame < 200 && !rose; frame++) {
			const now = generateAsciiAquariumFrame(frame, WIDE_COLUMNS, WIDE_ROWS, options)
			const later = generateAsciiAquariumFrame(frame + 8, WIDE_COLUMNS, WIDE_ROWS, options)
			const bubblesNow: Array<{ x: number; y: number }> = []
			const bubblesLater: Array<{ x: number; y: number }> = []
			for (let y = 0; y < WIDE_ROWS; y++) {
				for (let x = 0; x < WIDE_COLUMNS; x++) {
					if (now.lines[y][x].ch === 'o' || now.lines[y][x].ch === 'O') bubblesNow.push({ x, y })
					if (later.lines[y][x].ch === 'o' || later.lines[y][x].ch === 'O') bubblesLater.push({ x, y })
				}
			}
			for (const b1 of bubblesNow) {
				for (const b2 of bubblesLater) {
					if (Math.abs(b2.x - b1.x) <= 2 && b1.y - b2.y >= 2 && b1.y - b2.y <= 4) {
						rose = true
						break
					}
				}
				if (rose) break
			}
		}
		assert.ok(rose, 'expected to observe a bubble rising over an 8-frame gap')
	})
})
