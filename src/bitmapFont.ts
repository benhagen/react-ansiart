// Bitmap font loader and renderer for VGA-style fonts
// Supports raw binary bitmap data (8x16 VGA format)

export type BitmapFont = {
	width: number
	height: number
	glyphs: Uint8Array[] // Array of 256 glyphs, each is height bytes (1 byte per row)
	rawBitmapData?: Uint8Array // Optional raw bitmap data for debugging
}

/**
 * Load a raw binary bitmap font (8xN format, 256 glyphs)
 * Expected format: 256 consecutive glyphs, each N bytes (one byte per scanline)
 */
export async function loadRawBitmapFont(url: string, width = 8, height = 16): Promise<BitmapFont> {
	const response = await fetch(url)
	if (!response.ok) throw new Error(`Failed to load font: ${response.status}`)
	const buffer = await response.arrayBuffer()
	const bytes = new Uint8Array(buffer)

	const bytesPerGlyph = height
	const expectedSize = 256 * bytesPerGlyph

	// Try to find the font data in the file (might be in a .FON wrapper)
	let offset = 0

	// Simple heuristic: look for repeating pattern that looks like font data
	// VGA fonts typically start at specific offsets in .FON files
	// Common offsets: 0x0436, 0x1036, but we'll search
	if (bytes.length > expectedSize) {
		// Search for likely font data start - look for null glyph pattern at char 0
		for (let i = 0; i < bytes.length - expectedSize; i++) {
			// Check if this looks like a valid font start (first glyph usually empty or specific pattern)
			const slice = bytes.slice(i, i + expectedSize)
			// Simple validation: check if data looks reasonably distributed
			let nonZero = 0
			for (let j = 0; j < Math.min(1000, slice.length); j++) {
				if (slice[j] !== 0) nonZero++
			}
			// If we have some data but not all zeros, this might be font data
			if (nonZero > 100 && nonZero < 900) {
				offset = i
				break
			}
		}
	}

	const fontData = bytes.slice(offset, offset + expectedSize)
	if (fontData.length < expectedSize) {
		throw new Error(`Font file too small: ${fontData.length} < ${expectedSize}`)
	}

	const glyphs: Uint8Array[] = []
	for (let i = 0; i < 256; i++) {
		const start = i * bytesPerGlyph
		glyphs.push(fontData.slice(start, start + bytesPerGlyph))
	}

	return { width, height, glyphs }
}

/**
 * Render a single glyph to a canvas context (pixel-perfect, no scaling)
 */
export function renderGlyph(
	ctx: CanvasRenderingContext2D,
	font: BitmapFont,
	charCode: number,
	x: number,
	y: number,
	fgColor: string,
	bgColor: string
) {
	const glyph = font.glyphs[charCode] || font.glyphs[0]

	// Fill background
	ctx.fillStyle = bgColor
	ctx.fillRect(x, y, font.width, font.height)

	// Draw foreground pixels (1:1 pixel mapping)
	ctx.fillStyle = fgColor
	for (let row = 0; row < font.height; row++) {
		const byte = glyph[row]
		// Bits are stored MSB first (bit 7 = leftmost pixel, bit 0 = rightmost)
		for (let col = 0; col < font.width; col++) {
			const bit = 7 - col
			if (byte & (1 << bit)) {
				ctx.fillRect(x + col, y + row, 1, 1)
			}
		}
	}
}

/**
 * Render text string using bitmap font
 */
export function renderText(
	ctx: CanvasRenderingContext2D,
	font: BitmapFont,
	text: string,
	x: number,
	y: number,
	fgColor: string,
	bgColor: string
): number {
	let xPos = x
	for (let i = 0; i < text.length; i++) {
		const charCode = text.charCodeAt(i)
		renderGlyph(ctx, font, charCode, xPos, y, fgColor, bgColor)
		xPos += font.width
	}
	return xPos - x // return width rendered
}

