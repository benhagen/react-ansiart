// ============================================================================
// SAUCE Metadata
// ============================================================================

/**
 * SAUCE (Standard Architecture for Universal Comment Extensions) metadata
 * Provides file information, dimensions, and comments for ANSI art files
 */
export type SauceMetadata = {
	/** Should be "SAUCE" */
	id: string
	/** SAUCE version number */
	version: number
	/** Title of the artwork */
	title: string
	/** Author name */
	author: string
	/** Group/organization name */
	group: string
	/** Date in YYYYMMDD format */
	date: string
	/**
	 * Size of the artwork data, computed from the input: total length minus the
	 * SAUCE trailer, any comment block and the EOF marker.
	 * See {@link SauceMetadata.declaredFileSize} for the value stored in the record.
	 */
	fileSize: number
	/**
	 * FileSize field as stored in the SAUCE record (offset 90, 4 bytes LE).
	 * Normally equal to {@link SauceMetadata.fileSize}, but it is writer-supplied
	 * and may be 0 or stale.
	 */
	declaredFileSize: number
	/** Data type (0=text, 1=character art) */
	dataType: number
	/** File type (0=ASCII, 1=ANSI, 2=Ansimation, etc.) */
	fileType: number
	/** Type-specific info 1 (width for ANSI files) */
	tInfo1: number
	/** Type-specific info 2 (height for ANSI files) */
	tInfo2: number
	/** Type-specific info 3 (font ID for ANSI files) */
	tInfo3: number
	/** Type-specific info 4 (flags/aspect ratio for ANSI files) */
	tInfo4: number
	/** Number of comment lines */
	comments: number
	/** Type flags (ICE colors, letter spacing, etc.) */
	tFlags: number
	/** Type-specific info string (22 bytes, zero-terminated) */
	tInfoS?: string
	/** Comment lines (each up to 64 characters) */
	commentLines: string[]
}

// SAUCE header bytes
const SAUCE_ID_S = 0x53
const SAUCE_ID_A = 0x41
const SAUCE_ID_U = 0x55
const SAUCE_ID_C = 0x43
const SAUCE_ID_E = 0x45
export const SAUCE_TRAILER_SIZE = 128
export const SAUCE_EOF = 0x1a // EOF marker (26)
const COMMENT_ID_C = 0x43 // 'C'
const COMMENT_ID_O = 0x4f // 'O'
const COMMENT_ID_M = 0x4d // 'M'
const COMMENT_ID_N = 0x4e // 'N'
const COMMENT_ID_T = 0x54 // 'T'
export const COMMENT_SIZE = 64
export const COMMENT_ID_SIZE = 5 // "COMNT"

// ----------------------------------------------------------------------------
// SAUCE record field offsets, relative to the first byte of the 128-byte record.
// Layout per the SAUCE 00 specification:
//   ID(5) Version(2) Title(35) Author(20) Group(20) Date(8) FileSize(4, LE)
//   DataType(1) FileType(1) TInfo1..TInfo4(2 each, LE) Comments(1) TFlags(1)
//   TInfoS(22)  =  128 bytes
// ----------------------------------------------------------------------------
const OFFSET_ID = 0
const SAUCE_ID_SIZE = 5
const OFFSET_VERSION = 5
const OFFSET_TITLE = 7
const OFFSET_AUTHOR = 42
const OFFSET_GROUP = 62
const OFFSET_DATE = 82
const OFFSET_FILE_SIZE = 90
const OFFSET_DATA_TYPE = 94
const OFFSET_FILE_TYPE = 95
const OFFSET_TINFO1 = 96
const OFFSET_TINFO2 = 98
const OFFSET_TINFO3 = 100
const OFFSET_TINFO4 = 102
const OFFSET_COMMENTS = 104
const OFFSET_TFLAGS = 105
const OFFSET_TINFOS = 106
const TINFOS_SIZE = 22
const VERSION_SIZE = 2
const TITLE_SIZE = 35
const AUTHOR_SIZE = 20
const GROUP_SIZE = 20
const DATE_SIZE = 8

/**
 * Check if bytes contain a SAUCE trailer
 */
export function isSauceTrailer(bytes: Uint8Array): boolean {
	// Need at least 128 bytes for SAUCE + 1 for possible EOF
	if (bytes.length < SAUCE_TRAILER_SIZE + 1) return false
	// SAUCE header is 5 bytes: 'SAUCE' at offset length-128 (or length-129 if EOF present)
	// Check both positions (with and without EOF)
	const offWithEof = bytes.length - SAUCE_TRAILER_SIZE - 1
	const offWithoutEof = bytes.length - SAUCE_TRAILER_SIZE

	// Check position with EOF
	if (bytes[offWithEof] === SAUCE_EOF) {
		return (
			bytes[offWithEof + 1] === SAUCE_ID_S &&
			bytes[offWithEof + 2] === SAUCE_ID_A &&
			bytes[offWithEof + 3] === SAUCE_ID_U &&
			bytes[offWithEof + 4] === SAUCE_ID_C &&
			bytes[offWithEof + 5] === SAUCE_ID_E
		)
	}

	// Check position without EOF
	return (
		bytes[offWithoutEof] === SAUCE_ID_S &&
		bytes[offWithoutEof + 1] === SAUCE_ID_A &&
		bytes[offWithoutEof + 2] === SAUCE_ID_U &&
		bytes[offWithoutEof + 3] === SAUCE_ID_C &&
		bytes[offWithoutEof + 4] === SAUCE_ID_E
	)
}

/**
 * Parse SAUCE metadata from the 128-byte trailer
 * Follows PabloDraw's implementation
 * Returns undefined if no valid SAUCE data found
 */
export function parseSauce(bytes: Uint8Array): SauceMetadata | undefined {
	if (bytes.length < SAUCE_TRAILER_SIZE + 1) return undefined

	// The SAUCE record is always the final 128 bytes of the file
	const saucePos = bytes.length - SAUCE_TRAILER_SIZE

	// Verify SAUCE ID
	if (
		bytes[saucePos] !== SAUCE_ID_S ||
		bytes[saucePos + 1] !== SAUCE_ID_A ||
		bytes[saucePos + 2] !== SAUCE_ID_U ||
		bytes[saucePos + 3] !== SAUCE_ID_C ||
		bytes[saucePos + 4] !== SAUCE_ID_E
	) {
		return undefined
	}

	const dataView = new DataView(bytes.buffer, bytes.byteOffset + saucePos)

	// Read fixed-length space-padded strings (SAUCE format uses space padding, not null termination)
	// Following PabloDraw's implementation: read all bytes, convert to string, trim trailing whitespace
	function readString(offset: number, length: number): string {
		const charCodes: number[] = []
		for (let i = 0; i < length; i++) {
			const byte = bytes[saucePos + offset + i]
			charCodes.push(byte)
		}
		// Convert to string and trim trailing whitespace/null bytes (matching PabloDraw's TrimEnd)
		return String.fromCharCode(...charCodes)
			.replace(/\0+$/, '')
			.trimEnd()
	}

	const id = readString(OFFSET_ID, SAUCE_ID_SIZE)
	// Version is a 2-character ASCII field (e.g. "00" for version 0)
	const versionText = readString(OFFSET_VERSION, VERSION_SIZE)
	const parsedVersion = Number.parseInt(versionText, 10)
	const version = Number.isNaN(parsedVersion) ? 0 : parsedVersion

	const title = readString(OFFSET_TITLE, TITLE_SIZE)
	const author = readString(OFFSET_AUTHOR, AUTHOR_SIZE)
	const group = readString(OFFSET_GROUP, GROUP_SIZE)
	const date = readString(OFFSET_DATE, DATE_SIZE)

	// FileSize as recorded by the writer (4 bytes, little-endian)
	const declaredFileSize = dataView.getUint32(OFFSET_FILE_SIZE, true)

	const dataType = bytes[saucePos + OFFSET_DATA_TYPE]
	const fileType = bytes[saucePos + OFFSET_FILE_TYPE]

	const tInfo1 = dataView.getUint16(OFFSET_TINFO1, true) // Little-endian
	const tInfo2 = dataView.getUint16(OFFSET_TINFO2, true) // Little-endian
	const tInfo3 = dataView.getUint16(OFFSET_TINFO3, true) // UInt16, not byte!
	const tInfo4 = dataView.getUint16(OFFSET_TINFO4, true) // UInt16, not byte!

	const numComments = bytes[saucePos + OFFSET_COMMENTS] // Byte, not UInt16!
	const tFlags = bytes[saucePos + OFFSET_TFLAGS]

	// Read TInfoS (22 bytes, zero-terminated string)
	const tInfoSBytes = new Uint8Array(
		bytes.buffer,
		bytes.byteOffset + saucePos + OFFSET_TINFOS,
		TINFOS_SIZE
	)
	let tInfoSEnd = TINFOS_SIZE
	for (let i = 0; i < TINFOS_SIZE; i++) {
		if (tInfoSBytes[i] === 0) {
			tInfoSEnd = i
			break
		}
	}
	const tInfoS = String.fromCharCode(...Array.from(tInfoSBytes.slice(0, tInfoSEnd)))

	// Read comment lines - they come BEFORE the SAUCE record (with "COMNT" ID)
	const commentLines: string[] = []
	// Start of the artwork data's trailing metadata: the comment block when one is
	// present and valid, otherwise the SAUCE record itself
	let metadataStart = saucePos
	if (numComments > 0) {
		// Comments start before the SAUCE record
		// Position: saucePos - (numComments * COMMENT_SIZE) - COMMENT_ID_SIZE
		const commentStart = saucePos - numComments * COMMENT_SIZE - COMMENT_ID_SIZE

		if (commentStart >= 0) {
			// Check for "COMNT" ID
			if (
				bytes[commentStart] === COMMENT_ID_C &&
				bytes[commentStart + 1] === COMMENT_ID_O &&
				bytes[commentStart + 2] === COMMENT_ID_M &&
				bytes[commentStart + 3] === COMMENT_ID_N &&
				bytes[commentStart + 4] === COMMENT_ID_T
			) {
				metadataStart = commentStart
				// Read comments
				for (let i = 0; i < numComments && i < 255; i++) {
					const commentOffset = commentStart + COMMENT_ID_SIZE + i * COMMENT_SIZE
					if (commentOffset + COMMENT_SIZE > bytes.length) break
					const comment = readString(commentOffset - saucePos, COMMENT_SIZE)
					if (comment) {
						commentLines.push(comment)
					}
				}
			}
		}
	}

	// Calculate actual file size (excluding SAUCE, comments, and EOF).
	// The EOF marker sits immediately before the comment block (when present),
	// not immediately before the SAUCE record.
	const hasEof = metadataStart > 0 && bytes[metadataStart - 1] === SAUCE_EOF
	const actualFileSize = hasEof ? metadataStart - 1 : metadataStart

	return {
		id,
		version,
		title,
		author,
		group,
		date,
		fileSize: actualFileSize,
		declaredFileSize,
		dataType,
		fileType,
		tInfo1,
		tInfo2,
		tInfo3,
		tInfo4,
		comments: numComments,
		tFlags,
		tInfoS: tInfoS || undefined,
		commentLines,
	}
}

/**
 * Number of trailing bytes that are SAUCE metadata rather than artwork data:
 * the 128-byte record, any COMNT block and the EOF marker preceding them.
 * Returns 0 when the input carries no SAUCE trailer.
 * @param bytes - Full file bytes
 * @returns Byte count to strip from the end before parsing
 */
export function getSauceStripSize(bytes: Uint8Array): number {
	const sauce = parseSauce(bytes)
	if (!sauce) return 0
	return bytes.length - sauce.fileSize
}

function getFileTypeDescription(dataType: number, fileType: number): string {
	const descriptions: Record<number, Record<number, string>> = {
		0: {
			// Text files
			0: 'ASCII Text',
			1: 'ANSI Text',
			2: 'Ansimation',
			4: 'PCBoard',
			5: 'Avatar',
			6: 'HTML',
			7: 'Source Code',
			8: 'Tundra Draw',
		},
		1: {
			// Character art
			0: 'ASCII Character Art',
			1: 'ANSI Character Art',
			2: 'Ansimation',
			4: 'PCBoard Character Art',
			5: 'Avatar Character Art',
			6: 'HTML Character Art',
			7: 'Source Character Art',
			8: 'Tundra Draw Character Art',
		},
	}

	return descriptions[dataType]?.[fileType] || `Unknown (Type ${dataType}:${fileType})`
}

function getFontName(fontId: number): string {
	const fonts: Record<number, string> = {
		0: 'Default',
		1: 'Courier New',
		2: 'Terminal',
		3: 'Fixedsys',
		4: 'System',
		5: 'IBM VGA',
		6: 'IBM VGA50',
		7: 'IBM VGA25',
		8: 'IBM EGA',
		9: 'IBM EGA43',
		10: 'Amiga Topaz 1',
		11: 'Amiga Topaz 2',
		12: 'Amiga P0T-NOoDLE',
		13: 'Amiga MicroKnight',
		14: 'Amiga MicroKnight Plus',
		15: "Amiga mO'sOul",
	}

	return fonts[fontId] || `Font ${fontId}`
}

function getAspectRatio(flags: number): { width: number; height: number } | undefined {
	// Aspect ratio is encoded in flags for some formats
	// This is a simplified interpretation
	const aspectRatios: Record<number, { width: number; height: number }> = {
		0: { width: 1, height: 1 }, // Square pixels
		1: { width: 4, height: 3 }, // 4:3 aspect
		2: { width: 5, height: 4 }, // 5:4 aspect
		3: { width: 16, height: 9 }, // 16:9 widescreen
	}

	return aspectRatios[flags] || { width: 1, height: 1 }
}

/**
 * Enhanced SAUCE metadata interpretation
 */
export function getSauceInfo(sauce: SauceMetadata | undefined) {
	if (!sauce) return null

	const info = {
		...sauce,
		// Interpret data types
		fileTypeDescription: getFileTypeDescription(sauce.dataType, sauce.fileType),
		// Check if file has valid dimensions
		hasDimensions:
			sauce.dataType === 1 &&
			[1, 2].includes(sauce.fileType) &&
			sauce.tInfo1 > 0 &&
			sauce.tInfo2 > 0,
		// Get dimensions if available
		width: sauce.tInfo1 || undefined,
		height: sauce.tInfo2 || undefined,
		// Font information (for ANSI files)
		fontName:
			sauce.dataType === 1 && [1, 2].includes(sauce.fileType)
				? getFontName(sauce.tInfo3)
				: undefined,
		// ICE colors flag
		iceColors: (sauce.tFlags & 1) !== 0,
		// Letter spacing (aspect ratio)
		letterSpacing: (sauce.tFlags & 2) !== 0,
		// Aspect ratio information
		aspectRatio:
			sauce.dataType === 1 && [1, 2].includes(sauce.fileType)
				? getAspectRatio(sauce.tInfo4)
				: undefined,
	}

	return info
}
