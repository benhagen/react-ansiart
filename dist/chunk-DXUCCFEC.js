import {
  ANSI_COLORS_RGB,
  getPalette,
  rgbToPaletteColor
} from "./chunk-5HWPP6FR.js";

// src/ansi/frameToAnsi.ts
var BLOCK_CHARS = {
  dark: " ",
  // Space
  light: "\u2591",
  // ░ Light shade
  medium: "\u2592",
  // ▒ Medium shade
  heavy: "\u2593",
  // ▓ Heavy shade
  full: "\u2588"
  // █ Full block
};
function getBrightness(r, g, b) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
function getBlockChar(brightness) {
  if (brightness < 0.15) return BLOCK_CHARS.dark;
  if (brightness < 0.35) return BLOCK_CHARS.light;
  if (brightness < 0.6) return BLOCK_CHARS.medium;
  if (brightness < 0.85) return BLOCK_CHARS.heavy;
  return BLOCK_CHARS.full;
}
function convertFrameDataToAnsi(frame, columns, rows, palette = "ansi16") {
  const paletteColors = getPalette(palette);
  const paletteSize = paletteColors.length;
  const lines = [];
  const pixelsPerCellX = frame.width / columns;
  const pixelsPerCellY = frame.height / rows;
  for (let row = 0; row < rows; row++) {
    const line = [];
    for (let col = 0; col < columns; col++) {
      const pxStart = Math.floor(col * pixelsPerCellX);
      const pxEnd = Math.min(Math.floor((col + 1) * pixelsPerCellX), frame.width);
      const pyStart = Math.floor(row * pixelsPerCellY);
      const pyEnd = Math.min(Math.floor((row + 1) * pixelsPerCellY), frame.height);
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let pixelCount = 0;
      for (let py = pyStart; py < pyEnd; py++) {
        for (let px = pxStart; px < pxEnd; px++) {
          const pixelIndex = (py * frame.width + px) * 3;
          sumR += frame.pixels[pixelIndex];
          sumG += frame.pixels[pixelIndex + 1];
          sumB += frame.pixels[pixelIndex + 2];
          pixelCount++;
        }
      }
      if (pixelCount === 0) {
        line.push({ ch: " ", fg: 7, bg: 0, bold: false });
        continue;
      }
      const avgR = sumR / pixelCount;
      const avgG = sumG / pixelCount;
      const avgB = sumB / pixelCount;
      const brightness = getBrightness(avgR, avgG, avgB);
      const ch = getBlockChar(brightness);
      let fg;
      let bg;
      if (palette === "ansi16") {
        const colorIndex = rgbToPaletteColor(avgR, avgG, avgB, paletteColors);
        bg = brightness < 0.3 ? 0 : 8;
        if (brightness > 0.7 && colorIndex < 8) {
          fg = colorIndex + 8;
        } else {
          fg = colorIndex;
        }
      } else {
        const paletteColorIndex = rgbToPaletteColor(avgR, avgG, avgB, paletteColors);
        const [paletteR, paletteG, paletteB] = paletteColors[paletteColorIndex];
        const ansiMatch = rgbToPaletteColor(paletteR, paletteG, paletteB, ANSI_COLORS_RGB);
        bg = brightness < 0.3 ? 0 : 8;
        const paletteBrightness = getBrightness(paletteR, paletteG, paletteB);
        if (paletteBrightness > 0.6 && ansiMatch < 8) {
          fg = ansiMatch + 8;
        } else {
          fg = ansiMatch;
        }
      }
      line.push({ ch, fg, bg, bold: false });
    }
    lines.push(line);
  }
  return { lines, columns };
}

export {
  convertFrameDataToAnsi
};
//# sourceMappingURL=chunk-DXUCCFEC.js.map