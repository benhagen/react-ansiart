import * as react_jsx_runtime from 'react/jsx-runtime';
import React from 'react';
import { AsciiPerlinPlasmaOptions } from '../generators/plasma.js';
import '../ansi/types.js';
import '../utils/sauce.js';

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
    bitmapFontUrl?: string;
}
declare function PlasmaBackgroundLayout({ children, mode, contentClassName, contentStyle, plasmaClassName, generatorType, virtualWidthPx, virtualHeightPx, chars, timeScale, octaves, seed, darkenAmount, sparkRange, fgColor, bgColor, showPerformanceOverlay, fps, bitmapFontUrl, }: PlasmaBackgroundLayoutProps): react_jsx_runtime.JSX.Element;

export { PlasmaBackgroundLayout, type PlasmaBackgroundLayoutProps };
