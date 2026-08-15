import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	CP437_TO_UNICODE,
	charToCp437Byte,
	cp437ByteToChar,
	cp437ByteToGlyph,
	decodeCp437,
} from './cp437'

describe('CP437 table', () => {
	it('covers all 256 bytes with exactly one character each', () => {
		assert.equal(CP437_TO_UNICODE.length, 256)
		for (let b = 0; b < 256; b++) {
			assert.equal(
				typeof CP437_TO_UNICODE[b],
				'string',
				`byte 0x${b.toString(16)} has no entry`
			)
			assert.equal(
				[...CP437_TO_UNICODE[b]].length,
				1,
				`byte 0x${b.toString(16)} must map to a single character`
			)
		}
	})

	// A duplicate entry here is what silently made single-line box drawing render as
	// double-line glyphs: two bytes shared a codepoint, so the reverse lookup picked one.
	it('is a bijection, so byte -> char -> byte round-trips exactly', () => {
		const seen = new Map<string, number>()
		for (let b = 0; b < 256; b++) {
			const ch = CP437_TO_UNICODE[b]
			const prev = seen.get(ch)
			assert.equal(
				prev,
				undefined,
				`bytes 0x${prev?.toString(16)} and 0x${b.toString(16)} both map to ${JSON.stringify(ch)}`
			)
			seen.set(ch, b)
			assert.equal(charToCp437Byte(ch), b, `byte 0x${b.toString(16)} failed to round-trip`)
		}
	})

	it('maps the box-drawing range to the correct single and double line glyphs', () => {
		// Single-line
		assert.equal(cp437ByteToGlyph(0xc4), '─') // ─
		assert.equal(cp437ByteToGlyph(0xb3), '│') // │
		assert.equal(cp437ByteToGlyph(0xda), '┌') // ┌
		assert.equal(cp437ByteToGlyph(0xc0), '└') // └
		assert.equal(cp437ByteToGlyph(0xc5), '┼') // ┼
		// Double-line must be distinct from their single-line counterparts
		assert.equal(cp437ByteToGlyph(0xcd), '═') // ═
		assert.equal(cp437ByteToGlyph(0xba), '║') // ║
		assert.equal(cp437ByteToGlyph(0xc9), '╔') // ╔
		assert.equal(cp437ByteToGlyph(0xc8), '╚') // ╚
		assert.equal(cp437ByteToGlyph(0xce), '╬') // ╬
	})

	// Pins specific codepoints so a source re-encoding cannot silently corrupt the table.
	it('maps the extended range to real CP437 characters, not Latin-1', () => {
		const expected: Record<number, string> = {
			0x7f: '⌂', // ⌂
			0x80: 'Ç', // Ç
			0x9c: '£', // £
			0x9e: '₧', // ₧
			0x9f: 'ƒ', // ƒ
			0xa5: 'Ñ', // Ñ
			0xa9: '⌐', // ⌐
			0xb0: '░', // ░
			0xdb: '█', // █
			0xe0: 'α', // α
			0xe3: 'π', // π
			0xe6: 'µ', // µ
			0xec: '∞', // ∞
			0xf0: '≡', // ≡
			0xf8: '°', // °
			0xfb: '√', // √
			0xfc: 'ⁿ', // ⁿ
			0xfe: '■', // ■
			0xff: ' ', // NBSP
		}
		for (const [byte, ch] of Object.entries(expected)) {
			assert.equal(cp437ByteToGlyph(Number(byte)), ch, `byte ${byte} mismatch`)
		}
	})

	it('maps the low range to its printable CP437 glyphs', () => {
		assert.equal(cp437ByteToGlyph(0x01), '☺') // ☺
		assert.equal(cp437ByteToGlyph(0x03), '♥') // ♥
		assert.equal(cp437ByteToGlyph(0x0e), '♫') // ♫
		assert.equal(cp437ByteToGlyph(0x1a), '→') // →
		assert.equal(cp437ByteToGlyph(0x1f), '▼') // ▼
	})
})

describe('cp437ByteToChar', () => {
	it('preserves control meaning for stream bytes', () => {
		assert.equal(cp437ByteToChar(0x0a), '\n')
		assert.equal(cp437ByteToChar(0x0d), '\r')
		assert.equal(cp437ByteToChar(0x09), ' ')
		assert.equal(cp437ByteToChar(0x1b), '') // ESC is consumed by the parser
		assert.equal(cp437ByteToChar(0x07), '') // other C0 dropped
	})

	it('decodes printable bytes via the table', () => {
		assert.equal(cp437ByteToChar(0x41), 'A')
		assert.equal(cp437ByteToChar(0xdb), '█')
	})
})

describe('decodeCp437', () => {
	it('decodes a mixed byte run', () => {
		const bytes = new Uint8Array([0x48, 0x69, 0x0a, 0xdb, 0xc4, 0xcd, 0xe0])
		assert.equal(decodeCp437(bytes), 'Hi\n█─═α')
	})
})

describe('charToCp437Byte', () => {
	it('falls back safely for unmapped characters', () => {
		assert.equal(charToCp437Byte(''), 32)
		assert.equal(charToCp437Byte('中'), 32) // CJK -> space
	})

	it('resolves single- and double-line box drawing to distinct bytes', () => {
		assert.equal(charToCp437Byte('─'), 0xc4) // ─
		assert.equal(charToCp437Byte('═'), 0xcd) // ═
		assert.notEqual(charToCp437Byte('─'), charToCp437Byte('═'))
	})
})
