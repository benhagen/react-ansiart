import * as react_jsx_runtime from 'react/jsx-runtime';
import React from 'react';
import { DisplayFrameGenerator } from '../types/types.js';
import { AsciiPerlinPlasmaOptions } from '../generators/plasma.js';
import '../ansi/types.js';
import '../utils/sauce.js';
import '../utils/rgbToAnsi.js';

interface PlasmaBackgroundLayoutProps {
    children: React.ReactNode;
    mode?: 'fixed' | 'scrollable';
    contentClassName?: string;
    contentStyle?: React.CSSProperties;
    plasmaClassName?: string;
    frameGenerator?: DisplayFrameGenerator;
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
    bitmapFontUrl?: string;
}
declare function PlasmaBackgroundLayout({ children, mode, contentClassName, contentStyle, plasmaClassName, frameGenerator: externalFrameGenerator, generatorType, virtualWidthPx, virtualHeightPx, chars, timeScale, octaves, seed, darkenAmount, sparkRange, fgColor, bgColor, showPerformanceOverlay, fps, bitmapFontUrl, }: PlasmaBackgroundLayoutProps): react_jsx_runtime.JSX.Element;
/** Alias for PlasmaBackgroundLayout — supports any generator via frameGenerator prop */
declare const GeneratorBackgroundLayout: typeof PlasmaBackgroundLayout;
type GeneratorBackgroundLayoutProps = PlasmaBackgroundLayoutProps;

export { GeneratorBackgroundLayout, type GeneratorBackgroundLayoutProps, PlasmaBackgroundLayout, type PlasmaBackgroundLayoutProps };
