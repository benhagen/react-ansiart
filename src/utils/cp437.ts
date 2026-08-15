// CP437 (IBM PC / "OEM-US") code page conversion utilities.
//
// The mapping below is the complete, standard CP437 -> Unicode table. It matters that it
// is complete AND that it is a bijection: the render path converts bytes to characters on
// the way in (parser) and characters back to bytes on the way out (bitmap glyph lookup).
// Any two bytes sharing a Unicode codepoint would make the reverse lookup ambiguous and
// silently render the wrong glyph.

/** CP437 glyphs for bytes 0x00-0x1F (the "control" range has printable forms in CP437). */
const CP437_CONTROL_GLYPHS = '\u0000☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼'

/** CP437 glyphs for bytes 0x7F-0xFF. Byte 0xFF is a non-breaking space. */
const CP437_HIGH_GLYPHS =
	'⌂ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ '

function buildTable(): string[] {
	const table = new Array<string>(256)
	for (let i = 0x00; i <= 0x1f; i++) table[i] = CP437_CONTROL_GLYPHS[i]
	for (let i = 0x20; i <= 0x7e; i++) table[i] = String.fromCharCode(i)
	for (let i = 0x7f; i <= 0xff; i++) table[i] = CP437_HIGH_GLYPHS[i - 0x7f]
	return table
}

/**
 * Complete CP437 byte -> Unicode character table, indexed by byte value.
 * Every entry is a single distinct character, so the mapping is reversible.
 */
export const CP437_TO_UNICODE: readonly string[] = buildTable()

/**
 * Convert a CP437 byte to its printable glyph, ignoring any control-character meaning.
 * Use this when the byte is known to represent a glyph rather than a control code.
 */
export function cp437ByteToGlyph(byte: number): string {
	return CP437_TO_UNICODE[byte & 0xff]
}

/**
 * Convert a CP437 byte to a character for text/stream decoding.
 *
 * Bytes that carry control meaning in an ANSI art stream keep that meaning here:
 * LF and CR stay line terminators and TAB becomes a space (BBS convention). Other
 * C0 bytes are dropped. For the raw glyph forms use {@link cp437ByteToGlyph}.
 */
export function cp437ByteToChar(byte: number): string {
	// Handle control bytes explicitly
	if (byte === 0x0a) return '\n' // LF
	if (byte === 0x0d) return '\r' // CR
	if (byte === 0x09) return ' ' // TAB -> space (BBS convention)
	if (byte < 0x20) return '' // ignore other control chars

	return CP437_TO_UNICODE[byte & 0xff]
}

export function decodeCp437(bytes: Uint8Array): string {
	let out = ''
	for (let i = 0; i < bytes.length; i++) {
		out += cp437ByteToChar(bytes[i])
	}
	return out
}

// Reverse mapping: Unicode -> CP437 byte (for bitmap font glyph lookup).
// Built from the full table, so it round-trips every byte exactly.
const unicodeToCp437Map: Map<string, number> = new Map()

function buildReverseMap() {
	if (unicodeToCp437Map.size > 0) return
	for (let i = 0; i < 256; i++) {
		unicodeToCp437Map.set(CP437_TO_UNICODE[i], i)
	}
}

/**
 * Convert a Unicode character back to its CP437 byte code.
 * Falls back to the code point for unmapped characters in the byte range, else space.
 */
export function charToCp437Byte(ch: string): number {
	if (!ch || ch.length === 0) return 32 // space
	buildReverseMap()
	const mapped = unicodeToCp437Map.get(ch)
	if (mapped !== undefined) return mapped
	// Fallback to character code for ASCII range
	const code = ch.charCodeAt(0)
	return code < 256 ? code : 32 // fallback to space for unmapped chars
}
