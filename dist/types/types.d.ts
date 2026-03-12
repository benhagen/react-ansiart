import { AnsiScreen } from '../ansi/types.js';
import { PaletteMode } from '../utils/rgbToAnsi.js';
import '../utils/sauce.js';

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

export type { CharacterFrameGenerator, CharacterFrameGeneratorWithMetadata, DisplayFrameGenerator, FrameConverter, FrameData, FrameGenerator, GeneratorCapabilities, PixelFrameGenerator, RGBAColor, ViewportConfig };
