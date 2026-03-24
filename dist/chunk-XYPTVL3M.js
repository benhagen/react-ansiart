// src/font/bitmapFont.ts
async function loadRawBitmapFont(url, width = 8, height = 16) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load font: ${response.status}`);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const bytesPerGlyph = height;
  const expectedSize = 256 * bytesPerGlyph;
  let offset = 0;
  if (bytes.length > expectedSize) {
    for (let i = 0; i < bytes.length - expectedSize; i++) {
      const slice = bytes.slice(i, i + expectedSize);
      let nonZero = 0;
      for (let j = 0; j < Math.min(1e3, slice.length); j++) {
        if (slice[j] !== 0) nonZero++;
      }
      if (nonZero > 100 && nonZero < 900) {
        offset = i;
        break;
      }
    }
  }
  const fontData = bytes.slice(offset, offset + expectedSize);
  if (fontData.length < expectedSize) {
    throw new Error(`Font file too small: ${fontData.length} < ${expectedSize}`);
  }
  const glyphs = [];
  for (let i = 0; i < 256; i++) {
    const start = i * bytesPerGlyph;
    glyphs.push(fontData.slice(start, start + bytesPerGlyph));
  }
  return { width, height, glyphs };
}
function renderGlyph(ctx, font, charCode, x, y, fgColor, bgColor) {
  if (!font.glyphCache) {
    font.glyphCache = /* @__PURE__ */ new Map();
  }
  const cacheKey = `${charCode}:${fgColor}:${bgColor}`;
  let canvas = font.glyphCache.get(cacheKey);
  if (canvas) {
    font.glyphCache.delete(cacheKey);
    font.glyphCache.set(cacheKey, canvas);
  } else {
    const glyph = font.glyphs[charCode] || font.glyphs[0];
    canvas = document.createElement("canvas");
    canvas.width = font.width;
    canvas.height = font.height;
    const offscreenCtx = canvas.getContext("2d", { willReadFrequently: false });
    offscreenCtx.fillStyle = bgColor;
    offscreenCtx.fillRect(0, 0, font.width, font.height);
    offscreenCtx.fillStyle = fgColor;
    for (let row = 0; row < font.height; row++) {
      const byte = glyph[row];
      for (let col = 0; col < font.width; col++) {
        const bit = 7 - col;
        if (byte & 1 << bit) {
          offscreenCtx.fillRect(col, row, 1, 1);
        }
      }
    }
    if (font.glyphCache.size > 8192) {
      const iter = font.glyphCache.keys();
      for (let i = 0; i < 2048; i++) {
        const k = iter.next().value;
        if (k !== void 0) font.glyphCache.delete(k);
      }
    }
    font.glyphCache.set(cacheKey, canvas);
  }
  ctx.drawImage(canvas, x, y);
}
function renderText(ctx, font, text, x, y, fgColor, bgColor) {
  let xPos = x;
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    renderGlyph(ctx, font, charCode, xPos, y, fgColor, bgColor);
    xPos += font.width;
  }
  return xPos - x;
}

export {
  loadRawBitmapFont,
  renderGlyph,
  renderText
};
//# sourceMappingURL=chunk-XYPTVL3M.js.map