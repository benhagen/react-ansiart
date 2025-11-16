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

type RipArtProps = {
    url?: string;
    mode?: 'animated' | 'final' | 'auto';
    width?: number | 'auto';
    height?: number | 'auto';
    background?: string;
    allowDrop?: boolean;
    showOverlayControls?: boolean;
    showPerformanceOverlay?: boolean;
    debug?: boolean;
    fps?: number;
    bytesPerSecond?: number;
    autoStart?: boolean;
};
declare function RipArt({ url, mode, width, height, background, allowDrop, showOverlayControls, showPerformanceOverlay, debug, fps, bytesPerSecond, autoStart, }: RipArtProps): react_jsx_runtime.JSX.Element;

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

interface Point {
    x: number;
    y: number;
}
interface Size {
    width: number;
    height: number;
}
interface Rectangle {
    x: number;
    y: number;
    width: number;
    height: number;
}
interface RipState {
    color: number;
    fillColor: number;
    fillStyle: FillStyle;
    lineStyle: LineStyle;
    fontStyle: FontStyle;
    viewport: Rectangle | null;
    cursor: Point;
    writeMode: WriteMode;
    palette: number[];
    textWindow: Rectangle | null;
}
declare enum FillStyle {
    Empty = 0,
    Solid = 1,
    Line = 2,
    LtSlash = 3,
    Slash = 4,
    BkSlash = 5,
    LtBkSlash = 6,
    Hatch = 7,
    XHatch = 8,
    Interleave = 9,
    WideDot = 10,
    CloseDot = 11,
    User = 12
}
declare enum LineStyle {
    Solid = 0,
    Dotted = 1,
    Center = 2,
    Dashed = 3,
    User = 4
}
declare enum FontStyle {
    Default = 0,
    Triplex = 1,
    Small = 2,
    SansSerif = 3,
    Gothic = 4,
    Script = 5,
    TriplexScript = 6,
    Complex = 7,
    European = 8,
    Bold = 9
}
declare enum WriteMode {
    CopyPut = 0,
    XorPut = 1,
    OrPut = 2,
    AndPut = 3,
    NotPut = 4
}
declare enum Direction {
    Horizontal = 0,
    Vertical = 1
}
interface RipCommand {
    type: string;
    opcode: string;
}
interface RipLine extends RipCommand {
    type: 'Line';
    opcode: 'L';
    start: Point;
    end: Point;
}
interface RipCircle extends RipCommand {
    type: 'Circle';
    opcode: 'C';
    center: Point;
    radius: number;
}
interface RipOval extends RipCommand {
    type: 'Oval';
    opcode: 'O';
    center: Point;
    radius: Size;
    startAngle: number;
    endAngle: number;
}
interface RipArc extends RipCommand {
    type: 'Arc';
    opcode: 'A';
    center: Point;
    radius: number;
    startAngle: number;
    endAngle: number;
}
interface RipPolygon extends RipCommand {
    type: 'Polygon';
    opcode: 'P';
    points: Point[];
}
interface RipPolyLine extends RipCommand {
    type: 'PolyLine';
    opcode: 'PL';
    points: Point[];
}
interface RipBar extends RipCommand {
    type: 'Bar';
    opcode: 'B';
    rect: Rectangle;
}
interface RipDrawRectangle extends RipCommand {
    type: 'DrawRectangle';
    opcode: 'DR';
    rect: Rectangle;
}
interface RipBezier extends RipCommand {
    type: 'Bezier';
    opcode: 'BE';
    points: Point[];
    segments: number;
}
interface RipPixel extends RipCommand {
    type: 'Pixel';
    opcode: 'PX' | 'X';
    point: Point;
}
interface RipFill extends RipCommand {
    type: 'Fill';
    opcode: 'F';
    point: Point;
    border: number;
}
interface RipFilledPolygon extends RipCommand {
    type: 'FilledPolygon';
    opcode: 'FP';
    points: Point[];
}
interface RipFilledOval extends RipCommand {
    type: 'FilledOval';
    opcode: 'FO';
    center: Point;
    radius: Size;
}
interface RipPieSlice extends RipCommand {
    type: 'PieSlice';
    opcode: 'PS';
    center: Point;
    radius: number;
    startAngle: number;
    endAngle: number;
}
interface RipOvalPieSlice extends RipCommand {
    type: 'OvalPieSlice';
    opcode: 'OPS';
    center: Point;
    radius: Size;
    startAngle: number;
    endAngle: number;
}
interface RipOvalArc extends RipCommand {
    type: 'OvalArc';
    opcode: 'OA';
    center: Point;
    radius: Size;
    startAngle: number;
    endAngle: number;
}
interface RipColor extends RipCommand {
    type: 'Color';
    opcode: 'c';
    value: number;
}
interface RipFillStyle extends RipCommand {
    type: 'FillStyle';
    opcode: 'FS' | 'S';
    style: FillStyle;
    color: number;
}
interface RipLineStyle extends RipCommand {
    type: 'LineStyle';
    opcode: 'LS' | '=';
    style: LineStyle;
    pattern: number;
    thickness: number;
}
interface RipFontStyle extends RipCommand {
    type: 'FontStyle';
    opcode: 'FT';
    font: FontStyle;
    direction: Direction;
    characterSize: number;
}
interface RipViewPort extends RipCommand {
    type: 'ViewPort';
    opcode: 'V';
    rect: Rectangle;
}
interface RipGotoXY extends RipCommand {
    type: 'GotoXY';
    opcode: 'G';
    point: Point;
}
interface RipMove extends RipCommand {
    type: 'Move';
    opcode: 'M';
    point: Point;
}
interface RipHome extends RipCommand {
    type: 'Home';
    opcode: 'H';
}
interface RipWriteMode extends RipCommand {
    type: 'WriteMode';
    opcode: 'WM';
    mode: WriteMode;
}
interface RipSetPalette extends RipCommand {
    type: 'SetPalette';
    opcode: 'SP' | 'Q';
    palette: number[];
}
interface RipOnePalette extends RipCommand {
    type: 'OnePalette';
    opcode: 'OP';
    color: number;
    palette: number;
}
interface RipFillPattern extends RipCommand {
    type: 'FillPattern';
    opcode: 'FPAT';
    pattern: number[];
    color: number;
}
interface RipBeginText extends RipCommand {
    type: 'BeginText';
    opcode: 'BT';
    rect: Rectangle;
    flags: number;
}
interface RipEndText extends RipCommand {
    type: 'EndText';
    opcode: 'ET';
}
interface RipOutText extends RipCommand {
    type: 'OutText';
    opcode: 'OT';
    text: string;
}
interface RipOutTextXY extends RipCommand {
    type: 'OutTextXY';
    opcode: 'OTX';
    point: Point;
    text: string;
}
interface RipRegionText extends RipCommand {
    type: 'RegionText';
    opcode: 'RT';
    rect: Rectangle;
    text: string;
}
interface RipTextWindow extends RipCommand {
    type: 'TextWindow';
    opcode: 'TW';
    rect: Rectangle;
}
interface RipButton extends RipCommand {
    type: 'Button';
    opcode: 'BU';
    rect: Rectangle;
    hotKey: number;
    flags: number;
    text: string;
}
interface RipButtonStyle extends RipCommand {
    type: 'ButtonStyle';
    opcode: 'BS';
}
interface RipMouse extends RipCommand {
    type: 'Mouse';
    opcode: 'MO';
    enabled: boolean;
}
interface RipKillMouseFields extends RipCommand {
    type: 'KillMouseFields';
    opcode: 'KM';
}
interface RipEraseEOL extends RipCommand {
    type: 'EraseEOL';
    opcode: 'EE';
}
interface RipEraseView extends RipCommand {
    type: 'EraseView';
    opcode: 'EV';
}
interface RipEraseWindow extends RipCommand {
    type: 'EraseWindow';
    opcode: 'EW';
    rect: Rectangle;
}
interface RipResetWindows extends RipCommand {
    type: 'ResetWindows';
    opcode: 'RW';
}
interface RipGetImage extends RipCommand {
    type: 'GetImage';
    opcode: 'GI';
    rect: Rectangle;
    id: number;
}
interface RipPutImage extends RipCommand {
    type: 'PutImage';
    opcode: 'PI';
    point: Point;
    writeMode: WriteMode;
    id: number;
}
interface RipLoadIcon extends RipCommand {
    type: 'LoadIcon';
    opcode: 'LI';
    point: Point;
    id: number;
    flags: number;
    filename: string;
}
interface RipWriteIcon extends RipCommand {
    type: 'WriteIcon';
    opcode: 'WI';
    point: Point;
    id: number;
}
type AnyRipCommand = RipLine | RipCircle | RipOval | RipArc | RipPolygon | RipPolyLine | RipBar | RipDrawRectangle | RipBezier | RipPixel | RipFill | RipFilledPolygon | RipFilledOval | RipPieSlice | RipOvalPieSlice | RipOvalArc | RipColor | RipFillStyle | RipLineStyle | RipFontStyle | RipViewPort | RipGotoXY | RipMove | RipHome | RipWriteMode | RipSetPalette | RipOnePalette | RipFillPattern | RipBeginText | RipEndText | RipOutText | RipOutTextXY | RipRegionText | RipTextWindow | RipButton | RipButtonStyle | RipMouse | RipKillMouseFields | RipEraseEOL | RipEraseView | RipEraseWindow | RipResetWindows | RipGetImage | RipPutImage | RipLoadIcon | RipWriteIcon;

/**
 * Parse a RIP file and return commands and metadata
 */
declare function parseRip(data: Uint8Array, debug?: boolean): {
    commands: AnyRipCommand[];
    width: number;
    height: number;
    state: RipState;
};

/**
 * Convert FrameData to AnsiScreen
 * Downsamples RGB pixel data to character cells and selects appropriate
 * colors and block characters based on the palette mode
 */
declare function convertFrameDataToAnsi(frame: FrameData, columns: number, rows: number, palette?: PaletteMode): AnsiScreen;

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

export { ANSI_COLORS_RGB, AnsiArt, type AnsiArtFrameGeneratorOptions, type AnsiArtProps, type AnsiFrameGeneratorOptions, AnsiPlayerOverlay, type AnsiPlayerOverlayProps, AnsiVirtualDisplay, type AnsiVirtualDisplayProps, type AnyRipCommand, type AsciiFireOptions, type AsciiPerlinPlasmaOptions, type BitmapFont, type CharacterEncoding, type CharacterFrameGenerator, type CharacterFrameGeneratorWithMetadata, Direction, type DisplayFrameGenerator, FillStyle, FontCharacterChart, type FontCharacterChartProps, type FontExtractionResult, FontStyle, type FrameConverter, type FrameData, type FrameGenerator, type GeneratorCapabilities, LineStyle, type OctaveConfig, type PaletteMode, type PerformanceStats, type PixelFrameGenerator, PlasmaBackgroundLayout, type PlasmaBackgroundLayoutProps, type Point, type RGBAColor, type Rectangle, RipArt, type RipArtProps, type RipState, type SauceMetadata, type Size, type ViewportConfig, WriteMode, clearFireState, clearFontCache, convertFrameDataToAnsi, createAnsiArtFrameGenerator, createAnsiFrameGenerator, createAsciiFireSampler, createAsciiPerlinPlasmaSampler, detectAnimation, drawPerformanceOverlay, extractFontFromFON, generateAsciiFireFrame, generateAsciiPerlinPlasmaFrame, generateEvenlySpacedPalette, getPalette, getSauceInfo, loadBitmapFontFromUrl, loadRawBitmapFont, parseAnsi, parseAscii, parseRip, parseSauce, renderGlyph, renderText, rgbToAnsiColor, rgbToPaletteColor };
