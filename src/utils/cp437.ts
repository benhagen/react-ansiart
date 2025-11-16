// Minimal CP437 decoding utilities focused on ANSI art use-cases (blocks/box-drawing)

// Reverse mapping: Unicode -> CP437 byte (for bitmap font rendering)
const unicodeToCp437Map: Map<string, number> = new Map()

export function cp437ByteToChar(byte: number): string {
	// Handle control bytes explicitly
	if (byte === 0x0a) return '\n' // LF
	if (byte === 0x0d) return '\r' // CR
	if (byte === 0x09) return ' ' // TAB -> space (BBS convention)
	if (byte < 0x20) return '' // ignore other control chars

	// Common box-drawing and block elements used in ANSI art
	switch (byte) {
		// Light/medium/dark shade
		case 0xb0:
			return '\u2591' // ░
		case 0xb1:
			return '\u2592' // ▒
		case 0xb2:
			return '\u2593' // ▓

		// Box drawing single
		case 0xb3:
			return '\u2502' // │
		case 0xb4:
			return '\u2524' // ┤
		case 0xbf:
			return '\u2510' // ┐
		case 0xc0:
			return '\u2514' // └
		case 0xc1:
			return '\u2534' // ┴
		case 0xc2:
			return '\u252c' // ┬
		case 0xc3:
			return '\u251c' // ├
		case 0xc4:
			return '\u2500' // ─
		case 0xc5:
			return '\u253c' // ┼
		case 0xc7:
			return '\u251c' // ├ (approx)
		case 0xc8:
			return '\u2514' // └ (approx)
		case 0xc9:
			return '\u250c' // ┌
		case 0xca:
			return '\u252c' // ┬ (approx)
		case 0xcb:
			return '\u252c' // ┬ (approx)
		case 0xcc:
			return '\u251c' // ├ (approx)
		case 0xcd:
			return '\u2500' // ─ (double maps to single for compatibility)
		case 0xce:
			return '\u253c' // ┼ (approx)
		case 0xd9:
			return '\u2518' // ┘
		case 0xda:
			return '\u250c' // ┌

		// Block elements
		case 0xdb:
			return '\u2588' // █ full block
		case 0xdc:
			return '\u2584' // ▄ lower half block
		case 0xdd:
			return '\u258c' // ▌ left half block
		case 0xde:
			return '\u2590' // ▐ right half block
		case 0xdf:
			return '\u2580' // ▀ upper half block

		// Other commonly seen
		case 0xfe:
			return '\u25a0' // ■ black square
	}

	// ASCII range and most others map directly
	return String.fromCharCode(byte)
}

export function decodeCp437(bytes: Uint8Array): string {
	let out = ''
	for (let i = 0; i < bytes.length; i++) {
		out += cp437ByteToChar(bytes[i])
	}
	return out
}

// Build reverse mapping on first use
function buildReverseMap() {
	if (unicodeToCp437Map.size > 0) return
	for (let i = 0; i < 256; i++) {
		const ch = cp437ByteToChar(i)
		if (ch && ch !== '') {
			unicodeToCp437Map.set(ch, i)
		}
	}
}

/**
 * Convert a Unicode character back to its CP437 byte code
 * Returns the character code point if no CP437 mapping exists
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
