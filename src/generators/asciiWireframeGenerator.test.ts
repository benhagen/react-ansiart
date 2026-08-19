import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { AnsiScreen } from '../ansi/types'
import { charToCp437Byte } from '../utils/cp437'
import {
	generateAsciiWireframeFrame,
	createAsciiWireframeSampler,
	type AsciiWireframeShape,
} from './asciiWireframeGenerator'

const COLUMNS = 24
const ROWS = 12

const WIDE_COLUMNS = 80
const WIDE_ROWS = 25

const ALL_SHAPES: AsciiWireframeShape[] = ['cube', 'tetrahedron', 'octahedron', 'icosahedron']

function chGrid(screen: AnsiScreen): string[] {
	return screen.lines.map(l => l.map(c => c.ch).join(''))
}

function countNonSpace(screen: AnsiScreen): number {
	let on = 0
	for (const line of screen.lines) for (const cell of line) if (cell.ch !== ' ') on++
	return on
}

describe('generateAsciiWireframeFrame', () => {
	it('returns a full rectangular screen', () => {
		const screen = generateAsciiWireframeFrame(5, COLUMNS, ROWS)
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
		const options = { shape: 'icosahedron' as const, size: 0.9, speedX: 0.03 }
		const a = generateAsciiWireframeFrame(31, WIDE_COLUMNS, WIDE_ROWS, options)
		const b = generateAsciiWireframeFrame(31, WIDE_COLUMNS, WIDE_ROWS, options)
		assert.deepEqual(a, b)
	})

	it('emits only CP437-encodable characters for every shape at 80x25', () => {
		const seen = new Set<string>()
		for (const shape of ALL_SHAPES) {
			for (const frame of [0, 20, 60, 133]) {
				const screen = generateAsciiWireframeFrame(frame, WIDE_COLUMNS, WIDE_ROWS, { shape })
				for (const line of screen.lines) for (const cell of line) seen.add(cell.ch)
			}
		}
		for (const ch of seen) {
			assert.notEqual(charToCp437Byte(ch), null, `unmapped glyph ${JSON.stringify(ch)}`)
		}
	})

	it('does not throw on degenerate options and still returns a full screen', () => {
		const degenerate = [
			{ size: NaN, speedX: Infinity, speedY: -Infinity, speedZ: NaN },
			{ size: -4, shape: 'banana' as AsciiWireframeShape },
			{ size: Infinity, edgeChars: [], vertexChar: '' },
		]
		for (const options of degenerate) {
			const screen = generateAsciiWireframeFrame(9, COLUMNS, ROWS, options)
			assert.equal(screen.lines.length, ROWS)
			for (const line of screen.lines) {
				assert.equal(line.length, COLUMNS)
				for (const cell of line) {
					assert.equal([...cell.ch].length, 1)
				}
			}
		}
	})

	it('draws a wireframe with visible edges and vertex markers at 80x25', () => {
		for (const shape of ALL_SHAPES) {
			const screen = generateAsciiWireframeFrame(15, WIDE_COLUMNS, WIDE_ROWS, { shape })
			const on = countNonSpace(screen)
			const total = WIDE_COLUMNS * WIDE_ROWS
			assert.ok(on > 40, `${shape}: only ${on} non-space cells — edges missing`)
			assert.ok(on / total < 0.3, `${shape}: ${on} non-space cells reads as a solid, not a wireframe`)
			let vertices = 0
			for (const line of screen.lines) for (const cell of line) if (cell.ch === '■') vertices++
			assert.ok(vertices >= 1, `${shape}: no vertex markers visible`)
		}
	})

	it('rotates over time', () => {
		const a = generateAsciiWireframeFrame(0, WIDE_COLUMNS, WIDE_ROWS)
		const b = generateAsciiWireframeFrame(40, WIDE_COLUMNS, WIDE_ROWS)
		assert.notDeepEqual(chGrid(a), chGrid(b), 'frame 0 and frame 40 should differ')
	})

	it('produces different output for different shapes', () => {
		const seen = new Set<string>()
		for (const shape of ALL_SHAPES) {
			const screen = generateAsciiWireframeFrame(25, WIDE_COLUMNS, WIDE_ROWS, { shape })
			seen.add(chGrid(screen).join('\n'))
		}
		assert.equal(seen.size, ALL_SHAPES.length, 'each shape should render distinctly')
	})

	it('respects depthShading: false by using a single edge color', () => {
		const screen = generateAsciiWireframeFrame(25, WIDE_COLUMNS, WIDE_ROWS, {
			depthShading: false,
			vertexChar: '#', // fold vertices into edges so only edge colors remain
			edgeChars: ['#'],
			vertexColor: '#123456',
		})
		const edgeColors = new Set<string | number>()
		for (const line of screen.lines) {
			for (const cell of line) {
				if (cell.ch === '#' && cell.fg !== '#123456') edgeColors.add(cell.fg)
			}
		}
		assert.equal(edgeColors.size, 1, `expected one flat edge color, saw ${edgeColors.size}`)
	})
})

describe('createAsciiWireframeSampler', () => {
	it('returns cells for any coordinate, wrapping the backing grid', () => {
		const sample = createAsciiWireframeSampler(12, { shape: 'octahedron' })
		for (const [x, y] of [[0, 0], [40, 30], [-5, -7], [200, 500]]) {
			const cell = sample(x, y)
			assert.equal([...cell.ch].length, 1)
			assert.equal(typeof cell.bold, 'boolean')
		}
		assert.deepEqual(sample(3, 4), sample(83, 64), 'sampler should wrap at the backing grid')
	})
})
