export { AnsiArt } from './components/AnsiArt'
export type { AnsiArtProps } from './components/AnsiArt'

export { AnsiVirtualDisplay } from './components/AnsiVirtualDisplay'
export type { AnsiVirtualDisplayProps } from './components/AnsiVirtualDisplay'

export { AnsiPlayerOverlay } from './components/AnsiPlayerOverlay'
export type { AnsiPlayerOverlayProps } from './components/AnsiPlayerOverlay'

export { PlasmaBackgroundLayout, GeneratorBackgroundLayout } from './components/PlasmaBackgroundLayout'
export type { PlasmaBackgroundLayoutProps, GeneratorBackgroundLayoutProps } from './components/PlasmaBackgroundLayout'

export { FontCharacterChart } from './components/FontCharacterChart'
export type { FontCharacterChartProps } from './components/FontCharacterChart'

export { loadRawBitmapFont, renderGlyph, renderText } from './font/bitmapFont'
export type { BitmapFont } from './font/bitmapFont'
export { loadBitmapFontFromUrl } from './font/bitmapFontLoader'
export { extractFontFromFON, type FontExtractionResult } from './font/fonExtractor'
export { clearFontCache } from './font/fontCache'
export { getEmbeddedVgaFont } from './font/embeddedVgaFont'

export { drawPerformanceOverlay, type PerformanceStats } from './utils/performanceOverlay'

export {
	ANSI_COLORS_RGB,
	generateEvenlySpacedPalette,
	getPalette,
	rgbToAnsiColor,
	rgbToPaletteColor,
} from './utils/rgbToAnsi'
export type { PaletteMode } from './utils/rgbToAnsi'

export type { AnsiCell, AnsiScreen } from './ansi/types'
export { detectAnimation, parseAnsi, parseAscii } from './ansi/parser'
export type { CharacterEncoding } from './ansi/parser'
export { getSauceInfo, parseSauce } from './utils/sauce'
export type { SauceMetadata } from './utils/sauce'

export { convertFrameDataToAnsi } from './ansi/frameToAnsi'
export { createShapeConverter, SHAPE_CHAR_PRESETS } from './ansi/shapeAsciiConverter'
export type { ShapeConverterOptions, ShapeCharPreset } from './ansi/shapeAsciiConverter'

export {
	createAsciiPerlinPlasmaSampler,
	generateAsciiPerlinPlasmaFrame,
} from './generators/asciiPerlinPlasmaGenerator'
export type {
	AsciiPerlinPlasmaOptions,
	OctaveConfig,
} from './generators/asciiPerlinPlasmaGenerator'

export {
	createAsciiSonarSampler,
	generateAsciiSonarFrame,
} from './generators/asciiSonarFrameGenerator'
export type { AsciiSonarOptions } from './generators/asciiSonarFrameGenerator'

export {
	clearFireState,
	createAsciiFireSampler,
	generateAsciiFireFrame,
} from './generators/asciiFireGenerator'
export type { AsciiFireOptions } from './generators/asciiFireGenerator'

export {
	clearDatamoshState,
	createAsciiDatamoshSampler,
	generateAsciiDatamoshFrame,
} from './generators/asciiDatamoshGenerator'
export type { AsciiDatamoshOptions } from './generators/asciiDatamoshGenerator'

export {
	createAsciiMetaballsSampler,
	generateAsciiMetaballsFrame,
} from './generators/asciiMetaballsGenerator'
export type { AsciiMetaballsOptions } from './generators/asciiMetaballsGenerator'

export {
	clearMatrixRainState,
	createAsciiMatrixRainSampler,
	generateAsciiMatrixRainFrame,
} from './generators/asciiMatrixRainGenerator'
export type { AsciiMatrixRainOptions } from './generators/asciiMatrixRainGenerator'

export {
	clearStarfieldState,
	createAsciiStarfieldSampler,
	generateAsciiStarfieldFrame,
} from './generators/asciiStarfieldGenerator'
export type { AsciiStarfieldOptions } from './generators/asciiStarfieldGenerator'

export {
	generateAsciiTunnelFrame,
} from './generators/asciiTunnelGenerator'
export type { AsciiTunnelOptions } from './generators/asciiTunnelGenerator'

export {
	clearGameOfLifeState,
	createAsciiGameOfLifeSampler,
	generateAsciiGameOfLifeFrame,
} from './generators/asciiGameOfLifeGenerator'
export type { AsciiGameOfLifeOptions } from './generators/asciiGameOfLifeGenerator'

export {
	clearWaterRippleState,
	createAsciiWaterRippleSampler,
	generateAsciiWaterRippleFrame,
} from './generators/asciiWaterRippleGenerator'
export type { AsciiWaterRippleOptions } from './generators/asciiWaterRippleGenerator'

export {
	generateAsciiMandelbrotFrame,
	generateMandelbrotPixels,
} from './generators/asciiMandelbrotGenerator'
export type { AsciiMandelbrotOptions } from './generators/asciiMandelbrotGenerator'

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
