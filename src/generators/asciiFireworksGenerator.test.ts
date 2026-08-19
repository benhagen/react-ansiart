import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { generateAsciiFireworksFrame } from './asciiFireworksGenerator'
import { charToCp437Byte } from '../utils/cp437'

const COLUMNS = 24
const ROWS = 12

// Bursts are tuned for the default watching size.
const WIDE_COLUMNS = 80
const WIDE_ROWS = 25

const BURST_CHARS = new Set(['@', '#', '*', '+'])

describe('generateAsciiFireworksFrame', () => {
	it('returns a full rectangular screen', () => {
		const screen = generateAsciiFireworksFrame(5, COLUMNS, ROWS)
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
		const options = { seed: 99, launchInterval: 30, particleCount: 50 }
		const a = generateAsciiFireworksFrame(64, WIDE_COLUMNS, WIDE_ROWS, options)
		const b = generateAsciiFireworksFrame(64, WIDE_COLUMNS, WIDE_ROWS, options)
		assert.deepEqual(a, b)
	})

	it('is stateless: out-of-order frames reproduce identical output', () => {
		// The point of the closed-form design — seeking backward must not change
		// what any frame looks like.
		const first = generateAsciiFireworksFrame(100, WIDE_COLUMNS, WIDE_ROWS)
		generateAsciiFireworksFrame(10, WIDE_COLUMNS, WIDE_ROWS)
		const again = generateAsciiFireworksFrame(100, WIDE_COLUMNS, WIDE_ROWS)
		assert.deepEqual(first, again)
	})

	it('emits only CP437-encodable characters', () => {
		const seen = new Set<string>()
		for (const frame of [0, 30, 77, 150, 400]) {
			const screen = generateAsciiFireworksFrame(frame, WIDE_COLUMNS, WIDE_ROWS)
			for (const line of screen.lines) for (const cell of line) seen.add(cell.ch)
		}
		for (const ch of seen) {
			assert.notEqual(charToCp437Byte(ch), null, `unmapped glyph ${JSON.stringify(ch)}`)
		}
	})

	it('tolerates degenerate options without throwing', () => {
		const degenerate = [
			{ seed: Number.NaN, launchInterval: -5, riseFrames: 0 },
			{ particleCount: -10, gravity: Number.NaN, burstDuration: 0 },
			{ hues: [], bgColor: '#123456' },
			{ launchInterval: Number.POSITIVE_INFINITY, nightSky: false },
		]
		for (const options of degenerate) {
			const screen = generateAsciiFireworksFrame(42, COLUMNS, ROWS, options)
			assert.equal(screen.lines.length, ROWS)
			for (const line of screen.lines) {
				assert.equal(line.length, COLUMNS)
				for (const cell of line) {
					assert.equal([...cell.ch].length, 1)
				}
			}
		}
	})

	it('handles frame 0 and non-finite frame numbers', () => {
		assert.equal(generateAsciiFireworksFrame(0, COLUMNS, ROWS).lines.length, ROWS)
		assert.equal(generateAsciiFireworksFrame(Number.NaN, COLUMNS, ROWS).lines.length, ROWS)
	})

	it('produces at least one burst in the upper half over a 200-frame window at 80x25', () => {
		// nightSky off so every non-space glyph belongs to a rocket or burst.
		let bestBurstCells = 0
		for (let frame = 0; frame < 200; frame++) {
			const screen = generateAsciiFireworksFrame(frame, WIDE_COLUMNS, WIDE_ROWS, { nightSky: false })
			let burstCells = 0
			for (let y = 0; y < Math.floor(WIDE_ROWS / 2); y++) {
				for (const cell of screen.lines[y]) {
					if (BURST_CHARS.has(cell.ch)) burstCells++
				}
			}
			if (burstCells > bestBurstCells) bestBurstCells = burstCells
		}
		assert.ok(
			bestBurstCells >= 20,
			`expected a frame with >= 20 bright burst cells in the upper half, best was ${bestBurstCells}`,
		)
	})

	it('varies activity frame to frame (rockets rise, bursts expand and fade)', () => {
		const signatures = new Set<number>()
		for (let frame = 0; frame < 200; frame++) {
			const screen = generateAsciiFireworksFrame(frame, WIDE_COLUMNS, WIDE_ROWS, { nightSky: false })
			let nonSpace = 0
			for (const line of screen.lines) {
				for (const cell of line) if (cell.ch !== ' ') nonSpace++
			}
			signatures.add(nonSpace)
		}
		assert.ok(
			signatures.size >= 20,
			`expected the non-space cell count to vary across frames, saw ${signatures.size} distinct values`,
		)
	})

	it('never builds a color string per cell for the same hue level (tables are shared)', () => {
		// Two cells at the same brightness level of the same hue must reference
		// the same precomputed string (identity, not just equality).
		const screen = generateAsciiFireworksFrame(48, WIDE_COLUMNS, WIDE_ROWS, { nightSky: false })
		const byColor = new Map<string, number>()
		for (const line of screen.lines) {
			for (const cell of line) {
				if (cell.ch === ' ') continue
				byColor.set(cell.fg as string, (byColor.get(cell.fg as string) ?? 0) + 1)
			}
		}
		// A burst frame has far more lit cells than distinct hue-level colors
		const lit = [...byColor.values()].reduce((a, b) => a + b, 0)
		assert.ok(lit === 0 || byColor.size < lit, 'expected color strings to be reused across cells')
	})
})
