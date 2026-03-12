// src/utils/rgbToAnsi.ts
var ANSI_COLORS_RGB = [
  [0, 0, 0],
  // 0: Black
  [0, 0, 170],
  // 1: Blue
  [0, 170, 0],
  // 2: Green
  [0, 170, 170],
  // 3: Cyan
  [170, 0, 0],
  // 4: Red
  [170, 0, 170],
  // 5: Magenta
  [170, 85, 0],
  // 6: Brown
  [170, 170, 170],
  // 7: Light Gray
  [85, 85, 85],
  // 8: Dark Gray
  [85, 85, 255],
  // 9: Bright Blue
  [85, 255, 85],
  // 10: Bright Green
  [85, 255, 255],
  // 11: Bright Cyan
  [255, 85, 85],
  // 12: Bright Red
  [255, 85, 255],
  // 13: Bright Magenta
  [255, 255, 85],
  // 14: Yellow
  [255, 255, 255]
  // 15: White
];
function rgbDistance(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}
function generateEvenlySpacedPalette(size) {
  if (size === 1) {
    return [[128, 128, 128]];
  }
  if (size > 16) {
    const palette2 = [];
    const hueSteps = Math.ceil(Math.sqrt(size));
    const satSteps = Math.ceil(Math.sqrt(size));
    const valSteps = Math.ceil(size / (hueSteps * satSteps));
    for (let i = 0; i < size; i++) {
      const hueIdx = i % hueSteps;
      const satIdx = Math.floor(i / hueSteps) % satSteps;
      const valIdx = Math.floor(i / (hueSteps * satSteps));
      const hue = hueIdx / hueSteps * 360;
      const saturation = 0.3 + satIdx / satSteps * 0.7;
      const value = 0.2 + valIdx / valSteps * 0.8;
      const [r, g, b] = hsvToRgb(hue, Math.min(1, saturation), Math.min(1, value));
      palette2.push([r, g, b]);
    }
    return palette2;
  }
  const palette = [];
  const cubeRoot = Math.cbrt(size);
  const steps = Math.ceil(cubeRoot);
  for (let i = 0; i < size; i++) {
    const r = Math.floor(i % steps * (255 / (steps - 1)));
    const g = Math.floor(Math.floor(i / steps) % steps * (255 / (steps - 1)));
    const b = Math.floor(Math.floor(i / (steps * steps)) * (255 / (steps - 1)));
    palette.push([r, g, b]);
  }
  return palette;
}
function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(h / 60 % 2 - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (h >= 300 && h < 360) {
    r = c;
    g = 0;
    b = x;
  }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
function getPalette(mode) {
  if (mode === "ansi16") {
    return ANSI_COLORS_RGB;
  } else if (mode === "unconstrained") {
    return generateEvenlySpacedPalette(256);
  } else {
    return generateEvenlySpacedPalette(mode);
  }
}
function rgbToPaletteColor(r, g, b, palette) {
  let minDistance = Infinity;
  let closestIndex = 0;
  for (let i = 0; i < palette.length; i++) {
    const [ar, ag, ab] = palette[i];
    const distance = rgbDistance(r, g, b, ar, ag, ab);
    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = i;
    }
  }
  return closestIndex;
}
function rgbToAnsiColor(r, g, b) {
  return rgbToPaletteColor(r, g, b, ANSI_COLORS_RGB);
}

export {
  ANSI_COLORS_RGB,
  generateEvenlySpacedPalette,
  getPalette,
  rgbToPaletteColor,
  rgbToAnsiColor
};
//# sourceMappingURL=chunk-5HWPP6FR.js.map