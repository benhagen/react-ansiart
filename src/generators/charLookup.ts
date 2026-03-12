/**
 * Build a 256-entry character lookup table mapping brightness values (0-255)
 * to characters from the given set.
 */
export function buildCharLookup(chars: string[]): string[] {
	const charCount = chars.length
	const lookup = new Array(256)
	for (let i = 0; i < 256; i++) {
		const t = i / 255
		lookup[i] = chars[Math.floor(t * (charCount - 0.001))]
	}
	return lookup
}
