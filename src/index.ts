export { AnsiArt } from './AnsiArt'
export type { AnsiArtProps } from './AnsiArt'

export { AnsiArtNG } from './AnsiArtNG'
export type { AnsiArtNGProps } from './AnsiArtNG'

export { AnsiVirtualDisplay } from './AnsiVirtualDisplay'
export type { AnsiVirtualDisplayProps } from './AnsiVirtualDisplay'

export { AnsiPlayerOverlay } from './AnsiPlayerOverlay'
export type { AnsiPlayerOverlayProps } from './AnsiPlayerOverlay'

export { PlasmaBackgroundLayout } from './PlasmaBackgroundLayout'
export type { PlasmaBackgroundLayoutProps } from './PlasmaBackgroundLayout'

export { FontCharacterChart } from './FontCharacterChart'
export type { FontCharacterChartProps } from './FontCharacterChart'

export { loadBitmapFontFromUrl } from './font/bitmapFontLoader'
export type { BitmapFont } from './font/bitmapFont'
export { loadRawBitmapFont, renderGlyph, renderText } from './font/bitmapFont'
export { extractFontFromFON, type FontExtractionResult } from './font/fonExtractor'

export { drawPerformanceOverlay, type PerformanceStats } from './utils/performanceOverlay'

export {
	ANSI_COLORS_RGB,
	generateEvenlySpacedPalette,
	getPalette,
	rgbToAnsiColor,
	rgbToPaletteColor,
} from './rgbToAnsi'
export type { PaletteMode } from './rgbToAnsi'

export { parseSauce, detectAnimation, getSauceInfo, parseAscii } from './ansiParser'
export type { SauceMetadata, CharacterEncoding } from './ansiParser'

export { convertFrameDataToAnsi } from './frameToAnsi'

export {
	createAsciiPerlinPlasmaSampler,
	generateAsciiPerlinPlasmaFrame,
} from './generators/asciiPerlinPlasmaGenerator'
export type {
	AsciiPerlinPlasmaOptions,
	OctaveConfig,
} from './generators/asciiPerlinPlasmaGenerator'

export {
	createAnsiArtFrameGenerator,
	createAnsiFrameGenerator,
} from './generators/ansiFrameGenerator'
export type {
	AnsiArtFrameGeneratorOptions,
	AnsiFrameGeneratorOptions,
} from './generators/ansiFrameGenerator'

export type {
	CharacterFrameGenerator,
	CharacterFrameGeneratorWithMetadata,
	DisplayFrameGenerator,
	FrameConverter,
	FrameData,
	FrameGenerator,
	GeneratorCapabilities,
	PixelFrameGenerator,
	RGBAColor,
	ViewportConfig,
} from './types'
