import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createAnsiParseSession, parseAnsiCore } from './parser'

const TEST_FILES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'testFiles')

function loadTestFile(name: string): Uint8Array {
	return new Uint8Array(readFileSync(join(TEST_FILES_DIR, name)))
}

// Byte positions to sample: increasing prefixes of the file, then a rewind.
// A resumed session must produce output deep-equal to a fresh full re-parse
// stopped at the same byte index — that is the core correctness guarantee
// that lets animated playback parse only the per-frame delta.
const CHECKPOINT_FRACTIONS = [0.1, 0.4, 0.7, 1.0]

function assertSessionMatchesFreshParse(bytes: Uint8Array, columns: number | undefined) {
	const session = createAnsiParseSession(bytes, { columns })

	// Forward passes at increasing byte indices
	for (const fraction of CHECKPOINT_FRACTIONS) {
		const k = Math.floor(bytes.length * fraction)
		const resumed = session.advanceTo(k)
		const fresh = parseAnsiCore(bytes, { columns, maxByteIndex: k })
		assert.deepEqual(resumed, fresh, `mismatch at byte index ${k} (forward)`)
	}

	// Rewind (loop/seek backward) must reset and re-parse from byte 0
	const rewindK = Math.floor(bytes.length * 0.4)
	const rewound = session.advanceTo(rewindK)
	const freshRewind = parseAnsiCore(bytes, { columns, maxByteIndex: rewindK })
	assert.deepEqual(rewound, freshRewind, `mismatch at byte index ${rewindK} (after rewind)`)

	// Forward again after the rewind
	const resumeK = Math.floor(bytes.length * 0.7)
	const resumed = session.advanceTo(resumeK)
	const freshResume = parseAnsiCore(bytes, { columns, maxByteIndex: resumeK })
	assert.deepEqual(resumed, freshResume, `mismatch at byte index ${resumeK} (forward after rewind)`)
}

describe('createAnsiParseSession resumability', () => {
	// Animation-style file (cursor positioning throughout, no SAUCE trailer)
	const animationBytes = loadTestFile('CN2ACID_animation.ANS')
	// Conventional artwork with a SAUCE trailer (exercises the strip-once path)
	const artworkBytes = loadTestFile('TC-GOD.ANS')

	it('matches fresh parses for an animated file (fixed 80 columns)', () => {
		assertSessionMatchesFreshParse(animationBytes, 80)
	})

	it('matches fresh parses for an animated file (dynamic columns)', () => {
		assertSessionMatchesFreshParse(animationBytes, undefined)
	})

	it('matches fresh parses for a SAUCE-bearing file (fixed 80 columns)', () => {
		assertSessionMatchesFreshParse(artworkBytes, 80)
	})

	it('matches fresh parses for a SAUCE-bearing file (dynamic columns)', () => {
		assertSessionMatchesFreshParse(artworkBytes, undefined)
	})

	it('exposes SAUCE metadata and the stripped byte length', () => {
		const session = createAnsiParseSession(artworkBytes, { columns: 80 })
		assert.deepEqual(session.sauce, parseAnsiCore(artworkBytes, { columns: 80 }).sauce)
		assert.ok(session.byteLength < artworkBytes.length, 'SAUCE trailer must be stripped')

		const plainSession = createAnsiParseSession(animationBytes, { columns: 80 })
		assert.equal(plainSession.byteLength, animationBytes.length)
	})
})

describe('createAnsiParseSession at every byte boundary (synthetic)', () => {
	// Small synthetic stream covering SGR colors, cursor moves, save/restore,
	// erase line/display mid-stream, and line wrapping. Advancing one byte at a
	// time forces stop points inside escape sequences, so this verifies that
	// the retained state machine and the pure screen finalization stay
	// equivalent to a fresh parse at every single byte index.
	const esc = '\x1b['
	const synthetic =
		`${esc}0;36mHello, world!\r\n` +
		`${esc}1;33mBright ${esc}44mon blue` +
		`${esc}5;10HMoved${esc}s${esc}2K` +
		`${esc}7;1H${esc}0;35mrow seven${esc}K` +
		`${esc}2Jcleared${esc}u${esc}Bdown\n` +
		`wrap-${'x'.repeat(90)}`
	const syntheticBytes = new Uint8Array([...synthetic].map(ch => ch.charCodeAt(0)))

	it('matches fresh parses at every byte index (fixed 80 columns)', () => {
		const session = createAnsiParseSession(syntheticBytes, { columns: 80 })
		for (let k = 0; k <= syntheticBytes.length; k++) {
			const resumed = session.advanceTo(k)
			const fresh = parseAnsiCore(syntheticBytes, { columns: 80, maxByteIndex: k })
			assert.deepEqual(resumed, fresh, `mismatch at byte index ${k}`)
		}
	})

	it('matches fresh parses at every byte index (dynamic columns)', () => {
		const session = createAnsiParseSession(syntheticBytes, {})
		for (let k = 0; k <= syntheticBytes.length; k++) {
			const resumed = session.advanceTo(k)
			const fresh = parseAnsiCore(syntheticBytes, { maxByteIndex: k })
			assert.deepEqual(resumed, fresh, `mismatch at byte index ${k}`)
		}
	})

	it('handles a soft EOF byte followed by trailing data', () => {
		const withEof = new Uint8Array([...'AB\x1aCD'].map(ch => ch.charCodeAt(0)))
		const session = createAnsiParseSession(withEof, { columns: 80 })
		for (let k = 0; k <= withEof.length; k++) {
			const resumed = session.advanceTo(k)
			const fresh = parseAnsiCore(withEof, { columns: 80, maxByteIndex: k })
			assert.deepEqual(resumed, fresh, `mismatch at byte index ${k}`)
		}
	})
})
