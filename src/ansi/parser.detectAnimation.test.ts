import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { detectAnimation } from './parser'

const TEST_FILES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'testFiles')

function bytesOf(text: string): Uint8Array {
	return new Uint8Array([...text].map(ch => ch.charCodeAt(0)))
}

function loadTestFile(name: string): Uint8Array {
	return new Uint8Array(readFileSync(join(TEST_FILES_DIR, name)))
}

const esc = '\x1b['
/** The clear-screen/home preamble that opens nearly every classic .ANS file */
const PREAMBLE = `${esc}0m${esc}2J${esc}H`

describe('detectAnimation on real artwork', () => {
	// Classification for every ANSI file in testFiles/. Only CN2ACID_animation.ANS
	// is a genuine multi-frame ANSImation (889 cursor-position sequences, 96 of
	// them jumping backwards into painted output, 2 mid-stream screen clears).
	const EXPECTED: ReadonlyArray<readonly [string, boolean]> = [
		['AN-IDES1.ANS', false],
		['ANS-50A.ANS', false],
		['ANS-50B.ANS', false],
		['ANS-50C.ANS', false],
		['CN2ACID_animation.ANS', true],
		['KH-MALE1.ANS', false],
		['SI-SOS1.ANS', false],
		// Static piece that positions the cursor per line (rows 2..17, forward only)
		['T2-TEH1.ANS', false],
		['TC-GOD.ANS', false],
		['US-SFISH.ANS', false],
		['krl_valentine.ans', false],
	]

	for (const [name, expected] of EXPECTED) {
		it(`classifies ${name} as ${expected ? 'animated' : 'static'}`, () => {
			assert.equal(detectAnimation(loadTestFile(name)), expected)
		})
	}
})

describe('detectAnimation preamble handling', () => {
	it('ignores a leading clear-screen/home preamble', () => {
		assert.equal(detectAnimation(bytesOf(`${PREAMBLE}${esc}1;37mstatic artwork\r\n`)), false)
	})

	it('ignores a preamble that follows blank padding', () => {
		assert.equal(detectAnimation(bytesOf(`\r\n   ${esc}2J${esc}1;1Hstatic artwork\r\n`)), false)
	})

	it('ignores forward-only per-line positioning (static drawing style)', () => {
		let art = PREAMBLE
		for (let row = 2; row <= 40; row++) {
			art += `${esc}${row}Hrow ${row} content\r\n`
		}
		assert.equal(detectAnimation(bytesOf(art)), false)
	})

	it('ignores relative cursor moves used to overlay half blocks', () => {
		let art = PREAMBLE
		for (let i = 0; i < 200; i++) {
			art += `${esc}44mÜÜÜ${esc}A${esc}3D${esc}47mßßß\r\n`
		}
		assert.equal(detectAnimation(bytesOf(art)), false)
	})

	it('does not flag a single trailing park of the cursor', () => {
		assert.equal(detectAnimation(bytesOf(`${PREAMBLE}artwork\r\n${esc}H`)), false)
	})
})

describe('detectAnimation animation signals', () => {
	it('detects a mid-stream full-screen erase (frame boundary)', () => {
		assert.equal(detectAnimation(bytesOf(`${PREAMBLE}frame one${esc}2Jframe two`)), true)
	})

	it('detects repeated re-homing after content', () => {
		assert.equal(
			detectAnimation(bytesOf(`${PREAMBLE}frame one${esc}1;1Hframe two${esc}1;1Hframe three`)),
			true
		)
	})

	it('detects backwards jumps into already-painted output', () => {
		const art = `${PREAMBLE}${esc}20;10Hbottom${esc}5;10Hmiddle${esc}3;10Htop`
		assert.equal(detectAnimation(bytesOf(art)), true)
	})

	it('detects a backwards jump within the same row', () => {
		const art = `${PREAMBLE}${esc}10;40Hright${esc}10;20Hleft${esc}10;5Hleftmost`
		assert.equal(detectAnimation(bytesOf(art)), true)
	})

	it('trusts a SAUCE Ansimation marker even without cursor codes', () => {
		const data = bytesOf(`${PREAMBLE}no cursor codes at all\r\n`)
		const file = new Uint8Array(data.length + 1 + 128)
		file.set(data, 0)
		file[data.length] = 0x1a // EOF
		const record = data.length + 1
		for (const [i, ch] of [...'SAUCE00'].entries()) file[record + i] = ch.charCodeAt(0)
		file.fill(0x20, record + 7, record + 90) // title/author/group/date
		file[record + 94] = 1 // DataType: character art
		file[record + 95] = 2 // FileType: Ansimation
		assert.equal(detectAnimation(file), true)
	})

	it('does not trust a SAUCE ANSi marker as an animation', () => {
		const data = bytesOf(`${PREAMBLE}no cursor codes at all\r\n`)
		const file = new Uint8Array(data.length + 1 + 128)
		file.set(data, 0)
		file[data.length] = 0x1a
		const record = data.length + 1
		for (const [i, ch] of [...'SAUCE00'].entries()) file[record + i] = ch.charCodeAt(0)
		file.fill(0x20, record + 7, record + 90)
		file[record + 94] = 1
		file[record + 95] = 1 // FileType: ANSi
		assert.equal(detectAnimation(file), false)
	})
})
