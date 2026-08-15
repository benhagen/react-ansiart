import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { type BitmapFont, findFontDataOffset, renderGlyph } from './bitmapFont'

// Minimal canvas stub. These tests cover allocation and cache bounds — the properties that
// decide whether a truecolour generator churns canvas elements — not pixel output, which
// needs a real 2D context.
type StubCanvas = {
	width: number
	height: number
	getContext: () => StubContext
}

type StubContext = {
	fillStyle: string
	globalCompositeOperation: string
	fillRect: () => void
	clearRect: () => void
	drawImage: () => void
}

let canvasesCreated = 0
let originalDocument: unknown

function makeStubCanvas(): StubCanvas {
	canvasesCreated++
	const ctx: StubContext = {
		fillStyle: '',
		globalCompositeOperation: 'source-over',
		fillRect: () => {},
		clearRect: () => {},
		drawImage: () => {},
	}
	return { width: 0, height: 0, getContext: () => ctx }
}

function makeFont(): BitmapFont {
	const glyphs: Uint8Array[] = []
	for (let i = 0; i < 256; i++) {
		const glyph = new Uint8Array(16)
		for (let row = 0; row < 16; row++) glyph[row] = (i + row) & 0xff
		glyphs.push(glyph)
	}
	return { width: 8, height: 16, glyphs }
}

function targetContext(): CanvasRenderingContext2D {
	return makeStubCanvas().getContext() as unknown as CanvasRenderingContext2D
}

beforeEach(() => {
	canvasesCreated = 0
	originalDocument = (globalThis as { document?: unknown }).document
	;(globalThis as { document?: unknown }).document = {
		createElement: () => makeStubCanvas(),
	}
})

afterEach(() => {
	;(globalThis as { document?: unknown }).document = originalDocument
})

describe('renderGlyph caching', () => {
	it('allocates one canvas per distinct char/fg/bg and reuses it after', () => {
		const font = makeFont()
		const ctx = targetContext()
		const before = canvasesCreated

		renderGlyph(ctx, font, 65, 0, 0, '#ffffff', '#000000')
		const afterFirst = canvasesCreated
		assert.equal(afterFirst - before, 1, 'first render should allocate exactly one canvas')

		for (let i = 0; i < 50; i++) {
			renderGlyph(ctx, font, 65, 0, 0, '#ffffff', '#000000')
		}
		assert.equal(canvasesCreated, afterFirst, 'repeat renders must not allocate')
	})

	it('keeps the DOS palette entirely on the cached path', () => {
		const font = makeFont()
		const ctx = targetContext()
		const palette = Array.from({ length: 16 }, (_, i) => `#${i.toString(16).repeat(6)}`)
		const baseline = canvasesCreated

		// Two full passes over a plausible worst case for 16-colour art.
		for (let pass = 0; pass < 2; pass++) {
			for (let code = 0; code < 256; code++) {
				renderGlyph(ctx, font, code, 0, 0, palette[code % 16], palette[(code + 1) % 16])
			}
		}

		const allocations = canvasesCreated - baseline
		assert.equal(font.glyphCache!.size, 256, 'each char/colour pair should be cached once')
		assert.ok(allocations <= 256, `expected <=256 allocations, got ${allocations}`)
	})

	// The regression: the cache was keyed on char+fg+bg with no allocation ceiling, so a
	// generator emitting 24-bit colour created a canvas element per cell per frame.
	it('stops allocating once the colour cache is full', () => {
		const font = makeFont()
		const ctx = targetContext()
		const baseline = canvasesCreated

		// Far more distinct colours than the cache can hold. Each channel takes a different
		// digit of `i` so every iteration is a genuinely new cache key — deriving all three
		// from `i % 256` would silently repeat every 256 iterations and never fill the cache.
		const distinctColor = (i: number) =>
			`rgb(${i % 256},${Math.floor(i / 256) % 256},${Math.floor(i / 65536) % 256})`

		for (let i = 0; i < 12000; i++) {
			renderGlyph(ctx, font, i % 256, 0, 0, distinctColor(i), '#000000')
		}
		assert.equal(font.glyphCache!.size, 4096, 'cache should have filled to the cap')

		const allocations = canvasesCreated - baseline
		const cacheSize = font.glyphCache!.size
		assert.ok(cacheSize <= 4096, `coloured cache should stay bounded, got ${cacheSize}`)
		// Bounded by the cache cap, plus <=256 glyph masks, plus one scratch canvas.
		assert.ok(
			allocations <= 4096 + 256 + 1,
			`allocations should be bounded, got ${allocations}`
		)

		// Past the cap, further distinct colours must allocate nothing at all.
		const steady = canvasesCreated
		for (let i = 20000; i < 22000; i++) {
			renderGlyph(ctx, font, i % 256, 0, 0, distinctColor(i), '#010203')
		}
		assert.equal(canvasesCreated, steady, 'overflow path must be allocation-free')
	})

	it('caches at most one mask per char code', () => {
		const font = makeFont()
		const ctx = targetContext()

		// Push past the cap so the mask path is exercised, then hammer 256 char codes.
		for (let i = 0; i < 5000; i++) {
			renderGlyph(ctx, font, i % 256, 0, 0, `rgb(${i % 256},${i % 251},${i % 241})`, '#000000')
		}
		for (let pass = 0; pass < 3; pass++) {
			for (let code = 0; code < 256; code++) {
				renderGlyph(ctx, font, code, 0, 0, `rgb(${pass},${code},99)`, '#000000')
			}
		}

		assert.ok(font.glyphMaskCache!.size <= 256, 'mask cache must not exceed 256 entries')
	})
})

describe('findFontDataOffset', () => {
	it('returns 0 when the file is not larger than one font', () => {
		assert.equal(findFontDataOffset(new Uint8Array(4096), 4096), 0)
		assert.equal(findFontDataOffset(new Uint8Array(10), 4096), 0)
	})

	it('skips a zeroed header and finds the first plausible region', () => {
		const expectedSize = 4096
		const headerLength = 1078
		const bytes = new Uint8Array(headerLength + expectedSize + 64)
		// Populate the font region with ~50% density, which lands inside the accepted band.
		for (let i = headerLength; i < bytes.length; i++) {
			bytes[i] = i % 2 === 0 ? 0 : 0xff
		}
		const offset = findFontDataOffset(bytes, expectedSize)
		// The window needs >100 non-zero bytes, so it trips shortly after the data begins.
		assert.ok(offset > 0, 'should move past the zeroed header')
		assert.ok(
			offset >= headerLength - 1000 && offset <= headerLength + 200,
			`offset ${offset} should land near the data start (${headerLength})`
		)
	})

	it('returns 0 when no region matches the heuristic', () => {
		// Fully saturated data never falls below the max-nonzero bound.
		const bytes = new Uint8Array(4096 * 2).fill(0xff)
		assert.equal(findFontDataOffset(bytes, 4096), 0)
	})

	// The sliding window replaced a per-offset 4KB slice + rescan, which was quadratic.
	it('scans a large buffer without quadratic work', () => {
		const expectedSize = 4096
		const bytes = new Uint8Array(2_000_000).fill(0xff)
		const started = process.hrtime.bigint()
		findFontDataOffset(bytes, expectedSize)
		const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6
		assert.ok(elapsedMs < 500, `single pass expected, took ${elapsedMs.toFixed(0)}ms`)
	})
})
