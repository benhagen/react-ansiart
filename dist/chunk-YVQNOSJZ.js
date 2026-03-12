import {
  buildCharLookup
} from "./chunk-IA5TXP7D.js";

// src/generators/asciiPerlinPlasmaGenerator.ts
var DEFAULT_CHARS = [
  "Q",
  "B",
  "$",
  "8",
  "@",
  "0",
  "#",
  "2",
  "*",
  "+",
  ":",
  ",",
  "\xF9",
  "\xFA",
  " ",
  " ",
  " ",
  " ",
  " ",
  " "
];
var DEFAULT_OCTAVES = [
  {
    scale: 0.02,
    amplitude: 1,
    timeScaleX: -1,
    // Much slower movement
    timeScaleY: -0.5
    // Much slower movement
  },
  {
    scale: 0.04,
    amplitude: 1,
    timeScaleX: -0.5,
    // Much slower movement
    timeScaleY: -0.3
    // Much slower movement
  }
];
var DEFAULT_TIME_SCALE = 0.9;
var DEFAULT_FG_COLOR = "#55FFFF";
var DEFAULT_BG_COLOR = "#000000";
var FADE_TABLE = new Float32Array(512);
for (let i = 0; i < 512; i++) {
  const t = i / 511;
  FADE_TABLE[i] = t * t * t * (t * (t * 6 - 15) + 10);
}
function fastFade(t) {
  return FADE_TABLE[t * 511 | 0];
}
var GRAD_TABLE = new Float32Array([
  0.707,
  0.707,
  -0.707,
  0.707,
  0.707,
  -0.707,
  -0.707,
  -0.707,
  1,
  0,
  -1,
  0,
  0,
  1,
  0,
  -1
]);
function fastGrad(hash2, x, y) {
  const h = (hash2 & 7) << 1;
  return GRAD_TABLE[h] * x + GRAD_TABLE[h | 1] * y;
}
function hash(x, y, seed) {
  let h = x * 73856093 ^ y * 19349663 ^ seed;
  h = h >>> 16 ^ h;
  h *= 2146121005;
  h ^= h >>> 15;
  h *= 2221713035;
  return h ^ h >>> 16;
}
var permutationCache = /* @__PURE__ */ new Map();
function getCachedPermutation(seed) {
  const cached = permutationCache.get(seed);
  if (cached) return cached;
  const perm = generatePermutation(seed);
  permutationCache.set(seed, perm);
  if (permutationCache.size > 16) {
    const firstKey = permutationCache.keys().next().value;
    if (firstKey !== void 0) permutationCache.delete(firstKey);
  }
  return perm;
}
function generatePermutation(seed) {
  const perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  let randomSeed = seed;
  function random() {
    randomSeed = (randomSeed * 9301 + 49297) % 233280;
    return randomSeed / 233280;
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  return perm;
}
var lastOctaveInput = null;
var lastOctaveConfigs = null;
function getCachedOctaveConfigs(octaves) {
  if (lastOctaveInput === octaves && lastOctaveConfigs) return lastOctaveConfigs;
  lastOctaveConfigs = octaves.map((o) => ({
    scaleX: o.scale,
    scaleY: o.scale,
    timeScaleX: o.timeScaleX,
    timeScaleY: o.timeScaleY,
    amplitude: o.amplitude
  }));
  lastOctaveInput = octaves;
  return lastOctaveConfigs;
}
function noise2D(x, y, perm) {
  const X = Math.floor(x);
  const Y = Math.floor(y);
  x -= X;
  y -= Y;
  const u = fastFade(x);
  const v = fastFade(y);
  const seed = perm[0];
  const A = Math.abs(hash(X, Y, seed)) % 256;
  const B = Math.abs(hash(X + 1, Y, seed)) % 256;
  const C = Math.abs(hash(X, Y + 1, seed)) % 256;
  const D = Math.abs(hash(X + 1, Y + 1, seed)) % 256;
  const g00 = fastGrad(perm[A], x, y);
  const g10 = fastGrad(perm[B], x - 1, y);
  const g01 = fastGrad(perm[C], x, y - 1);
  const g11 = fastGrad(perm[D], x - 1, y - 1);
  const a = g00 + u * (g10 - g00);
  const b = g01 + u * (g11 - g01);
  return a + v * (b - a);
}
function generateAsciiPerlinPlasmaFrame(frame, columns, rows, options = {}) {
  const {
    chars = DEFAULT_CHARS,
    timeScale = DEFAULT_TIME_SCALE,
    fgColor = DEFAULT_FG_COLOR,
    bgColor = DEFAULT_BG_COLOR,
    octaves = DEFAULT_OCTAVES,
    seed = 12345
    // Fixed default seed for consistent patterns
  } = options;
  const time = frame * timeScale;
  const perm = getCachedPermutation(seed);
  const charLookup = buildCharLookup(chars);
  const octaveConfigs = getCachedOctaveConfigs(octaves);
  const lines = [];
  for (let y = 0; y < rows; y++) {
    const line = [];
    for (let x = 0; x < columns; x++) {
      let value = 0;
      for (const octave of octaveConfigs) {
        value += noise2D(
          (x + time * octave.timeScaleX) * octave.scaleX,
          (y + time * octave.timeScaleY) * octave.scaleY,
          perm
        ) * octave.amplitude;
      }
      const clampedValue = value < -1 ? -1 : value > 1 ? 1 : value;
      const charIndex = (clampedValue + 1) * 127.5 | 0;
      const ch = charLookup[charIndex];
      line.push({ ch, fg: fgColor, bg: bgColor, bold: false });
    }
    lines.push(line);
  }
  return { lines, columns };
}
function createAsciiPerlinPlasmaSampler(frame, options = {}) {
  const {
    chars = DEFAULT_CHARS,
    timeScale = DEFAULT_TIME_SCALE,
    fgColor = DEFAULT_FG_COLOR,
    bgColor = DEFAULT_BG_COLOR,
    octaves = DEFAULT_OCTAVES,
    seed = 12345
  } = options;
  const time = frame * timeScale;
  const perm = getCachedPermutation(seed);
  const charLookup = buildCharLookup(chars);
  const octaveConfigs = getCachedOctaveConfigs(octaves);
  return (x, y) => {
    let value = 0;
    for (const octave of octaveConfigs) {
      value += noise2D(
        (x + time * octave.timeScaleX) * octave.scaleX,
        (y + time * octave.timeScaleY) * octave.scaleY,
        perm
      ) * octave.amplitude;
    }
    const clampedValue = value < -1 ? -1 : value > 1 ? 1 : value;
    const charIndex = (clampedValue + 1) * 127.5 | 0;
    const ch = charLookup[charIndex];
    return { ch, fg: fgColor, bg: bgColor, bold: false };
  };
}

export {
  generateAsciiPerlinPlasmaFrame,
  createAsciiPerlinPlasmaSampler
};
//# sourceMappingURL=chunk-YVQNOSJZ.js.map