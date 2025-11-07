import type { AnsiScreen } from './ansiParser'
import type { PaletteMode } from './rgbToAnsi'

export interface RGBAColor {
	r: number // 0-255
	g: number // 0-255
	b: number // 0-255
	a: number // 0-255 (alpha/opacity)
}

export type FrameData = {
	width: number
	height: number
	pixels: Uint8Array // RGB format: 3 bytes per pixel (r, g, b)
}

export type FrameGenerator = (frame: number, width: number, height: number) => FrameData

export type FrameConverter = (
	frameData: FrameData,
	columns: number,
	rows: number,
	palette?: PaletteMode
) => AnsiScreen

export type CharacterFrameGenerator = (frame: number, columns: number, rows: number) => AnsiScreen

export type PixelFrameGenerator = {
	generator: FrameGenerator
	converter: FrameConverter
}

export type DisplayFrameGenerator = CharacterFrameGenerator | PixelFrameGenerator

// Virtual viewport configuration for windowed rendering
export type ViewportConfig = {
	// Full virtual world size in character cells
	virtualColumns: number
	virtualRows: number
	// Top-left of the viewport within the virtual world (character coords)
	viewX: number
	viewY: number
}
