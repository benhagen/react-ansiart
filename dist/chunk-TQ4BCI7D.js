import {
  parseAnsiCore
} from "./chunk-BBNH5DIF.js";

// src/generators/ansiFrameGenerator.ts
function createEmptyRow(columns) {
  return Array(columns).fill(null).map(() => ({
    ch: " ",
    fg: 7,
    bg: 0,
    bold: false
  }));
}
function createAnsiFrameGenerator(options) {
  const {
    ansiData,
    mode,
    columns,
    rows: displayRows,
    finalHeightForCanvas,
    bytesPerSecond: initialBytesPerSecond = 960,
    // Default: 9600 baud = 960 bytes/sec (baud/10 conversion)
    fps = 30,
    // Default: 30 fps
    onDimensionsChange,
    onScrollChange,
    debugCursorCodes = false
  } = options;
  let currentBytesPerSecond = initialBytesPerSecond;
  if (mode === "final") {
    let cachedScreen = null;
    if (columns !== void 0) {
      cachedScreen = parseAnsiCore(ansiData, { columns });
    } else {
      cachedScreen = parseAnsiCore(ansiData);
      if (onDimensionsChange) {
        onDimensionsChange({
          columns: cachedScreen.columns,
          rows: cachedScreen.lines.length
        });
      }
    }
    const generator2 = ((frame, cols, requestedRows) => {
      if (columns !== void 0) {
        const actualContent = cachedScreen.lines;
        const paddedLines = [];
        for (let i = 0; i < actualContent.length; i++) {
          paddedLines.push(actualContent[i]);
        }
        while (paddedLines.length < requestedRows) {
          paddedLines.push(createEmptyRow(columns));
        }
        return {
          lines: paddedLines,
          columns: cachedScreen.columns
        };
      }
      return cachedScreen;
    });
    generator2.capabilities = {
      supportsSeek: false,
      supportsSpeedControl: false
    };
    return generator2;
  }
  let lastFrame = -1;
  let lastNotifiedColumns = 0;
  let lastNotifiedRows = 0;
  let lastNotifiedViewY = 0;
  let lastTargetByteIndex = -1;
  let lastParsedScreen = null;
  const generator = ((frame, cols, rows) => {
    if (frame < lastFrame) {
      lastNotifiedColumns = 0;
      lastNotifiedRows = 0;
      lastNotifiedViewY = 0;
      lastTargetByteIndex = -1;
      lastParsedScreen = null;
    }
    lastFrame = frame;
    const elapsedSeconds = frame / fps;
    const targetByteIndex = Math.min(
      Math.floor(elapsedSeconds * currentBytesPerSecond),
      ansiData.length
    );
    let screen;
    if (targetByteIndex === lastTargetByteIndex && lastParsedScreen) {
      screen = lastParsedScreen;
    } else if (columns !== void 0) {
      screen = parseAnsiCore(ansiData, { columns, maxByteIndex: targetByteIndex });
      lastTargetByteIndex = targetByteIndex;
      lastParsedScreen = screen;
      if (displayRows !== void 0) {
        const contentRows = screen.lines.length;
        const viewY = Math.max(0, contentRows - displayRows);
        if (onScrollChange && viewY !== lastNotifiedViewY) {
          onScrollChange({
            viewY,
            contentRows
          });
          lastNotifiedViewY = viewY;
        }
        const windowStart = viewY;
        const windowEnd = Math.min(windowStart + displayRows, contentRows);
        const windowedLines = screen.lines.slice(windowStart, windowEnd);
        screen.lines = [...windowedLines];
        while (screen.lines.length < displayRows) {
          screen.lines.push(createEmptyRow(columns));
        }
      } else if (displayRows === void 0 && finalHeightForCanvas !== void 0) {
        while (screen.lines.length < finalHeightForCanvas) {
          screen.lines.push(createEmptyRow(columns));
        }
      }
    } else {
      screen = parseAnsiCore(ansiData, { maxByteIndex: targetByteIndex });
      lastTargetByteIndex = targetByteIndex;
      lastParsedScreen = screen;
      if (onDimensionsChange) {
        const currentColumns = screen.columns;
        const currentRows = screen.lines.length;
        if (currentColumns !== lastNotifiedColumns || currentRows !== lastNotifiedRows) {
          onDimensionsChange({
            columns: currentColumns,
            rows: currentRows
          });
          lastNotifiedColumns = currentColumns;
          lastNotifiedRows = currentRows;
        }
      }
    }
    return screen;
  });
  generator.capabilities = {
    supportsSeek: true,
    supportsSpeedControl: true,
    getTotalBytes: () => ansiData.length,
    getTotalFrames: () => Math.ceil(ansiData.length / currentBytesPerSecond * fps)
  };
  generator.setSpeed = (bytesPerSecond) => {
    currentBytesPerSecond = bytesPerSecond;
  };
  generator.getCurrentSpeed = () => {
    return currentBytesPerSecond;
  };
  return generator;
}
function createAnsiArtFrameGenerator(options) {
  const {
    ansiData,
    mode,
    columns,
    rows,
    finalHeightForAnimated,
    bytesPerSecond = 960,
    // Default: 9600 baud = 960 bytes/sec
    fps = 30,
    onDimensionsChange,
    onScrollChange,
    debugCursorCodes = false
  } = options;
  return createAnsiFrameGenerator({
    ansiData,
    mode,
    columns,
    rows,
    finalHeightForCanvas: finalHeightForAnimated,
    bytesPerSecond,
    fps,
    onDimensionsChange,
    onScrollChange,
    debugCursorCodes
  });
}

export {
  createAnsiFrameGenerator,
  createAnsiArtFrameGenerator
};
//# sourceMappingURL=chunk-TQ4BCI7D.js.map