import * as react_jsx_runtime from 'react/jsx-runtime';
import React from 'react';

type AnsiArtProps = {
    src: string;
    mode?: 'animated' | 'final' | 'auto';
    columns?: number | 'auto';
    rows?: number | 'auto';
    background?: string;
    bitmapFontUrl: string;
    showControls?: boolean;
    showOverlayControls?: boolean;
    showPerformanceOverlay?: boolean;
    sauceOverlay?: boolean;
    fps?: number;
    bytesPerSecond?: number;
    autoStart?: boolean;
    allowDrop?: boolean;
    debugCursorCodes?: boolean;
};
declare function AnsiArt({ src, mode, columns, rows, background, bitmapFontUrl, showControls, showOverlayControls, showPerformanceOverlay, sauceOverlay, fps, bytesPerSecond, // Default: 9600 baud (960 bytes/sec after conversion from baud/10)
autoStart, allowDrop, debugCursorCodes, }: AnsiArtProps): react_jsx_runtime.JSX.Element;

/**
 * SAUCE (Standard Architecture for Universal Comment Extensions) metadata
 * Provides file information, dimensions, and comments for ANSI art files
 */
type SauceMetadata = {
    /** Should be "SAUCE" */
    id: string;
    /** SAUCE version number */
    version: number;
    /** Title of the artwork */
    title: string;
    /** Author name */
    author: string;
    /** Group/organization name */
    group: string;
    /** Date in YYYYMMDD format */
    date: string;
    /** Original file size */
    fileSize: number;
    /** Data type (0=text, 1=character art) */
    dataType: number;
    /** File type (0=ASCII, 1=ANSI, 2=Ansimation, etc.) */
    fileType: number;
    /** Type-specific info 1 (width for ANSI files) */
    tInfo1: number;
    /** Type-specific info 2 (height for ANSI files) */
    tInfo2: number;
    /** Type-specific info 3 (font ID for ANSI files) */
    tInfo3: number;
    /** Type-specific info 4 (flags/aspect ratio for ANSI files) */
    tInfo4: number;
    /** Number of comment lines */
    comments: number;
    /** Type flags (ICE colors, letter spacing, etc.) */
    tFlags: number;
    /** Type-specific info string (22 bytes, zero-terminated) */
    tInfoS?: string;
    /** Comment lines (each up to 64 characters) */
    commentLines: string[];
};
/**
 * Parse SAUCE metadata from the 128-byte trailer
 * Follows PabloDraw's implementation
 * Returns undefined if no valid SAUCE data found
 */
declare function parseSauce(bytes: Uint8Array): SauceMetadata | undefined;
/**
 * Enhanced SAUCE metadata interpretation
 */
declare function getSauceInfo(sauce: SauceMetadata | undefined): {
    fileTypeDescription: string;
    hasDimensions: boolean;
    width: number | undefined;
    height: number | undefined;
    fontName: string | undefined;
    iceColors: boolean;
    letterSpacing: boolean;
    aspectRatio: {
        width: number;
        height: number;
    } | undefined;
    /** Should be "SAUCE" */
    id: string;
    /** SAUCE version number */
    version: number;
    /** Title of the artwork */
    title: string;
    /** Author name */
    author: string;
    /** Group/organization name */
    group: string;
    /** Date in YYYYMMDD format */
    date: string;
    /** Original file size */
    fileSize: number;
    /** Data type (0=text, 1=character art) */
    dataType: number;
    /** File type (0=ASCII, 1=ANSI, 2=Ansimation, etc.) */
    fileType: number;
    /** Type-specific info 1 (width for ANSI files) */
    tInfo1: number;
    /** Type-specific info 2 (height for ANSI files) */
    tInfo2: number;
    /** Type-specific info 3 (font ID for ANSI files) */
    tInfo3: number;
    /** Type-specific info 4 (flags/aspect ratio for ANSI files) */
    tInfo4: number;
    /** Number of comment lines */
    comments: number;
    /** Type flags (ICE colors, letter spacing, etc.) */
    tFlags: number;
    /** Type-specific info string (22 bytes, zero-terminated) */
    tInfoS?: string;
    /** Comment lines (each up to 64 characters) */
    commentLines: string[];
} | null;

/**
 * Character encoding options for ANSI file parsing
 */
type CharacterEncoding = 'cp437' | 'cp850' | 'cp1252' | 'iso-8859-1' | 'utf-8';
/**
 * Represents a single character cell in an ANSI screen
 */
type AnsiCell = {
    /** Character to display */
    ch: string;
    /** Foreground color: ANSI color index (0-15) or CSS color string (e.g., "rgb(255, 0, 0)") */
    fg: number | string;
    /** Background color: ANSI color index (0-15) or CSS color string (e.g., "rgb(0, 0, 0)") */
    bg: number | string;
    /** Whether the character is bold */
    bold: boolean;
};
/**
 * Complete ANSI screen representation
 */
type AnsiScreen = {
    /** Two-dimensional array of character cells: lines[row][column] */
    lines: AnsiCell[][];
    /** Number of columns (character width) */
    columns: number;
    /** Optional SAUCE metadata if present in the file */
    sauce?: SauceMetadata;
};
/**
 * Parse ANSI art file with fixed column width
 * @param bytesInput - Input bytes to parse
 * @param columns - Fixed column width (default: 80)
 * @param encoding - Character encoding (default: 'cp437')
 * @returns Parsed ANSI screen
 */
declare function parseAnsi(bytesInput: Uint8Array, columns?: number, encoding?: CharacterEncoding): AnsiScreen;
/**
 * Detect if an ANSI file contains animation sequences
 * Returns true if the file appears to be animated (contains cursor positioning commands)
 */
declare function detectAnimation(bytes: Uint8Array): boolean;
/**
 * Parse plain ASCII text (no ANSI codes) into AnsiScreen format
 * Useful for simple text art files
 */
declare function parseAscii(bytes: Uint8Array, encoding?: CharacterEncoding): AnsiScreen;

type BitmapFont = {
    width: number;
    height: number;
    glyphs: Uint8Array[];
    rawBitmapData?: Uint8Array;
    glyphCache?: Map<string, HTMLCanvasElement>;
};
/**
 * Load a raw binary bitmap font (8xN format, 256 glyphs)
 * Expected format: 256 consecutive glyphs, each N bytes (one byte per scanline)
 */
declare function loadRawBitmapFont(url: string, width?: number, height?: number): Promise<BitmapFont>;
declare function renderGlyph(ctx: CanvasRenderingContext2D, font: BitmapFont, charCode: number, x: number, y: number, fgColor: string, bgColor: string): void;
/**
 * Render text string using bitmap font
 */
declare function renderText(ctx: CanvasRenderingContext2D, font: BitmapFont, text: string, x: number, y: number, fgColor: string, bgColor: string): number;

declare const ANSI_COLORS_RGB: Array<[number, number, number]>;
/**
 * Generate evenly spaced colors across the RGB spectrum
 * Uses a cube root distribution for more perceptually uniform colors
 */
declare function generateEvenlySpacedPalette(size: number): Array<[number, number, number]>;
type PaletteMode = 'ansi16' | 'unconstrained' | number;
/**
 * Get color palette based on mode
 */
declare function getPalette(mode: PaletteMode): Array<[number, number, number]>;
/**
 * Convert RGB color to closest color index in the given palette
 */
declare function rgbToPaletteColor(r: number, g: number, b: number, palette: Array<[number, number, number]>): number;
/**
 * Convert RGB color to closest ANSI 16-color palette index (0-15)
 */
declare function rgbToAnsiColor(r: number, g: number, b: number): number;

interface RGBAColor {
    r: number;
    g: number;
    b: number;
    a: number;
}
type FrameData = {
    width: number;
    height: number;
    pixels: Uint8Array;
};
type FrameGenerator = (frame: number, width: number, height: number) => FrameData;
type FrameConverter = (frameData: FrameData, columns: number, rows: number, palette?: PaletteMode) => AnsiScreen;
type CharacterFrameGenerator = (frame: number, columns: number, rows: number) => AnsiScreen;
type PixelFrameGenerator = {
    generator: FrameGenerator;
    converter: FrameConverter;
};
type DisplayFrameGenerator = CharacterFrameGenerator | PixelFrameGenerator;
type GeneratorCapabilities = {
    supportsSeek: boolean;
    supportsSpeedControl: boolean;
    getTotalFrames?: () => number;
    getTotalBytes?: () => number;
};
type CharacterFrameGeneratorWithMetadata = CharacterFrameGenerator & {
    capabilities?: GeneratorCapabilities;
    setSpeed?: (bytesPerSecond: number) => void;
    seekToFrame?: (frame: number) => void;
    getCurrentSpeed?: () => number;
    advanceByte?: () => void;
    rewindByte?: () => void;
    getCurrentBytePosition?: () => number;
    clearManualBytePosition?: () => void;
};
type ViewportConfig = {
    virtualColumns: number;
    virtualRows: number;
    viewX: number;
    viewY: number;
};

type AnsiVirtualDisplayProps = {
    columns?: number;
    rows?: number;
    frameGenerator: DisplayFrameGenerator;
    fps?: number;
    background?: string;
    bitmapFont?: BitmapFont;
    bitmapFontUrl?: string;
    showControls?: boolean;
    showOverlayControls?: boolean;
    showPerformanceOverlay?: boolean;
    fillContainer?: boolean;
    virtualColumns?: number;
    virtualRows?: number;
    viewX?: number;
    viewY?: number;
    pixelOffsetX?: number;
    pixelOffsetY?: number;
    onViewChange?: (view: {
        viewX: number;
        viewY: number;
    }) => void;
    sauce?: SauceMetadata;
    onSauceClick?: () => void;
    autoStart?: boolean;
};
declare function AnsiVirtualDisplay({ columns, rows, frameGenerator, fps, background, bitmapFont: providedBitmapFont, bitmapFontUrl, showControls, showOverlayControls, showPerformanceOverlay, fillContainer, virtualColumns, virtualRows, viewX, viewY, pixelOffsetX, pixelOffsetY, onViewChange, sauce, onSauceClick, autoStart, }: AnsiVirtualDisplayProps): react_jsx_runtime.JSX.Element;

type AnsiPlayerOverlayProps = {
    isPlaying: boolean;
    currentBytes: number;
    totalBytes: number;
    currentSpeed: number;
    isVisible: boolean;
    onPlayPause: () => void;
    onRestart: () => void;
    onSeek: (bytePosition: number) => void;
    onSpeedChange: (bytesPerSecond: number) => void;
    onAdvanceByte: () => void;
    onRewindByte: () => void;
    onMouseMove: () => void;
    sauce?: SauceMetadata;
    onSauceClick?: () => void;
};
declare function AnsiPlayerOverlay({ isPlaying, currentBytes, totalBytes, currentSpeed, isVisible, onPlayPause, onRestart, onSeek, onSpeedChange, onAdvanceByte, onRewindByte, onMouseMove, sauce, onSauceClick, }: AnsiPlayerOverlayProps): react_jsx_runtime.JSX.Element;

interface OctaveConfig {
    scale: number;
    amplitude: number;
    timeScaleX: number;
    timeScaleY: number;
}
interface AsciiPerlinPlasmaOptions {
    /** Array of characters to use for ASCII rendering (brightness-based) */
    chars?: string[];
    /** Animation speed multiplier. Default: 0.9. Lower = slower animation */
    timeScale?: number;
    /** Foreground color (CSS color string). Default: '#55FFFF' (bright cyan). Accepts any valid CSS color (hex, rgb, rgba, hsl, named colors, etc.) */
    fgColor?: string;
    /** Background color (CSS color string). Default: '#000000' (black). Accepts any valid CSS color (hex, rgb, rgba, hsl, named colors, etc.) */
    bgColor?: string;
    /** Noise octave configurations */
    octaves?: OctaveConfig[];
    /** Seed for noise generation. Controls the pattern shape. Default: 12345. Use different seeds for different patterns */
    seed?: number;
}
/**
 * Generate ASCII Perlin Plasma frame
 * Creates a character frame with Perlin noise-based brightness mapping
 */
declare function generateAsciiPerlinPlasmaFrame(frame: number, columns: number, rows: number, options?: AsciiPerlinPlasmaOptions): AnsiScreen;
/**
 * Create a reusable sampler for a specific frame and options.
 * Returns a function that maps world coordinates (x,y) in character cells
 * to an ANSI cell, without caring about any viewport/window.
 */
declare function createAsciiPerlinPlasmaSampler(frame: number, options?: AsciiPerlinPlasmaOptions): (x: number, y: number) => {
    ch: any;
    fg: string;
    bg: string;
    bold: boolean;
};

interface PlasmaBackgroundLayoutProps {
    children: React.ReactNode;
    mode?: 'fixed' | 'scrollable';
    contentClassName?: string;
    contentStyle?: React.CSSProperties;
    plasmaClassName?: string;
    generatorType?: 'plasma' | 'fire';
    virtualWidthPx?: number;
    virtualHeightPx?: number;
    chars?: string[];
    timeScale?: number;
    octaves?: AsciiPerlinPlasmaOptions['octaves'];
    seed?: number;
    darkenAmount?: number;
    sparkRange?: [number, number];
    fgColor?: string;
    bgColor?: string;
    showPerformanceOverlay?: boolean;
    fps?: number;
    bitmapFontUrl: string;
}
declare function PlasmaBackgroundLayout({ children, mode, contentClassName, contentStyle, plasmaClassName, generatorType, virtualWidthPx, virtualHeightPx, chars, timeScale, octaves, seed, darkenAmount, sparkRange, fgColor, bgColor, showPerformanceOverlay, fps, bitmapFontUrl, }: PlasmaBackgroundLayoutProps): react_jsx_runtime.JSX.Element;

type FontCharacterChartProps = {
    bitmapFontUrl: string;
};
declare function FontCharacterChart({ bitmapFontUrl }: FontCharacterChartProps): react_jsx_runtime.JSX.Element;

/**
 * Load a bitmap font from a URL
 * Tries to extract from FON format first, falls back to raw bitmap format
 * Framework-independent - can be used in any environment
 *
 * Note: Extracted glyphs are cached in localStorage to avoid re-extraction.
 */
declare function loadBitmapFontFromUrl(bitmapFontUrl: string): Promise<BitmapFont | null>;

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
 * Convert FrameData to AnsiScreen
 * Downsamples RGB pixel data to character cells and selects appropriate
 * colors and block characters based on the palette mode
 */
declare function convertFrameDataToAnsi(frame: FrameData, columns: number, rows: number, palette?: PaletteMode): AnsiScreen;

interface AsciiSonarOptions {
    /** Pulses per second. Default: 0.9 */
    frequency?: number;
    /** Overall ripple strength. Default: 1.0 */
    intensity?: number;
    /** Frames per second used to convert frame->seconds. Default: 30 */
    fps?: number;
    /** Foreground base color (RGB); alpha is applied per-cell. Default: '#ffffff' */
    fgColor?: string;
    /** Background color for all cells. Default: '#000000' */
    bgColor?: string;
    /** Dot character to draw everywhere. Default: '.' */
    dotChar?: string;
    /** Ring expansion speed in character-cells per second. Default: 14 */
    speed?: number;
    /** Ring band width in character-cells (gaussian sigma-ish). Default: 1.25 */
    bandWidth?: number;
    /** Exponential decay per second applied to older rings. Default: 0.75 */
    decay?: number;
    /** Minimum alpha added everywhere (ambient). Default: 0.03 */
    baseAlpha?: number;
    /** Quantize alpha into N steps to avoid exploding glyph cache. Default: 32 */
    alphaSteps?: number;
    /** Center X in cell coordinates (0..columns-1). Default: (columns-1)/2 */
    centerX?: number;
    /** Center Y in cell coordinates (0..rows-1). Default: (rows-1)/2 */
    centerY?: number;
    /** Vertical aspect scale (text cells are taller than wide). Default: 2 */
    aspectY?: number;
    /** Maximum number of active rings to sum (performance cap). Default: 24 */
    maxRings?: number;
}
declare function generateAsciiSonarFrame(frame: number, columns: number, rows: number, options?: AsciiSonarOptions): AnsiScreen;
declare function createAsciiSonarSampler(frame: number, options?: AsciiSonarOptions): (x: number, y: number) => {
    ch: string;
    fg: string;
    bg: string;
    bold: boolean;
};

interface AsciiFireOptions {
    /** Array of characters to use for ASCII rendering (brightness-based) */
    chars?: string[];
    /** Constant value to subtract each frame for darkening. Default: 0.5. Higher values = faster extinguishing */
    darkenAmount?: number;
    /** Min/max palette indices for bottom row sparks (the fuel). Default: [200, 255] */
    sparkRange?: [number, number];
    /** Background color (CSS color string). Default: '#000000' (black). Accepts any valid CSS color (hex, rgb, rgba, hsl, named colors, etc.) */
    bgColor?: string;
    /** Seed for random number generation. Controls the spark pattern. Default: 12345. Use different seeds for different patterns */
    seed?: number;
    /** World height for scrollable mode (optional, used to anchor fire to bottom of page) */
    worldHeight?: number;
    /** World width for scrollable mode (optional, used to size buffer horizontally) */
    worldWidth?: number;
}
/**
 * Generate ASCII Fire frame
 * Creates a character frame with classic demo scene fire effect
 */
declare function generateAsciiFireFrame(frame: number, columns: number, rows: number, options?: AsciiFireOptions): AnsiScreen;
/**
 * Create a reusable sampler for a specific frame and options.
 * Returns a function that maps world coordinates (x,y) in character cells
 * to an ANSI cell, without caring about any viewport/window.
 *
 * Note: For fire effect, we need to maintain state across the entire virtual world.
 * This is more complex than plasma because fire has persistent state.
 */
declare function createAsciiFireSampler(frame: number, options?: AsciiFireOptions): (x: number, y: number) => {
    ch: any;
    fg: string;
    bg: string;
    bold: boolean;
};
/**
 * Clear all fire state (useful for resetting effects or when switching generators)
 */
declare function clearFireState(): void;

interface AsciiDatamoshOptions {
    /** Random seed. Default: 1337 */
    seed?: number;
    /** Background color (CSS). Default: '#000000' */
    bgColor?: string;
    /** Frames between “keyframes” (full refresh). Default: 24 */
    keyframeIntervalFrames?: number;
    /** Number of corruption operations per frame. Default: 10 */
    blockOpsPerFrame?: number;
    /** Minimum block size (cells). Default: 3 */
    minBlockSize?: number;
    /** Maximum block size (cells). Default: 18 */
    maxBlockSize?: number;
    /** Maximum horizontal/vertical shift used by some ops (cells). Default: 12 */
    maxShift?: number;
    /** Chance (0..1) to apply a horizontal tear op each frame. Default: 0.5 */
    tearChance?: number;
    /** Chance (0..1) to apply a palette shift op each frame. Default: 0.65 */
    paletteShiftChance?: number;
    /** Chance (0..1) to apply a noise fill op each frame. Default: 0.35 */
    noiseFillChance?: number;
    /** Characters used for base “video” shading (dark -> bright). Default: ' ░▒▓█' */
    baseChars?: string;
    /** Characters used for noise fill. Default: '█▓▒░▀▄■□▲▼◆◇╳#@$%&*+;:,. ' */
    noiseChars?: string;
    /** If true, allow blocks/tears to wrap around edges. Default: true */
    wrap?: boolean;
}
declare function generateAsciiDatamoshFrame(frame: number, columns: number, rows: number, options?: AsciiDatamoshOptions): AnsiScreen;
/**
 * Create a sampler that returns cells from an internal “virtual” buffer.
 * This is useful for windowed/scrollable virtual worlds.
 *
 * Notes:
 * - The sampler wraps coordinates (like classic demo effects) for stability.
 * - Provide `virtualColumns` / `virtualRows` when using this for virtual worlds.
 */
declare function createAsciiDatamoshSampler(frame: number, options?: AsciiDatamoshOptions & {
    virtualColumns?: number;
    virtualRows?: number;
}): (x: number, y: number) => {
    ch: string;
    fg: string;
    bg: string;
    bold: boolean;
};
declare function clearDatamoshState(): void;

interface AsciiMetaballsOptions {
    /** Random seed. Default: 1337 */
    seed?: number;
    /** Foreground color (CSS). Default: '#55FFFF' */
    fgColor?: string;
    /** Background color (CSS). Default: '#000000' */
    bgColor?: string;
    /** Characters to use for shading (dark -> bright). Default: ' .,:;+=xX$&#@' */
    chars?: string[];
    /** Number of metaballs. Default: 6 */
    balls?: number;
    /** Animation speed multiplier (frame -> time). Default: 0.085 */
    speed?: number;
    /** Minimum metaball radius (cells). Default: 2.5 */
    radiusMin?: number;
    /** Maximum metaball radius (cells). Default: 9.5 */
    radiusMax?: number;
    /** Normalization intensity (k) used in `1 - exp(-k * F)`. Default: 0.55 */
    intensity?: number;
    /** Vertical aspect scale (text cells are taller than wide). Default: 2 */
    aspectY?: number;
}
declare function generateAsciiMetaballsFrame(frame: number, columns: number, rows: number, options?: AsciiMetaballsOptions): AnsiScreen;
declare function createAsciiMetaballsSampler(frame: number, options?: AsciiMetaballsOptions): (x: number, y: number) => {
    ch: string;
    fg: string;
    bg: string;
    bold: boolean;
};

type AnsiFrameGeneratorOptions = {
    ansiData: Uint8Array;
    mode: 'animated' | 'final';
    columns?: number;
    rows?: number;
    finalHeightForCanvas?: number;
    bytesPerSecond?: number;
    fps?: number;
    onDimensionsChange?: (dimensions: {
        columns: number;
        rows: number;
    }) => void;
    onScrollChange?: (scroll: {
        viewY: number;
        contentRows: number;
    }) => void;
    debugCursorCodes?: boolean;
};
/**
 * Create a frame generator for ANSI art files
 * Supports both animated (progressive) and final (complete) modes
 * Supports both fixed and dynamic column sizing
 */
declare function createAnsiFrameGenerator(options: AnsiFrameGeneratorOptions): CharacterFrameGeneratorWithMetadata;
type AnsiArtFrameGeneratorOptions = {
    ansiData: Uint8Array;
    mode: 'animated' | 'final';
    columns?: number;
    rows?: number;
    finalHeightForAnimated?: number;
    bytesPerSecond?: number;
    fps?: number;
    onDimensionsChange?: (dimensions: {
        columns: number;
        rows: number;
    }) => void;
    onScrollChange?: (scroll: {
        viewY: number;
        contentRows: number;
    }) => void;
    debugCursorCodes?: boolean;
};
/**
 * Create a frame generator for AnsiArt component
 * Handles the logic for determining effective columns and rows based on auto/fixed settings
 */
declare function createAnsiArtFrameGenerator(options: AnsiArtFrameGeneratorOptions): CharacterFrameGeneratorWithMetadata | null;

export { ANSI_COLORS_RGB, AnsiArt, type AnsiArtFrameGeneratorOptions, type AnsiArtProps, type AnsiFrameGeneratorOptions, AnsiPlayerOverlay, type AnsiPlayerOverlayProps, AnsiVirtualDisplay, type AnsiVirtualDisplayProps, type AsciiDatamoshOptions, type AsciiFireOptions, type AsciiMetaballsOptions, type AsciiPerlinPlasmaOptions, type AsciiSonarOptions, type BitmapFont, type CharacterEncoding, type CharacterFrameGenerator, type CharacterFrameGeneratorWithMetadata, type DisplayFrameGenerator, FontCharacterChart, type FontCharacterChartProps, type FontExtractionResult, type FrameConverter, type FrameData, type FrameGenerator, type GeneratorCapabilities, type OctaveConfig, type PaletteMode, type PerformanceStats, type PixelFrameGenerator, PlasmaBackgroundLayout, type PlasmaBackgroundLayoutProps, type RGBAColor, type SauceMetadata, type ViewportConfig, clearDatamoshState, clearFireState, clearFontCache, convertFrameDataToAnsi, createAnsiArtFrameGenerator, createAnsiFrameGenerator, createAsciiDatamoshSampler, createAsciiFireSampler, createAsciiMetaballsSampler, createAsciiPerlinPlasmaSampler, createAsciiSonarSampler, detectAnimation, drawPerformanceOverlay, extractFontFromFON, generateAsciiDatamoshFrame, generateAsciiFireFrame, generateAsciiMetaballsFrame, generateAsciiPerlinPlasmaFrame, generateAsciiSonarFrame, generateEvenlySpacedPalette, getPalette, getSauceInfo, loadBitmapFontFromUrl, loadRawBitmapFont, parseAnsi, parseAscii, parseSauce, renderGlyph, renderText, rgbToAnsiColor, rgbToPaletteColor };
