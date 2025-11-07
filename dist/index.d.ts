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
};
declare function AnsiArt({ src, columns, background, allowDrop, bitmapFontUrl, debugFont, animated, frameDelay, bytesPerFrame, linesPerFrame, animateBy, showControls, debugPerformance, }: AnsiArtProps): react_jsx_runtime.JSX.Element;

type AnsiCell = {
    ch: string;
    fg: number | string;
    bg: number | string;
    bold: boolean;
};
type AnsiScreen = {
    lines: AnsiCell[][];
    columns: number;
};

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
type ViewportConfig = {
    virtualColumns: number;
    virtualRows: number;
    viewX: number;
    viewY: number;
};

type AnsiVirtualDisplayProps = {
    columns?: number;
    rows?: number;
    cellWidthPx?: number;
    cellHeightPx?: number;
    frameGenerator?: DisplayFrameGenerator;
    fps?: number;
    fontFamily?: string;
    background?: string;
    bitmapFontUrl?: string;
    showControls?: boolean;
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
declare function AnsiVirtualDisplay({ columns, rows, cellWidthPx, cellHeightPx, frameGenerator, fps, fontFamily, background, bitmapFontUrl, showControls, showPerformanceOverlay, fillContainer, virtualColumns, virtualRows, viewX, viewY, pixelOffsetX, pixelOffsetY, onViewChange, }: AnsiVirtualDisplayProps): react_jsx_runtime.JSX.Element;

/**
 * ASCII Perlin Plasma Effect Component
 *
 * A configurable React component that generates a classic demoscene style flowing plasma effect
 * using Perlin noise and ASCII characters rendered on an HTML5 Canvas.
 *
 * @example
 * ```tsx
 * <AsciiPerlinPlasma
 *   charWidth={12}
 *   charHeight={16}
 *   color="#00FFFF"
 *   fpsCap={30}
 *   timeScale={0.5}
 * />
 * ```
 *
 * Performance Optimizations:
 * - HTML5 Canvas rendering (5-10x faster than DOM text manipulation)
 * - Pre-computed character lookup table (256 entries)
 * - Object pooling for row buffers to avoid GC pressure
 * - Optimized hash function for faster noise generation
 * - Cached octave configurations
 * - High-DPI canvas scaling for crisp rendering
 * - FPS capping to prevent excessive CPU usage
 * - Centralized color definition matching SCSS theme
 *
 * Features:
 * - 2D Perlin noise implementation
 * - Multiple octaves for detail
 * - Independent X/Y movement
 * - Dynamic resizing
 * - GPU-accelerated canvas rendering
 * - Fully configurable via props
 */

interface OctaveConfig$1 {
    scale: number;
    amplitude: number;
    timeScaleX: number;
    timeScaleY: number;
}
interface AsciiPerlinPlasmaProps {
    /** Width of each character in pixels */
    charWidth?: number;
    /** Height of each character in pixels */
    charHeight?: number;
    /** Array of characters to use for ASCII rendering */
    chars?: string[];
    /** Animation speed multiplier */
    timeScale?: number;
    /** Maximum FPS to cap animation at */
    fpsCap?: number;
    /** Text color (CSS color string). Default: 'rgba(138, 230, 230, 1)'. Accepts any valid CSS color (hex, rgb, rgba, hsl, named colors, etc.) */
    color?: string;
    /** Noise octave configurations */
    octaves?: OctaveConfig$1[];
    /** Additional CSS class name */
    className?: string;
    /** Vertical offset for scrolling (in pixels) */
    yOffset?: number;
    /** Virtual height of the full scrollable content (in pixels) - for maintaining consistency across scroll */
    virtualHeight?: number;
}
declare const AsciiPerlinPlasma: React.FC<AsciiPerlinPlasmaProps>;

interface PlasmaBackgroundLayoutProps extends Omit<AsciiPerlinPlasmaProps, 'className'> {
    children: React.ReactNode;
    mode?: 'fixed' | 'scrollable';
    contentClassName?: string;
    contentStyle?: React.CSSProperties;
    plasmaClassName?: string;
    virtualWidthPx?: number;
    virtualHeightPx?: number;
    fgColor?: string;
    bgColor?: string;
    showPerformanceOverlay?: boolean;
    fps?: number;
    bitmapFontUrl?: string;
}
declare function PlasmaBackgroundLayout({ children, mode, contentClassName, contentStyle, plasmaClassName, virtualWidthPx, virtualHeightPx, fgColor, bgColor, showPerformanceOverlay, fps, bitmapFontUrl, ...plasmaProps }: PlasmaBackgroundLayoutProps): react_jsx_runtime.JSX.Element;

type FontCharacterChartProps = {
    bitmapFontUrl: string;
};
declare function FontCharacterChart({ bitmapFontUrl }: FontCharacterChartProps): react_jsx_runtime.JSX.Element;

/**
 * 2D Perlin noise
 * @param x X coordinate
 * @param y Y coordinate
 * @returns Noise value between -1 and 1 (typically normalized to 0-1)
 */
declare function perlinNoise2D(x: number, y: number): number;
/**
 * 3D Perlin noise
 * @param x X coordinate
 * @param y Y coordinate
 * @param z Z coordinate
 * @returns Noise value between -1 and 1 (typically normalized to 0-1)
 */
declare function perlinNoise3D(x: number, y: number, z: number): number;
/**
 * 2D or 3D Perlin noise
 * @param x X coordinate
 * @param y Y coordinate
 * @param z Optional Z coordinate for 3D noise
 * @returns Noise value between -1 and 1
 */
declare function perlinNoise(x: number, y: number, z?: number): number;

/**
 * Generate a plasma effect frame using Perlin noise
 * Creates flowing, organic color patterns that animate smoothly
 */
declare function generatePlasmaFrame(frame: number, width: number, height: number): FrameData;

/**
 * Convert FrameData to AnsiScreen
 * Downsamples RGB pixel data to character cells and selects appropriate
 * colors and block characters based on the palette mode
 */
declare function convertFrameDataToAnsi(frame: FrameData, columns: number, rows: number, palette?: PaletteMode): AnsiScreen;

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

export { ANSI_COLORS_RGB, AnsiArt, type AnsiArtProps, AnsiVirtualDisplay, type AnsiVirtualDisplayProps, AsciiPerlinPlasma, type AsciiPerlinPlasmaOptions, type AsciiPerlinPlasmaProps, type CharacterFrameGenerator, type DisplayFrameGenerator, FontCharacterChart, type FontCharacterChartProps, type FrameConverter, type FrameData, type FrameGenerator, type OctaveConfig, type PaletteMode, type PixelFrameGenerator, PlasmaBackgroundLayout, type PlasmaBackgroundLayoutProps, type RGBAColor, type ViewportConfig, convertFrameDataToAnsi, createAsciiPerlinPlasmaSampler, generateAsciiPerlinPlasmaFrame, generateEvenlySpacedPalette, generatePlasmaFrame, getPalette, perlinNoise, perlinNoise2D, perlinNoise3D, rgbToAnsiColor, rgbToPaletteColor };
