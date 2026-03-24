export { AnsiArt, AnsiArtProps } from './components/AnsiArt.js';
export { AnsiVirtualDisplay, AnsiVirtualDisplayProps } from './components/AnsiVirtualDisplay.js';
export { AnsiPlayerOverlay, AnsiPlayerOverlayProps } from './components/AnsiPlayerOverlay.js';
export { GeneratorBackgroundLayout, GeneratorBackgroundLayoutProps, PlasmaBackgroundLayout, PlasmaBackgroundLayoutProps } from './components/PlasmaBackgroundLayout.js';
export { FontCharacterChart, FontCharacterChartProps } from './components/FontCharacterChart.js';
import { BitmapFont } from './font/bitmapFont.js';
export { loadRawBitmapFont, renderGlyph, renderText } from './font/bitmapFont.js';
export { loadBitmapFontFromUrl } from './font/bitmapFontLoader.js';
export { getEmbeddedVgaFont } from './font/embeddedVgaFont.js';
export { ANSI_COLORS_RGB, PaletteMode, generateEvenlySpacedPalette, getPalette, rgbToAnsiColor, rgbToPaletteColor } from './utils/rgbToAnsi.js';
import { AnsiCell, AnsiScreen } from './ansi/types.js';
export { CharacterEncoding, detectAnimation, parseAnsi, parseAscii } from './ansi/parser.js';
export { SauceMetadata, getSauceInfo, parseSauce } from './utils/sauce.js';
export { convertFrameDataToAnsi } from './ansi/frameToAnsi.js';
import { FrameConverter, FrameData } from './types/types.js';
export { CharacterFrameGenerator, CharacterFrameGeneratorWithMetadata, DisplayFrameGenerator, FrameGenerator, GeneratorCapabilities, PixelFrameGenerator, RGBAColor, ViewportConfig } from './types/types.js';
export { AsciiPerlinPlasmaOptions, OctaveConfig, createAsciiPerlinPlasmaSampler, generateAsciiPerlinPlasmaFrame } from './generators/plasma.js';
export { AsciiSonarOptions, createAsciiSonarSampler, generateAsciiSonarFrame } from './generators/sonar.js';
export { AsciiFireOptions, clearFireState, createAsciiFireSampler, generateAsciiFireFrame } from './generators/fire.js';
export { AsciiDatamoshOptions, clearDatamoshState, createAsciiDatamoshSampler, generateAsciiDatamoshFrame } from './generators/datamosh.js';
export { AsciiMetaballsOptions, createAsciiMetaballsSampler, generateAsciiMetaballsFrame } from './generators/metaballs.js';
export { AnsiArtFrameGeneratorOptions, AnsiFrameGeneratorOptions, createAnsiArtFrameGenerator, createAnsiFrameGenerator } from './generators/ansiFrame.js';
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

/**
 * Shape-based ASCII rendering converter.
 *
 * Uses 6D shape vectors to match image regions to characters based on
 * spatial luminance distribution rather than simple brightness.
 * Based on https://alexharri.com/blog/ascii-rendering
 */

/** Exported character set presets */
declare const SHAPE_CHAR_PRESETS: {
    readonly ascii: " !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    readonly cp437: string;
    readonly minimal: " .:-=+*#%@";
    readonly blocks: " ░▒▓█";
};
type ShapeCharPreset = keyof typeof SHAPE_CHAR_PRESETS;
interface ShapeConverterOptions {
    /** BitmapFont to compute shape vectors from (required). */
    bitmapFont: BitmapFont;
    /** Character set preset (default: 'cp437'). Ignored when `chars` is provided. */
    charSet?: ShapeCharPreset;
    /** Characters to use for matching. Overrides `charSet` when provided. */
    chars?: string | string[];
    /** Number of characters from the diversity-sorted set to use (default: all). Lower = faster but less accurate. */
    rampLength?: number;
    /** Contrast enhancement exponent (default: 2.2). Higher = sharper edges. Set to 1 to disable. */
    contrastExponent?: number;
    /** Use only foreground characters on a black background (default: false). Gives a pure ASCII art look. */
    monoBackground?: boolean;
    /** Use full RGB colors instead of ANSI palette (default: false). Outputs CSS rgb() strings. */
    rgbColor?: boolean;
}
/**
 * Create a shape-based ASCII frame converter.
 *
 * Uses 6D shape vectors to match image regions to characters based on
 * spatial luminance distribution. Produces much more detailed ASCII art
 * than simple brightness-to-block-char mapping.
 *
 * The converter pre-computes shape vectors from the provided bitmap font,
 * then on each frame samples 6 strategic points within each cell and finds
 * the closest matching character via Euclidean distance in 6D space.
 *
 * @example
 * ```tsx
 * import { createShapeConverter, AnsiVirtualDisplay } from 'react-ansiart'
 *
 * const converter = createShapeConverter({ bitmapFont: myFont })
 *
 * <AnsiVirtualDisplay
 *   frameGenerator={{ generator: myPixelGen, converter }}
 *   columns={80}
 *   rows={25}
 *   bitmapFontUrl="/fonts/Bm437_IBM_VGA_8x16.FON"
 *   fps={30}
 * />
 * ```
 */
declare function createShapeConverter(options: ShapeConverterOptions): FrameConverter;

interface AsciiMatrixRainOptions {
    /** Base fall speed (rows per frame). Default: 0.5 */
    speed?: number;
    /** Fraction of columns with active streams (0–1). Default: 0.7 */
    density?: number;
    /** Average trail length in rows. Default: 15 */
    trailLength?: number;
    /** Head character color (CSS). Default: '#ffffff' */
    headColor?: string;
    /** Trail body color (CSS). Default: '#00ff44' */
    trailColor?: string;
    /** Background color (CSS). Default: '#000000' */
    bgColor?: string;
    /** Character pool to draw from. Default: half-width katakana + digits + symbols */
    chars?: string;
    /** RNG seed. Default: 7331 */
    seed?: number;
}
declare function generateAsciiMatrixRainFrame(frame: number, columns: number, rows: number, options?: AsciiMatrixRainOptions): AnsiScreen;
/**
 * Create a sampler for virtual world / windowed rendering.
 */
declare function createAsciiMatrixRainSampler(frame: number, options?: AsciiMatrixRainOptions): (x: number, y: number) => AnsiCell;
/**
 * Clear all matrix rain state.
 */
declare function clearMatrixRainState(): void;

interface AsciiStarfieldOptions {
    /** Number of stars in the field. Default: 200 */
    stars?: number;
    /** Speed at which stars approach the viewer per frame. Default: 0.02 */
    speed?: number;
    /** Foreground color for stars (CSS color string). Default: '#ffffff' */
    fgColor?: string;
    /** Background color (CSS color string). Default: '#000000' */
    bgColor?: string;
    /** Characters used by depth: first char = farthest, last char = nearest. Default: '·.+*#@' */
    chars?: string;
    /** Seed for deterministic random number generation. Default: 4242 */
    seed?: number;
    /** Whether near stars draw streak trails. Default: true */
    streaks?: boolean;
}
/**
 * Generate ASCII Starfield frame
 * Creates a 3D starfield effect (flying through space) as a CharacterFrameGenerator
 */
declare function generateAsciiStarfieldFrame(frame: number, columns: number, rows: number, options?: AsciiStarfieldOptions): AnsiScreen;
/**
 * Create a reusable sampler for a specific frame and options.
 * Returns a function that maps world coordinates (x,y) in character cells
 * to an ANSI cell.
 */
declare function createAsciiStarfieldSampler(frame: number, options?: AsciiStarfieldOptions): (x: number, y: number) => {
    ch: string;
    fg: string;
    bg: string;
    bold: boolean;
};
/**
 * Clear all starfield state (useful for resetting effects or when switching generators)
 */
declare function clearStarfieldState(): void;

interface AsciiTunnelOptions {
    /** Forward movement speed through the tunnel. Default: 0.08 */
    speed?: number;
    /** Rotation speed of the tunnel. Default: 0.01 */
    rotationSpeed?: number;
    /** Number of checkerboard tiles in each direction. Default: 8 */
    tiles?: number;
    /** Foreground color (CSS color string). Default: '#00ffaa' */
    fgColor?: string;
    /** Background color (CSS color string). Default: '#000000' */
    bgColor?: string;
    /** Characters used for brightness mapping (dark to bright). Default: ' .:-=+*#%@' */
    chars?: string;
    /** Vertical aspect ratio correction factor. Default: 2 */
    aspectY?: number;
}
/**
 * Generate ASCII Tunnel frame
 * Creates a classic demo scene rotating/zooming tunnel with checkerboard texture.
 * This is a stateless generator — output is a pure function of the frame number.
 */
declare function generateAsciiTunnelFrame(frame: number, columns: number, rows: number, options?: AsciiTunnelOptions): AnsiScreen;

interface AsciiGameOfLifeOptions {
    /** Initial density of live cells (0-1). Default: 0.3 */
    density?: number;
    /** Foreground color for live cells (CSS color string). Default: '#55ff55' */
    fgColor?: string;
    /** Background color (CSS color string). Default: '#000000' */
    bgColor?: string;
    /** Seed for random number generation. Default: 9999 */
    seed?: number;
    /** Whether to auto-seed when population drops too low. Default: true */
    autoSeed?: boolean;
    /** Population threshold (fraction of total cells) below which auto-seeding triggers. Default: 0.05 */
    autoSeedThreshold?: number;
}
/**
 * Clear all Game of Life state (useful for resetting effects or when switching generators)
 */
declare function clearGameOfLifeState(): void;
/**
 * Generate an ASCII Game of Life frame with age-based coloring
 */
declare function generateAsciiGameOfLifeFrame(frame: number, columns: number, rows: number, options?: AsciiGameOfLifeOptions): AnsiScreen;
/**
 * Create a reusable sampler for a specific frame and options.
 * Returns a function that maps world coordinates (x, y) to an ANSI cell.
 */
declare function createAsciiGameOfLifeSampler(frame: number, options?: AsciiGameOfLifeOptions): (x: number, y: number) => AnsiCell;

interface AsciiWaterRippleOptions {
    /** Damping factor for wave decay (0-1). Default: 0.97. Lower = faster decay */
    damping?: number;
    /** Drop a stone every N frames. Default: 15 */
    dropFrequency?: number;
    /** Amplitude of dropped stones. Default: 255 */
    dropStrength?: number;
    /** Foreground color for disturbed water (CSS color string). Default: '#4488ff' */
    fgColor?: string;
    /** Background color for calm water (CSS color string). Default: '#000011' */
    bgColor?: string;
    /** Characters for brightness ramp. Default: ' ·:~=@' */
    chars?: string;
    /** Seed for random number generation. Default: 5555 */
    seed?: number;
}
/**
 * Clear all water ripple state (useful for resetting effects or when switching generators)
 */
declare function clearWaterRippleState(): void;
/**
 * Generate an ASCII water ripple frame with wave-equation simulation
 */
declare function generateAsciiWaterRippleFrame(frame: number, columns: number, rows: number, options?: AsciiWaterRippleOptions): AnsiScreen;
/**
 * Create a reusable sampler for a specific frame and options.
 * Returns a function that maps world coordinates (x, y) to an ANSI cell.
 */
declare function createAsciiWaterRippleSampler(frame: number, options?: AsciiWaterRippleOptions): (x: number, y: number) => AnsiCell;

interface AsciiMandelbrotOptions {
    /** Maximum iteration count (higher = more detail, slower). Default: 64 */
    maxIter?: number;
    /** Zoom rate per frame. Default: 0.02 */
    zoomSpeed?: number;
    /** Zoom target real component. Default: -0.7435 (Seahorse Valley) */
    zoomX?: number;
    /** Zoom target imaginary component. Default: 0.1314 */
    zoomY?: number;
    /** Starting zoom level. Default: 0.5 */
    initialZoom?: number;
    /** Base foreground color (used in mono mode). Default: '#ff8800' */
    fgColor?: string;
    /** Background / set interior color. Default: '#000000' */
    bgColor?: string;
    /** Character ramp from low to high iteration count. Default: ' .:-=+*#%@' */
    chars?: string;
    /** Y aspect correction for non-square cells. Default: 2 */
    aspectY?: number;
    /** Color mode: 'spectrum' cycles rainbow hues, 'mono' uses fgColor brightness. Default: 'spectrum' */
    colorMode?: 'spectrum' | 'mono';
}
declare function generateAsciiMandelbrotFrame(frame: number, columns: number, rows: number, options?: AsciiMandelbrotOptions): AnsiScreen;
/**
 * Generate Mandelbrot fractal as RGB pixel data.
 * Use with createShapeConverter for shape-based ASCII rendering.
 */
declare function generateMandelbrotPixels(frame: number, width: number, height: number, options?: AsciiMandelbrotOptions): FrameData;

export { AnsiCell, AnsiScreen, type AsciiGameOfLifeOptions, type AsciiMandelbrotOptions, type AsciiMatrixRainOptions, type AsciiStarfieldOptions, type AsciiTunnelOptions, type AsciiWaterRippleOptions, BitmapFont, type FontExtractionResult, FrameConverter, FrameData, type PerformanceStats, SHAPE_CHAR_PRESETS, type ShapeCharPreset, type ShapeConverterOptions, clearFontCache, clearGameOfLifeState, clearMatrixRainState, clearStarfieldState, clearWaterRippleState, createAsciiGameOfLifeSampler, createAsciiMatrixRainSampler, createAsciiStarfieldSampler, createAsciiWaterRippleSampler, createShapeConverter, drawPerformanceOverlay, extractFontFromFON, generateAsciiGameOfLifeFrame, generateAsciiMandelbrotFrame, generateAsciiMatrixRainFrame, generateAsciiStarfieldFrame, generateAsciiTunnelFrame, generateAsciiWaterRippleFrame, generateMandelbrotPixels };
