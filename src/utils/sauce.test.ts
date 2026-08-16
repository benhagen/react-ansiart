import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { getSauceStripSize, isSauceTrailer, parseSauce } from './sauce'

const TEST_FILES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'testFiles')

// ----------------------------------------------------------------------------
// Byte-exact synthetic SAUCE record.
//
// Every offset below is written out by hand from the SAUCE 00 specification so
// the test asserts the spec rather than whatever the parser happens to do:
//   ID(5) Version(2) Title(35) Author(20) Group(20) Date(8) FileSize(4, LE)
//   DataType(1) FileType(1) TInfo1..4(2 each, LE) Comments(1) TFlags(1)
//   TInfoS(22)  =  128 bytes
// ----------------------------------------------------------------------------

const RECORD_SIZE = 128
const EOF_MARKER = 0x1a

const EXPECTED = {
	title: 'Byte Exact Trailer',
	author: 'Hand Computed',
	group: 'Offset Verifiers',
	date: '20240131',
	/** 0x00012345 -> bytes 45 23 01 00 at offsets 90..93 */
	fileSize: 74565,
	dataType: 1,
	fileType: 2,
	tInfo1: 132,
	tInfo2: 60,
	tInfo3: 9,
	tInfo4: 3,
	comments: 2,
	tFlags: 3,
	tInfoS: 'IBM VGA50',
} as const

const COMMENT_LINES = ['First comment line', 'Second comment line'] as const

function writeAscii(target: Uint8Array, offset: number, text: string, length: number, pad = 0x20) {
	for (let i = 0; i < length; i++) {
		target[offset + i] = i < text.length ? text.charCodeAt(i) : pad
	}
}

function buildSauceRecord(): Uint8Array {
	const record = new Uint8Array(RECORD_SIZE)
	writeAscii(record, 0, 'SAUCE', 5)
	writeAscii(record, 5, '00', 2)
	writeAscii(record, 7, EXPECTED.title, 35)
	writeAscii(record, 42, EXPECTED.author, 20)
	writeAscii(record, 62, EXPECTED.group, 20)
	writeAscii(record, 82, EXPECTED.date, 8)
	// FileSize, 4 bytes little-endian
	record[90] = 0x45
	record[91] = 0x23
	record[92] = 0x01
	record[93] = 0x00
	record[94] = EXPECTED.dataType
	record[95] = EXPECTED.fileType
	// TInfo1..TInfo4, 2 bytes little-endian each
	record[96] = 0x84 // 132
	record[97] = 0x00
	record[98] = 0x3c // 60
	record[99] = 0x00
	record[100] = 0x09 // 9
	record[101] = 0x00
	record[102] = 0x03 // 3
	record[103] = 0x00
	record[104] = EXPECTED.comments
	record[105] = EXPECTED.tFlags
	// TInfoS: zero-terminated, zero-padded (not space-padded)
	writeAscii(record, 106, EXPECTED.tInfoS, 22, 0x00)
	return record
}

/**
 * Assemble [data][EOF][COMNT block][SAUCE record], the full trailing layout.
 */
function buildFile(data: Uint8Array, options: { comments?: readonly string[]; eof?: boolean } = {}) {
	const { comments = [], eof = true } = options
	const commentBlockSize = comments.length > 0 ? 5 + comments.length * 64 : 0
	const total = data.length + (eof ? 1 : 0) + commentBlockSize + RECORD_SIZE
	const file = new Uint8Array(total)
	file.set(data, 0)
	let offset = data.length
	if (eof) file[offset++] = EOF_MARKER
	if (comments.length > 0) {
		writeAscii(file, offset, 'COMNT', 5)
		offset += 5
		for (const line of comments) {
			writeAscii(file, offset, line, 64)
			offset += 64
		}
	}
	const record = buildSauceRecord()
	record[104] = comments.length
	file.set(record, offset)
	return file
}

const ART_DATA = new Uint8Array([...'Hello ANSI'].map(ch => ch.charCodeAt(0)))

describe('parseSauce field offsets', () => {
	it('reads every field from its SAUCE 00 spec offset', () => {
		const file = buildFile(ART_DATA, { comments: COMMENT_LINES })
		const sauce = parseSauce(file)
		assert.ok(sauce, 'expected a SAUCE record to be parsed')

		assert.equal(sauce.id, 'SAUCE')
		assert.equal(sauce.version, 0)
		assert.equal(sauce.title, EXPECTED.title)
		assert.equal(sauce.author, EXPECTED.author)
		assert.equal(sauce.group, EXPECTED.group)
		assert.equal(sauce.date, EXPECTED.date)
		// FileSize as stored in the record (offset 90), independent of actual length
		assert.equal(sauce.declaredFileSize, EXPECTED.fileSize)
		assert.equal(sauce.dataType, EXPECTED.dataType)
		assert.equal(sauce.fileType, EXPECTED.fileType)
		assert.equal(sauce.tInfo1, EXPECTED.tInfo1)
		assert.equal(sauce.tInfo2, EXPECTED.tInfo2)
		assert.equal(sauce.tInfo3, EXPECTED.tInfo3)
		assert.equal(sauce.tInfo4, EXPECTED.tInfo4)
		assert.equal(sauce.comments, COMMENT_LINES.length)
		assert.equal(sauce.tFlags, EXPECTED.tFlags)
		assert.equal(sauce.tInfoS, EXPECTED.tInfoS)
		assert.deepEqual(sauce.commentLines, [...COMMENT_LINES])
	})

	it('computes fileSize as the artwork length, excluding EOF, comments and record', () => {
		const withComments = buildFile(ART_DATA, { comments: COMMENT_LINES })
		assert.equal(parseSauce(withComments)?.fileSize, ART_DATA.length)

		const withoutComments = buildFile(ART_DATA)
		assert.equal(parseSauce(withoutComments)?.fileSize, ART_DATA.length)

		const withoutEof = buildFile(ART_DATA, { eof: false })
		assert.equal(parseSauce(withoutEof)?.fileSize, ART_DATA.length)
	})

	it('returns undefined when there is no SAUCE record', () => {
		assert.equal(parseSauce(new Uint8Array(200)), undefined)
		assert.equal(parseSauce(new Uint8Array([1, 2, 3])), undefined)
		assert.equal(isSauceTrailer(new Uint8Array(200)), false)
	})
})

describe('getSauceStripSize', () => {
	it('accounts for the record, the comment block and the EOF marker', () => {
		const withComments = buildFile(ART_DATA, { comments: COMMENT_LINES })
		// 128 record + 5 "COMNT" + 2 * 64 comment lines + 1 EOF
		assert.equal(getSauceStripSize(withComments), 128 + 5 + 2 * 64 + 1)

		assert.equal(getSauceStripSize(buildFile(ART_DATA)), 128 + 1)
		assert.equal(getSauceStripSize(buildFile(ART_DATA, { eof: false })), 128)
	})

	it('returns 0 when the input carries no SAUCE trailer', () => {
		assert.equal(getSauceStripSize(new Uint8Array(300)), 0)
		assert.equal(getSauceStripSize(ART_DATA), 0)
	})
})

describe('parseSauce against real artwork', () => {
	// Values below were decoded by hand from the last 128 bytes of the file
	// before running the parser (TC-GOD.ANS is 19804 bytes: 19675 data + 1 EOF
	// + 128 record, so the record starts at offset 19676).
	it('matches the hand-decoded trailer of TC-GOD.ANS', () => {
		const bytes = new Uint8Array(readFileSync(join(TEST_FILES_DIR, 'TC-GOD.ANS')))
		assert.equal(bytes.length, 19804)

		const sauce = parseSauce(bytes)
		assert.ok(sauce, 'TC-GOD.ANS must carry a SAUCE record')
		assert.equal(sauce.id, 'SAUCE')
		assert.equal(sauce.version, 0)
		assert.equal(sauce.title, 'Generations of Doom')
		assert.equal(sauce.author, 'The Clone')
		assert.equal(sauce.group, 'ACiD Productions')
		assert.equal(sauce.date, '19940131')
		assert.equal(sauce.declaredFileSize, 19675)
		assert.equal(sauce.fileSize, 19675)
		assert.equal(sauce.dataType, 1) // Character art
		assert.equal(sauce.fileType, 1) // ANSi (not Ansimation)
		assert.equal(sauce.tInfo1, 80) // width
		assert.equal(sauce.tInfo2, 121) // height
		assert.equal(sauce.tInfo3, 16) // font id
		assert.equal(sauce.tInfo4, 0)
		assert.equal(sauce.comments, 0)
		assert.equal(sauce.tFlags, 0)
		assert.equal(sauce.tInfoS, undefined)
		assert.deepEqual(sauce.commentLines, [])

		// 128-byte record + 1 EOF byte
		assert.equal(getSauceStripSize(bytes), 129)
	})

	it('matches the hand-decoded trailer of krl_valentine.ans', () => {
		const bytes = new Uint8Array(readFileSync(join(TEST_FILES_DIR, 'krl_valentine.ans')))
		const sauce = parseSauce(bytes)
		assert.ok(sauce, 'krl_valentine.ans must carry a SAUCE record')
		assert.equal(sauce.title, 'Valentine')
		assert.equal(sauce.author, 'Krl')
		assert.equal(sauce.group, 'Lazarus')
		assert.equal(sauce.date, '20250604')
		assert.equal(sauce.declaredFileSize, 29178)
		assert.equal(sauce.fileSize, 29178)
		assert.equal(sauce.dataType, 1)
		assert.equal(sauce.fileType, 1)
		assert.equal(sauce.tInfo1, 80)
		assert.equal(sauce.tInfo2, 134)
		assert.equal(sauce.tFlags, 2) // letter spacing, no iCE colors
		assert.equal(sauce.tInfoS, 'IBM VGA')
	})
})
