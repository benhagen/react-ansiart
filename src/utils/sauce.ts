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
	/** Original file size */
	fileSize: number
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

	// Find SAUCE position - check for EOF byte (0x1A) before SAUCE
	let saucePos = bytes.length - SAUCE_TRAILER_SIZE
	let hasEof = false

	// Check if there's an EOF byte before SAUCE
	if (bytes.length >= SAUCE_TRAILER_SIZE + 1) {
		const eofPos = bytes.length - SAUCE_TRAILER_SIZE - 1
		if (bytes[eofPos] === SAUCE_EOF) {
			hasEof = true
			saucePos = eofPos + 1
		}
	}

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

	const id = readString(0, 5)
	// Version is 2 bytes (e.g., "00" for version 0)
	const version = bytes[saucePos + 5] // First byte is major version, second byte is minor (we'll just use first)

	const title = readString(7, 35) // Offset 7 (after 5-byte ID + 2-byte version)
	const author = readString(42, 20) // Offset 42 (7 + 35)
	const group = readString(62, 20) // Offset 62 (42 + 20)
	const date = readString(82, 8) // Offset 82 (62 + 20)

	const fileSize = dataView.getUint32(89, true) // Little-endian (offset 89 = 82 + 8 - 1, but actually 89)

	const dataType = bytes[saucePos + 93]
	const fileType = bytes[saucePos + 94]

	const tInfo1 = dataView.getUint16(95, true) // Little-endian
	const tInfo2 = dataView.getUint16(97, true) // Little-endian
	const tInfo3 = dataView.getUint16(99, true) // UInt16, not byte!
	const tInfo4 = dataView.getUint16(101, true) // UInt16, not byte!

	const numComments = bytes[saucePos + 103] // Byte, not UInt16!
	const tFlags = bytes[saucePos + 104]

	// Read TInfoS (22 bytes, zero-terminated string) - offset 105 (103 + 1 + 1)
	const tInfoSBytes = new Uint8Array(bytes.buffer, bytes.byteOffset + saucePos + 105, 22)
	let tInfoSEnd = 22
	for (let i = 0; i < 22; i++) {
		if (tInfoSBytes[i] === 0) {
			tInfoSEnd = i
			break
		}
	}
	const tInfoS = String.fromCharCode(...Array.from(tInfoSBytes.slice(0, tInfoSEnd)))

	// Read comment lines - they come BEFORE the SAUCE header (with "COMNT" ID)
	const commentLines: string[] = []
	if (numComments > 0) {
		// Comments start before SAUCE header
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

	// Calculate actual file size (excluding SAUCE, comments, and EOF)
	let actualFileSize = bytes.length - SAUCE_TRAILER_SIZE
	if (numComments > 0) {
		actualFileSize -= COMMENT_ID_SIZE + numComments * COMMENT_SIZE
	}
	if (hasEof) {
		actualFileSize -= 1
	}

	return {
		id,
		version,
		title,
		author,
		group,
		date,
		fileSize: actualFileSize,
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

function getFileTypeDescription(dataType: number, fileType: number): string {
	const descriptions: Record<number, Record<number, string>> = {
		0: {
			// Text files
			0: 'ASCII Text',
			1: 'ANSI Text',
			2: 'Ansimation',
			3: 'RIP Script',
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
			3: 'RIP Character Art',
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
