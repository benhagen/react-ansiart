// src/generators/asciiFireGenerator.ts
var DEFAULT_CHARS = [" ", ".", ":", ";", "+", "=", "x", "X", "$", "&", "#", "@"];
var DEFAULT_DARKEN_AMOUNT = 0.5;
var DEFAULT_SPARK_RANGE = [200, 255];
var DEFAULT_BG_COLOR = "#000000";
var DEFAULT_SEED = 12345;
function generateFirePalette() {
  const palette = [];
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let r;
    let g;
    let b;
    if (t < 0.3) {
      const localT = t / 0.3;
      r = Math.floor(localT * 50);
      g = 0;
      b = 0;
    } else if (t < 0.6) {
      const localT = (t - 0.3) / 0.3;
      r = Math.floor(50 + localT * 200);
      g = Math.floor(localT * 30);
      b = 0;
    } else if (t < 0.85) {
      const localT = (t - 0.6) / 0.25;
      r = 255;
      g = Math.floor(30 + localT * 100);
      b = 0;
    } else {
      const localT = (t - 0.85) / 0.15;
      r = 255;
      g = Math.floor(130 + localT * 125);
      b = Math.floor(localT * 50);
    }
    palette[i] = `rgb(${r},${g},${b})`;
  }
  return palette;
}
var FIRE_PALETTE = generateFirePalette();
var lastFireChars = null;
var lastFireCharLookup = null;
function getFireCharLookup(chars) {
  if (lastFireChars === chars && lastFireCharLookup) return lastFireCharLookup;
  const charCount = chars.length;
  const lookup = new Array(256);
  for (let i = 0; i < 256; i++) {
    lookup[i] = chars[Math.floor(i / 255 * (charCount - 1e-3))];
  }
  lastFireChars = chars;
  lastFireCharLookup = lookup;
  return lookup;
}
function createRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}
function calculateNaturalFireHeight(darkenAmount, sparkRange) {
  const maxHeat = sparkRange[1];
  const naturalHeight = Math.ceil(maxHeat / darkenAmount);
  return Math.max(30, Math.min(200, naturalHeight));
}
var fireStateMap = /* @__PURE__ */ new Map();
function generateAsciiFireFrame(frame, columns, rows, options = {}) {
  const {
    chars = DEFAULT_CHARS,
    darkenAmount = DEFAULT_DARKEN_AMOUNT,
    sparkRange = DEFAULT_SPARK_RANGE,
    bgColor = DEFAULT_BG_COLOR,
    seed = DEFAULT_SEED
  } = options;
  const naturalHeight = calculateNaturalFireHeight(darkenAmount, sparkRange);
  const actualBufferHeight = Math.min(naturalHeight, rows);
  const charLookup = getFireCharLookup(chars);
  const stateKey = JSON.stringify({ columns, rows, seed, darkenAmount, sparkRange, naturalHeight });
  let state = fireStateMap.get(stateKey);
  if (!state || frame < state.lastFrame) {
    const bufferRows2 = actualBufferHeight + 1;
    const buffer = new Uint8Array(columns * bufferRows2);
    const bottomRowStart2 = (bufferRows2 - 1) * columns;
    for (let x = 0; x < columns; x++) {
      buffer[bottomRowStart2 + x] = 255;
    }
    for (let y = actualBufferHeight - 1; y >= Math.max(0, actualBufferHeight - 5); y--) {
      for (let x = 0; x < columns; x++) {
        const idx = y * columns + x;
        const distFromBottom = actualBufferHeight - 1 - y;
        const heat = Math.max(0, 255 - distFromBottom * 50);
        buffer[idx] = heat;
      }
    }
    state = { buffer, lastFrame: -1 };
    fireStateMap.set(stateKey, state);
  }
  const fireBuffer = state.buffer;
  state.lastFrame = frame;
  const random = createRandom(seed + frame);
  let readBuffer = state.readBuffer;
  if (!readBuffer || readBuffer.length !== fireBuffer.length) {
    readBuffer = new Uint8Array(fireBuffer.length);
    state.readBuffer = readBuffer;
  }
  readBuffer.set(fireBuffer);
  const bufferRows = actualBufferHeight + 1;
  const bottomRowStart = (bufferRows - 1) * columns;
  for (let x = 0; x < columns; x++) {
    const sparkValue = Math.floor(sparkRange[0] + random() * (sparkRange[1] - sparkRange[0]));
    fireBuffer[bottomRowStart + x] = sparkValue;
  }
  for (let y = actualBufferHeight - 1; y >= 0; y--) {
    for (let x = 0; x < columns; x++) {
      const currentIdx = y * columns + x;
      const belowY = y + 1;
      const leftX = (x - 1 + columns) % columns;
      const rightX = (x + 1) % columns;
      const belowIdx = belowY * columns + x;
      const belowLeftIdx = belowY * columns + leftX;
      const belowRightIdx = belowY * columns + rightX;
      const avg = (readBuffer[belowIdx] + readBuffer[belowLeftIdx] + readBuffer[belowRightIdx]) / 3;
      const darkened = Math.max(0, avg - darkenAmount);
      fireBuffer[currentIdx] = Math.floor(darkened);
    }
  }
  const lines = [];
  for (let y = 0; y < actualBufferHeight; y++) {
    const line = [];
    for (let x = 0; x < columns; x++) {
      const paletteIndex = fireBuffer[y * columns + x];
      const ch = charLookup[paletteIndex];
      const fgColor = FIRE_PALETTE[paletteIndex];
      line.push({ ch, fg: fgColor, bg: bgColor, bold: false });
    }
    lines.push(line);
  }
  for (let y = actualBufferHeight; y < rows; y++) {
    const line = [];
    for (let x = 0; x < columns; x++) {
      line.push({ ch: " ", fg: FIRE_PALETTE[0], bg: bgColor, bold: false });
    }
    lines.push(line);
  }
  return { lines, columns };
}
var samplerStateMap = /* @__PURE__ */ new Map();
function createAsciiFireSampler(frame, options = {}) {
  const {
    chars = DEFAULT_CHARS,
    darkenAmount = DEFAULT_DARKEN_AMOUNT,
    sparkRange = DEFAULT_SPARK_RANGE,
    bgColor = DEFAULT_BG_COLOR,
    seed = DEFAULT_SEED,
    worldHeight,
    // Optional: height of virtual world in scrollable mode
    worldWidth
    // Optional: width of virtual world in scrollable mode
  } = options;
  const charLookup = getFireCharLookup(chars);
  const naturalHeight = calculateNaturalFireHeight(darkenAmount, sparkRange);
  const bufferCols = worldWidth || 200;
  const stateKey = JSON.stringify({
    seed,
    darkenAmount,
    sparkRange,
    naturalHeight
  });
  let samplerState = samplerStateMap.get(stateKey);
  const bufferRows = naturalHeight + 1;
  if (samplerState) {
    if (frame < samplerState.lastFrame) {
      const buffer = new Uint8Array(bufferCols * bufferRows);
      const bottomRowStart = (bufferRows - 1) * bufferCols;
      for (let x = 0; x < bufferCols; x++) {
        buffer[bottomRowStart + x] = 255;
      }
      for (let y = bufferRows - 2; y >= Math.max(0, bufferRows - 6); y--) {
        for (let x = 0; x < bufferCols; x++) {
          const idx = y * bufferCols + x;
          const distFromBottom = bufferRows - 2 - y;
          const heat = Math.max(0, 255 - distFromBottom * 50);
          buffer[idx] = heat;
        }
      }
      samplerState.buffer = buffer;
      samplerState.bufferCols = bufferCols;
      samplerState.bufferRows = bufferRows;
      samplerState.lastFrame = -1;
    } else if (samplerState.bufferCols !== bufferCols || samplerState.bufferRows !== bufferRows) {
      const oldBuffer = samplerState.buffer;
      const oldCols = samplerState.bufferCols;
      const oldRows = samplerState.bufferRows;
      const newBuffer = new Uint8Array(bufferCols * bufferRows);
      for (let y = 0; y < bufferRows; y++) {
        for (let x = 0; x < bufferCols; x++) {
          const newIdx = y * bufferCols + x;
          if (x < oldCols && y < oldRows) {
            const oldIdx = y * oldCols + x;
            newBuffer[newIdx] = oldBuffer[oldIdx];
          } else {
            if (y === bufferRows - 1) {
              newBuffer[newIdx] = 255;
            } else {
              newBuffer[newIdx] = 0;
            }
          }
        }
      }
      samplerState.buffer = newBuffer;
      samplerState.bufferCols = bufferCols;
      samplerState.bufferRows = bufferRows;
    }
  } else {
    const buffer = new Uint8Array(bufferCols * bufferRows);
    const bottomRowStart = (bufferRows - 1) * bufferCols;
    for (let x = 0; x < bufferCols; x++) {
      buffer[bottomRowStart + x] = 255;
    }
    for (let y = bufferRows - 2; y >= Math.max(0, bufferRows - 6); y--) {
      for (let x = 0; x < bufferCols; x++) {
        const idx = y * bufferCols + x;
        const distFromBottom = bufferRows - 2 - y;
        const heat = Math.max(0, 255 - distFromBottom * 50);
        buffer[idx] = heat;
      }
    }
    samplerState = { buffer, bufferCols, bufferRows, lastFrame: -1 };
    samplerStateMap.set(stateKey, samplerState);
  }
  const virtualBuffer = samplerState.buffer;
  const currentBufferCols = samplerState.bufferCols;
  const currentBufferRows = samplerState.bufferRows;
  if (frame > samplerState.lastFrame) {
    let readBuffer = samplerState.readBuffer;
    if (!readBuffer || readBuffer.length !== virtualBuffer.length) {
      readBuffer = new Uint8Array(virtualBuffer.length);
      samplerState.readBuffer = readBuffer;
    }
    readBuffer.set(virtualBuffer);
    const random = createRandom(seed + frame);
    const bottomRowStart = (currentBufferRows - 1) * currentBufferCols;
    for (let x = 0; x < currentBufferCols; x++) {
      const sparkValue = Math.floor(sparkRange[0] + random() * (sparkRange[1] - sparkRange[0]));
      virtualBuffer[bottomRowStart + x] = sparkValue;
    }
    for (let y = currentBufferRows - 2; y >= 0; y--) {
      for (let x = 0; x < currentBufferCols; x++) {
        const currentIdx = y * currentBufferCols + x;
        const belowY = y + 1;
        const leftX = (x - 1 + currentBufferCols) % currentBufferCols;
        const rightX = (x + 1) % currentBufferCols;
        const belowIdx = belowY * currentBufferCols + x;
        const belowLeftIdx = belowY * currentBufferCols + leftX;
        const belowRightIdx = belowY * currentBufferCols + rightX;
        const avg = (readBuffer[belowIdx] + readBuffer[belowLeftIdx] + readBuffer[belowRightIdx]) / 3;
        const darkened = Math.max(0, avg - darkenAmount);
        virtualBuffer[currentIdx] = Math.floor(darkened);
      }
    }
    samplerState.lastFrame = frame;
  }
  return (x, y) => {
    const wrappedX = (x % currentBufferCols + currentBufferCols) % currentBufferCols;
    const actualWorldHeight = worldHeight || currentBufferRows;
    const fireStartY = Math.max(0, actualWorldHeight - naturalHeight);
    if (y < fireStartY) {
      return { ch: " ", fg: FIRE_PALETTE[0], bg: bgColor, bold: false };
    }
    const bufferY = y - fireStartY;
    const clampedY = Math.max(0, Math.min(bufferY, currentBufferRows - 2));
    const paletteIndex = virtualBuffer[clampedY * currentBufferCols + wrappedX];
    const ch = charLookup[paletteIndex];
    const fgColor = FIRE_PALETTE[paletteIndex];
    return { ch, fg: fgColor, bg: bgColor, bold: false };
  };
}
function clearFireState() {
  fireStateMap.clear();
  samplerStateMap.clear();
}

export {
  generateAsciiFireFrame,
  createAsciiFireSampler,
  clearFireState
};
//# sourceMappingURL=chunk-OE5RWVGH.js.map