import * as react_jsx_runtime from 'react/jsx-runtime';
import { SauceMetadata } from '../utils/sauce.js';
import { BitmapFont } from '../font/bitmapFont.js';
import { DisplayFrameGenerator } from '../types/types.js';
import '../ansi/types.js';
import '../utils/rgbToAnsi.js';

type AnsiVirtualDisplayProps = {
    columns?: number;
    rows?: number;
    frameGenerator: DisplayFrameGenerator;
    fps?: number;
    background?: string;
    bitmapFont?: BitmapFont;
    bitmapFontUrl?: string;
    /** @deprecated Use `showOverlayControls` instead */
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

export { AnsiVirtualDisplay, type AnsiVirtualDisplayProps };
