export { AnsiArt } from './components/AnsiArt'
export type { AnsiArtProps } from './components/AnsiArt'

export { RipArt } from './components/RipArt'
export type { RipArtProps } from './components/RipArt'

export { AnsiVirtualDisplay } from './components/AnsiVirtualDisplay'
export type { AnsiVirtualDisplayProps } from './components/AnsiVirtualDisplay'

export { AnsiPlayerOverlay } from './components/AnsiPlayerOverlay'
export type { AnsiPlayerOverlayProps } from './components/AnsiPlayerOverlay'

export { PlasmaBackgroundLayout } from './components/PlasmaBackgroundLayout'
export type { PlasmaBackgroundLayoutProps } from './components/PlasmaBackgroundLayout'

export { FontCharacterChart } from './components/FontCharacterChart'
export type { FontCharacterChartProps } from './components/FontCharacterChart'

export { loadRawBitmapFont, renderGlyph, renderText } from './font/bitmapFont'
export type { BitmapFont } from './font/bitmapFont'
export { loadBitmapFontFromUrl } from './font/bitmapFontLoader'
export { extractFontFromFON, type FontExtractionResult } from './font/fonExtractor'
export { clearFontCache } from './font/fontCache'

export { drawPerformanceOverlay, type PerformanceStats } from './utils/performanceOverlay'

export {
	ANSI_COLORS_RGB,
	generateEvenlySpacedPalette,
	getPalette,
	rgbToAnsiColor,
	rgbToPaletteColor,
} from './utils/rgbToAnsi'
export type { PaletteMode } from './utils/rgbToAnsi'

export { detectAnimation, parseAnsi, parseAscii } from './ansi/parser'
export type { CharacterEncoding } from './ansi/parser'
export { parseRip } from './rip/parser'
export type {
	AnyRipCommand,
	Direction,
	FillStyle,
	FontStyle,
	LineStyle,
	Point,
	Rectangle,
	RipState,
	Size,
	WriteMode,
} from './rip/types'
export { getSauceInfo, parseSauce } from './utils/sauce'
export type { SauceMetadata } from './utils/sauce'

export { convertFrameDataToAnsi } from './ansi/frameToAnsi'

export {
	createAsciiPerlinPlasmaSampler,
	generateAsciiPerlinPlasmaFrame,
} from './generators/asciiPerlinPlasmaGenerator'
export type {
	AsciiPerlinPlasmaOptions,
	OctaveConfig,
} from './generators/asciiPerlinPlasmaGenerator'

export {
	clearFireState,
	createAsciiFireSampler,
	generateAsciiFireFrame,
} from './generators/asciiFireGenerator'
export type { AsciiFireOptions } from './generators/asciiFireGenerator'

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
} from './types/types'
