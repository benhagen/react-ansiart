import { CharacterFrameGeneratorWithMetadata } from '../types/types.js';
import '../ansi/types.js';
import '../utils/sauce.js';
import '../utils/rgbToAnsi.js';

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

export { type AnsiArtFrameGeneratorOptions, type AnsiFrameGeneratorOptions, createAnsiArtFrameGenerator, createAnsiFrameGenerator };
