import * as react_jsx_runtime from 'react/jsx-runtime';

type AnsiArtProps = {
    src: string;
    mode?: 'animated' | 'final' | 'auto';
    columns?: number | 'auto';
    rows?: number | 'auto';
    background?: string;
    bitmapFontUrl?: string;
    /** @deprecated Use `showOverlayControls` instead */
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

export { AnsiArt, type AnsiArtProps };
