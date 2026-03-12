// src/utils/egaPalette.ts
function toHex(component) {
  return component.toString(16).padStart(2, "0").toUpperCase();
}
function egaRed(index) {
  return 85 * (index >> 1 & 2 | index >> 5 & 1);
}
function egaGreen(index) {
  return 85 * (index & 2 | index >> 4 & 1);
}
function egaBlue(index) {
  return 85 * (index << 1 & 2 | index >> 3 & 1);
}
function egaIndexToColor(index) {
  const red = egaRed(index);
  const green = egaGreen(index);
  const blue = egaBlue(index);
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}
var EGA_PALETTE_RGB = Array.from({ length: 64 }, (_, i) => egaIndexToColor(i));

// src/generators/asciiDatamoshGenerator.ts
var DEFAULTS = {
  seed: 1337,
  bgColor: "#000000",
  keyframeIntervalFrames: 24,
  blockOpsPerFrame: 10,
  minBlockSize: 3,
  maxBlockSize: 18,
  maxShift: 12,
  tearChance: 0.5,
  paletteShiftChance: 0.65,
  noiseFillChance: 0.35,
  baseChars: " \u2591\u2592\u2593\u2588",
  noiseChars: "\u2588\u2593\u2592\u2591\u2580\u2584\u25A0\u25A1\u25B2\u25BC\u25C6\u25C7\u2573#@$%&*+;:,. ",
  wrap: true
};
function clampInt(v, min, max) {
  if (!Number.isFinite(v)) return min;
  const n = Math.floor(v);
  return n < min ? min : n > max ? max : n;
}
function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function wrapIndex(v, size) {
  const m = v % size;
  return m < 0 ? m + size : m;
}
function hash2D(x, y, seed) {
  let h = x * 2654435761 ^ y * 2246822507 ^ seed;
  h ^= h >>> 16;
  h = Math.imul(h, 2146121005);
  h ^= h >>> 15;
  h = Math.imul(h, 2221713035);
  h ^= h >>> 16;
  return h >>> 0;
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function smoothstep(t) {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}
function makeRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state, 1664525) + 1013904223 >>> 0;
    return state / 4294967295;
  };
}
function createCellArrays(columns, rows, bgColor) {
  const n = columns * rows;
  return {
    chars: new Array(n).fill(" "),
    fg: new Array(n).fill("#FFFFFF"),
    bg: bgColor,
    bold: new Array(n).fill(false)
  };
}
function fillKeyframeBase(frame, columns, rows, options, cells) {
  const { seed, baseChars, bgColor } = options;
  const ramp = Array.from(baseChars.length ? baseChars : DEFAULTS.baseChars);
  const rampLen = ramp.length;
  cells.bg = bgColor;
  const t = frame * 0.06;
  let i = 0;
  for (let y = 0; y < rows; y++) {
    const yf = y / Math.max(1, rows - 1);
    for (let x = 0; x < columns; x++) {
      const xf = x / Math.max(1, columns - 1);
      const h = hash2D(x, y, seed ^ 2882400001);
      const grain = ((h & 1023) / 1023 - 0.5) * 0.18;
      const bandA = Math.sin((xf * 9 + yf * 4) * Math.PI * 2 + t * 0.9);
      const bandB = Math.sin((xf * 3 - yf * 7) * Math.PI * 2 - t * 0.6);
      const bandC = Math.sin((xf * 2 + yf * 2) * Math.PI * 2 + t * 0.25);
      const v = (bandA * 0.45 + bandB * 0.35 + bandC * 0.2) * 0.5 + 0.5 + grain;
      const v01 = v < 0 ? 0 : v > 1 ? 1 : v;
      const vSmooth = smoothstep(v01);
      const chIndex = Math.min(rampLen - 1, Math.floor(vSmooth * (rampLen - 1e-3)));
      const hueish = (xf * 0.35 + yf * 0.25 + t * 0.05 + (h >>> 10 & 255) / 255 * 0.15) % 1;
      const idx = Math.min(63, Math.max(0, Math.floor(hueish * 64)));
      cells.chars[i] = ramp[chIndex];
      cells.fg[i] = EGA_PALETTE_RGB[idx];
      cells.bold[i] = false;
      i++;
    }
  }
}
function copyRect(src, dst, columns, rows, x0, y0, w, h, dx, dy, wrap) {
  for (let by = 0; by < h; by++) {
    const sy = y0 + by;
    const dyRow = y0 + by + dy;
    const srcY = wrap ? wrapIndex(sy, rows) : sy;
    const dstY = wrap ? wrapIndex(dyRow, rows) : dyRow;
    if (!wrap && (srcY < 0 || srcY >= rows || dstY < 0 || dstY >= rows)) continue;
    for (let bx = 0; bx < w; bx++) {
      const sx = x0 + bx;
      const dxCol = x0 + bx + dx;
      const srcX = wrap ? wrapIndex(sx, columns) : sx;
      const dstX = wrap ? wrapIndex(dxCol, columns) : dxCol;
      if (!wrap && (srcX < 0 || srcX >= columns || dstX < 0 || dstX >= columns)) continue;
      const si = srcY * columns + srcX;
      const di = dstY * columns + dstX;
      dst.chars[di] = src.chars[si];
      dst.fg[di] = src.fg[si];
      dst.bold[di] = src.bold[si];
    }
  }
}
function horizontalTear(src, dst, columns, rows, y0, h, shift, wrap) {
  for (let by = 0; by < h; by++) {
    const y = y0 + by;
    const yy = wrap ? wrapIndex(y, rows) : y;
    if (!wrap && (yy < 0 || yy >= rows)) continue;
    for (let x = 0; x < columns; x++) {
      const sx = x;
      const dx = x + shift;
      const srcX = sx;
      const dstX = wrap ? wrapIndex(dx, columns) : dx;
      if (!wrap && (dstX < 0 || dstX >= columns)) continue;
      const si = yy * columns + srcX;
      const di = yy * columns + dstX;
      dst.chars[di] = src.chars[si];
      dst.fg[di] = src.fg[si];
      dst.bold[di] = src.bold[si];
    }
  }
}
function noiseFillRect(dst, columns, rows, x0, y0, w, h, seed, frame, noiseChars, wrap) {
  const chars = Array.from(noiseChars.length ? noiseChars : DEFAULTS.noiseChars);
  const cLen = chars.length;
  for (let by = 0; by < h; by++) {
    const y = y0 + by;
    const yy = wrap ? wrapIndex(y, rows) : y;
    if (!wrap && (yy < 0 || yy >= rows)) continue;
    for (let bx = 0; bx < w; bx++) {
      const x = x0 + bx;
      const xx = wrap ? wrapIndex(x, columns) : x;
      if (!wrap && (xx < 0 || xx >= columns)) continue;
      const i = yy * columns + xx;
      const h2 = hash2D(x, y, seed ^ frame * 2654435761);
      const ch = chars[h2 % cLen];
      const color = EGA_PALETTE_RGB[(h2 >>> 8) % 64];
      dst.chars[i] = ch;
      dst.fg[i] = color;
      dst.bold[i] = (h2 >>> 14 & 1) === 1;
    }
  }
}
function paletteShiftRect(src, dst, columns, rows, x0, y0, w, h, shift, wrap) {
  const egaIndexByColor = /* @__PURE__ */ new Map();
  for (let i = 0; i < 64; i++) {
    egaIndexByColor.set(EGA_PALETTE_RGB[i], i);
  }
  for (let by = 0; by < h; by++) {
    const y = y0 + by;
    const yy = wrap ? wrapIndex(y, rows) : y;
    if (!wrap && (yy < 0 || yy >= rows)) continue;
    for (let bx = 0; bx < w; bx++) {
      const x = x0 + bx;
      const xx = wrap ? wrapIndex(x, columns) : x;
      if (!wrap && (xx < 0 || xx >= columns)) continue;
      const i = yy * columns + xx;
      const fg = src.fg[i];
      const idx = egaIndexByColor.get(fg);
      if (idx === void 0) {
        dst.fg[i] = fg;
        continue;
      }
      dst.fg[i] = EGA_PALETTE_RGB[wrapIndex(idx + shift, 64)];
    }
  }
}
var datamoshStateMap = /* @__PURE__ */ new Map();
function getStateKey(columns, rows, options) {
  return JSON.stringify({
    columns,
    rows,
    seed: options.seed,
    bgColor: options.bgColor,
    keyframeIntervalFrames: options.keyframeIntervalFrames,
    blockOpsPerFrame: options.blockOpsPerFrame,
    minBlockSize: options.minBlockSize,
    maxBlockSize: options.maxBlockSize,
    maxShift: options.maxShift,
    tearChance: options.tearChance,
    paletteShiftChance: options.paletteShiftChance,
    noiseFillChance: options.noiseFillChance,
    baseChars: options.baseChars,
    noiseChars: options.noiseChars,
    wrap: options.wrap
  });
}
function resolveOptions(options) {
  return {
    seed: Number.isFinite(options.seed) ? options.seed : DEFAULTS.seed,
    bgColor: (options.bgColor ?? DEFAULTS.bgColor).toString(),
    keyframeIntervalFrames: clampInt(
      options.keyframeIntervalFrames ?? DEFAULTS.keyframeIntervalFrames,
      1,
      600
    ),
    blockOpsPerFrame: clampInt(options.blockOpsPerFrame ?? DEFAULTS.blockOpsPerFrame, 0, 200),
    minBlockSize: clampInt(options.minBlockSize ?? DEFAULTS.minBlockSize, 1, 200),
    maxBlockSize: clampInt(options.maxBlockSize ?? DEFAULTS.maxBlockSize, 1, 400),
    maxShift: clampInt(options.maxShift ?? DEFAULTS.maxShift, 0, 200),
    tearChance: clamp01(options.tearChance ?? DEFAULTS.tearChance),
    paletteShiftChance: clamp01(options.paletteShiftChance ?? DEFAULTS.paletteShiftChance),
    noiseFillChance: clamp01(options.noiseFillChance ?? DEFAULTS.noiseFillChance),
    baseChars: (options.baseChars ?? DEFAULTS.baseChars).toString(),
    noiseChars: (options.noiseChars ?? DEFAULTS.noiseChars).toString(),
    wrap: options.wrap ?? DEFAULTS.wrap
  };
}
function snapshotCells(cells) {
  return {
    chars: cells.chars.slice(),
    fg: cells.fg.slice(),
    bg: cells.bg,
    bold: cells.bold.slice()
  };
}
function advanceState(frame, columns, rows, opts, state) {
  if (frame < state.lastFrame) {
    state.lastFrame = -1;
    state.lastKeyframe = -1;
  }
  const interval = Math.max(1, opts.keyframeIntervalFrames);
  const shouldKeyframe = state.lastKeyframe < 0 || frame === 0 || frame % interval === 0;
  if (frame <= state.lastFrame) return;
  if (shouldKeyframe) {
    fillKeyframeBase(
      frame,
      columns,
      rows,
      {
        seed: opts.seed,
        baseChars: opts.baseChars,
        bgColor: opts.bgColor
      },
      state.cells
    );
    state.lastKeyframe = frame;
    state.lastFrame = frame;
    return;
  }
  const rng = makeRng((opts.seed ^ frame * 2654435761) >>> 0);
  const minB = Math.min(opts.minBlockSize, opts.maxBlockSize);
  const maxB = Math.max(opts.minBlockSize, opts.maxBlockSize);
  const maxShift = opts.maxShift;
  const wrap = opts.wrap;
  if (!state.readCells) {
    state.readCells = snapshotCells(state.cells);
  } else {
    const n = state.cells.chars.length;
    for (let i = 0; i < n; i++) {
      state.readCells.chars[i] = state.cells.chars[i];
      state.readCells.fg[i] = state.cells.fg[i];
      state.readCells.bold[i] = state.cells.bold[i];
    }
    state.readCells.bg = state.cells.bg;
  }
  const readCells = state.readCells;
  const ops = opts.blockOpsPerFrame;
  for (let op = 0; op < ops; op++) {
    const w = clampInt(lerp(minB, maxB, rng()), 1, columns);
    const h = clampInt(lerp(minB, maxB, rng()), 1, rows);
    const x0 = clampInt(rng() * columns, 0, columns - 1);
    const y0 = clampInt(rng() * rows, 0, rows - 1);
    const dx = clampInt((rng() * 2 - 1) * maxShift, -maxShift, maxShift);
    const dy = clampInt((rng() * 2 - 1) * maxShift, -maxShift, maxShift);
    copyRect(readCells, state.cells, columns, rows, x0, y0, w, h, dx, dy, wrap);
  }
  if (rng() < opts.tearChance) {
    const bandH = clampInt(lerp(1, Math.max(2, Math.floor(rows * 0.15)), rng()), 1, rows);
    const y0 = clampInt(rng() * rows, 0, rows - 1);
    const shift = clampInt((rng() * 2 - 1) * maxShift, -maxShift, maxShift);
    const n = state.cells.chars.length;
    for (let i = 0; i < n; i++) {
      readCells.chars[i] = state.cells.chars[i];
      readCells.fg[i] = state.cells.fg[i];
      readCells.bold[i] = state.cells.bold[i];
    }
    horizontalTear(readCells, state.cells, columns, rows, y0, bandH, shift, wrap);
  }
  if (rng() < opts.paletteShiftChance) {
    const shifts = [3, 5, 7, 11, -3, -5, -7, -11];
    const shift = shifts[clampInt(rng() * shifts.length, 0, shifts.length - 1)];
    const w = clampInt(lerp(minB, maxB, rng()), 1, columns);
    const h = clampInt(lerp(minB, maxB, rng()), 1, rows);
    const x0 = clampInt(rng() * columns, 0, columns - 1);
    const y0 = clampInt(rng() * rows, 0, rows - 1);
    const n2 = state.cells.chars.length;
    for (let i = 0; i < n2; i++) {
      readCells.chars[i] = state.cells.chars[i];
      readCells.fg[i] = state.cells.fg[i];
      readCells.bold[i] = state.cells.bold[i];
    }
    paletteShiftRect(readCells, state.cells, columns, rows, x0, y0, w, h, shift, wrap);
  }
  if (rng() < opts.noiseFillChance) {
    const w = clampInt(lerp(minB, maxB, rng()), 1, columns);
    const h = clampInt(lerp(minB, maxB, rng()), 1, rows);
    const x0 = clampInt(rng() * columns, 0, columns - 1);
    const y0 = clampInt(rng() * rows, 0, rows - 1);
    noiseFillRect(state.cells, columns, rows, x0, y0, w, h, opts.seed, frame, opts.noiseChars, wrap);
  }
  state.lastFrame = frame;
}
function generateAsciiDatamoshFrame(frame, columns, rows, options = {}) {
  const opts = resolveOptions(options);
  const stateKey = getStateKey(columns, rows, opts);
  let state = datamoshStateMap.get(stateKey);
  if (!state) {
    state = {
      cells: createCellArrays(columns, rows, opts.bgColor),
      readCells: null,
      lastFrame: -1,
      lastKeyframe: -1
    };
    datamoshStateMap.set(stateKey, state);
  }
  advanceState(frame, columns, rows, opts, state);
  const lines = [];
  let i = 0;
  for (let y = 0; y < rows; y++) {
    const line = [];
    for (let x = 0; x < columns; x++) {
      line.push({
        ch: state.cells.chars[i],
        fg: state.cells.fg[i],
        bg: state.cells.bg,
        bold: state.cells.bold[i]
      });
      i++;
    }
    lines.push(line);
  }
  return { lines, columns };
}
function createAsciiDatamoshSampler(frame, options = {}) {
  const virtualColumns = clampInt(options.virtualColumns ?? 200, 1, 2e3);
  const virtualRows = clampInt(options.virtualRows ?? 120, 1, 2e3);
  const opts = resolveOptions(options);
  const stateKey = getStateKey(virtualColumns, virtualRows, opts);
  let state = datamoshStateMap.get(stateKey);
  if (!state) {
    state = {
      cells: createCellArrays(virtualColumns, virtualRows, opts.bgColor),
      readCells: null,
      lastFrame: -1,
      lastKeyframe: -1
    };
    datamoshStateMap.set(stateKey, state);
  }
  advanceState(frame, virtualColumns, virtualRows, opts, state);
  return (x, y) => {
    const xx = wrapIndex(x, virtualColumns);
    const yy = wrapIndex(y, virtualRows);
    const i = yy * virtualColumns + xx;
    return {
      ch: state.cells.chars[i],
      fg: state.cells.fg[i],
      bg: state.cells.bg,
      bold: state.cells.bold[i]
    };
  };
}
function clearDatamoshState() {
  datamoshStateMap.clear();
}

export {
  generateAsciiDatamoshFrame,
  createAsciiDatamoshSampler,
  clearDatamoshState
};
//# sourceMappingURL=chunk-EU7BANWY.js.map