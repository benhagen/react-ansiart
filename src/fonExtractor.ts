// Extract bitmap font data from Windows .FON files
// .FON files are NE (New Executable) format containing FNT resources

export async function extractFontFromFON(url: string): Promise<Uint8Array | null> {
	const response = await fetch(url)
	if (!response.ok) throw new Error(`Failed to load FON: ${response.status}`)
	const buffer = await response.arrayBuffer()
	const bytes = new Uint8Array(buffer)

	// Check for MZ header (DOS executable)
	if (bytes[0] !== 0x4d || bytes[1] !== 0x5a) {
		// Not a .FON file, might be raw bitmap data
		return bytes
	}

	// Get NE header offset from MZ header at offset 0x3C
	const neOffset = bytes[0x3c] | (bytes[0x3d] << 8)

	// Verify NE signature
	if (bytes[neOffset] !== 0x4e || bytes[neOffset + 1] !== 0x45) {
		return null
	}

	// NE header structure:
	// +0x24: Resource table offset (from NE header start)
	const resTableOffset = neOffset + (bytes[neOffset + 0x24] | (bytes[neOffset + 0x25] << 8))

	// Resource table format:
	// +0: Alignment shift count (2 bytes)
	// +2: Resource type entries
	const alignShift = bytes[resTableOffset] | (bytes[resTableOffset + 1] << 8)

	let pos = resTableOffset + 2

	// Search for font resources (type ID 0x8008)
	while (pos < bytes.length - 8) {
		const typeId = bytes[pos] | (bytes[pos + 1] << 8)

		if (typeId === 0) {
			break // End of resource table
		}

		const count = bytes[pos + 2] | (bytes[pos + 3] << 8)
		pos += 8 // Skip type header

		if (typeId === 0x8008) {
			// Found font resource
			if (count > 0) {
				// Get first font resource
				const fontResOffset = (bytes[pos] | (bytes[pos + 1] << 8)) << alignShift
				const fontResLength = (bytes[pos + 2] | (bytes[pos + 3] << 8)) << alignShift

				// Extract FNT data
				const fntData = bytes.slice(fontResOffset, fontResOffset + fontResLength)

				// Parse FNT header to find bitmap data
				const dfPixHeight = fntData[0x58] | (fntData[0x59] << 8)
				const dfFirstChar = fntData[0x5f]
				const dfLastChar = fntData[0x60]

				// For fixed-width VGA fonts: bitmap is stored sequentially after header + character table
				const charTableStart = 117
				const charCount = dfLastChar - dfFirstChar + 1
				const charTableSize = charCount * 4 // Each entry is 4 bytes

				// Bitmap starts after header (117) + character table
				// Try to find correct offset by checking alignment of known characters
				const baseOffset = charTableStart + charTableSize
				let bitmapOffset = baseOffset

				// Test offsets around the base to find best alignment
				// Check multiple known characters:
				// - char 32 (space) should be all zeros
				// - char 65 (A) should have 5-7 blank rows then data
				// - char 219 (0xDB, full block █) should be all 0xFF (all pixels on)
				let bestOffset = baseOffset
				let bestScore = -1

				for (let adj = -16; adj <= 16; adj++) {
					const testOffset = baseOffset + adj
					if (testOffset < 0 || fntData.length < testOffset + 4096) continue

					let score = 0

					// Check char 32 (space) - should be all zeros
					const testChar32 = fntData.slice(testOffset + 32 * 16, testOffset + 32 * 16 + 16)
					const spaceNonZero = testChar32.filter(b => b !== 0).length
					if (spaceNonZero === 0) {
						score += 20 // Perfect match: space is all zeros
					} else if (spaceNonZero <= 2) {
						score += 10 // Mostly zeros, acceptable
					} else {
						continue // Space should not have data
					}

					// Check char 65 (A) - should have 5-7 blank rows then data
					const testChar65 = fntData.slice(testOffset + 65 * 16, testOffset + 65 * 16 + 16)
					const firstNonZero = testChar65.findIndex(b => b !== 0)
					if (firstNonZero >= 5 && firstNonZero <= 7) {
						score += 15 - Math.abs(firstNonZero - 6) // Prefer exactly 6 blank rows
						// Bonus if the first data byte looks reasonable
						if (testChar65[firstNonZero] >= 0x10 && testChar65[firstNonZero] <= 0x80) {
							score += 5
						}
					} else {
						score -= 10 // A should have proper structure
					}

					// Check char 219 (0xDB, full block █) - should be all 0xFF
					const testChar219 = fntData.slice(testOffset + 219 * 16, testOffset + 219 * 16 + 16)
					const allFF = testChar219.every(b => b === 0xff)
					if (allFF) {
						score += 25 // Perfect: full block is all 0xFF
					} else {
						const nonFF = testChar219.filter(b => b !== 0xff).length
						if (nonFF <= 2) {
							score += 10 // Mostly 0xFF, acceptable
						} else {
							score -= 15 // Full block should be solid
						}
					}

					if (score > bestScore) {
						bestScore = score
						bestOffset = testOffset
					}
				}

				bitmapOffset = bestOffset

				// Check if bitmap is within FNT data
				if (fntData.length >= bitmapOffset + 4096) {
					return fntData.slice(bitmapOffset, bitmapOffset + 4096)
				}

				// If bitmap isn't in FNT data, it might be after the FNT resource in the main file
				// Try reading from the main file at fontResOffset + bitmapOffset
				const absoluteBitmapOffset = fontResOffset + bitmapOffset
				if (bytes.length >= absoluteBitmapOffset + 4096) {
					return bytes.slice(absoluteBitmapOffset, absoluteBitmapOffset + 4096)
				}

				return null
			}
		}

		// Skip resource entries
		pos += count * 12
	}

	return null
}
