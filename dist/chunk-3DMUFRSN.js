import {
  buildCharLookup
} from "./chunk-IA5TXP7D.js";

// src/generators/asciiMetaballsGenerator.ts
var DEFAULTS = {
  seed: 1337,
  fgColor: "#55FFFF",
  bgColor: "#000000",
  chars: Array.from(" .,:;+=xX$&#@"),
  balls: 6,
  speed: 0.085,
  radiusMin: 2.5,
  radiusMax: 9.5,
  intensity: 0.55,
  aspectY: 2
};
function clampInt(v, min, max) {
  if (!Number.isFinite(v)) return min;
  const n = Math.floor(v);
  return n < min ? min : n > max ? max : n;
}
function hash32(x) {
  let h = x >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 2146121005);
  h ^= h >>> 15;
  h = Math.imul(h, 2221713035);
  h ^= h >>> 16;
  return h >>> 0;
}
function rand01(seed, salt) {
  return hash32(seed ^ salt) / 4294967295;
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function buildBalls(columns, rows, options) {
  const n = clampInt(options.balls, 1, 48);
  const balls = new Array(n);
  const seed = options.seed;
  for (let i = 0; i < n; i++) {
    const s = i * 9973;
    const baseX = rand01(seed, s + 11) * (columns - 1);
    const baseY = rand01(seed, s + 23) * (rows - 1);
    const orbitX = lerp(columns * 0.06, columns * 0.35, rand01(seed, s + 31));
    const orbitY = lerp(rows * 0.06, rows * 0.35, rand01(seed, s + 37));
    const phase = rand01(seed, s + 41) * Math.PI * 2;
    const freq = lerp(0.6, 1.8, rand01(seed, s + 53));
    const radius = lerp(options.radiusMin, options.radiusMax, rand01(seed, s + 59));
    balls[i] = { baseX, baseY, orbitX, orbitY, phase, freq, radius };
  }
  return balls;
}
var lastBallsCacheKey = "";
var lastBallsResult = null;
function getCachedBalls(columns, rows, opts) {
  const key = `${columns}:${rows}:${opts.seed}:${opts.balls}:${opts.radiusMin}:${opts.radiusMax}`;
  if (key === lastBallsCacheKey && lastBallsResult) return lastBallsResult;
  lastBallsResult = buildBalls(columns, rows, opts);
  lastBallsCacheKey = key;
  return lastBallsResult;
}
function resolveOptions(options) {
  return {
    seed: Number.isFinite(options.seed) ? options.seed : DEFAULTS.seed,
    fgColor: (options.fgColor ?? DEFAULTS.fgColor).toString(),
    bgColor: (options.bgColor ?? DEFAULTS.bgColor).toString(),
    chars: options.chars?.length ? options.chars : DEFAULTS.chars,
    balls: clampInt(options.balls ?? DEFAULTS.balls, 1, 48),
    speed: Number.isFinite(options.speed) ? options.speed : DEFAULTS.speed,
    radiusMin: Number.isFinite(options.radiusMin) ? options.radiusMin : DEFAULTS.radiusMin,
    radiusMax: Number.isFinite(options.radiusMax) ? options.radiusMax : DEFAULTS.radiusMax,
    intensity: Number.isFinite(options.intensity) ? options.intensity : DEFAULTS.intensity,
    aspectY: Number.isFinite(options.aspectY) ? options.aspectY : DEFAULTS.aspectY
  };
}
function computeCell(x, y, time, columns, rows, options, balls, charLookup) {
  const aspectY = options.aspectY > 0 ? options.aspectY : DEFAULTS.aspectY;
  let field = 0;
  const eps = 0.65;
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    const bx = b.baseX + Math.cos(time * b.freq + b.phase) * b.orbitX;
    const by = b.baseY + Math.sin(time * (b.freq * 0.9) + b.phase) * b.orbitY;
    const dx = x - bx;
    const dy = (y - by) * aspectY;
    const d2 = dx * dx + dy * dy + eps;
    field += b.radius * b.radius / d2;
  }
  const k = options.intensity >= 0 ? options.intensity : DEFAULTS.intensity;
  const v01 = 1 - Math.exp(-k * field);
  const idx = clampInt(v01 * 255, 0, 255);
  const ch = charLookup[idx];
  const fg = options.fgColor;
  if (idx < 10) {
    return { ch: " ", fg, bg: options.bgColor, bold: false };
  }
  return { ch, fg, bg: options.bgColor, bold: false };
}
function generateAsciiMetaballsFrame(frame, columns, rows, options = {}) {
  const opts = resolveOptions(options);
  const time = frame * opts.speed;
  const balls = getCachedBalls(columns, rows, opts);
  const chars = opts.chars.length ? opts.chars : DEFAULTS.chars;
  const charLookup = buildCharLookup(chars);
  const lines = [];
  for (let y = 0; y < rows; y++) {
    const line = [];
    for (let x = 0; x < columns; x++) {
      line.push(computeCell(x, y, time, columns, rows, opts, balls, charLookup));
    }
    lines.push(line);
  }
  return { lines, columns };
}
function createAsciiMetaballsSampler(frame, options = {}) {
  const opts = resolveOptions(options);
  const time = frame * opts.speed;
  const virtualColumns = 200;
  const virtualRows = 120;
  const balls = buildBalls(virtualColumns, virtualRows, opts);
  const chars = opts.chars.length ? opts.chars : DEFAULTS.chars;
  const charLookup = buildCharLookup(chars);
  return (x, y) => {
    return computeCell(x, y, time, virtualColumns, virtualRows, opts, balls, charLookup);
  };
}

export {
  generateAsciiMetaballsFrame,
  createAsciiMetaballsSampler
};
//# sourceMappingURL=chunk-3DMUFRSN.js.map