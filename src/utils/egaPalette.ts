// Extended EGA palette RGB values generated from the canonical 6-bit hardware encoding.
// Conversion formula from https://moddingwiki.shikadi.net/wiki/EGA_Palette
function toHex(component: number): string {
	return component.toString(16).padStart(2, '0').toUpperCase()
}

function egaRed(index: number): number {
	return 85 * (((index >> 1) & 0x2) | ((index >> 5) & 0x1))
}

function egaGreen(index: number): number {
	return 85 * ((index & 0x2) | ((index >> 4) & 0x1))
}

function egaBlue(index: number): number {
	return 85 * (((index << 1) & 0x2) | ((index >> 3) & 0x1))
}

function egaIndexToColor(index: number): string {
	const red = egaRed(index)
	const green = egaGreen(index)
	const blue = egaBlue(index)
	return `#${toHex(red)}${toHex(green)}${toHex(blue)}`
}

export const EGA_PALETTE_RGB: string[] = Array.from({ length: 64 }, (_, i) => egaIndexToColor(i))
