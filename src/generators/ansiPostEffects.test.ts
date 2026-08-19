import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { AnsiCell, AnsiScreen } from '../ansi/types'
import type { CharacterFrameGeneratorWithMetadata } from '../types/types'
import { CP437_TO_UNICODE } from '../utils/cp437'
import {
	composeAnsiEffects,
	createChromaticAberrationEffect,
	createKaleidoscopeEffect,
	createLensEffect,
	createPhosphorPersistenceEffect,
	createScanlineEffect,
	createVhsTrackingEffect,
	type AnsiPostEffect,
} from './ansiPostEffects'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-'

/** Build a screen where every cell has a distinct-ish char and a parseable color. */
function makeScreen(columns: number, rows: number): AnsiScreen {
	const lines: AnsiCell[][] = []
	for (let y = 0; y < rows; y++) {
		const line: AnsiCell[] = []
		for (let x = 0; x < columns; x++) {
			line.push({
				ch: ALPHABET[(y * columns + x) % ALPHABET.length],
				fg: `rgb(${(x * 7) % 200},${(y * 11) % 200},${(x + y) % 200})`,
				bg: '#101018',
				bold: (x + y) % 5 === 0,
			})
		}
		lines.push(line)
	}
	return { lines, columns }
}

/** Row-distinct pattern: every cell in a given row has a unique character. */
function makeRowDistinctScreen(columns: number, rows: number): AnsiScreen {
	const lines: AnsiCell[][] = []
	for (let y = 0; y < rows; y++) {
		const line: AnsiCell[] = []
		for (let x = 0; x < columns; x++) {
			line.push({
				ch: ALPHABET[x % ALPHABET.length],
				fg: 'rgb(180,180,180)',
				bg: '#000000',
				bold: false,
			})
		}
		lines.push(line)
	}
	return { lines, columns }
}

function cloneScreen(screen: AnsiScreen): AnsiScreen {
	return {
		lines: screen.lines.map((line) => line.map((cell) => ({ ...cell }))),
		columns: screen.columns,
	}
}

function assertScreensValueEqual(actual: AnsiScreen, expected: AnsiScreen, message: string): void {
	assert.equal(actual.columns, expected.columns, `${message}: columns`)
	assert.equal(actual.lines.length, expected.lines.length, `${message}: row count`)
	for (let y = 0; y < expected.lines.length; y++) {
		const a = actual.lines[y]
		const e = expected.lines[y]
		assert.equal(a.length, e.length, `${message}: row ${y} length`)
		for (let x = 0; x < e.length; x++) {
			assert.deepEqual({ ...a[x] }, { ...e[x] }, `${message}: cell ${x},${y}`)
		}
	}
}

/** Every effect, in a default-ish configuration, for the shared invariant tests. */
function allEffects(): Array<{ name: string; effect: AnsiPostEffect }> {
	return [
		{ name: 'lens', effect: createLensEffect() },
		{ name: 'scanline', effect: createScanlineEffect({ dimOthers: true }) },
		{ name: 'vhs', effect: createVhsTrackingEffect({ glitchInterval: 4, glitchDuration: 2 }) },
		{ name: 'phosphor', effect: createPhosphorPersistenceEffect() },
		{ name: 'chromatic', effect: createChromaticAberrationEffect() },
		{ name: 'kaleidoscope', effect: createKaleidoscopeEffect() },
	]
}

describe('post effects: input immutability', () => {
	it('never mutates the input screen', () => {
		for (const { name, effect } of allEffects()) {
			const input = makeScreen(40, 20)
			const before = cloneScreen(input)
			const beforeRows = input.lines.slice()
			const beforeCells = input.lines.map((line) => line.slice())

			for (let frame = 0; frame < 12; frame++) effect(input, frame, 40, 20)

			assertScreensValueEqual(input, before, `${name} mutated input values`)
			for (let y = 0; y < input.lines.length; y++) {
				assert.equal(input.lines[y], beforeRows[y], `${name} replaced input row ${y}`)
				for (let x = 0; x < input.lines[y].length; x++) {
					assert.equal(
						input.lines[y][x],
						beforeCells[y][x],
						`${name} replaced input cell ${x},${y}`
					)
				}
			}
		}
	})

	it('returns rows it owns, never the input row arrays', () => {
		const input = makeScreen(24, 10)
		for (const { name, effect } of allEffects()) {
			// frame 0 is a glitch frame for the vhs config, so every effect transforms here.
			const out = effect(input, 0, 24, 10)
			for (let y = 0; y < out.lines.length; y++) {
				assert.notEqual(out.lines[y], input.lines[y], `${name} returned input row ${y}`)
			}
		}
	})

	it('returns a fresh screen object each call and preserves sauce', () => {
		const input = makeScreen(24, 10)
		const sauced: AnsiScreen = { ...input, sauce: { title: 'x' } as AnsiScreen['sauce'] }
		const effect = createLensEffect()
		const a = effect(sauced, 0, 24, 10)
		const b = effect(sauced, 1, 24, 10)
		assert.notEqual(a, b)
		assert.equal(a.sauce, sauced.sauce)
		assert.equal(b.sauce, sauced.sauce)
	})
})

describe('post effects: determinism', () => {
	it('produces identical output for the same frame', () => {
		for (const { name, effect } of allEffects()) {
			const input = makeScreen(32, 16)
			const first = cloneScreen(effect(input, 7, 32, 16))
			// Advance a few frames so any internal buffer is fully rewritten in between.
			effect(input, 8, 32, 16)
			effect(input, 9, 32, 16)
			const again = effect(input, 7, 32, 16)
			assertScreensValueEqual(again, first, `${name} is not deterministic`)
		}
	})

	it('separate instances with the same options agree', () => {
		const input = makeScreen(32, 16)
		const a = createVhsTrackingEffect({ seed: 99, glitchInterval: 5, glitchDuration: 3 })
		const b = createVhsTrackingEffect({ seed: 99, glitchInterval: 5, glitchDuration: 3 })
		for (let frame = 0; frame < 15; frame++) {
			assertScreensValueEqual(
				a(input, frame, 32, 16),
				cloneScreen(b(input, frame, 32, 16)),
				`vhs instances diverged at frame ${frame}`
			)
		}
	})
})

describe('createLensEffect', () => {
	it('passes cells far outside the lens through by reference', () => {
		const input = makeScreen(40, 20)
		const effect = createLensEffect({ radius: 3, magnification: 2 })
		for (let frame = 0; frame < 40; frame++) {
			const out = effect(input, frame, 40, 20)
			// The lens path is inset by its own radius, so the extreme corners are always outside.
			assert.equal(out.lines[0][0], input.lines[0][0], `corner changed at frame ${frame}`)
			assert.equal(out.lines[19][39], input.lines[19][39], `corner changed at frame ${frame}`)
		}
	})

	it('magnifies: source cells are duplicated inside the lens', () => {
		// 16x8 with radius 8 and cellAspect 2 pins the lens center at (8, 4) for every frame
		// (the Lissajous amplitude collapses to zero when the lens fills the screen).
		const input = makeRowDistinctScreen(16, 8)
		const effect = createLensEffect({
			radius: 8,
			magnification: 2,
			cellAspect: 2,
			rimWidth: 1,
			rimBrightness: 0,
		})
		const out = effect(input, 3, 16, 8)
		const row = out.lines[4]

		// At 2x, columns 9 and 10 both sample source column 9.
		assert.equal(row[9].ch, input.lines[4][9].ch)
		assert.equal(row[10].ch, input.lines[4][9].ch)
		assert.notEqual(row[10].ch, input.lines[4][10].ch)

		// Sanity: the magnified row uses fewer distinct characters than the source row.
		const outChars = new Set(row.map((cell) => cell.ch))
		const srcChars = new Set(input.lines[4].map((cell) => cell.ch))
		assert.ok(
			outChars.size < srcChars.size,
			`expected magnification to collapse distinct chars (${outChars.size} vs ${srcChars.size})`
		)
	})

	it('brightens the rim without touching the source cells', () => {
		const input = makeRowDistinctScreen(16, 8)
		const effect = createLensEffect({
			radius: 8,
			magnification: 1,
			cellAspect: 2,
			rimWidth: 2,
			rimBrightness: 0.5,
		})
		const out = effect(input, 0, 16, 8)
		// Column 0 of row 4 sits at distance 8 from the center -> deep in the rim band.
		const rimCell = out.lines[4][0]
		const centerCell = out.lines[4][8]
		assert.notEqual(rimCell.fg, input.lines[4][0].fg)
		assert.equal(centerCell.fg, input.lines[4][8].fg)
		assert.equal(input.lines[4][0].fg, 'rgb(180,180,180)')
	})

	it('leaves non-parseable colors untouched', () => {
		const input: AnsiScreen = {
			columns: 4,
			lines: [
				[
					{ ch: 'a', fg: 7, bg: 0, bold: false },
					{ ch: 'b', fg: 'chartreuse', bg: 0, bold: false },
					{ ch: 'c', fg: 7, bg: 0, bold: false },
					{ ch: 'd', fg: 7, bg: 0, bold: false },
				],
			],
		}
		// magnification 1 keeps the sample in place, so every cell is its own rim-brightened self.
		const effect = createLensEffect({
			radius: 4,
			magnification: 1,
			cellAspect: 2,
			rimWidth: 4,
			rimBrightness: 1,
		})
		const out = effect(input, 0, 4, 1)
		assert.equal(out.lines[0][0].fg, 7)
		assert.equal(out.lines[0][1].fg, 'chartreuse')
	})
})

describe('createScanlineEffect', () => {
	it('passes rows far from the beam through by reference', () => {
		const input = makeScreen(20, 40)
		const effect = createScanlineEffect({ speed: 0, phase: 0, thickness: 2 })
		const out = effect(input, 0, 20, 40)
		// Beam sits on row 0; row 20 is far outside the gaussian.
		for (let x = 0; x < 20; x++) {
			assert.equal(out.lines[20][x], input.lines[20][x])
		}
	})

	it('brightens the beam row foreground', () => {
		const input = makeRowDistinctScreen(8, 20)
		const effect = createScanlineEffect({ speed: 0, phase: 5, thickness: 2, brightness: 0.6 })
		const out = effect(input, 0, 8, 20)
		assert.notEqual(out.lines[5][0].fg, input.lines[5][0].fg)
		assert.equal(out.lines[5][0].ch, input.lines[5][0].ch)
		// Brightening moves channels toward 255.
		const match = /^rgb\((\d+),/.exec(String(out.lines[5][0].fg))
		assert.ok(match)
		assert.ok(Number(match[1]) > 180)
	})

	it('leaves backgrounds alone unless affectBackground is set', () => {
		const input = makeRowDistinctScreen(8, 20)
		const plain = createScanlineEffect({ speed: 0, phase: 5, thickness: 2 })
		assert.equal(plain(input, 0, 8, 20).lines[5][0].bg, input.lines[5][0].bg)

		const withBg = createScanlineEffect({
			speed: 0,
			phase: 5,
			thickness: 2,
			affectBackground: true,
			backgroundBrightness: 0.5,
		})
		assert.notEqual(withBg(input, 0, 8, 20).lines[5][0].bg, input.lines[5][0].bg)
	})

	it('dims non-beam rows only when dimOthers is set', () => {
		const input = makeRowDistinctScreen(8, 40)
		const off = createScanlineEffect({ speed: 0, phase: 0, thickness: 2 })
		assert.equal(off(input, 0, 8, 40).lines[20][0], input.lines[20][0])

		const on = createScanlineEffect({ speed: 0, phase: 0, thickness: 2, dimOthers: true })
		const dimmed = on(input, 0, 8, 40).lines[20][0]
		assert.notEqual(dimmed.fg, input.lines[20][0].fg)
		const match = /^rgb\((\d+),/.exec(String(dimmed.fg))
		assert.ok(match)
		assert.ok(Number(match[1]) < 180)
	})

	it('sweeps: the beam row advances with the frame', () => {
		const input = makeRowDistinctScreen(8, 40)
		const effect = createScanlineEffect({ speed: 1, thickness: 2 })
		const brightRow = (frame: number): number => {
			const out = effect(input, frame, 8, 40)
			let best = -1
			for (let y = 0; y < out.lines.length; y++) {
				if (out.lines[y][0] !== input.lines[y][0]) {
					// Track the brightest (closest to beam center) transformed row.
					const value = Number(/^rgb\((\d+),/.exec(String(out.lines[y][0].fg))?.[1] ?? 0)
					const bestValue =
						best < 0 ? -1 : Number(/^rgb\((\d+),/.exec(String(out.lines[best][0].fg))?.[1] ?? 0)
					if (value > bestValue) best = y
				}
			}
			return best
		}
		assert.equal(brightRow(0), 0)
		assert.equal(brightRow(10), 10)
		assert.equal(brightRow(41), 1)
	})
})

describe('createVhsTrackingEffect', () => {
	it('returns the input screen untouched on idle frames', () => {
		const input = makeScreen(24, 12)
		const effect = createVhsTrackingEffect({ glitchInterval: 10, glitchDuration: 2 })
		for (const frame of [2, 3, 5, 9, 12, 19]) {
			assert.equal(effect(input, frame, 24, 12), input, `frame ${frame} should be pass-through`)
		}
	})

	it('disturbs a band of rows on glitch frames', () => {
		const input = makeScreen(24, 12)
		const effect = createVhsTrackingEffect({
			seed: 5,
			glitchInterval: 10,
			glitchDuration: 2,
			minBandRows: 2,
			maxBandRows: 4,
			maxShift: 3,
		})
		const out = effect(input, 0, 24, 12)
		assert.notEqual(out, input)

		let changedRows = 0
		for (let y = 0; y < out.lines.length; y++) {
			let rowChanged = false
			for (let x = 0; x < out.lines[y].length; x++) {
				const a = out.lines[y][x]
				const b = input.lines[y][x]
				if (a.ch !== b.ch || a.fg !== b.fg || a.bg !== b.bg) rowChanged = true
			}
			if (rowChanged) changedRows++
		}
		assert.ok(changedRows >= 2 && changedRows <= 4, `expected a 2-4 row band, got ${changedRows}`)
	})

	it('shifts the band horizontally with wrapping', () => {
		const input = makeRowDistinctScreen(16, 8)
		const effect = createVhsTrackingEffect({
			seed: 11,
			glitchInterval: 10,
			glitchDuration: 1,
			maxShift: 4,
			noiseEdgeWidth: 0,
			desaturation: 0,
			darken: 0,
		})
		const out = effect(input, 0, 16, 8)
		// Find the band and verify every band row is a rotation of the source row.
		const sourceChars = input.lines[0].map((cell) => cell.ch)
		let bandRows = 0
		for (let y = 0; y < out.lines.length; y++) {
			const chars = out.lines[y].map((cell) => cell.ch)
			if (chars.join('') === sourceChars.join('')) continue
			bandRows++
			const doubled = sourceChars.join('') + sourceChars.join('')
			assert.ok(doubled.includes(chars.join('')), `row ${y} is not a rotation of the source`)
		}
		assert.ok(bandRows > 0, 'expected at least one shifted row')
	})

	it('uses only CP437-representable noise glyphs', () => {
		const input = makeRowDistinctScreen(16, 8)
		const effect = createVhsTrackingEffect({
			seed: 3,
			glitchInterval: 2,
			glitchDuration: 2,
			noiseChance: 1,
			noiseEdgeWidth: 4,
		})
		for (let frame = 0; frame < 8; frame++) {
			const out = effect(input, frame, 16, 8)
			for (const line of out.lines) {
				for (const cell of line) {
					assert.ok(
						CP437_TO_UNICODE.includes(cell.ch),
						`character ${JSON.stringify(cell.ch)} is not in CP437`
					)
				}
			}
		}
	})
})

describe('createPhosphorPersistenceEffect', () => {
	/** One lit cell at (x, y) on an otherwise dark screen. */
	function dotScreen(columns: number, rows: number, x: number, y: number): AnsiScreen {
		const lines: AnsiCell[][] = []
		for (let yy = 0; yy < rows; yy++) {
			const line: AnsiCell[] = []
			for (let xx = 0; xx < columns; xx++) {
				line.push({
					ch: xx === x && yy === y ? '@' : ' ',
					fg: xx === x && yy === y ? 'rgb(200,100,40)' : '#000000',
					bg: '#000000',
					bold: false,
				})
			}
			lines.push(line)
		}
		return { lines, columns }
	}

	it('leaves a fading trail behind a moving cell', () => {
		const effect = createPhosphorPersistenceEffect({ decayFrames: 6, strength: 1 })
		effect(dotScreen(10, 3, 2, 1), 0, 10, 3)
		// The dot moves; its old position goes dark and must keep glowing.
		const out = effect(dotScreen(10, 3, 5, 1), 1, 10, 3)
		const trail = out.lines[1][2]
		assert.equal(trail.ch, '@', 'trail keeps the departed glyph')
		assert.notEqual(trail.fg, '#000000')
		const first = /^rgb\((\d+),/.exec(String(trail.fg))
		assert.ok(first && Number(first[1]) > 100, `trail should start bright, got ${trail.fg}`)

		// And it decays over subsequent frames until gone.
		let previous = Number(first![1])
		let faded = false
		for (let frame = 2; frame < 12; frame++) {
			const next = effect(dotScreen(10, 3, 5, 1), frame, 10, 3)
			const cell = next.lines[1][2]
			if (cell.ch === ' ') {
				faded = true
				break
			}
			const match = /^rgb\((\d+),/.exec(String(cell.fg))
			assert.ok(match)
			const value = Number(match![1])
			assert.ok(value <= previous, `trail brightened from ${previous} to ${value}`)
			previous = value
		}
		assert.ok(faded, 'trail never fully faded')
	})

	it('re-lighting a cell replaces its trail with the live cell by reference', () => {
		const effect = createPhosphorPersistenceEffect({ decayFrames: 8 })
		effect(dotScreen(10, 3, 2, 1), 0, 10, 3)
		effect(dotScreen(10, 3, 5, 1), 1, 10, 3)
		const relit = dotScreen(10, 3, 2, 1)
		const out = effect(relit, 2, 10, 3)
		assert.equal(out.lines[1][2], relit.lines[1][2])
	})

	it('resets its memory when the frame number rewinds', () => {
		const effect = createPhosphorPersistenceEffect({ decayFrames: 8, strength: 1 })
		effect(dotScreen(10, 3, 2, 1), 0, 10, 3)
		effect(dotScreen(10, 3, 5, 1), 1, 10, 3)
		// Rewind to frame 0: memory clears, so the old position shows the raw dark cell.
		const rewound = dotScreen(10, 3, 5, 1)
		const out = effect(rewound, 0, 10, 3)
		assert.equal(out.lines[1][2], rewound.lines[1][2], 'expected no trail after a rewind')
	})

	it('dims numeric ANSI palette colors through the EGA table', () => {
		const effect = createPhosphorPersistenceEffect({ decayFrames: 6, strength: 1 })
		const lit: AnsiScreen = {
			columns: 3,
			lines: [[
				{ ch: '#', fg: 14, bg: 0, bold: false },
				{ ch: ' ', fg: 7, bg: 0, bold: false },
				{ ch: ' ', fg: 7, bg: 0, bold: false },
			]],
		}
		const dark: AnsiScreen = {
			columns: 3,
			lines: [[
				{ ch: ' ', fg: 7, bg: 0, bold: false },
				{ ch: ' ', fg: 7, bg: 0, bold: false },
				{ ch: ' ', fg: 7, bg: 0, bold: false },
			]],
		}
		effect(lit, 0, 3, 1)
		const out = effect(dark, 1, 3, 1)
		const trail = out.lines[0][0]
		assert.equal(trail.ch, '#')
		// ANSI 14 is yellow (255,255,85); the trail must be an rgb() dim of it.
		const match = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(String(trail.fg))
		assert.ok(match, `expected an rgb() trail color, got ${trail.fg}`)
		assert.ok(Number(match![1]) > 0 && Number(match![1]) <= 255)
		assert.equal(match![1], match![2], 'yellow keeps r == g when dimmed')
	})
})

describe('createChromaticAberrationEffect', () => {
	/** A screen with a hard vertical color edge at column `edge`. */
	function edgeScreen(columns: number, rows: number, edge: number): AnsiScreen {
		const lines: AnsiCell[][] = []
		for (let y = 0; y < rows; y++) {
			const line: AnsiCell[] = []
			for (let x = 0; x < columns; x++) {
				line.push({
					ch: '█',
					fg: x < edge ? 'rgb(255,255,255)' : 'rgb(0,0,0)',
					bg: '#000000',
					bold: false,
				})
			}
			lines.push(line)
		}
		return { lines, columns }
	}

	it('fringes colors at a hard edge but leaves flat areas untouched by reference', () => {
		const input = edgeScreen(40, 5, 30)
		const effect = createChromaticAberrationEffect({ maxShift: 2, falloff: 'uniform' })
		const out = effect(input, 0, 40, 5)

		// Deep inside the flat white region: reference pass-through.
		assert.equal(out.lines[2][10], input.lines[2][10])
		// Just right of the edge: red channel sampled from the white side -> red fringe.
		const fringed = out.lines[2][30]
		const match = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(String(fringed.fg))
		assert.ok(match, `expected an rgb() fringe, got ${String(fringed.fg)}`)
		assert.ok(Number(match![1]) > Number(match![3]), 'expected red > blue right of a white edge')
		// Just left of the edge: blue channel sampled from the black side -> blue drops out first,
		// i.e. blue < red is false there; instead blue is pulled DOWN: r stays 255.
		const leftOfEdge = out.lines[2][29]
		const lm = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(String(leftOfEdge.fg))
		assert.ok(lm)
		assert.ok(Number(lm![3]) < Number(lm![1]), 'expected blue < red left of a white edge')
	})

	it("edge falloff keeps the screen center clean", () => {
		const input = makeScreen(41, 5)
		const effect = createChromaticAberrationEffect({ maxShift: 2, falloff: 'edge' })
		const out = effect(input, 0, 41, 5)
		// shift table is 0 near the center column regardless of content.
		assert.equal(out.lines[2][20], input.lines[2][20])
		assert.equal(out.lines[2][21], input.lines[2][21])
	})

	it('maxShift 0 is a total pass-through of the input screen object', () => {
		const input = makeScreen(20, 5)
		const effect = createChromaticAberrationEffect({ maxShift: 0 })
		assert.equal(effect(input, 0, 20, 5), input)
	})

	it('never changes glyphs, only colors', () => {
		const input = makeScreen(32, 8)
		const effect = createChromaticAberrationEffect({ maxShift: 3, falloff: 'uniform' })
		const out = effect(input, 0, 32, 8)
		for (let y = 0; y < 8; y++) {
			for (let x = 0; x < 32; x++) {
				assert.equal(out.lines[y][x].ch, input.lines[y][x].ch)
			}
		}
	})
})

describe('createKaleidoscopeEffect', () => {
	it('produces mirror symmetry from an asymmetric source', () => {
		// Source: left half 'L', right half 'R'. A 2-segment kaleidoscope with no rotation
		// must produce a screen symmetric under vertical mirroring about the center row axis.
		const columns = 21
		const rows = 11
		const lines: AnsiCell[][] = []
		for (let y = 0; y < rows; y++) {
			const line: AnsiCell[] = []
			for (let x = 0; x < columns; x++) {
				line.push({ ch: y < 5 ? 'T' : y > 5 ? 'B' : 'M', fg: 'rgb(9,9,9)', bg: '#000', bold: false })
			}
			lines.push(line)
		}
		const input: AnsiScreen = { lines, columns }
		const effect = createKaleidoscopeEffect({
			segments: 2,
			rotateSpeed: 0,
			sourceRotateSpeed: 0,
		})
		const out = effect(input, 0, columns, rows)
		for (let y = 0; y < rows; y++) {
			for (let x = 0; x < columns; x++) {
				assert.equal(
					out.lines[y][x].ch,
					out.lines[rows - 1 - y][x].ch,
					`asymmetric at ${x},${y}`
				)
			}
		}
	})

	it('emits only cells that exist in the source (pure remapping)', () => {
		const input = makeScreen(30, 15)
		const sourceCells = new Set<AnsiCell>()
		for (const line of input.lines) for (const cell of line) sourceCells.add(cell)

		const effect = createKaleidoscopeEffect({ segments: 6 })
		for (const frame of [0, 10, 100]) {
			const out = effect(input, frame, 30, 15)
			for (const line of out.lines) {
				for (const cell of line) {
					assert.ok(sourceCells.has(cell), 'kaleidoscope invented a cell')
				}
			}
		}
	})

	it('rotation animates the output over time', () => {
		const input = makeScreen(30, 15)
		const effect = createKaleidoscopeEffect({ segments: 6, rotateSpeed: 0.05 })
		const asText = (s: AnsiScreen) => s.lines.map((l) => l.map((c) => c.ch).join('')).join('\n')
		const a = asText(effect(input, 0, 30, 15))
		const b = asText(effect(input, 40, 30, 15))
		assert.notEqual(a, b)
	})
})

describe('composeAnsiEffects', () => {
	const baseGenerator = (): CharacterFrameGeneratorWithMetadata =>
		((frame: number, columns: number, rows: number) => {
			void frame
			return makeRowDistinctScreen(columns, rows)
		}) as CharacterFrameGeneratorWithMetadata

	/** Test effect that rewrites every char, into its own buffer. */
	const tagEffect = (from: string, to: string): AnsiPostEffect => {
		return (screen) => ({
			lines: screen.lines.map((line) =>
				line.map((cell) => ({ ...cell, ch: cell.ch === from ? to : cell.ch }))
			),
			columns: screen.columns,
		})
	}

	it('keeps the CharacterFrameGenerator contract', () => {
		const composed = composeAnsiEffects(baseGenerator(), createLensEffect())
		const screen = composed(3, 24, 12)
		assert.equal(screen.columns, 24)
		assert.equal(screen.lines.length, 12)
		for (const line of screen.lines) assert.equal(line.length, 24)
	})

	it('applies effects left to right', () => {
		const gen = baseGenerator()
		const aThenB = composeAnsiEffects(gen, tagEffect('A', 'B'), tagEffect('B', 'C'))
		const bThenA = composeAnsiEffects(gen, tagEffect('B', 'C'), tagEffect('A', 'B'))
		// Source row starts 'A', 'B', ...
		assert.equal(aThenB(0, 8, 2).lines[0][0].ch, 'C')
		assert.equal(bThenA(0, 8, 2).lines[0][0].ch, 'B')
	})

	it('accepts effects as arrays or varargs', () => {
		const gen = baseGenerator()
		const viaArray = composeAnsiEffects(gen, [tagEffect('A', 'B'), tagEffect('B', 'C')])
		assert.equal(viaArray(0, 8, 2).lines[0][0].ch, 'C')
		const mixed = composeAnsiEffects(gen, tagEffect('A', 'B'), [tagEffect('B', 'C')])
		assert.equal(mixed(0, 8, 2).lines[0][0].ch, 'C')
	})

	it('forwards player metadata', () => {
		const gen = baseGenerator()
		let speed = 960
		gen.capabilities = {
			supportsSeek: true,
			supportsSpeedControl: true,
			getTotalBytes: () => 1234,
			getTotalFrames: () => 42,
		}
		gen.setSpeed = (bytesPerSecond: number) => {
			speed = bytesPerSecond
		}
		gen.getCurrentSpeed = () => speed
		gen.getCurrentBytePosition = () => 17

		const composed = composeAnsiEffects(gen, createScanlineEffect())
		assert.equal(composed.capabilities, gen.capabilities)
		assert.equal(composed.capabilities?.getTotalBytes?.(), 1234)
		assert.equal(composed.getCurrentBytePosition?.(), 17)
		composed.setSpeed?.(120)
		assert.equal(speed, 120)
		assert.equal(composed.getCurrentSpeed?.(), 120)
	})

	it('does not forward metadata the source generator lacks', () => {
		const composed = composeAnsiEffects(baseGenerator(), createScanlineEffect())
		assert.equal(composed.capabilities, undefined)
		assert.equal(composed.setSpeed, undefined)
		assert.equal('setSpeed' in composed, false)
	})

	it('strips isStatic when effects are attached, keeps it when there are none', () => {
		const gen = baseGenerator()
		gen.isStatic = true

		const wrapped = composeAnsiEffects(gen, createLensEffect())
		assert.equal(wrapped.isStatic, undefined, 'animated effects must not stay static')

		const unwrapped = composeAnsiEffects(gen)
		assert.equal(unwrapped.isStatic, true)
	})

	it('tolerates a source generator whose rows alias retained state', () => {
		// Mimics the progressive ANSI parser: the same row arrays come back every frame.
		const retained = makeScreen(20, 10)
		const gen = ((frame: number) => {
			void frame
			return retained
		}) as CharacterFrameGeneratorWithMetadata
		const before = cloneScreen(retained)

		const composed = composeAnsiEffects(
			gen,
			createLensEffect({ radius: 4 }),
			createScanlineEffect({ dimOthers: true }),
			createVhsTrackingEffect({ glitchInterval: 3, glitchDuration: 2 })
		)
		for (let frame = 0; frame < 20; frame++) composed(frame, 20, 10)

		assertScreensValueEqual(retained, before, 'composed chain mutated the retained screen')
	})
})
