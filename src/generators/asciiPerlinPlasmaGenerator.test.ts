import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_CHARS, generateAsciiPerlinPlasmaFrame } from './asciiPerlinPlasmaGenerator'
import { charToCp437Byte } from '../utils/cp437'
import { getEmbeddedVgaFont } from '../font/embeddedVgaFont'

const COLUMNS = 80
const ROWS = 25

/** Lit pixels in a glyph (0-128 for the 8x16 VGA font) — the perceptual weight of a ramp step. */
function inkCoverage(ch: string): number {
	const code = charToCp437Byte(ch)
	assert.notEqual(code, null, `character ${JSON.stringify(ch)} is not CP437-encodable`)
	const glyph = getEmbeddedVgaFont().glyphs[code as number]
	let lit = 0
	for (const byte of glyph) {
		for (let bit = 0; bit < 8; bit++) if (byte & (1 << bit)) lit++
	}
	return lit
}

function sampleChars(frames: number): string[] {
	const out: string[] = []
	for (let frame = 0; frame < frames; frame++) {
		const screen = generateAsciiPerlinPlasmaFrame(frame, COLUMNS, ROWS)
		for (const line of screen.lines) for (const cell of line) out.push(cell.ch)
	}
	return out
}

describe('asciiPerlinPlasmaGenerator default ramp', () => {
	it('emits only CP437-encodable characters', () => {
		for (const ch of new Set(sampleChars(8))) {
			assert.notEqual(charToCp437Byte(ch), null, `unmapped glyph ${JSON.stringify(ch)}`)
		}
	})

	// The pre-fix ramp put 'ù'/'ú' (35 lit pixels) after ':'/',' (8), so brightness rose
	// again approaching the blank end and drew a bright band along every dark region.
	// Asserts the ramp as *declared* — sorting first would make this vacuous.
	it('is monotonically non-increasing in ink coverage', () => {
		for (let i = 1; i < DEFAULT_CHARS.length; i++) {
			const prev = inkCoverage(DEFAULT_CHARS[i - 1])
			const curr = inkCoverage(DEFAULT_CHARS[i])
			assert.ok(
				curr <= prev,
				`ramp brightens at index ${i}: ${JSON.stringify(DEFAULT_CHARS[i - 1])}=${prev} -> ` +
					`${JSON.stringify(DEFAULT_CHARS[i])}=${curr}`
			)
		}
	})

	it('ends blank and spans most of the font’s ink range', () => {
		assert.equal(inkCoverage(DEFAULT_CHARS[DEFAULT_CHARS.length - 1]), 0)
		assert.ok(inkCoverage(DEFAULT_CHARS[0]) >= 40, 'ramp should start near the densest ASCII glyph')
	})
})

describe('asciiPerlinPlasmaGenerator value spread', () => {
	// The octave sum is bell-distributed, so a linear index left most of the ramp
	// unreachable and concentrated cells on a couple of entries. These bounds encode
	// "the ramp is actually used" without pinning the exact visual output.
	const chars = sampleChars(40)

	it('reaches a wide span of the ramp', () => {
		assert.ok(
			new Set(chars).size >= 10,
			`expected >= 10 distinct glyphs, saw ${new Set(chars).size}`
		)
	})

	it('does not concentrate cells on a single glyph', () => {
		const counts = new Map<string, number>()
		for (const ch of chars) counts.set(ch, (counts.get(ch) ?? 0) + 1)
		const largest = Math.max(...counts.values()) / chars.length
		assert.ok(largest < 0.3, `largest single glyph share ${(largest * 100).toFixed(1)}% >= 30%`)
	})

	it('renders the dense end of the ramp', () => {
		// Pre-fix, the six densest entries drew 0.46% of cells combined.
		const dense = chars.filter(ch => inkCoverage(ch) >= 39).length / chars.length
		assert.ok(dense > 0.02, `dense glyphs only ${(dense * 100).toFixed(2)}% of cells`)
	})
})

describe('asciiPerlinPlasmaGenerator determinism', () => {
	it('is a pure function of (frame, columns, rows)', () => {
		const a = generateAsciiPerlinPlasmaFrame(7, COLUMNS, ROWS)
		const b = generateAsciiPerlinPlasmaFrame(7, COLUMNS, ROWS)
		assert.deepEqual(
			a.lines.map(l => l.map(c => c.ch).join('')),
			b.lines.map(l => l.map(c => c.ch).join(''))
		)
	})
})
