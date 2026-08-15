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

export {
	CP437_TO_UNICODE,
	charToCp437Byte,
	cp437ByteToChar,
	cp437ByteToGlyph,
	decodeCp437,
} from './utils/cp437'

export type { AnsiCell, AnsiScreen } from './ansi/types'
export { createAnsiParseSession, detectAnimation, parseAnsi, parseAscii } from './ansi/parser'
export type { AnsiParseSession, CharacterEncoding } from './ansi/parser'
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
	createAsciiFireGenerator,
	createAsciiFireSampler,
	generateAsciiFireFrame,
} from './generators/asciiFireGenerator'
export type { AsciiFireOptions } from './generators/asciiFireGenerator'

export {
	clearDatamoshState,
	createAsciiDatamoshGenerator,
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
	createAsciiMatrixRainGenerator,
	createAsciiMatrixRainSampler,
	generateAsciiMatrixRainFrame,
} from './generators/asciiMatrixRainGenerator'
export type { AsciiMatrixRainOptions } from './generators/asciiMatrixRainGenerator'

export {
	clearStarfieldState,
	createAsciiStarfieldGenerator,
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
	createAsciiGameOfLifeGenerator,
	createAsciiGameOfLifeSampler,
	generateAsciiGameOfLifeFrame,
} from './generators/asciiGameOfLifeGenerator'
export type { AsciiGameOfLifeOptions } from './generators/asciiGameOfLifeGenerator'

export {
	clearWaterRippleState,
	createAsciiWaterRippleGenerator,
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

export {
	createAsciiCopperBarsSampler,
	generateAsciiCopperBarsFrame,
} from './generators/asciiCopperBarsGenerator'
export type { AsciiCopperBarsOptions } from './generators/asciiCopperBarsGenerator'

export {
	createAsciiCrtStaticSampler,
	generateAsciiCrtStaticFrame,
} from './generators/asciiCrtStaticGenerator'
export type { AsciiCrtStaticOptions } from './generators/asciiCrtStaticGenerator'

export {
	createAsciiAuroraBorealisSampler,
	generateAsciiAuroraBorealisFrame,
} from './generators/asciiAuroraBorealisGenerator'
export type { AsciiAuroraBorealisOptions } from './generators/asciiAuroraBorealisGenerator'

export {
	clearReactionDiffusionState,
	createAsciiReactionDiffusionGenerator,
	createAsciiReactionDiffusionSampler,
	generateAsciiReactionDiffusionFrame,
} from './generators/asciiReactionDiffusionGenerator'
export type { AsciiReactionDiffusionOptions } from './generators/asciiReactionDiffusionGenerator'

export {
	createAsciiTerrainFlyoverSampler,
	generateAsciiTerrainFlyoverFrame,
} from './generators/asciiTerrainFlyoverGenerator'
export type { AsciiTerrainFlyoverOptions } from './generators/asciiTerrainFlyoverGenerator'

export { createGeneratorStateStore } from './generators/generatorState'
export type { GeneratorStateStore } from './generators/generatorState'
export { MAX_SIMULATION_CATCHUP, catchupSteps } from './generators/simulationCatchup'

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
