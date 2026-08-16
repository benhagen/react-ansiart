import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { type BitmapFont, normalizeGlyphColor } from '../font/bitmapFont'
import type { FrameData } from '../types/types'
import { createShapeConverter } from './shapeAsciiConverter'

// The ladder the converter is specified to emit in rgbColor mode at its default of 8
// levels: every eighth-ish entry of the renderer's own 32-value ladder, endpoints
// included. Written out independently of the implementation so the test pins the
// contract rather than mirroring the code.
const LEVELS = [0, 33, 74, 107, 148, 181, 222, 255]

/** Widest gap between neighbouring levels — the ladder is not evenly spaced (33/41/33/…). */
const MAX_STEP = Math.max(...LEVELS.slice(1).map((v, i) => v - LEVELS[i]))

function makeFont(): BitmapFont {
	const glyphs: Uint8Array[] = []
	for (let i = 0; i < 256; i++) {
		const glyph = new Uint8Array(16)
		for (let row = 0; row < 16; row++) glyph[row] = (i * 7 + row * 31) & 0xff
		glyphs.push(glyph)
	}
	return { width: 8, height: 16, glyphs }
}

/** Frame whose every pixel is the same colour. */
function solidFrame(width: number, height: number, r: number, g: number, b: number): FrameData {
	const pixels = new Uint8Array(width * height * 3)
	for (let i = 0; i < pixels.length; i += 3) {
		pixels[i] = r
		pixels[i + 1] = g
		pixels[i + 2] = b
	}
	return { width, height, pixels }
}

/** Frame with a smooth 2D gradient, so cells cover a wide spread of colours. */
function gradientFrame(width: number, height: number, phase = 0): FrameData {
	const pixels = new Uint8Array(width * height * 3)
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * 3
			pixels[i] = Math.min(255, ((x * 255) / width + phase) | 0)
			pixels[i + 1] = Math.min(255, ((y * 255) / height + phase) | 0)
			pixels[i + 2] = Math.min(255, ((x + y) % 256) + phase)
		}
	}
	return { width, height, pixels }
}

function parseRgb(color: number | string): [number, number, number] {
	assert.equal(typeof color, 'string', `expected an rgb() string, got ${String(color)}`)
	const match = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(color as string)
	assert.ok(match, `expected a canonical rgb() string, got ${String(color)}`)
	return [+match[1], +match[2], +match[3]]
}

function allCells(screen: { lines: { fg: number | string; bg: number | string }[][] }) {
	return screen.lines.flat()
}

const COLS = 40
const ROWS = 12
const PIXEL_W = COLS * 6
const PIXEL_H = ROWS * 12

describe('shape converter rgbColor quantization', () => {
	it('emits only quantized channel values for fg', () => {
		const converter = createShapeConverter({ bitmapFont: makeFont(), rgbColor: true, monoBackground: true })
		const screen = converter(gradientFrame(PIXEL_W, PIXEL_H), COLS, ROWS)

		const seen = new Set<string>()
		for (const cell of allCells(screen)) {
			const [r, g, b] = parseRgb(cell.fg)
			for (const v of [r, g, b]) {
				assert.ok(LEVELS.includes(v), `channel ${v} is not one of the ${LEVELS.length} levels`)
			}
			seen.add(cell.fg as string)
		}
		assert.ok(seen.size <= LEVELS.length ** 3, `distinct colours must be bounded, got ${seen.size}`)
	})

	it('quantizes the non-mono background as well', () => {
		const converter = createShapeConverter({ bitmapFont: makeFont(), rgbColor: true, monoBackground: false })
		const screen = converter(gradientFrame(PIXEL_W, PIXEL_H), COLS, ROWS)

		for (const cell of allCells(screen)) {
			for (const v of parseRgb(cell.bg)) {
				assert.ok(LEVELS.includes(v), `background channel ${v} is not on the ladder`)
			}
		}
	})

	// The glyph cache keys on char + fg + bg, so one fg pairing with several near-identical
	// bgs multiplies the entries it needs. Deriving bg from the quantized fg keeps it at one.
	it('pairs every foreground colour with exactly one background colour', () => {
		const converter = createShapeConverter({ bitmapFont: makeFont(), rgbColor: true, monoBackground: false })

		const pairs = new Map<string, string>()
		for (const phase of [0, 3, 7, 11]) {
			for (const cell of allCells(converter(gradientFrame(PIXEL_W, PIXEL_H, phase), COLS, ROWS))) {
				const fg = cell.fg as string
				const seen = pairs.get(fg)
				if (seen === undefined) pairs.set(fg, cell.bg as string)
				else assert.equal(cell.bg, seen, `fg ${fg} paired with two backgrounds`)
			}
		}
		assert.ok(pairs.size > 1, 'expected the gradient to produce several foreground colours')
	})

	it('keeps black black and full-bright full-bright', () => {
		const converter = createShapeConverter({ bitmapFont: makeFont(), rgbColor: true, monoBackground: true })

		const black = allCells(converter(solidFrame(PIXEL_W, PIXEL_H, 0, 0, 0), COLS, ROWS))
		for (const cell of black) assert.equal(cell.fg, 'rgb(0,0,0)')

		const white = allCells(converter(solidFrame(PIXEL_W, PIXEL_H, 255, 255, 255), COLS, ROWS))
		for (const cell of white) assert.equal(cell.fg, 'rgb(255,255,255)')
	})

	// The load-bearing property: the display engine's per-cell diff and the glyph cache both
	// key on the colour string, so a cell that shades slowly has to keep the *same* string
	// between frames. Without this, every lit cell is dirty every frame (measured: 1.1fps
	// against 31.5fps for the same scene in palette mode).
	it('produces identical fg strings for frames whose colours drift by less than a step', () => {
		const converter = createShapeConverter({ bitmapFont: makeFont(), rgbColor: true, monoBackground: true })

		for (const level of LEVELS) {
			const drift = level === 255 ? -4 : 4
			const before = allCells(converter(solidFrame(PIXEL_W, PIXEL_H, level, level, level), COLS, ROWS))
			const after = allCells(
				converter(solidFrame(PIXEL_W, PIXEL_H, level + drift, level + drift, level + drift), COLS, ROWS)
			)

			assert.equal(before.length, after.length)
			for (let i = 0; i < before.length; i++) {
				assert.equal(after[i].fg, before[i].fg, `cell ${i} changed colour for a drift of ${drift} at level ${level}`)
			}
			assert.equal(before[0].fg, `rgb(${level},${level},${level})`)
		}
	})

	it('leaves each channel within half a quantization step of the sampled value', () => {
		const converter = createShapeConverter({ bitmapFont: makeFont(), rgbColor: true, monoBackground: true })

		for (let v = 0; v <= 255; v += 5) {
			const cells = allCells(converter(solidFrame(PIXEL_W, PIXEL_H, v, v, v), COLS, ROWS))
			const [r] = parseRgb(cells[0].fg)
			assert.ok(
				Math.abs(r - v) <= MAX_STEP / 2 + 0.5,
				`value ${v} quantized to ${r}, off by more than half a step`
			)
		}
	})

	// Emitted colours are re-snapped by the glyph renderer before they are drawn. If the
	// converter's levels were not fixed points of that ladder, every colour would be
	// quantized twice and drift by up to 3/255 from what this converter promised.
	it('emits levels the glyph renderer leaves untouched', () => {
		for (const level of LEVELS) {
			const color = `rgb(${level},${level},${level})`
			assert.equal(normalizeGlyphColor(color), color, `${level} is not a fixed point of the renderer ladder`)
		}

		const converter = createShapeConverter({ bitmapFont: makeFont(), rgbColor: true, monoBackground: false })
		for (const cell of allCells(converter(gradientFrame(PIXEL_W, PIXEL_H), COLS, ROWS))) {
			assert.equal(normalizeGlyphColor(cell.fg as string), cell.fg)
			assert.equal(normalizeGlyphColor(cell.bg as string), cell.bg)
		}
	})

	describe('rgbLevels', () => {
		it('honours a custom level count, still on renderer fixed points', () => {
			const converter = createShapeConverter({
				bitmapFont: makeFont(),
				rgbColor: true,
				monoBackground: true,
				rgbLevels: 4,
			})

			const seen = new Set<number>()
			for (const cell of allCells(converter(gradientFrame(PIXEL_W, PIXEL_H), COLS, ROWS))) {
				assert.equal(normalizeGlyphColor(cell.fg as string), cell.fg)
				for (const v of parseRgb(cell.fg)) seen.add(v)
			}
			assert.ok(seen.size <= 4, `expected at most 4 levels per channel, saw ${[...seen].sort((a, b) => a - b)}`)
			assert.ok(seen.has(0) || seen.has(255), 'endpoints should be reachable')
		})

		it('gives finer colour at a higher level count', () => {
			const font = makeFont()
			const coarse = createShapeConverter({ bitmapFont: font, rgbColor: true, monoBackground: true, rgbLevels: 4 })
			const fine = createShapeConverter({ bitmapFont: font, rgbColor: true, monoBackground: true, rgbLevels: 32 })

			const distinct = (converter: ReturnType<typeof createShapeConverter>) =>
				new Set(allCells(converter(gradientFrame(PIXEL_W, PIXEL_H), COLS, ROWS)).map((c) => c.fg as string)).size

			assert.ok(distinct(fine) > distinct(coarse), 'more levels should yield more distinct colours')
		})

		it('clamps out-of-range level counts instead of breaking', () => {
			const font = makeFont()
			for (const rgbLevels of [0, 1, -5, 1000, 2.4]) {
				const converter = createShapeConverter({ bitmapFont: font, rgbColor: true, monoBackground: true, rgbLevels })
				const cells = allCells(converter(gradientFrame(PIXEL_W, PIXEL_H), COLS, ROWS))
				for (const cell of cells) {
					for (const v of parseRgb(cell.fg)) assert.ok(v >= 0 && v <= 255, `channel ${v} out of range`)
					assert.equal(normalizeGlyphColor(cell.fg as string), cell.fg)
				}
			}
		})

		// Above the renderer's own 32 levels there is nothing finer to ask for.
		it('caps distinct values at the renderer ladder', () => {
			const converter = createShapeConverter({
				bitmapFont: makeFont(),
				rgbColor: true,
				monoBackground: true,
				rgbLevels: 64,
			})

			const seen = new Set<number>()
			for (const cell of allCells(converter(gradientFrame(PIXEL_W, PIXEL_H), COLS, ROWS))) {
				for (const v of parseRgb(cell.fg)) seen.add(v)
			}
			assert.ok(seen.size <= 32, `expected at most 32 distinct levels, saw ${seen.size}`)
		})
	})

	it('does not touch palette-mode output', () => {
		const converter = createShapeConverter({ bitmapFont: makeFont(), monoBackground: true })
		for (const cell of allCells(converter(gradientFrame(PIXEL_W, PIXEL_H), COLS, ROWS))) {
			assert.equal(typeof cell.fg, 'number')
			assert.equal(cell.bg, 0)
		}
	})
})
