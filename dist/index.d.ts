export { AnsiArt, AnsiArtProps } from './components/AnsiArt.js';
export { AnsiVirtualDisplay, AnsiVirtualDisplayProps } from './components/AnsiVirtualDisplay.js';
export { AnsiPlayerOverlay, AnsiPlayerOverlayProps } from './components/AnsiPlayerOverlay.js';
export { PlasmaBackgroundLayout, PlasmaBackgroundLayoutProps } from './components/PlasmaBackgroundLayout.js';
export { FontCharacterChart, FontCharacterChartProps } from './components/FontCharacterChart.js';
import { BitmapFont } from './font/bitmapFont.js';
export { loadRawBitmapFont, renderGlyph, renderText } from './font/bitmapFont.js';
export { loadBitmapFontFromUrl } from './font/bitmapFontLoader.js';
export { getEmbeddedVgaFont } from './font/embeddedVgaFont.js';
export { ANSI_COLORS_RGB, PaletteMode, generateEvenlySpacedPalette, getPalette, rgbToAnsiColor, rgbToPaletteColor } from './utils/rgbToAnsi.js';
export { AnsiCell, AnsiScreen } from './ansi/types.js';
export { CharacterEncoding, detectAnimation, parseAnsi, parseAscii } from './ansi/parser.js';
export { SauceMetadata, getSauceInfo, parseSauce } from './utils/sauce.js';
export { convertFrameDataToAnsi } from './ansi/frameToAnsi.js';
export { AsciiPerlinPlasmaOptions, OctaveConfig, createAsciiPerlinPlasmaSampler, generateAsciiPerlinPlasmaFrame } from './generators/plasma.js';
export { AsciiSonarOptions, createAsciiSonarSampler, generateAsciiSonarFrame } from './generators/sonar.js';
export { AsciiFireOptions, clearFireState, createAsciiFireSampler, generateAsciiFireFrame } from './generators/fire.js';
export { AsciiDatamoshOptions, clearDatamoshState, createAsciiDatamoshSampler, generateAsciiDatamoshFrame } from './generators/datamosh.js';
export { AsciiMetaballsOptions, createAsciiMetaballsSampler, generateAsciiMetaballsFrame } from './generators/metaballs.js';
export { AnsiArtFrameGeneratorOptions, AnsiFrameGeneratorOptions, createAnsiArtFrameGenerator, createAnsiFrameGenerator } from './generators/ansiFrame.js';
export { CharacterFrameGenerator, CharacterFrameGeneratorWithMetadata, DisplayFrameGenerator, FrameConverter, FrameData, FrameGenerator, GeneratorCapabilities, PixelFrameGenerator, RGBAColor, ViewportConfig } from './types/types.js';
import 'react/jsx-runtime';
import 'react';

type FontExtractionResult = {
    bitmapData: Uint8Array;
    width: number;
    height: number;
};
declare function extractFontFromFON(url: string): Promise<FontExtractionResult | null>;

/**
 * Clear font cache
 * @param url Optional specific URL to clear, or undefined to clear all font caches
 */
declare function clearFontCache(url?: string): void;

type PerformanceStats = {
    actualFps: number;
    targetFps: number;
    renderTime: number;
    drawTime: number;
    virtualColumns?: number;
    virtualRows?: number;
    viewColumns: number;
    viewRows: number;
    viewX: number;
    viewY: number;
};
/**
 * Draw performance overlay as a separate canvas layer
 * Does not mutate screen data - renders directly to canvas
 */
declare function drawPerformanceOverlay(ctx: CanvasRenderingContext2D, stats: PerformanceStats, font: BitmapFont): void;

export { BitmapFont, type FontExtractionResult, type PerformanceStats, clearFontCache, drawPerformanceOverlay, extractFontFromFON };
