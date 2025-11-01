import * as react_jsx_runtime from 'react/jsx-runtime';

type AnsiArtProps = {
    src: string;
    columns?: number;
    fontSizePx?: number;
    fontFamily?: string;
    background?: string;
    allowDrop?: boolean;
    yScale?: number;
    renderMode?: 'dom' | 'canvas';
    cellWidthPx?: number;
    cellHeightPx?: number;
    bitmapFontUrl?: string;
    debugFont?: boolean;
    animated?: boolean;
    frameDelay?: number;
    animationSpeed?: number;
    showControls?: boolean;
};
declare function AnsiArt({ src, columns, fontSizePx, fontFamily, background, allowDrop, yScale, renderMode, cellWidthPx, cellHeightPx, bitmapFontUrl, debugFont, animated, frameDelay, animationSpeed, showControls, }: AnsiArtProps): react_jsx_runtime.JSX.Element;

export { AnsiArt, type AnsiArtProps };
