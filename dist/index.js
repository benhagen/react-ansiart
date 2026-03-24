import {
  createAsciiSonarSampler,
  generateAsciiSonarFrame
} from "./chunk-PMMVU7JC.js";
import {
  clearDatamoshState,
  createAsciiDatamoshSampler,
  generateAsciiDatamoshFrame
} from "./chunk-IL2CPPL5.js";
import {
  createAsciiMetaballsSampler,
  generateAsciiMetaballsFrame
} from "./chunk-3DMUFRSN.js";
import {
  convertFrameDataToAnsi
} from "./chunk-DXUCCFEC.js";
import {
  ANSI_COLORS_RGB,
  generateEvenlySpacedPalette,
  getPalette,
  rgbToAnsiColor,
  rgbToPaletteColor
} from "./chunk-5HWPP6FR.js";
import {
  AnsiArt
} from "./chunk-T72OEH7A.js";
import {
  createAnsiArtFrameGenerator,
  createAnsiFrameGenerator
} from "./chunk-LSGSMP4Z.js";
import {
  detectAnimation,
  parseAnsi,
  parseAscii
} from "./chunk-3PHKD3AN.js";
import {
  getSauceInfo,
  parseSauce
} from "./chunk-Y5FXFALI.js";
import {
  GeneratorBackgroundLayout,
  PlasmaBackgroundLayout
} from "./chunk-XGLY2GX5.js";
import {
  AnsiVirtualDisplay,
  drawPerformanceOverlay
} from "./chunk-4RKQEKOE.js";
import {
  clearFontCache,
  loadBitmapFontFromUrl
} from "./chunk-GBKXSTBJ.js";
import {
  AnsiPlayerOverlay
} from "./chunk-54OD6GSV.js";
import {
  FontCharacterChart
} from "./chunk-FI6FNZEI.js";
import {
  extractFontFromFON
} from "./chunk-ISKFY25D.js";
import {
  getEmbeddedVgaFont
} from "./chunk-H72Q7PYO.js";
import "./chunk-RZAN2XLW.js";
import {
  loadRawBitmapFont,
  renderGlyph,
  renderText
} from "./chunk-XYPTVL3M.js";
import {
  createAsciiPerlinPlasmaSampler,
  generateAsciiPerlinPlasmaFrame
} from "./chunk-YVQNOSJZ.js";
import {
  buildCharLookup
} from "./chunk-IA5TXP7D.js";
import {
  clearFireState,
  createAsciiFireSampler,
  generateAsciiFireFrame
} from "./chunk-WICQIU2Y.js";

// src/ansi/shapeAsciiConverter.ts
var K = 6;
var TOTAL_SAMPLES = K + 10;
var S_PTS = [
  { x: 0.3, y: 0.23 },
  { x: 0.7, y: 0.18 },
  { x: 0.3, y: 0.5 },
  { x: 0.7, y: 0.5 },
  { x: 0.3, y: 0.82 },
  { x: 0.7, y: 0.77 }
];
var E_PTS = [
  { x: 0.07, y: -0.21, a: [0, 1] },
  { x: 0.93, y: -0.21, a: [0, 1] },
  { x: -0.25, y: 0.07, a: [0, 2] },
  { x: 1.25, y: 0.07, a: [1, 3] },
  { x: -0.25, y: 0.5, a: [0, 2, 4] },
  { x: 1.25, y: 0.5, a: [1, 3, 5] },
  { x: -0.25, y: 0.93, a: [2, 4] },
  { x: 1.25, y: 0.93, a: [3, 5] },
  { x: 0.07, y: 1.21, a: [4, 5] },
  { x: 0.93, y: 1.21, a: [4, 5] }
];
var E_AFF = Array.from({ length: K }, () => []);
for (let e = 0; e < E_PTS.length; e++) {
  for (const i of E_PTS[e].a) E_AFF[i].push(e);
}
var Q_BITS = 5;
var Q_RANGE = 1 << Q_BITS;
var Q_MAX = Q_RANGE - 1;
var DEFAULT_CONTRAST_EXP = 2.2;
var PRESET_ASCII = " !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
var PRESET_CP437 = PRESET_ASCII + "\u2591\u2592\u2593\u2588\u2584\u258C\u2590\u2580";
var SHAPE_CHAR_PRESETS = {
  ascii: PRESET_ASCII,
  cp437: PRESET_CP437,
  minimal: " .:-=+*#%@",
  blocks: " \u2591\u2592\u2593\u2588"
};
function sampleCircleBitmap(glyph, fontWidth, fontHeight, cx, cy, r) {
  const r2 = r * r;
  const x0 = Math.max(0, cx - r | 0);
  const y0 = Math.max(0, cy - r | 0);
  const x1 = Math.min(fontWidth - 1, cx + r + 1 | 0);
  const y1 = Math.min(fontHeight - 1, cy + r + 1 | 0);
  let sum = 0;
  let n = 0;
  for (let y = y0; y <= y1; y++) {
    const dy2 = (y - cy) * (y - cy);
    const byte = glyph[y];
    for (let x = x0; x <= x1; x++) {
      if ((x - cx) * (x - cx) + dy2 <= r2) {
        sum += byte >> 7 - x & 1;
        n++;
      }
    }
  }
  return n > 0 ? sum / n : 0;
}
function sampleCellPoints(buf, w, h, cellX, cellY, cellW, cellH, sampleR, internal, external) {
  const r2 = sampleR * sampleR;
  const ptX = new Float64Array(TOTAL_SAMPLES);
  const ptY = new Float64Array(TOTAL_SAMPLES);
  for (let s = 0; s < K; s++) {
    ptX[s] = cellX + S_PTS[s].x * cellW;
    ptY[s] = cellY + S_PTS[s].y * cellH;
  }
  for (let e = 0; e < 10; e++) {
    ptX[K + e] = cellX + E_PTS[e].x * cellW;
    ptY[K + e] = cellY + E_PTS[e].y * cellH;
  }
  let outerX0 = ptX[0];
  let outerY0 = ptY[0];
  let outerX1 = ptX[0];
  let outerY1 = ptY[0];
  for (let i = 1; i < TOTAL_SAMPLES; i++) {
    if (ptX[i] < outerX0) outerX0 = ptX[i];
    if (ptY[i] < outerY0) outerY0 = ptY[i];
    if (ptX[i] > outerX1) outerX1 = ptX[i];
    if (ptY[i] > outerY1) outerY1 = ptY[i];
  }
  const x0 = Math.max(0, outerX0 - sampleR | 0);
  const y0 = Math.max(0, outerY0 - sampleR | 0);
  const x1 = Math.min(w - 1, outerX1 + sampleR + 1 | 0);
  const y1 = Math.min(h - 1, outerY1 + sampleR + 1 | 0);
  const sums = new Float64Array(TOTAL_SAMPLES);
  const counts = new Uint16Array(TOTAL_SAMPLES);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i3 = (y * w + x) * 3;
      const lum = 0.2126 * buf[i3] + 0.7152 * buf[i3 + 1] + 0.0722 * buf[i3 + 2];
      for (let p = 0; p < TOTAL_SAMPLES; p++) {
        const dx = x - ptX[p];
        const dy = y - ptY[p];
        if (dx * dx + dy * dy <= r2) {
          sums[p] += lum;
          counts[p]++;
        }
      }
    }
  }
  for (let s = 0; s < K; s++) {
    internal[s] = counts[s] > 0 ? sums[s] / (counts[s] * 255) : 0;
  }
  for (let e = 0; e < 10; e++) {
    external[e] = counts[K + e] > 0 ? sums[K + e] / (counts[K + e] * 255) : 0;
  }
}
function sampleCellColor(buf, w, h, cellX, cellY, cellW, cellH) {
  const cx = cellX + cellW * 0.5;
  const cy = cellY + cellH * 0.5;
  const dx = cellW * 0.25;
  const dy = cellH * 0.25;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let n = 0;
  const pts = [
    [cx - dx, cy - dy],
    [cx + dx, cy - dy],
    [cx - dx, cy + dy],
    [cx + dx, cy + dy]
  ];
  for (const [sx, sy] of pts) {
    const px = Math.min(Math.max(Math.floor(sx), 0), w - 1);
    const py = Math.min(Math.max(Math.floor(sy), 0), h - 1);
    const i = (py * w + px) * 3;
    sumR += buf[i];
    sumG += buf[i + 1];
    sumB += buf[i + 2];
    n++;
  }
  return [sumR / n, sumG / n, sumB / n];
}
function buildCharVecs(font, chars) {
  const vecs = [];
  const validChars = [];
  let gmax = 0;
  const sampleR = Math.max(1, Math.min(font.width, font.height) * 0.28);
  for (const char of chars) {
    const charCode = char.charCodeAt(0);
    const glyph = font.glyphs[charCode];
    if (!glyph) continue;
    const v = new Float32Array(K);
    for (let s = 0; s < K; s++) {
      v[s] = sampleCircleBitmap(
        glyph,
        font.width,
        font.height,
        S_PTS[s].x * font.width,
        S_PTS[s].y * font.height,
        sampleR
      );
      if (v[s] > gmax) gmax = v[s];
    }
    validChars.push(char);
    vecs.push(v);
  }
  if (gmax > 0) {
    for (const v of vecs) {
      for (let s = 0; s < K; s++) v[s] /= gmax;
    }
  }
  return { chars: validChars, vecs };
}
function sortByDiversity(vecs) {
  const n = vecs.length;
  const order = [0];
  const used = /* @__PURE__ */ new Set([0]);
  const minDists = new Float32Array(n).fill(Infinity);
  for (let i = 1; i < n; i++) {
    let d = 0;
    for (let j = 0; j < K; j++) {
      const t = vecs[i][j] - vecs[0][j];
      d += t * t;
    }
    minDists[i] = d;
  }
  while (order.length < n) {
    let bestIdx = -1;
    let bestDist = -1;
    for (let i = 0; i < n; i++) {
      if (!used.has(i) && minDists[i] > bestDist) {
        bestDist = minDists[i];
        bestIdx = i;
      }
    }
    if (bestIdx < 0) break;
    order.push(bestIdx);
    used.add(bestIdx);
    for (let i = 0; i < n; i++) {
      if (!used.has(i)) {
        let d = 0;
        for (let j = 0; j < K; j++) {
          const t = vecs[i][j] - vecs[bestIdx][j];
          d += t * t;
        }
        if (d < minDists[i]) minDists[i] = d;
      }
    }
  }
  return order;
}
function qKey(v) {
  let k = 0;
  for (let i = 0; i < K; i++) {
    k = k * Q_RANGE + Math.min(Q_MAX, Math.max(0, v[i] * Q_RANGE | 0));
  }
  return k;
}
function findNearest(v, vecs, activeIndices, cache) {
  const key = qKey(v);
  const cached = cache.get(key);
  if (cached !== void 0) return cached;
  let bestIdx = activeIndices[0];
  let bestDist = Infinity;
  for (const idx of activeIndices) {
    let d = 0;
    for (let j = 0; j < K; j++) {
      const t = v[j] - vecs[idx][j];
      d += t * t;
    }
    if (d < bestDist) {
      bestDist = d;
      bestIdx = idx;
    }
  }
  cache.set(key, bestIdx);
  return bestIdx;
}
function getBrightness(r, g, b) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
function createShapeConverter(options) {
  const contrastExp = options.contrastExponent ?? DEFAULT_CONTRAST_EXP;
  const monoBackground = options.monoBackground ?? false;
  const rgbColor = options.rgbColor ?? false;
  const charArray = options.chars ? typeof options.chars === "string" ? [...options.chars] : options.chars : [...SHAPE_CHAR_PRESETS[options.charSet ?? "cp437"]];
  const { chars, vecs } = buildCharVecs(options.bitmapFont, charArray);
  const diversityOrder = sortByDiversity(vecs);
  const rampLen = Math.max(2, Math.min(options.rampLength ?? chars.length, chars.length));
  const activeIndices = diversityOrder.slice(0, rampLen);
  const lookupCache = /* @__PURE__ */ new Map();
  const inputVec = new Float32Array(K);
  const extVals = new Float32Array(10);
  const converter = (frame, columns, rows, palette = "ansi16") => {
    const paletteColors = getPalette(palette);
    const lines = [];
    const pixelsPerCellX = frame.width / columns;
    const pixelsPerCellY = frame.height / rows;
    const sampleR = Math.max(1, Math.min(pixelsPerCellX, pixelsPerCellY) * 0.2);
    for (let row = 0; row < rows; row++) {
      const line = [];
      for (let col = 0; col < columns; col++) {
        const cellX = col * pixelsPerCellX;
        const cellY = row * pixelsPerCellY;
        sampleCellPoints(
          frame.pixels,
          frame.width,
          frame.height,
          cellX,
          cellY,
          pixelsPerCellX,
          pixelsPerCellY,
          sampleR,
          inputVec,
          extVals
        );
        for (let s = 0; s < K; s++) {
          let maxExt = 0;
          for (const ei of E_AFF[s]) {
            if (extVals[ei] > maxExt) maxExt = extVals[ei];
          }
          if (maxExt > 0.01) {
            const norm = Math.min(1, inputVec[s] / maxExt);
            inputVec[s] = norm ** contrastExp * maxExt;
          }
        }
        const charIdx = findNearest(inputVec, vecs, activeIndices, lookupCache);
        const ch = chars[charIdx];
        const [avgR, avgG, avgB] = sampleCellColor(
          frame.pixels,
          frame.width,
          frame.height,
          cellX,
          cellY,
          pixelsPerCellX,
          pixelsPerCellY
        );
        const brightness = getBrightness(avgR, avgG, avgB);
        let fg;
        let bg;
        if (rgbColor) {
          const q = 8;
          const r = Math.round(avgR / q) * q;
          const g = Math.round(avgG / q) * q;
          const b = Math.round(avgB / q) * q;
          fg = `rgb(${r},${g},${b})`;
          if (monoBackground) {
            bg = "rgb(0,0,0)";
          } else {
            const scale = brightness < 0.3 ? 0.15 : 0.3;
            const br = Math.round(avgR * scale / q) * q;
            const bg2 = Math.round(avgG * scale / q) * q;
            const bb = Math.round(avgB * scale / q) * q;
            bg = `rgb(${br},${bg2},${bb})`;
          }
        } else if (monoBackground) {
          bg = 0;
          if (palette === "ansi16") {
            const colorIndex = rgbToPaletteColor(avgR, avgG, avgB, paletteColors);
            fg = brightness > 0.7 && colorIndex < 8 ? colorIndex + 8 : colorIndex;
          } else {
            const paletteColorIndex = rgbToPaletteColor(avgR, avgG, avgB, paletteColors);
            const [paletteR, paletteG, paletteB] = paletteColors[paletteColorIndex];
            const ansiMatch = rgbToPaletteColor(paletteR, paletteG, paletteB, ANSI_COLORS_RGB);
            const paletteBrightness = getBrightness(paletteR, paletteG, paletteB);
            fg = paletteBrightness > 0.6 && ansiMatch < 8 ? ansiMatch + 8 : ansiMatch;
          }
        } else if (palette === "ansi16") {
          const colorIndex = rgbToPaletteColor(avgR, avgG, avgB, paletteColors);
          bg = brightness < 0.3 ? 0 : 8;
          fg = brightness > 0.7 && colorIndex < 8 ? colorIndex + 8 : colorIndex;
        } else {
          const paletteColorIndex = rgbToPaletteColor(avgR, avgG, avgB, paletteColors);
          const [paletteR, paletteG, paletteB] = paletteColors[paletteColorIndex];
          const ansiMatch = rgbToPaletteColor(paletteR, paletteG, paletteB, ANSI_COLORS_RGB);
          bg = brightness < 0.3 ? 0 : 8;
          const paletteBrightness = getBrightness(paletteR, paletteG, paletteB);
          fg = paletteBrightness > 0.6 && ansiMatch < 8 ? ansiMatch + 8 : ansiMatch;
        }
        line.push({ ch, fg, bg, bold: false });
      }
      lines.push(line);
    }
    return { lines, columns };
  };
  return converter;
}

// src/generators/asciiMatrixRainGenerator.ts
var DEFAULT_CHARS = '\uFF71\uFF72\uFF73\uFF74\uFF75\uFF76\uFF77\uFF78\uFF79\uFF7A\uFF7B\uFF7C\uFF7D\uFF7E\uFF7F\uFF80\uFF81\uFF82\uFF83\uFF84\uFF85\uFF86\uFF87\uFF88\uFF89\uFF8A\uFF8B\uFF8C\uFF8D\uFF8E\uFF8F\uFF90\uFF91\uFF92\uFF93\uFF94\uFF95\uFF96\uFF97\uFF98\uFF99\uFF9A\uFF9B\uFF9C\uFF9D0123456789:."=*+-<>';
var DEFAULT_SPEED = 0.5;
var DEFAULT_DENSITY = 0.7;
var DEFAULT_TRAIL_LENGTH = 15;
var DEFAULT_HEAD_COLOR = "#ffffff";
var DEFAULT_TRAIL_COLOR = "#00ff44";
var DEFAULT_BG_COLOR = "#000000";
var DEFAULT_SEED = 7331;
function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state, 1664525) + 1013904223 >>> 0;
    return state / 4294967295;
  };
}
function parseHex(hex) {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  return [
    parseInt(h.slice(0, 2), 16) || 0,
    parseInt(h.slice(2, 4), 16) || 0,
    parseInt(h.slice(4, 6), 16) || 0
  ];
}
function lerpColor(a, b, t) {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const b2 = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${b2})`;
}
var matrixStateMap = /* @__PURE__ */ new Map();
function initStream(rng, rows, baseSpeed, trailLength, charPoolSize) {
  const speed = baseSpeed * (0.5 + rng() * 1);
  const length = Math.max(3, Math.floor(trailLength * (0.5 + rng() * 1)));
  const charIndices = [];
  for (let i = 0; i < length; i++) {
    charIndices.push(Math.floor(rng() * charPoolSize));
  }
  return {
    y: -Math.floor(rng() * rows * 1.5),
    // stagger start positions
    speed,
    length,
    charIndices,
    charChangeRate: 0.03 + rng() * 0.07
  };
}
function generateAsciiMatrixRainFrame(frame, columns, rows, options = {}) {
  const {
    speed = DEFAULT_SPEED,
    density = DEFAULT_DENSITY,
    trailLength = DEFAULT_TRAIL_LENGTH,
    headColor = DEFAULT_HEAD_COLOR,
    trailColor = DEFAULT_TRAIL_COLOR,
    bgColor = DEFAULT_BG_COLOR,
    chars = DEFAULT_CHARS,
    seed = DEFAULT_SEED
  } = options;
  const charPool = Array.from(chars);
  const stateKey = JSON.stringify({ columns, seed, density, trailLength });
  let state = matrixStateMap.get(stateKey);
  if (!state || frame < state.lastFrame) {
    const rng2 = createRandom(seed);
    const streams = [];
    for (let col = 0; col < columns; col++) {
      if (rng2() < density) {
        streams.push(initStream(rng2, rows, speed, trailLength, charPool.length));
      } else {
        streams.push(null);
      }
    }
    state = { streams, lastFrame: -1 };
    matrixStateMap.set(stateKey, state);
    if (matrixStateMap.size > 32) {
      const firstKey = matrixStateMap.keys().next().value;
      if (firstKey !== void 0) matrixStateMap.delete(firstKey);
    }
  }
  const headRGB = parseHex(headColor);
  const trailRGB = parseHex(trailColor);
  const blackRGB = [0, 0, 0];
  const rng = createRandom(seed + frame * 97);
  for (let col = 0; col < columns; col++) {
    let stream = state.streams[col];
    if (stream) {
      stream.y += stream.speed;
      for (let i = 0; i < stream.charIndices.length; i++) {
        if (rng() < stream.charChangeRate) {
          stream.charIndices[i] = Math.floor(rng() * charPool.length);
        }
      }
      if (stream.y - stream.length > rows) {
        if (rng() < density) {
          state.streams[col] = initStream(rng, rows, speed, trailLength, charPool.length);
          state.streams[col].y = -Math.floor(rng() * trailLength);
        } else {
          state.streams[col] = null;
        }
      }
    } else {
      if (rng() < density * 0.02) {
        state.streams[col] = initStream(rng, rows, speed, trailLength, charPool.length);
        state.streams[col].y = -Math.floor(rng() * trailLength);
      }
    }
  }
  state.lastFrame = frame;
  const lines = [];
  for (let row = 0; row < rows; row++) {
    const line = [];
    for (let col = 0; col < columns; col++) {
      const stream = state.streams[col];
      if (!stream) {
        line.push({ ch: " ", fg: bgColor, bg: bgColor, bold: false });
        continue;
      }
      const headY = Math.floor(stream.y);
      const distFromHead = row - headY;
      if (distFromHead < 0 || distFromHead >= stream.length) {
        line.push({ ch: " ", fg: bgColor, bg: bgColor, bold: false });
      } else if (distFromHead === 0) {
        const ch = charPool[stream.charIndices[0] % charPool.length];
        line.push({ ch, fg: headColor, bg: bgColor, bold: true });
      } else {
        const t = distFromHead / (stream.length - 1);
        const ch = charPool[stream.charIndices[distFromHead % stream.charIndices.length] % charPool.length];
        const fg = lerpColor(trailRGB, blackRGB, t * t);
        line.push({ ch, fg, bg: bgColor, bold: false });
      }
    }
    lines.push(line);
  }
  return { lines, columns };
}
function createAsciiMatrixRainSampler(frame, options = {}) {
  const virtualCols = 200;
  const virtualRows = 120;
  const screen = generateAsciiMatrixRainFrame(frame, virtualCols, virtualRows, options);
  return (x, y) => {
    const wx = (x % virtualCols + virtualCols) % virtualCols;
    const wy = (y % virtualRows + virtualRows) % virtualRows;
    const line = screen.lines[wy];
    if (!line || !line[wx]) {
      return { ch: " ", fg: options.bgColor ?? DEFAULT_BG_COLOR, bg: options.bgColor ?? DEFAULT_BG_COLOR, bold: false };
    }
    return line[wx];
  };
}
function clearMatrixRainState() {
  matrixStateMap.clear();
}

// src/generators/asciiStarfieldGenerator.ts
var DEFAULT_STARS = 200;
var DEFAULT_SPEED2 = 0.02;
var DEFAULT_FG_COLOR = "#ffffff";
var DEFAULT_BG_COLOR2 = "#000000";
var DEFAULT_CHARS2 = "\xB7.+*#@";
var DEFAULT_SEED2 = 4242;
function createRandom2(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state, 1664525) + 1013904223 >>> 0;
    return state / 4294967295;
  };
}
var starfieldStateMap = /* @__PURE__ */ new Map();
function initStars(count, rng) {
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rng() * 2 - 1,
      y: rng() * 2 - 1,
      z: rng()
    });
  }
  return stars;
}
function respawnStar(star, rng) {
  star.x = rng() * 2 - 1;
  star.y = rng() * 2 - 1;
  star.z = 1;
}
function brightnessToRgb(brightness, fgColor) {
  let r = 255;
  let g = 255;
  let b = 255;
  if (fgColor.startsWith("#")) {
    const hex = fgColor.slice(1);
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
  }
  const clamped = Math.max(0, Math.min(1, brightness));
  const minBrightness = 0.15;
  const scaled = minBrightness + clamped * (1 - minBrightness);
  return `rgb(${Math.floor(r * scaled)},${Math.floor(g * scaled)},${Math.floor(b * scaled)})`;
}
function generateAsciiStarfieldFrame(frame, columns, rows, options = {}) {
  const {
    stars: starCount = DEFAULT_STARS,
    speed = DEFAULT_SPEED2,
    fgColor = DEFAULT_FG_COLOR,
    bgColor = DEFAULT_BG_COLOR2,
    chars = DEFAULT_CHARS2,
    seed = DEFAULT_SEED2,
    streaks = true
  } = options;
  const stateKey = JSON.stringify({ starCount, speed, seed });
  let state = starfieldStateMap.get(stateKey);
  if (!state || frame < state.lastFrame) {
    const initRng = createRandom2(seed);
    const starPool2 = initStars(starCount, initRng);
    state = { stars: starPool2, lastFrame: -1 };
    starfieldStateMap.set(stateKey, state);
    if (starfieldStateMap.size > 32) {
      const firstKey = starfieldStateMap.keys().next().value;
      if (firstKey !== void 0) starfieldStateMap.delete(firstKey);
    }
  }
  const starPool = state.stars;
  const rng = createRandom2(seed + frame * 7919);
  for (let i = 0; i < starPool.length; i++) {
    const star = starPool[i];
    star.z -= speed;
    if (star.z < 0.01) {
      respawnStar(star, rng);
    }
  }
  state.lastFrame = frame;
  const lines = [];
  for (let y = 0; y < rows; y++) {
    const line = [];
    for (let x = 0; x < columns; x++) {
      line.push({ ch: " ", fg: bgColor, bg: bgColor, bold: false });
    }
    lines.push(line);
  }
  const centerX = columns / 2;
  const centerY = rows / 2;
  const scale = Math.min(columns, rows) * 0.4;
  const charCount = chars.length;
  for (let i = 0; i < starPool.length; i++) {
    const star = starPool[i];
    const screenX = Math.floor(centerX + star.x / star.z * scale);
    const screenY = Math.floor(centerY + star.y / star.z * scale * 0.5);
    if (screenX < 0 || screenX >= columns || screenY < 0 || screenY >= rows) {
      continue;
    }
    const brightness = 1 - star.z;
    const charIndex = Math.min(charCount - 1, Math.floor(brightness * charCount));
    const ch = chars[charIndex];
    const fg = brightnessToRgb(brightness, fgColor);
    lines[screenY][screenX] = { ch, fg, bg: bgColor, bold: brightness > 0.7 };
    if (streaks && star.z < 0.3) {
      const streakY = screenY - 1;
      if (streakY >= 0 && streakY < rows) {
        const streakBrightness = brightness * 0.5;
        const streakCharIndex = Math.max(0, charIndex - 1);
        const streakCh = chars[streakCharIndex];
        const streakFg = brightnessToRgb(streakBrightness, fgColor);
        if (lines[streakY][screenX].ch === " ") {
          lines[streakY][screenX] = { ch: streakCh, fg: streakFg, bg: bgColor, bold: false };
        }
      }
    }
  }
  return { lines, columns };
}
function createAsciiStarfieldSampler(frame, options = {}) {
  const {
    stars: starCount = DEFAULT_STARS,
    speed = DEFAULT_SPEED2,
    fgColor = DEFAULT_FG_COLOR,
    bgColor = DEFAULT_BG_COLOR2,
    chars = DEFAULT_CHARS2,
    seed = DEFAULT_SEED2,
    streaks = true
  } = options;
  const stateKey = JSON.stringify({ starCount, speed, seed, sampler: true });
  let state = starfieldStateMap.get(stateKey);
  if (!state || frame < state.lastFrame) {
    const initRng = createRandom2(seed);
    const starPool2 = initStars(starCount, initRng);
    state = { stars: starPool2, lastFrame: -1 };
    starfieldStateMap.set(stateKey, state);
    if (starfieldStateMap.size > 32) {
      const firstKey = starfieldStateMap.keys().next().value;
      if (firstKey !== void 0) starfieldStateMap.delete(firstKey);
    }
  }
  const starPool = state.stars;
  if (frame > state.lastFrame) {
    const rng = createRandom2(seed + frame * 7919);
    for (let i = 0; i < starPool.length; i++) {
      const star = starPool[i];
      star.z -= speed;
      if (star.z < 0.01) {
        respawnStar(star, rng);
      }
    }
    state.lastFrame = frame;
  }
  const charCount = chars.length;
  const virtualCols = 200;
  const virtualRows = 60;
  const centerX = virtualCols / 2;
  const centerY = virtualRows / 2;
  const scale = Math.min(virtualCols, virtualRows) * 0.4;
  const projected = /* @__PURE__ */ new Map();
  for (let i = 0; i < starPool.length; i++) {
    const star = starPool[i];
    const screenX = Math.floor(centerX + star.x / star.z * scale);
    const screenY = Math.floor(centerY + star.y / star.z * scale * 0.5);
    const brightness = 1 - star.z;
    const charIndex = Math.min(charCount - 1, Math.floor(brightness * charCount));
    const ch = chars[charIndex];
    const fg = brightnessToRgb(brightness, fgColor);
    const key = `${screenX},${screenY}`;
    projected.set(key, { ch, fg, bold: brightness > 0.7 });
    if (streaks && star.z < 0.3) {
      const streakY = screenY - 1;
      const streakKey = `${screenX},${streakY}`;
      if (!projected.has(streakKey)) {
        const streakBrightness = brightness * 0.5;
        const streakCharIndex = Math.max(0, charIndex - 1);
        const streakCh = chars[streakCharIndex];
        const streakFg = brightnessToRgb(streakBrightness, fgColor);
        projected.set(streakKey, { ch: streakCh, fg: streakFg, bold: false, isStreak: true });
      }
    }
  }
  return (x, y) => {
    const key = `${x},${y}`;
    const star = projected.get(key);
    if (star) {
      return { ch: star.ch, fg: star.fg, bg: bgColor, bold: star.bold };
    }
    return { ch: " ", fg: bgColor, bg: bgColor, bold: false };
  };
}
function clearStarfieldState() {
  starfieldStateMap.clear();
}

// src/generators/asciiTunnelGenerator.ts
var DEFAULT_SPEED3 = 0.08;
var DEFAULT_ROTATION_SPEED = 0.01;
var DEFAULT_TILES = 8;
var DEFAULT_FG_COLOR2 = "#00ffaa";
var DEFAULT_BG_COLOR3 = "#000000";
var DEFAULT_CHARS3 = [" ", ".", ":", "-", "=", "+", "*", "#", "%", "@"];
var DEFAULT_ASPECT_Y = 2;
var lastTunnelChars = null;
var lastTunnelCharLookup = null;
function getTunnelCharLookup(chars) {
  if (lastTunnelChars === chars && lastTunnelCharLookup) return lastTunnelCharLookup;
  const charArray = chars.split("");
  lastTunnelCharLookup = buildCharLookup(charArray);
  lastTunnelChars = chars;
  return lastTunnelCharLookup;
}
function parseHexColor(hex) {
  const clean = hex.replace("#", "");
  if (clean.length === 3) {
    const r2 = parseInt(clean[0] + clean[0], 16);
    const g2 = parseInt(clean[1] + clean[1], 16);
    const b2 = parseInt(clean[2] + clean[2], 16);
    return [r2, g2, b2];
  }
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b];
}
var TWO_PI = Math.PI * 2;
var TUNNEL_SCALE = 1;
var FOG_FACTOR = 0.1;
function generateAsciiTunnelFrame(frame, columns, rows, options = {}) {
  const {
    speed = DEFAULT_SPEED3,
    rotationSpeed = DEFAULT_ROTATION_SPEED,
    tiles = DEFAULT_TILES,
    fgColor = DEFAULT_FG_COLOR2,
    bgColor = DEFAULT_BG_COLOR3,
    chars = DEFAULT_CHARS3.join(""),
    aspectY = DEFAULT_ASPECT_Y
  } = options;
  const charLookup = getTunnelCharLookup(chars);
  const [fgR, fgG, fgB] = parseHexColor(fgColor);
  const centerX = columns / 2;
  const centerY = rows / 2;
  const lines = [];
  for (let y = 0; y < rows; y++) {
    const line = [];
    for (let x = 0; x < columns; x++) {
      const actualX = x - centerX;
      const actualY = (y - centerY) * aspectY;
      const distance = Math.sqrt(actualX * actualX + actualY * actualY);
      if (distance < 0.5) {
        line.push({ ch: " ", fg: bgColor, bg: bgColor, bold: false });
        continue;
      }
      const angle = Math.atan2(actualY, actualX);
      let u = angle / TWO_PI + 0.5;
      let v = TUNNEL_SCALE / distance;
      u += frame * rotationSpeed;
      v += frame * speed;
      const tileU = Math.floor(u * tiles);
      const tileV = Math.floor(v * tiles);
      const pattern = ((tileU + tileV) % 2 + 2) % 2;
      const fog = 1 / (1 + distance * FOG_FACTOR);
      const brightness = Math.floor(pattern * fog * 255);
      const clampedBrightness = Math.max(0, Math.min(255, brightness));
      const ch = charLookup[clampedBrightness];
      const r = Math.floor(fgR * fog);
      const g = Math.floor(fgG * fog);
      const b = Math.floor(fgB * fog);
      const cellFg = `rgb(${r},${g},${b})`;
      line.push({ ch, fg: cellFg, bg: bgColor, bold: false });
    }
    lines.push(line);
  }
  return { lines, columns };
}

// src/generators/asciiGameOfLifeGenerator.ts
var DEFAULT_DENSITY2 = 0.3;
var DEFAULT_FG_COLOR3 = "#55ff55";
var DEFAULT_BG_COLOR4 = "#000000";
var DEFAULT_SEED3 = 9999;
var DEFAULT_AUTO_SEED = true;
var DEFAULT_AUTO_SEED_THRESHOLD = 0.05;
function createRandom3(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state, 1664525) + 1013904223 >>> 0;
    return state / 4294967295;
  };
}
function parseColor(color) {
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16)
      ];
    }
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16)
    ];
  }
  const match = color.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (match) {
    return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
  }
  return [255, 255, 255];
}
function lerpColor2(a, b, t) {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}
var stateMap = /* @__PURE__ */ new Map();
function clearGameOfLifeState() {
  stateMap.clear();
}
function generateAsciiGameOfLifeFrame(frame, columns, rows, options = {}) {
  const {
    density = DEFAULT_DENSITY2,
    fgColor = DEFAULT_FG_COLOR3,
    bgColor = DEFAULT_BG_COLOR4,
    seed = DEFAULT_SEED3,
    autoSeed = DEFAULT_AUTO_SEED,
    autoSeedThreshold = DEFAULT_AUTO_SEED_THRESHOLD
  } = options;
  const totalCells = columns * rows;
  const stateKey = JSON.stringify({ columns, rows, seed, density });
  let state = stateMap.get(stateKey);
  if (!state || frame < state.lastFrame) {
    const cells2 = new Uint8Array(totalCells);
    const next2 = new Uint8Array(totalCells);
    const random = createRandom3(seed);
    for (let i = 0; i < totalCells; i++) {
      cells2[i] = random() < density ? 1 : 0;
    }
    state = { cells: cells2, next: next2, lastFrame: -1 };
    stateMap.set(stateKey, state);
    if (stateMap.size > 32) {
      const firstKey = stateMap.keys().next().value;
      if (firstKey !== void 0) stateMap.delete(firstKey);
    }
  }
  const { cells, next } = state;
  const framesToSimulate = frame - state.lastFrame;
  for (let f = 0; f < framesToSimulate; f++) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const idx = y * columns + x;
        let neighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dy === 0 && dx === 0) continue;
            const ny = (y + dy + rows) % rows;
            const nx = (x + dx + columns) % columns;
            if (cells[ny * columns + nx] > 0) neighbors++;
          }
        }
        if (cells[idx] > 0) {
          if (neighbors === 2 || neighbors === 3) {
            next[idx] = Math.min(cells[idx] + 1, 255);
          } else {
            next[idx] = 0;
          }
        } else {
          next[idx] = neighbors === 3 ? 1 : 0;
        }
      }
    }
    cells.set(next);
    if (autoSeed) {
      let population = 0;
      for (let i = 0; i < totalCells; i++) {
        if (cells[i] > 0) population++;
      }
      if (population < autoSeedThreshold * totalCells) {
        const random = createRandom3(seed + frame + f);
        for (let i = 0; i < totalCells; i++) {
          if (cells[i] === 0 && random() < 0.1) {
            cells[i] = 1;
          }
        }
      }
    }
  }
  state.lastFrame = frame;
  const fgRgb = parseColor(fgColor);
  const dimRgb = [
    Math.round(fgRgb[0] * 0.2),
    Math.round(fgRgb[1] * 0.2),
    Math.round(fgRgb[2] * 0.2)
  ];
  const lines = [];
  for (let y = 0; y < rows; y++) {
    const line = [];
    for (let x = 0; x < columns; x++) {
      const age = cells[y * columns + x];
      let ch;
      if (age === 0) {
        ch = " ";
      } else if (age === 1) {
        ch = "\u2588";
      } else if (age <= 5) {
        ch = "\u2593";
      } else if (age <= 15) {
        ch = "\u2592";
      } else {
        ch = "\u2591";
      }
      let fg;
      if (age === 0) {
        fg = bgColor;
      } else {
        const t = Math.min(age, 50) / 50;
        fg = lerpColor2(fgRgb, dimRgb, t);
      }
      line.push({ ch, fg, bg: bgColor, bold: false });
    }
    lines.push(line);
  }
  return { lines, columns };
}
function createAsciiGameOfLifeSampler(frame, options = {}) {
  const {
    fgColor = DEFAULT_FG_COLOR3,
    bgColor = DEFAULT_BG_COLOR4
  } = options;
  const fgRgb = parseColor(fgColor);
  const dimRgb = [
    Math.round(fgRgb[0] * 0.2),
    Math.round(fgRgb[1] * 0.2),
    Math.round(fgRgb[2] * 0.2)
  ];
  const cols = 200;
  const rows = 60;
  const screen = generateAsciiGameOfLifeFrame(frame, cols, rows, options);
  return (x, y) => {
    const wrappedX = (x % cols + cols) % cols;
    const wrappedY = (y % rows + rows) % rows;
    const cell = screen.lines[wrappedY]?.[wrappedX];
    if (!cell) {
      return { ch: " ", fg: bgColor, bg: bgColor, bold: false };
    }
    return cell;
  };
}

// src/generators/asciiWaterRippleGenerator.ts
var DEFAULT_DAMPING = 0.97;
var DEFAULT_DROP_FREQUENCY = 15;
var DEFAULT_DROP_STRENGTH = 255;
var DEFAULT_FG_COLOR4 = "#4488ff";
var DEFAULT_BG_COLOR5 = "#000011";
var DEFAULT_CHARS4 = [" ", "\xB7", ":", "~", "=", "@"];
var DEFAULT_SEED4 = 5555;
function createRandom4(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state, 1664525) + 1013904223 >>> 0;
    return state / 4294967295;
  };
}
function parseColor2(color) {
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16)
      ];
    }
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16)
    ];
  }
  const match = color.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (match) {
    return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
  }
  return [255, 255, 255];
}
function lerpColor3(a, b, t) {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}
var stateMap2 = /* @__PURE__ */ new Map();
function clearWaterRippleState() {
  stateMap2.clear();
}
var lastChars = null;
var lastCharLookup = null;
function getCharLookup(chars) {
  if (lastChars === chars && lastCharLookup) return lastCharLookup;
  const charArray = Array.from(chars);
  lastCharLookup = buildCharLookup(charArray);
  lastChars = chars;
  return lastCharLookup;
}
function generateAsciiWaterRippleFrame(frame, columns, rows, options = {}) {
  const {
    damping = DEFAULT_DAMPING,
    dropFrequency = DEFAULT_DROP_FREQUENCY,
    dropStrength = DEFAULT_DROP_STRENGTH,
    fgColor = DEFAULT_FG_COLOR4,
    bgColor = DEFAULT_BG_COLOR5,
    chars = DEFAULT_CHARS4.join(""),
    seed = DEFAULT_SEED4
  } = options;
  const totalCells = columns * rows;
  const stateKey = JSON.stringify({ columns, rows, seed, damping, dropFrequency, dropStrength });
  let state = stateMap2.get(stateKey);
  if (!state || frame < state.lastFrame) {
    const current2 = new Float32Array(totalCells);
    const previous2 = new Float32Array(totalCells);
    state = { current: current2, previous: previous2, lastFrame: -1 };
    stateMap2.set(stateKey, state);
    if (stateMap2.size > 32) {
      const firstKey = stateMap2.keys().next().value;
      if (firstKey !== void 0) stateMap2.delete(firstKey);
    }
  }
  const { current, previous } = state;
  const framesToSimulate = frame - state.lastFrame;
  for (let f = 0; f < framesToSimulate; f++) {
    const currentFrame = state.lastFrame + 1 + f;
    if (currentFrame % dropFrequency === 0) {
      const random = createRandom4(seed + currentFrame);
      const dx = Math.floor(random() * columns);
      const dy = Math.floor(random() * rows);
      current[dy * columns + dx] = dropStrength;
    }
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const idx = y * columns + x;
        const up = y > 0 ? (y - 1) * columns + x : idx;
        const down = y < rows - 1 ? (y + 1) * columns + x : idx;
        const left = x > 0 ? y * columns + (x - 1) : idx;
        const right = x < columns - 1 ? y * columns + (x + 1) : idx;
        const next = ((current[up] + current[down] + current[left] + current[right]) / 2 - previous[idx]) * damping;
        previous[idx] = next;
      }
    }
    for (let i = 0; i < totalCells; i++) {
      const tmp = previous[i];
      previous[i] = current[i];
      current[i] = tmp;
    }
  }
  state.lastFrame = frame;
  const charLookup = getCharLookup(chars);
  const fgRgb = parseColor2(fgColor);
  const bgRgb = parseColor2(bgColor);
  const lines = [];
  for (let y = 0; y < rows; y++) {
    const line = [];
    for (let x = 0; x < columns; x++) {
      const height = current[y * columns + x];
      const clamped = Math.max(-dropStrength, Math.min(dropStrength, height));
      const normalized = (clamped + dropStrength) / (2 * dropStrength);
      const brightnessIndex = Math.floor(normalized * 255);
      const ch = charLookup[Math.max(0, Math.min(255, brightnessIndex))];
      const intensity = Math.min(Math.abs(height) / dropStrength, 1);
      const fg = lerpColor3(bgRgb, fgRgb, intensity);
      line.push({ ch, fg, bg: bgColor, bold: false });
    }
    lines.push(line);
  }
  return { lines, columns };
}
function createAsciiWaterRippleSampler(frame, options = {}) {
  const {
    bgColor = DEFAULT_BG_COLOR5
  } = options;
  const cols = 200;
  const rows = 60;
  const screen = generateAsciiWaterRippleFrame(frame, cols, rows, options);
  return (x, y) => {
    const wrappedX = (x % cols + cols) % cols;
    const wrappedY = (y % rows + rows) % rows;
    const cell = screen.lines[wrappedY]?.[wrappedX];
    if (!cell) {
      return { ch: " ", fg: bgColor, bg: bgColor, bold: false };
    }
    return cell;
  };
}

// src/generators/asciiMandelbrotGenerator.ts
var DEFAULT_MAX_ITER = 64;
var DEFAULT_ZOOM_SPEED = 0.02;
var DEFAULT_ZOOM_X = -0.7435;
var DEFAULT_ZOOM_Y = 0.1314;
var DEFAULT_INITIAL_ZOOM = 0.5;
var DEFAULT_FG_COLOR5 = "#ff8800";
var DEFAULT_BG_COLOR6 = "#000000";
var DEFAULT_CHARS5 = " .:-=+*#%@";
var DEFAULT_ASPECT_Y2 = 2;
var DEFAULT_COLOR_MODE = "spectrum";
var lastChars2 = null;
var lastCharLookup2 = null;
function getCharLookup2(chars) {
  if (lastChars2 === chars && lastCharLookup2) return lastCharLookup2;
  lastCharLookup2 = buildCharLookup(Array.from(chars));
  lastChars2 = chars;
  return lastCharLookup2;
}
function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p2, q2, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p2 + (q2 - p2) * 6 * t;
      if (t < 1 / 2) return q2;
      if (t < 2 / 3) return p2 + (q2 - p2) * (2 / 3 - t) * 6;
      return p2;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
}
function parseHex2(hex) {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  return [
    parseInt(h.slice(0, 2), 16) || 0,
    parseInt(h.slice(2, 4), 16) || 0,
    parseInt(h.slice(4, 6), 16) || 0
  ];
}
function generateAsciiMandelbrotFrame(frame, columns, rows, options = {}) {
  const {
    maxIter = DEFAULT_MAX_ITER,
    zoomSpeed = DEFAULT_ZOOM_SPEED,
    zoomX = DEFAULT_ZOOM_X,
    zoomY = DEFAULT_ZOOM_Y,
    initialZoom = DEFAULT_INITIAL_ZOOM,
    fgColor = DEFAULT_FG_COLOR5,
    bgColor = DEFAULT_BG_COLOR6,
    chars = DEFAULT_CHARS5,
    aspectY = DEFAULT_ASPECT_Y2,
    colorMode = DEFAULT_COLOR_MODE
  } = options;
  const charLookup = getCharLookup2(chars);
  const zoom = initialZoom * Math.pow(1 + zoomSpeed, frame);
  const scaleX = 3 / zoom / columns;
  const scaleY = 3 / zoom / rows * aspectY;
  const fgRGB = parseHex2(fgColor);
  const lines = [];
  for (let row = 0; row < rows; row++) {
    const line = [];
    const ci = zoomY + (row - rows / 2) * scaleY;
    for (let col = 0; col < columns; col++) {
      const cr = zoomX + (col - columns / 2) * scaleX;
      let zr = 0;
      let zi = 0;
      let iter = 0;
      while (iter < maxIter) {
        const zr2 = zr * zr;
        const zi2 = zi * zi;
        if (zr2 + zi2 > 4) break;
        zi = 2 * zr * zi + ci;
        zr = zr2 - zi2 + cr;
        iter++;
      }
      if (iter === maxIter) {
        line.push({ ch: " ", fg: bgColor, bg: bgColor, bold: false });
      } else {
        const brightness = Math.floor(iter / maxIter * 255);
        const ch = charLookup[brightness];
        let fg;
        if (colorMode === "spectrum") {
          const hue = (iter / maxIter * 3 + frame * 5e-3) % 1;
          const lightness = 0.15 + iter / maxIter * 0.55;
          fg = hslToRgb(hue, 0.9, lightness);
        } else {
          const t = iter / maxIter;
          const r = Math.round(fgRGB[0] * t);
          const g = Math.round(fgRGB[1] * t);
          const b = Math.round(fgRGB[2] * t);
          fg = `rgb(${r},${g},${b})`;
        }
        line.push({ ch, fg, bg: bgColor, bold: false });
      }
    }
    lines.push(line);
  }
  return { lines, columns };
}
function generateMandelbrotPixels(frame, width, height, options = {}) {
  const {
    maxIter = DEFAULT_MAX_ITER,
    zoomSpeed = DEFAULT_ZOOM_SPEED,
    zoomX = DEFAULT_ZOOM_X,
    zoomY = DEFAULT_ZOOM_Y,
    initialZoom = DEFAULT_INITIAL_ZOOM,
    fgColor = DEFAULT_FG_COLOR5,
    bgColor = DEFAULT_BG_COLOR6,
    colorMode = DEFAULT_COLOR_MODE
  } = options;
  const zoom = initialZoom * Math.pow(1 + zoomSpeed, frame);
  const scaleX = 3 / zoom / width;
  const scaleY = 3 / zoom / height;
  const fgRGB = parseHex2(fgColor);
  const bgRGB = parseHex2(bgColor);
  const pixels = new Uint8Array(width * height * 3);
  for (let py = 0; py < height; py++) {
    const ci = zoomY + (py - height / 2) * scaleY;
    for (let px = 0; px < width; px++) {
      const cr = zoomX + (px - width / 2) * scaleX;
      let zr = 0;
      let zi = 0;
      let iter = 0;
      while (iter < maxIter) {
        const zr2 = zr * zr;
        const zi2 = zi * zi;
        if (zr2 + zi2 > 4) break;
        zi = 2 * zr * zi + ci;
        zr = zr2 - zi2 + cr;
        iter++;
      }
      const i = (py * width + px) * 3;
      if (iter === maxIter) {
        pixels[i] = bgRGB[0];
        pixels[i + 1] = bgRGB[1];
        pixels[i + 2] = bgRGB[2];
      } else if (colorMode === "spectrum") {
        const hue = (iter / maxIter * 3 + frame * 5e-3) % 1;
        const lightness = 0.15 + iter / maxIter * 0.55;
        const rgb = hslToRgbArray(hue, 0.9, lightness);
        pixels[i] = rgb[0];
        pixels[i + 1] = rgb[1];
        pixels[i + 2] = rgb[2];
      } else {
        const t = iter / maxIter;
        pixels[i] = Math.round(fgRGB[0] * t);
        pixels[i + 1] = Math.round(fgRGB[1] * t);
        pixels[i + 2] = Math.round(fgRGB[2] * t);
      }
    }
  }
  return { width, height, pixels };
}
function hslToRgbArray(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p2, q2, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p2 + (q2 - p2) * 6 * t;
      if (t < 1 / 2) return q2;
      if (t < 2 / 3) return p2 + (q2 - p2) * (2 / 3 - t) * 6;
      return p2;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
export {
  ANSI_COLORS_RGB,
  AnsiArt,
  AnsiPlayerOverlay,
  AnsiVirtualDisplay,
  FontCharacterChart,
  GeneratorBackgroundLayout,
  PlasmaBackgroundLayout,
  SHAPE_CHAR_PRESETS,
  clearDatamoshState,
  clearFireState,
  clearFontCache,
  clearGameOfLifeState,
  clearMatrixRainState,
  clearStarfieldState,
  clearWaterRippleState,
  convertFrameDataToAnsi,
  createAnsiArtFrameGenerator,
  createAnsiFrameGenerator,
  createAsciiDatamoshSampler,
  createAsciiFireSampler,
  createAsciiGameOfLifeSampler,
  createAsciiMatrixRainSampler,
  createAsciiMetaballsSampler,
  createAsciiPerlinPlasmaSampler,
  createAsciiSonarSampler,
  createAsciiStarfieldSampler,
  createAsciiWaterRippleSampler,
  createShapeConverter,
  detectAnimation,
  drawPerformanceOverlay,
  extractFontFromFON,
  generateAsciiDatamoshFrame,
  generateAsciiFireFrame,
  generateAsciiGameOfLifeFrame,
  generateAsciiMandelbrotFrame,
  generateAsciiMatrixRainFrame,
  generateAsciiMetaballsFrame,
  generateAsciiPerlinPlasmaFrame,
  generateAsciiSonarFrame,
  generateAsciiStarfieldFrame,
  generateAsciiTunnelFrame,
  generateAsciiWaterRippleFrame,
  generateEvenlySpacedPalette,
  generateMandelbrotPixels,
  getEmbeddedVgaFont,
  getPalette,
  getSauceInfo,
  loadBitmapFontFromUrl,
  loadRawBitmapFont,
  parseAnsi,
  parseAscii,
  parseSauce,
  renderGlyph,
  renderText,
  rgbToAnsiColor,
  rgbToPaletteColor
};
//# sourceMappingURL=index.js.map