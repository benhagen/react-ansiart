import * as react_jsx_runtime from 'react/jsx-runtime';
import React from 'react';

type AnsiArtProps = {
    src: string;
    columns?: number;
    background?: string;
    allowDrop?: boolean;
    bitmapFontUrl: string;
    debugFont?: boolean;
    animated?: boolean;
    frameDelay?: number;
    bytesPerFrame?: number;
    linesPerFrame?: number;
    animateBy?: 'bytes' | 'cursor';
    showControls?: boolean;
    debugPerformance?: boolean;
    debugCursorCodes?: boolean;
};
declare function AnsiArt({ src, columns, background, allowDrop, bitmapFontUrl, debugFont, animated, frameDelay, bytesPerFrame, linesPerFrame, animateBy, showControls, debugPerformance, debugCursorCodes, }: AnsiArtProps): react_jsx_runtime.JSX.Element;

type AnsiArtNGProps = {
    src: string;
    mode?: 'animated' | 'final';
    viewscreen?: 'fixed' | 'dynamic';
    columns?: number;
    rows?: number;
    background?: string;
    bitmapFontUrl: string;
    showControls?: boolean;
    showOverlayControls?: boolean;
    showPerformanceOverlay?: boolean;
    fps?: number;
    bytesPerSecond?: number;
    allowDrop?: boolean;
    debugCursorCodes?: boolean;
};
declare function AnsiArtNG({ src, mode, viewscreen, columns, rows, background, bitmapFontUrl, showControls, showOverlayControls, showPerformanceOverlay, fps, bytesPerSecond, // Default: 9600 baud (960 bytes/sec after conversion from baud/10)
allowDrop, debugCursorCodes, }: AnsiArtNGProps): react_jsx_runtime.JSX.Element;

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

type CharacterEncoding = 'cp437' | 'cp850' | 'cp1252' | 'iso-8859-1' | 'utf-8';
type AnsiCell = {
    ch: string;
    fg: number | string;
    bg: number | string;
    bold: boolean;
};
type SauceMetadata = {
    id: string;
    version: number;
    title: string;
    author: string;
    group: string;
    date: string;
    fileSize: number;
    dataType: number;
    fileType: number;
    tInfo1: number;
    tInfo2: number;
    tInfo3: number;
    tInfo4: number;
    comments: number;
    tFlags: number;
    commentLines: string[];
};
type AnsiScreen = {
    lines: AnsiCell[][];
    columns: number;
    sauce?: SauceMetadata;
};
/**
 * Parse SAUCE metadata from the 128-byte trailer
 * Returns undefined if no valid SAUCE data found
 */
declare function parseSauce(bytes: Uint8Array): SauceMetadata | undefined;
/**
 * Detect if an ANSI file contains animation sequences
 * Returns true if the file appears to be animated (contains cursor positioning commands)
 */
declare function detectAnimation(bytes: Uint8Array): boolean;
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
    id: string;
    version: number;
    title: string;
    author: string;
    group: string;
    date: string;
    fileSize: number;
    dataType: number;
    fileType: number;
    tInfo1: number;
    tInfo2: number;
    tInfo3: number;
    tInfo4: number;
    comments: number;
    tFlags: number;
    commentLines: string[];
} | null;
/**
 * Parse plain ASCII text (no ANSI codes) into AnsiScreen format
 * Useful for simple text art files
 */
declare function parseAscii(bytes: Uint8Array, encoding?: CharacterEncoding): AnsiScreen;

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
};
declare function AnsiVirtualDisplay({ columns, rows, frameGenerator, fps, background, bitmapFont: providedBitmapFont, bitmapFontUrl, showControls, showOverlayControls, showPerformanceOverlay, fillContainer, virtualColumns, virtualRows, viewX, viewY, pixelOffsetX, pixelOffsetY, onViewChange, }: AnsiVirtualDisplayProps): react_jsx_runtime.JSX.Element;

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
};
declare function AnsiPlayerOverlay({ isPlaying, currentBytes, totalBytes, currentSpeed, isVisible, onPlayPause, onRestart, onSeek, onSpeedChange, onAdvanceByte, onRewindByte, onMouseMove, }: AnsiPlayerOverlayProps): react_jsx_runtime.JSX.Element;

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
    virtualWidthPx?: number;
    virtualHeightPx?: number;
    chars?: string[];
    timeScale?: number;
    octaves?: AsciiPerlinPlasmaOptions['octaves'];
    seed?: number;
    fgColor?: string;
    bgColor?: string;
    showPerformanceOverlay?: boolean;
    fps?: number;
    bitmapFontUrl: string;
}
declare function PlasmaBackgroundLayout({ children, mode, contentClassName, contentStyle, plasmaClassName, virtualWidthPx, virtualHeightPx, chars, timeScale, octaves, seed, fgColor, bgColor, showPerformanceOverlay, fps, bitmapFontUrl, }: PlasmaBackgroundLayoutProps): react_jsx_runtime.JSX.Element;

type FontCharacterChartProps = {
    bitmapFontUrl: string;
};
declare function FontCharacterChart({ bitmapFontUrl }: FontCharacterChartProps): react_jsx_runtime.JSX.Element;

/**
 * Load a bitmap font from a URL
 * Tries to extract from FON format first, falls back to raw bitmap format
 * Framework-independent - can be used in any environment
 */
declare function loadBitmapFontFromUrl(bitmapFontUrl: string): Promise<BitmapFont | null>;

type FontExtractionResult = {
    bitmapData: Uint8Array;
    width: number;
    height: number;
};
declare function extractFontFromFON(url: string): Promise<FontExtractionResult | null>;

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

type AnsiFrameGeneratorOptions = {
    ansiData: Uint8Array;
    mode: 'animated' | 'final';
    columns?: number;
    rows?: number;
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
    viewscreen: 'fixed' | 'dynamic';
    columns?: number;
    rows?: number;
    dynamicColumns?: number;
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
 * Create a frame generator for AnsiArtNG component
 * Handles the logic for determining effective columns based on viewscreen and mode
 */
declare function createAnsiArtFrameGenerator(options: AnsiArtFrameGeneratorOptions): CharacterFrameGeneratorWithMetadata | null;

export { ANSI_COLORS_RGB, AnsiArt, type AnsiArtFrameGeneratorOptions, AnsiArtNG, type AnsiArtNGProps, type AnsiArtProps, type AnsiFrameGeneratorOptions, AnsiPlayerOverlay, type AnsiPlayerOverlayProps, AnsiVirtualDisplay, type AnsiVirtualDisplayProps, type AsciiPerlinPlasmaOptions, type BitmapFont, type CharacterEncoding, type CharacterFrameGenerator, type CharacterFrameGeneratorWithMetadata, type DisplayFrameGenerator, FontCharacterChart, type FontCharacterChartProps, type FontExtractionResult, type FrameConverter, type FrameData, type FrameGenerator, type GeneratorCapabilities, type OctaveConfig, type PaletteMode, type PerformanceStats, type PixelFrameGenerator, PlasmaBackgroundLayout, type PlasmaBackgroundLayoutProps, type RGBAColor, type SauceMetadata, type ViewportConfig, convertFrameDataToAnsi, createAnsiArtFrameGenerator, createAnsiFrameGenerator, createAsciiPerlinPlasmaSampler, detectAnimation, drawPerformanceOverlay, extractFontFromFON, generateAsciiPerlinPlasmaFrame, generateEvenlySpacedPalette, getPalette, getSauceInfo, loadBitmapFontFromUrl, loadRawBitmapFont, parseAscii, parseSauce, renderGlyph, renderText, rgbToAnsiColor, rgbToPaletteColor };
