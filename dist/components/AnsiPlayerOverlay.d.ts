import * as react_jsx_runtime from 'react/jsx-runtime';
import { SauceMetadata } from '../utils/sauce.js';

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

export { AnsiPlayerOverlay, type AnsiPlayerOverlayProps };
