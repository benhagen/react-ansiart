// src/AnsiArt.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// src/cp437.ts
var unicodeToCp437Map = /* @__PURE__ */ new Map();
function cp437ByteToChar(byte) {
  if (byte === 10) return "\n";
  if (byte === 13) return "\r";
  if (byte === 9) return " ";
  if (byte < 32) return "";
  switch (byte) {
    // Light/medium/dark shade
    case 176:
      return "\u2591";
    // ░
    case 177:
      return "\u2592";
    // ▒
    case 178:
      return "\u2593";
    // ▓
    // Box drawing single
    case 179:
      return "\u2502";
    // │
    case 180:
      return "\u2524";
    // ┤
    case 191:
      return "\u2510";
    // ┐
    case 192:
      return "\u2514";
    // └
    case 193:
      return "\u2534";
    // ┴
    case 194:
      return "\u252C";
    // ┬
    case 195:
      return "\u251C";
    // ├
    case 196:
      return "\u2500";
    // ─
    case 197:
      return "\u253C";
    // ┼
    case 199:
      return "\u251C";
    // ├ (approx)
    case 200:
      return "\u2514";
    // └ (approx)
    case 201:
      return "\u250C";
    // ┌
    case 202:
      return "\u252C";
    // ┬ (approx)
    case 203:
      return "\u252C";
    // ┬ (approx)
    case 204:
      return "\u251C";
    // ├ (approx)
    case 205:
      return "\u2500";
    // ─ (double maps to single for compatibility)
    case 206:
      return "\u253C";
    // ┼ (approx)
    case 217:
      return "\u2518";
    // ┘
    case 218:
      return "\u250C";
    // ┌
    // Block elements
    case 219:
      return "\u2588";
    // █ full block
    case 220:
      return "\u2584";
    // ▄ lower half block
    case 221:
      return "\u258C";
    // ▌ left half block
    case 222:
      return "\u2590";
    // ▐ right half block
    case 223:
      return "\u2580";
    // ▀ upper half block
    // Other commonly seen
    case 254:
      return "\u25A0";
  }
  return String.fromCharCode(byte);
}
function buildReverseMap() {
  if (unicodeToCp437Map.size > 0) return;
  for (let i = 0; i < 256; i++) {
    const ch = cp437ByteToChar(i);
    if (ch && ch !== "") {
      unicodeToCp437Map.set(ch, i);
    }
  }
}
function charToCp437Byte(ch) {
  if (!ch || ch.length === 0) return 32;
  buildReverseMap();
  const mapped = unicodeToCp437Map.get(ch);
  if (mapped !== void 0) return mapped;
  const code = ch.charCodeAt(0);
  return code < 256 ? code : 32;
}

// src/ansiParser.ts
function createCell(fg, bg, bold) {
  return { ch: " ", fg, bg, bold };
}
function ensureRow(lines, row, columns, fg, bg, bold) {
  while (lines.length <= row) {
    const newLine = [];
    for (let c = 0; c < columns; c++) newLine.push(createCell(7, 0, false));
    lines.push(newLine);
  }
}
function clearLine(line, from, to, fg, bg, bold) {
  const start = Math.max(0, from);
  const end = Math.min(line.length - 1, to);
  for (let c = start; c <= end; c++) {
    line[c] = createCell(fg, bg, bold);
  }
}
function isSauceTrailer(bytes) {
  if (bytes.length < 128) return false;
  const off = bytes.length - 128;
  return bytes[off] === 83 && // S
  bytes[off + 1] === 65 && // A
  bytes[off + 2] === 85 && // U
  bytes[off + 3] === 67 && // C
  bytes[off + 4] === 69;
}
function parseAnsi(bytesInput, columns = 80) {
  let bytes = bytesInput;
  if (isSauceTrailer(bytes)) {
    bytes = bytes.slice(0, bytes.length - 128);
  }
  const lines = [];
  const cur = { row: 0, col: 0 };
  const savedCur = { row: 0, col: 0 };
  let fg = 7;
  let bg = 0;
  let bold = false;
  const ESC = 27;
  let i = 0;
  let state = "normal";
  let csiParams = "";
  const writeChar = (ch) => {
    if (ch === "") return;
    if (ch === "\n") {
      cur.row += 1;
      cur.col = 0;
      return;
    }
    if (ch === "\r") {
      cur.col = 0;
      return;
    }
    if (cur.col < 0) cur.col = 0;
    if (cur.col >= columns) {
      return;
    }
    ensureRow(lines, cur.row, columns, fg, bg, bold);
    lines[cur.row][cur.col] = { ch, fg, bg, bold };
    cur.col += 1;
  };
  const applySGR = (params) => {
    if (params.length === 0) params = [0];
    const ANSI_TO_DOS = [0, 4, 2, 6, 1, 5, 3, 7];
    for (const p2 of params) {
      if (p2 === 0) {
        fg = 7;
        bg = 0;
        bold = false;
        continue;
      }
      if (p2 === 1) {
        bold = true;
        continue;
      }
      if (p2 === 22) {
        bold = false;
        continue;
      }
      if (p2 === 39) {
        fg = 7;
        continue;
      }
      if (p2 === 49) {
        bg = 0;
        continue;
      }
      if (p2 >= 30 && p2 <= 37) {
        fg = ANSI_TO_DOS[p2 - 30];
        continue;
      }
      if (p2 >= 40 && p2 <= 47) {
        bg = ANSI_TO_DOS[p2 - 40];
        continue;
      }
      if (p2 >= 90 && p2 <= 97) {
        fg = 8 + ANSI_TO_DOS[p2 - 90];
        continue;
      }
      if (p2 >= 100 && p2 <= 107) {
        bg = 8 + ANSI_TO_DOS[p2 - 100];
        continue;
      }
    }
  };
  while (i < bytes.length) {
    const b = bytes[i++];
    if (b === 26) break;
    switch (state) {
      case "normal": {
        if (b === ESC) {
          state = "esc";
          break;
        }
        writeChar(cp437ByteToChar(b));
        break;
      }
      case "esc": {
        if (b === 91) {
          state = "csi";
          csiParams = "";
          break;
        }
        state = "normal";
        break;
      }
      case "csi": {
        const ch = String.fromCharCode(b);
        if (b >= 48 && b <= 63 || ch === " " || ch === "?") {
          csiParams += ch;
          break;
        }
        const params = csiParams.trim().length ? csiParams.split(";").map((x) => x === "" ? NaN : parseInt(x, 10)) : [];
        const get = (idx, def) => Number.isNaN(params[idx]) || params[idx] === void 0 ? def : params[idx];
        if (ch === "s") {
          savedCur.row = cur.row;
          savedCur.col = cur.col;
        } else if (ch === "u") {
          cur.row = savedCur.row;
          cur.col = savedCur.col;
          ensureRow(lines, cur.row, columns, fg, bg, bold);
        } else if (ch === "m") {
          applySGR(params.filter((p2) => !Number.isNaN(p2)));
        } else if (ch === "H" || ch === "f") {
          const r = Math.max(1, get(0, 1)) - 1;
          const c = Math.max(1, get(1, 1)) - 1;
          cur.row = r;
          cur.col = Math.max(0, Math.min(columns - 1, c));
          ensureRow(lines, cur.row, columns, fg, bg, bold);
        } else if (ch === "A") {
          const n = Math.max(1, get(0, 1));
          cur.row = Math.max(0, cur.row - n);
        } else if (ch === "B") {
          const n = Math.max(1, get(0, 1));
          cur.row = cur.row + n;
          ensureRow(lines, cur.row, columns, fg, bg, bold);
        } else if (ch === "C") {
          const n = Math.max(1, get(0, 1));
          cur.col = Math.min(columns - 1, cur.col + n);
        } else if (ch === "D") {
          const n = Math.max(1, get(0, 1));
          cur.col = Math.max(0, cur.col - n);
        } else if (ch === "G") {
          const c = Math.max(1, get(0, 1)) - 1;
          cur.col = Math.max(0, Math.min(columns - 1, c));
        } else if (ch === "K") {
          const mode = get(0, 0);
          ensureRow(lines, cur.row, columns, fg, bg, bold);
          if (mode === 0) {
            clearLine(lines[cur.row], cur.col, columns - 1, fg, bg, bold);
          } else if (mode === 1) {
            clearLine(lines[cur.row], 0, cur.col, fg, bg, bold);
          } else if (mode === 2) {
            clearLine(lines[cur.row], 0, columns - 1, fg, bg, bold);
          }
        } else if (ch === "J") {
          const mode = get(0, 0);
          if (mode === 2) {
            lines.length = 0;
            cur.row = 0;
            cur.col = 0;
          } else if (mode === 0 || mode === 1) {
            ensureRow(lines, cur.row, columns, fg, bg, bold);
            if (mode === 0) {
              clearLine(lines[cur.row], cur.col, columns - 1, fg, bg, bold);
              for (let r = cur.row + 1; r < lines.length; r++)
                clearLine(lines[r], 0, columns - 1, fg, bg, bold);
            } else {
              for (let r = 0; r < cur.row; r++) clearLine(lines[r], 0, columns - 1, fg, bg, bold);
              clearLine(lines[cur.row], 0, cur.col, fg, bg, bold);
            }
          }
        }
        state = "normal";
        csiParams = "";
        break;
      }
    }
  }
  if (lines.length === 0) {
    const newLine = [];
    for (let c = 0; c < columns; c++) newLine.push(createCell(7, 0, false));
    lines.push(newLine);
  }
  for (let r = 0; r < lines.length; r++) {
    const line = lines[r];
    if (!line) {
      lines[r] = [];
      for (let c = 0; c < columns; c++) lines[r].push(createCell(7, 0, false));
    } else {
      while (line.length < columns) {
        line.push(createCell(7, 0, false));
      }
    }
  }
  return { lines, columns };
}
function parseAnsiIncremental(bytesInput, columns, maxByteIndex) {
  let bytes = bytesInput;
  if (isSauceTrailer(bytes)) {
    bytes = bytes.slice(0, bytes.length - 128);
  }
  const stopAt = Math.min(maxByteIndex, bytes.length);
  const lines = [];
  const cur = { row: 0, col: 0 };
  const savedCur = { row: 0, col: 0 };
  let fg = 7;
  let bg = 0;
  let bold = false;
  const ESC = 27;
  let i = 0;
  let state = "normal";
  let csiParams = "";
  const writeChar = (ch) => {
    if (ch === "") return;
    if (ch === "\n") {
      cur.row += 1;
      cur.col = 0;
      return;
    }
    if (ch === "\r") {
      cur.col = 0;
      return;
    }
    if (cur.col < 0) cur.col = 0;
    if (cur.col >= columns) {
      return;
    }
    ensureRow(lines, cur.row, columns, fg, bg, bold);
    lines[cur.row][cur.col] = { ch, fg, bg, bold };
    cur.col += 1;
  };
  const applySGR = (params) => {
    if (params.length === 0) params = [0];
    const ANSI_TO_DOS = [0, 4, 2, 6, 1, 5, 3, 7];
    for (const p2 of params) {
      if (p2 === 0) {
        fg = 7;
        bg = 0;
        bold = false;
        continue;
      }
      if (p2 === 1) {
        bold = true;
        continue;
      }
      if (p2 === 22) {
        bold = false;
        continue;
      }
      if (p2 === 39) {
        fg = 7;
        continue;
      }
      if (p2 === 49) {
        bg = 0;
        continue;
      }
      if (p2 >= 30 && p2 <= 37) {
        fg = ANSI_TO_DOS[p2 - 30];
        continue;
      }
      if (p2 >= 40 && p2 <= 47) {
        bg = ANSI_TO_DOS[p2 - 40];
        continue;
      }
      if (p2 >= 90 && p2 <= 97) {
        fg = 8 + ANSI_TO_DOS[p2 - 90];
        continue;
      }
      if (p2 >= 100 && p2 <= 107) {
        bg = 8 + ANSI_TO_DOS[p2 - 100];
        continue;
      }
    }
  };
  while (i < stopAt) {
    const b = bytes[i++];
    if (b === 26) break;
    switch (state) {
      case "normal": {
        if (b === ESC) {
          state = "esc";
          break;
        }
        writeChar(cp437ByteToChar(b));
        break;
      }
      case "esc": {
        if (b === 91) {
          state = "csi";
          csiParams = "";
          break;
        }
        state = "normal";
        break;
      }
      case "csi": {
        const ch = String.fromCharCode(b);
        if (b >= 48 && b <= 63 || ch === " " || ch === "?") {
          csiParams += ch;
          break;
        }
        const params = csiParams.trim().length ? csiParams.split(";").map((x) => x === "" ? NaN : parseInt(x, 10)) : [];
        const get = (idx, def) => Number.isNaN(params[idx]) || params[idx] === void 0 ? def : params[idx];
        if (ch === "s") {
          savedCur.row = cur.row;
          savedCur.col = cur.col;
        } else if (ch === "u") {
          cur.row = savedCur.row;
          cur.col = savedCur.col;
          ensureRow(lines, cur.row, columns, fg, bg, bold);
        } else if (ch === "m") {
          applySGR(params.filter((p2) => !Number.isNaN(p2)));
        } else if (ch === "H" || ch === "f") {
          const r = Math.max(1, get(0, 1)) - 1;
          const c = Math.max(1, get(1, 1)) - 1;
          cur.row = r;
          cur.col = Math.max(0, Math.min(columns - 1, c));
          ensureRow(lines, cur.row, columns, fg, bg, bold);
        } else if (ch === "A") {
          const n = Math.max(1, get(0, 1));
          cur.row = Math.max(0, cur.row - n);
        } else if (ch === "B") {
          const n = Math.max(1, get(0, 1));
          cur.row = cur.row + n;
          ensureRow(lines, cur.row, columns, fg, bg, bold);
        } else if (ch === "C") {
          const n = Math.max(1, get(0, 1));
          cur.col = Math.min(columns - 1, cur.col + n);
        } else if (ch === "D") {
          const n = Math.max(1, get(0, 1));
          cur.col = Math.max(0, cur.col - n);
        } else if (ch === "G") {
          const c = Math.max(1, get(0, 1)) - 1;
          cur.col = Math.max(0, Math.min(columns - 1, c));
        } else if (ch === "K") {
          const mode = get(0, 0);
          ensureRow(lines, cur.row, columns, fg, bg, bold);
          if (mode === 0) {
            clearLine(lines[cur.row], cur.col, columns - 1, fg, bg, bold);
          } else if (mode === 1) {
            clearLine(lines[cur.row], 0, cur.col, fg, bg, bold);
          } else if (mode === 2) {
            clearLine(lines[cur.row], 0, columns - 1, fg, bg, bold);
          }
        } else if (ch === "J") {
          const mode = get(0, 0);
          if (mode === 2) {
            lines.length = 0;
            cur.row = 0;
            cur.col = 0;
          } else if (mode === 0 || mode === 1) {
            ensureRow(lines, cur.row, columns, fg, bg, bold);
            if (mode === 0) {
              clearLine(lines[cur.row], cur.col, columns - 1, fg, bg, bold);
              for (let r = cur.row + 1; r < lines.length; r++)
                clearLine(lines[r], 0, columns - 1, fg, bg, bold);
            } else {
              for (let r = 0; r < cur.row; r++) clearLine(lines[r], 0, columns - 1, fg, bg, bold);
              clearLine(lines[cur.row], 0, cur.col, fg, bg, bold);
            }
          }
        }
        state = "normal";
        csiParams = "";
        break;
      }
    }
  }
  if (lines.length === 0) {
    const newLine = [];
    for (let c = 0; c < columns; c++) newLine.push(createCell(7, 0, false));
    lines.push(newLine);
  }
  for (let r = 0; r < lines.length; r++) {
    const line = lines[r];
    if (!line) {
      lines[r] = [];
      for (let c = 0; c < columns; c++) lines[r].push(createCell(7, 0, false));
    } else {
      while (line.length < columns) {
        line.push(createCell(7, 0, false));
      }
    }
  }
  return { lines, columns };
}
function findNextRenderPoint(bytes, startIndex, batchSize = 50) {
  if (startIndex >= bytes.length) return bytes.length;
  let i = startIndex;
  const ESC = 27;
  let state = "normal";
  let normalCharCount = 0;
  while (i < bytes.length) {
    const b = bytes[i++];
    if (b === 26) return i;
    switch (state) {
      case "normal": {
        if (b === ESC) {
          if (normalCharCount > 0) return i - 1;
          state = "esc";
          break;
        }
        if (b === 10 || b === 13) {
          return i;
        }
        normalCharCount++;
        if (normalCharCount >= batchSize) {
          return i;
        }
        break;
      }
      case "esc": {
        if (b === 91) {
          state = "csi";
          break;
        }
        return i;
      }
      case "csi": {
        const ch = String.fromCharCode(b);
        if (b >= 48 && b <= 63 || ch === " " || ch === "?") {
          break;
        }
        return i;
      }
    }
  }
  return bytes.length;
}
function findNextCursorMove(bytes, startIndex, maxCharsBeforeStop = 2e3, linesPerBatch = 5) {
  if (startIndex >= bytes.length) return bytes.length;
  let i = startIndex;
  const ESC = 27;
  let state = "normal";
  let csiParams = "";
  let normalCharCount = 0;
  let newlineCount = 0;
  let foundAnyCursorCommand = false;
  while (i < bytes.length) {
    const b = bytes[i++];
    if (b === 26) return i;
    switch (state) {
      case "normal": {
        if (b === ESC) {
          state = "esc";
          csiParams = "";
          break;
        }
        if (b === 10 || b === 13) {
          newlineCount++;
          if (newlineCount >= linesPerBatch) {
            return i;
          }
          break;
        }
        normalCharCount++;
        if (normalCharCount >= maxCharsBeforeStop) {
          return i;
        }
        break;
      }
      case "esc": {
        if (b === 91) {
          state = "csi";
          break;
        }
        state = "normal";
        break;
      }
      case "csi": {
        const ch = String.fromCharCode(b);
        if (b >= 48 && b <= 63 || ch === " " || ch === "?") {
          csiParams += ch;
          break;
        }
        const isCursorMove = ch === "H" || // Cursor Position
        ch === "f" || // Horizontal Vertical Position
        ch === "A" || // Cursor Up
        ch === "B" || // Cursor Down
        ch === "C" || // Cursor Forward
        ch === "D" || // Cursor Back
        ch === "G" || // Cursor Horizontal Absolute
        ch === "s" || // Save Cursor Position
        ch === "u";
        state = "normal";
        csiParams = "";
        if (isCursorMove) {
          foundAnyCursorCommand = true;
          normalCharCount = 0;
          newlineCount = 0;
          return i;
        }
        break;
      }
    }
  }
  return bytes.length;
}

// src/bitmapFont.ts
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
  if (!canvas) {
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
    font.glyphCache.set(cacheKey, canvas);
  }
  ctx.drawImage(canvas, x, y);
}

// src/fonExtractor.ts
async function extractFontFromFON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load FON: ${response.status}`);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes[0] !== 77 || bytes[1] !== 90) {
    return bytes;
  }
  const neOffset = bytes[60] | bytes[61] << 8;
  if (bytes[neOffset] !== 78 || bytes[neOffset + 1] !== 69) {
    return null;
  }
  const resTableOffset = neOffset + (bytes[neOffset + 36] | bytes[neOffset + 37] << 8);
  const alignShift = bytes[resTableOffset] | bytes[resTableOffset + 1] << 8;
  let pos = resTableOffset + 2;
  while (pos < bytes.length - 8) {
    const typeId = bytes[pos] | bytes[pos + 1] << 8;
    if (typeId === 0) {
      break;
    }
    const count = bytes[pos + 2] | bytes[pos + 3] << 8;
    pos += 8;
    if (typeId === 32776) {
      if (count > 0) {
        const fontResOffset = (bytes[pos] | bytes[pos + 1] << 8) << alignShift;
        const fontResLength = (bytes[pos + 2] | bytes[pos + 3] << 8) << alignShift;
        const fntData = bytes.slice(fontResOffset, fontResOffset + fontResLength);
        const dfPixHeight = fntData[88] | fntData[89] << 8;
        const dfFirstChar = fntData[95];
        const dfLastChar = fntData[96];
        const charTableStart = 117;
        const charCount = dfLastChar - dfFirstChar + 1;
        const charTableSize = charCount * 4;
        const baseOffset = charTableStart + charTableSize;
        let bitmapOffset = baseOffset;
        let bestOffset = baseOffset;
        let bestScore = -1;
        for (let adj = -16; adj <= 16; adj++) {
          const testOffset = baseOffset + adj;
          if (testOffset < 0 || fntData.length < testOffset + 4096) continue;
          let score = 0;
          const testChar32 = fntData.slice(testOffset + 32 * 16, testOffset + 32 * 16 + 16);
          const spaceNonZero = testChar32.filter((b) => b !== 0).length;
          if (spaceNonZero === 0) {
            score += 20;
          } else if (spaceNonZero <= 2) {
            score += 10;
          } else {
            continue;
          }
          const testChar65 = fntData.slice(testOffset + 65 * 16, testOffset + 65 * 16 + 16);
          const firstNonZero = testChar65.findIndex((b) => b !== 0);
          if (firstNonZero >= 5 && firstNonZero <= 7) {
            score += 15 - Math.abs(firstNonZero - 6);
            if (testChar65[firstNonZero] >= 16 && testChar65[firstNonZero] <= 128) {
              score += 5;
            }
          } else {
            score -= 10;
          }
          const testChar219 = fntData.slice(testOffset + 219 * 16, testOffset + 219 * 16 + 16);
          const allFF = testChar219.every((b) => b === 255);
          if (allFF) {
            score += 25;
          } else {
            const nonFF = testChar219.filter((b) => b !== 255).length;
            if (nonFF <= 2) {
              score += 10;
            } else {
              score -= 15;
            }
          }
          if (score > bestScore) {
            bestScore = score;
            bestOffset = testOffset;
          }
        }
        bitmapOffset = bestOffset;
        if (fntData.length >= bitmapOffset + 4096) {
          return fntData.slice(bitmapOffset, bitmapOffset + 4096);
        }
        const absoluteBitmapOffset = fontResOffset + bitmapOffset;
        if (bytes.length >= absoluteBitmapOffset + 4096) {
          return bytes.slice(absoluteBitmapOffset, absoluteBitmapOffset + 4096);
        }
        return null;
      }
    }
    pos += count * 12;
  }
  return null;
}

// src/AnsiArt.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var DOS_COLORS = {
  0: "#000000",
  1: "#0000AA",
  2: "#00AA00",
  3: "#00AAAA",
  4: "#AA0000",
  5: "#AA00AA",
  6: "#AA5500",
  7: "#AAAAAA",
  8: "#555555",
  9: "#5555FF",
  10: "#55FF55",
  11: "#55FFFF",
  12: "#FF5555",
  13: "#FF55FF",
  14: "#FFFF55",
  15: "#FFFFFF"
};
function colorToCss(color, defaultColor = "#AAAAAA") {
  if (typeof color === "string") {
    return color;
  }
  return DOS_COLORS[color] ?? defaultColor;
}
function AnsiArt({
  src,
  columns = 80,
  background = "#000",
  allowDrop = true,
  bitmapFontUrl,
  debugFont = false,
  animated = false,
  frameDelay = 2,
  bytesPerFrame = 500,
  linesPerFrame = 25,
  animateBy = "cursor",
  showControls = false,
  debugPerformance = false
}) {
  const [screen, setScreen] = useState(null);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [bitmapFont, setBitmapFont] = useState(null);
  const [rawFontData, setRawFontData] = useState(null);
  const [rawAnsiData, setRawAnsiData] = useState(null);
  const [currentByteIndex, setCurrentByteIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [perfMetrics, setPerfMetrics] = useState({
    fps: 0,
    renderTimeMs: 0,
    cellsUpdated: 0,
    totalCells: 0,
    parseTimeMs: 0,
    bytesPerSecond: 0
  });
  const canvasRef = useRef(null);
  const debugFontCanvasRef = useRef(null);
  const animationTimeoutRef = useRef(null);
  const currentByteIndexRef = useRef(0);
  const rawAnsiDataRef = useRef(null);
  const isAnimatingRef = useRef(false);
  const columnsRef = useRef(columns);
  const frameDelayRef = useRef(frameDelay);
  const bytesPerFrameRef = useRef(bytesPerFrame);
  const linesPerFrameRef = useRef(linesPerFrame);
  const animateByRef = useRef(animateBy);
  const backgroundRef = useRef(background);
  const bitmapFontRef = useRef(bitmapFont);
  const previousScreenRef = useRef(null);
  const lastFrameTimeRef = useRef(0);
  const frameCountRef = useRef(0);
  const fpsUpdateTimeRef = useRef(0);
  const lastByteIndexRef = useRef(0);
  const lastBytesUpdateTimeRef = useRef(0);
  async function loadFromBytes(bytes, name) {
    setError(null);
    try {
      if (animated) {
        setRawAnsiData(bytes);
        currentByteIndexRef.current = 0;
        setCurrentByteIndex(0);
        previousScreenRef.current = null;
        setIsPlaying(true);
        setScreen(parseAnsi(new Uint8Array(0), columns));
        if (name) setFileName(name);
      } else {
        const parsed = parseAnsi(bytes, columns);
        setScreen(parsed);
        if (name) setFileName(name);
        setRawAnsiData(null);
        currentByteIndexRef.current = 0;
        setCurrentByteIndex(0);
        setIsPlaying(false);
      }
    } catch (e) {
      setError(String(e?.message || e));
    }
  }
  useEffect(() => {
    if (!bitmapFontUrl) {
      setBitmapFont(null);
      return;
    }
    let cancelled = false;
    async function loadFont() {
      try {
        const fontData = await extractFontFromFON(bitmapFontUrl);
        if (fontData && fontData.length >= 4096) {
          if (!cancelled) setRawFontData(fontData);
          const glyphs = [];
          for (let i = 0; i < 256; i++) {
            glyphs.push(fontData.slice(i * 16, (i + 1) * 16));
          }
          if (!cancelled) setBitmapFont({ width: 8, height: 16, glyphs, rawBitmapData: fontData });
        } else {
          const font = await loadRawBitmapFont(bitmapFontUrl, 8, 16);
          if (!cancelled) setBitmapFont(font);
        }
      } catch (e) {
        console.warn("Failed to load bitmap font:", e);
        if (!cancelled) setBitmapFont(null);
      }
    }
    loadFont();
    return () => {
      cancelled = true;
    };
  }, [bitmapFontUrl]);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`Failed to fetch ${src}: ${res.status}`);
        const buf = new Uint8Array(await res.arrayBuffer());
        if (animated) {
          if (!cancelled) {
            setRawAnsiData(buf);
            currentByteIndexRef.current = 0;
            setCurrentByteIndex(0);
            previousScreenRef.current = null;
            setIsPlaying(true);
            setScreen(parseAnsi(new Uint8Array(0), columns));
          }
        } else {
          const parsed = parseAnsi(buf, columns);
          if (!cancelled) {
            setScreen(parsed);
            setFileName(null);
            setRawAnsiData(null);
            currentByteIndexRef.current = 0;
            setCurrentByteIndex(0);
            setIsPlaying(false);
          }
        }
      } catch (e) {
        if (!cancelled) setError(String(e?.message || e));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [src, columns, animated]);
  const onDragEnter = (e) => {
    if (!allowDrop) return;
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragOver = (e) => {
    if (!allowDrop) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  };
  const onDragLeave = (e) => {
    if (!allowDrop) return;
    e.preventDefault();
    setIsDragging(false);
  };
  const onDrop = async (e) => {
    if (!allowDrop) return;
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      await loadFromBytes(buf, file.name);
    } catch (err) {
      setError(String(err?.message || err));
    }
  };
  const handlePlayPause = () => {
    if (currentByteIndex >= (rawAnsiData?.length || 0)) {
      currentByteIndexRef.current = 0;
      setCurrentByteIndex(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };
  const handleRestart = () => {
    currentByteIndexRef.current = 0;
    setCurrentByteIndex(0);
    previousScreenRef.current = null;
    isAnimatingRef.current = false;
    setIsPlaying(true);
    if (rawAnsiData) setScreen(parseAnsi(new Uint8Array(0), columns));
  };
  const rootStyle = useMemo(
    () => ({
      ...isDragging ? { outline: "2px dashed #888", outlineOffset: "-2px" } : {}
    }),
    [isDragging]
  );
  const renderToCanvas = useCallback(
    (screenToRender, forceFullRedraw = false) => {
      const renderStart = performance.now();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const bitmapFont2 = bitmapFontRef.current;
      if (!bitmapFont2) return;
      const rows = screenToRender.lines.length;
      const cols = screenToRender.columns;
      const background2 = backgroundRef.current;
      const charWidth = bitmapFont2.width;
      const charHeight = bitmapFont2.height;
      const cssWidth = cols * charWidth;
      const cssHeight = rows * charHeight;
      const dpr = typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1;
      const previousScreen = previousScreenRef.current;
      const needsResize = canvas.width !== Math.floor(cssWidth * dpr) || canvas.height !== Math.floor(cssHeight * dpr);
      if (needsResize) {
        canvas.width = Math.max(1, Math.floor(cssWidth * dpr));
        canvas.height = Math.max(1, Math.floor(cssHeight * dpr));
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      if (!previousScreen || needsResize || forceFullRedraw) {
        ctx.fillStyle = background2;
        ctx.fillRect(0, 0, cssWidth, cssHeight);
      }
      let cellsUpdated = 0;
      const totalCells = rows * cols;
      for (let r = 0; r < rows; r++) {
        const cells = screenToRender.lines[r];
        const prevCells = previousScreen?.lines[r];
        if (!prevCells || forceFullRedraw || needsResize) {
          for (let c = 0; c < cells.length; c++) {
            const cell = cells[c];
            cellsUpdated++;
            const x = c * charWidth;
            const y = r * charHeight;
            const fg = typeof cell.fg === "number" && cell.bold && cell.fg < 8 ? cell.fg + 8 : cell.fg;
            const fgColor = colorToCss(fg, "#AAAAAA");
            const bgColor = colorToCss(cell.bg, "#000000");
            const charCode = charToCp437Byte(cell.ch);
            renderGlyph(ctx, bitmapFont2, charCode, x, y, fgColor, bgColor);
          }
          continue;
        }
        for (let c = 0; c < cells.length; c++) {
          const cell = cells[c];
          const prevCell = prevCells[c];
          if (prevCell && prevCell.ch === cell.ch && prevCell.fg === cell.fg && prevCell.bg === cell.bg && prevCell.bold === cell.bold) {
            continue;
          }
          cellsUpdated++;
          const x = c * charWidth;
          const y = r * charHeight;
          const fg = typeof cell.fg === "number" && cell.bold && cell.fg < 8 ? cell.fg + 8 : cell.fg;
          const fgColor = colorToCss(fg, "#AAAAAA");
          const bgColor = colorToCss(cell.bg, "#000000");
          const charCode = charToCp437Byte(cell.ch);
          renderGlyph(ctx, bitmapFont2, charCode, x, y, fgColor, bgColor);
        }
      }
      previousScreenRef.current = screenToRender;
      const renderEnd = performance.now();
      const renderTimeMs = renderEnd - renderStart;
      if (debugPerformance) {
        const now = performance.now();
        frameCountRef.current++;
        if (now - fpsUpdateTimeRef.current >= 500) {
          const fps = frameCountRef.current / (now - fpsUpdateTimeRef.current) * 1e3;
          setPerfMetrics((prev) => ({
            ...prev,
            fps: Math.round(fps),
            renderTimeMs: Math.round(renderTimeMs * 100) / 100,
            cellsUpdated,
            totalCells
          }));
          frameCountRef.current = 0;
          fpsUpdateTimeRef.current = now;
        }
      }
    },
    [debugPerformance]
  );
  useEffect(() => {
    if (!screen) return;
    renderToCanvas(screen, true);
  }, [screen, renderToCanvas]);
  useEffect(() => {
    rawAnsiDataRef.current = rawAnsiData;
  }, [rawAnsiData]);
  useEffect(() => {
    columnsRef.current = columns;
    frameDelayRef.current = frameDelay;
    bytesPerFrameRef.current = bytesPerFrame;
    linesPerFrameRef.current = linesPerFrame;
    animateByRef.current = animateBy;
    backgroundRef.current = background;
    bitmapFontRef.current = bitmapFont;
  }, [columns, frameDelay, bytesPerFrame, linesPerFrame, animateBy, background, bitmapFont]);
  const animateRef = useRef(null);
  animateRef.current = () => {
    const data = rawAnsiDataRef.current;
    if (!data) {
      isAnimatingRef.current = false;
      return;
    }
    if (frameDelayRef.current <= 0) {
      while (currentByteIndexRef.current < data.length) {
        const currentIndex2 = currentByteIndexRef.current;
        const nextByteIndex2 = animateByRef.current === "cursor" ? findNextCursorMove(
          data,
          currentIndex2,
          columnsRef.current * 10,
          linesPerFrameRef.current
        ) : findNextRenderPoint(data, currentIndex2, bytesPerFrameRef.current);
        if (nextByteIndex2 <= currentIndex2 || nextByteIndex2 > data.length) break;
        const newScreen = parseAnsiIncremental(data, columnsRef.current, nextByteIndex2);
        renderToCanvas(newScreen);
        currentByteIndexRef.current = nextByteIndex2;
      }
      const finalScreen = parseAnsiIncremental(data, columnsRef.current, data.length);
      setScreen(finalScreen);
      setCurrentByteIndex(data.length);
      setIsPlaying(false);
      isAnimatingRef.current = false;
      return;
    }
    const currentIndex = currentByteIndexRef.current;
    const parseStart = performance.now();
    const nextByteIndex = animateByRef.current === "cursor" ? findNextCursorMove(data, currentIndex, columnsRef.current * 10, linesPerFrameRef.current) : findNextRenderPoint(data, currentIndex, bytesPerFrameRef.current);
    if (debugPerformance) {
      console.log(
        `Animation frame: ${currentIndex} -> ${nextByteIndex} (${nextByteIndex - currentIndex} bytes)`
      );
    }
    if (nextByteIndex > currentIndex && nextByteIndex <= data.length) {
      const newScreen = parseAnsiIncremental(data, columnsRef.current, nextByteIndex);
      const parseEnd = performance.now();
      if (debugPerformance) {
        const now = performance.now();
        const bytesDelta = nextByteIndex - lastByteIndexRef.current;
        const timeDelta = now - lastBytesUpdateTimeRef.current;
        if (timeDelta >= 500) {
          const bytesPerSecond = Math.round(bytesDelta / timeDelta * 1e3);
          setPerfMetrics((prev) => ({
            ...prev,
            parseTimeMs: Math.round((parseEnd - parseStart) * 100) / 100,
            bytesPerSecond
          }));
          lastByteIndexRef.current = nextByteIndex;
          lastBytesUpdateTimeRef.current = now;
        } else {
          setPerfMetrics((prev) => ({
            ...prev,
            parseTimeMs: Math.round((parseEnd - parseStart) * 100) / 100
          }));
        }
      }
      renderToCanvas(newScreen);
      currentByteIndexRef.current = nextByteIndex;
      if (nextByteIndex >= data.length) {
        setScreen(newScreen);
        setCurrentByteIndex(nextByteIndex);
        setIsPlaying(false);
        isAnimatingRef.current = false;
        return;
      }
      animationTimeoutRef.current = window.setTimeout(() => {
        animateRef.current?.();
      }, frameDelayRef.current);
    } else {
      setIsPlaying(false);
      isAnimatingRef.current = false;
    }
  };
  useEffect(() => {
    if (!animated || !isPlaying) {
      isAnimatingRef.current = false;
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
      return;
    }
    if (isAnimatingRef.current) {
      return;
    }
    isAnimatingRef.current = true;
    animateRef.current?.();
    return () => {
      isAnimatingRef.current = false;
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
    };
  }, [animated, isPlaying]);
  useEffect(() => {
    if (!debugFont || !rawFontData) return;
    const canvas = debugFontCanvasRef.current;
    if (!canvas) return;
    const charWidth = 8;
    const charHeight = 16;
    const cols = 16;
    const rows = 16;
    const cssWidth = cols * charWidth;
    const cssHeight = rows * charHeight;
    const dpr = typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1;
    canvas.width = Math.max(1, Math.floor(cssWidth * dpr));
    canvas.height = Math.max(1, Math.floor(cssHeight * dpr));
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    ctx.fillStyle = "#FFFFFF";
    for (let charCode = 0; charCode < 256; charCode++) {
      const charBase = charCode * 16;
      const col = charCode % 16;
      const row = Math.floor(charCode / 16);
      const baseX = col * charWidth;
      const baseY = row * charHeight;
      for (let rowIdx = 0; rowIdx < 16; rowIdx++) {
        const byte = rawFontData[charBase + rowIdx];
        const x = baseX;
        const y = baseY + rowIdx;
        for (let bit = 0; bit < 8; bit++) {
          const bitValue = 7 - bit;
          if (byte & 1 << bitValue) {
            ctx.fillRect(x + bit, y, 1, 1);
          }
        }
      }
    }
  }, [debugFont, rawFontData]);
  if (error)
    return /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          ...rootStyle,
          padding: "16px",
          color: "#FF5555",
          background: "#000",
          fontFamily: "monospace"
        },
        onDragEnter,
        onDragOver,
        onDragLeave,
        onDrop,
        children: error
      }
    );
  if (!screen)
    return /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          ...rootStyle,
          padding: "16px",
          color: "#AAA",
          background: "#000",
          fontFamily: "monospace"
        },
        onDragEnter,
        onDragOver,
        onDragLeave,
        onDrop,
        children: "Loading\u2026"
      }
    );
  return /* @__PURE__ */ jsxs("div", { children: [
    debugPerformance && /* @__PURE__ */ jsxs(
      "div",
      {
        style: {
          position: "absolute",
          top: 0,
          right: 0,
          background: "rgba(0, 0, 0, 0.8)",
          color: "#0f0",
          padding: "8px 12px",
          fontFamily: "monospace",
          fontSize: "11px",
          border: "1px solid #0f0",
          zIndex: 1e3,
          lineHeight: "1.4"
        },
        children: [
          /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx("strong", { children: "Performance Metrics" }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            "FPS: ",
            perfMetrics.fps
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            "Render: ",
            perfMetrics.renderTimeMs,
            "ms"
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            "Parse: ",
            perfMetrics.parseTimeMs,
            "ms"
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            "Cells: ",
            perfMetrics.cellsUpdated,
            "/",
            perfMetrics.totalCells,
            " (",
            perfMetrics.totalCells > 0 ? Math.round(perfMetrics.cellsUpdated / perfMetrics.totalCells * 100) : 0,
            "%)"
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            "Bytes: ",
            currentByteIndex
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            "Speed: ",
            perfMetrics.bytesPerSecond,
            " B/s"
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            "Mode: ",
            animateBy
          ] }),
          animateBy === "bytes" ? /* @__PURE__ */ jsxs("div", { children: [
            "BPF: ",
            bytesPerFrame
          ] }) : /* @__PURE__ */ jsxs("div", { children: [
            "LPF: ",
            linesPerFrame
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            "Playing: ",
            isPlaying ? "Yes" : "No"
          ] })
        ]
      }
    ),
    debugFont && rawFontData && /* @__PURE__ */ jsxs("div", { style: { marginBottom: 16 }, children: [
      /* @__PURE__ */ jsxs("h3", { style: { color: "#AAA", marginBottom: 8 }, children: [
        "Font Debug - Raw Bitmap Data (256 glyphs, 16x16 grid, ",
        rawFontData.length,
        " bytes)"
      ] }),
      /* @__PURE__ */ jsx(
        "canvas",
        {
          ref: debugFontCanvasRef,
          style: { border: "1px solid #555", display: "block", background: "#000" }
        }
      )
    ] }),
    showControls && animated && /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }, children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: handlePlayPause,
          style: {
            padding: "6px 12px",
            background: "#333",
            color: "#AAA",
            border: "1px solid #555",
            cursor: "pointer",
            fontSize: "14px",
            fontFamily: "monospace"
          },
          onMouseEnter: (e) => e.currentTarget.style.background = "#444",
          onMouseLeave: (e) => e.currentTarget.style.background = "#333",
          children: isPlaying ? "\u23F8 Pause" : "\u25B6 Play"
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: handleRestart,
          style: {
            padding: "6px 12px",
            background: "#333",
            color: "#AAA",
            border: "1px solid #555",
            cursor: "pointer",
            fontSize: "14px",
            fontFamily: "monospace"
          },
          onMouseEnter: (e) => e.currentTarget.style.background = "#444",
          onMouseLeave: (e) => e.currentTarget.style.background = "#333",
          children: "\u23EE Restart"
        }
      )
    ] }),
    /* @__PURE__ */ jsx(
      "canvas",
      {
        ref: canvasRef,
        style: rootStyle,
        "aria-label": `ANSI Art Canvas${fileName ? ` - ${fileName}` : ""}`,
        onDragEnter,
        onDragOver,
        onDragLeave,
        onDrop
      }
    )
  ] });
}

// src/AnsiVirtualDisplay.tsx
import { useEffect as useEffect2, useMemo as useMemo2, useRef as useRef2, useState as useState2 } from "react";

// src/AnsiVirtualDisplayEngine.ts
var DOS_COLORS2 = {
  0: "#000000",
  1: "#0000AA",
  2: "#00AA00",
  3: "#00AAAA",
  4: "#AA0000",
  5: "#AA00AA",
  6: "#AA5500",
  7: "#AAAAAA",
  8: "#555555",
  9: "#5555FF",
  10: "#55FF55",
  11: "#55FFFF",
  12: "#FF5555",
  13: "#FF55FF",
  14: "#FFFF55",
  15: "#FFFFFF"
};
function colorToCss2(color, defaultColor = "#AAAAAA") {
  if (typeof color === "string") {
    return color;
  }
  return DOS_COLORS2[color] ?? defaultColor;
}
function compressLine(cells) {
  if (cells.length === 0) return [];
  const runs = [];
  let current = null;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (!current) {
      current = { text: cell.ch, fg: cell.fg, bg: cell.bg, bold: cell.bold };
      continue;
    }
    if (cell.fg === current.fg && cell.bg === current.bg && cell.bold === current.bold) {
      current.text += cell.ch;
    } else {
      runs.push(current);
      current = { text: cell.ch, fg: cell.fg, bg: cell.bg, bold: cell.bold };
    }
  }
  if (current) runs.push(current);
  return runs;
}
var AnsiVirtualDisplayEngine = class {
  // Extra rows to render above/below for smooth scrolling
  constructor(canvas, config) {
    this.bitmapFont = null;
    this.currentFrame = 0;
    this.isPlaying = true;
    this.screen = null;
    this.animationFrameId = null;
    this.lastFrameTime = 0;
    this.showPerformanceOverlay = false;
    this.renderTime = 0;
    this.drawTime = 0;
    this.previousDrawTime = 0;
    this.fpsHistory = [];
    this.actualFps = 0;
    this.targetFps = 0;
    this.offscreenCanvas = null;
    this.offscreenCtx = null;
    this.lastRenderedViewY = -1;
    this.bufferRows = 2;
    this._animate = () => {
      if (!this.isPlaying) {
        this.animationFrameId = null;
        return;
      }
      const frameInterval = 1e3 / this.config.fps;
      const currentTime = performance.now();
      const elapsed = currentTime - this.lastFrameTime;
      if (elapsed >= frameInterval) {
        this.fpsHistory.push(elapsed);
        if (this.fpsHistory.length > 30) {
          this.fpsHistory.shift();
        }
        const avgInterval = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
        this.actualFps = 1e3 / avgInterval;
        this.targetFps = this.config.fps;
        this.lastFrameTime = currentTime;
        this.currentFrame++;
        this._generateAndRender();
      }
      this.animationFrameId = requestAnimationFrame(this._animate);
    };
    this.canvas = canvas;
    this.config = { ...config };
    this.showPerformanceOverlay = config.showPerformanceOverlay ?? false;
    this.targetFps = config.fps;
    this._setupCanvas();
    if (this.isPlaying) {
      this._startAnimation();
    }
    this._generateAndRender();
  }
  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this._startAnimation();
  }
  pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this._stopAnimation();
  }
  restart() {
    this.currentFrame = 0;
    this.isPlaying = true;
    this._generateAndRender();
    if (this.isPlaying) {
      this._startAnimation();
    }
  }
  setBitmapFont(font) {
    this.bitmapFont = font;
    this._setupCanvas();
    this._render();
  }
  updateConfig(config) {
    const needsCanvasResize = config.columns !== void 0 || config.rows !== void 0 || config.cellWidthPx !== void 0 || config.cellHeightPx !== void 0;
    const overlayToggled = config.showPerformanceOverlay !== void 0 && config.showPerformanceOverlay !== this.showPerformanceOverlay;
    this.config = { ...this.config, ...config };
    if (config.showPerformanceOverlay !== void 0) {
      this.showPerformanceOverlay = config.showPerformanceOverlay;
    }
    if (config.fps !== void 0) {
      this.targetFps = config.fps;
    }
    if (needsCanvasResize) {
      this._setupCanvas();
    }
    if (config.columns !== void 0 || config.rows !== void 0 || config.frameGenerator !== void 0 || overlayToggled) {
      this._generateAndRender();
    } else {
      this._render();
    }
  }
  getPlayingState() {
    return this.isPlaying;
  }
  getCurrentFrame() {
    return this.currentFrame;
  }
  enablePerformanceOverlay(enabled) {
    this.showPerformanceOverlay = enabled;
    this._generateAndRender();
  }
  destroy() {
    this._stopAnimation();
  }
  _startAnimation() {
    if (this.animationFrameId !== null) return;
    this.lastFrameTime = performance.now();
    this._animate();
  }
  _stopAnimation() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  _generateAndRender() {
    const renderStart = performance.now();
    const generator = this.config.frameGenerator;
    const viewY = this.config.viewY ?? 0;
    const cellViewY = Math.floor(viewY);
    const bufferedRows = this.config.rows + this.bufferRows * 2;
    const bufferedViewY = Math.max(0, cellViewY - this.bufferRows);
    if ("generator" in generator && "converter" in generator) {
      const pixelGen = generator;
      const frameData = pixelGen.generator(this.currentFrame, this.config.columns, bufferedRows);
      this.screen = pixelGen.converter(frameData, this.config.columns, bufferedRows);
    } else {
      const charGen = generator;
      this.screen = charGen(this.currentFrame, this.config.columns, bufferedRows);
    }
    this.lastRenderedViewY = cellViewY;
    this.renderTime = performance.now() - renderStart;
    if (this.showPerformanceOverlay && this.screen) {
      this._addPerformanceOverlay(this.screen);
    }
    this._render();
  }
  _setupCanvas() {
    if (!this.canvas) return;
    const charWidth = this.bitmapFont ? this.bitmapFont.width : this.config.cellWidthPx;
    const charHeight = this.bitmapFont ? this.bitmapFont.height : this.config.cellHeightPx;
    const screenCols = this.config.columns;
    const screenRows = this.config.rows;
    const cssWidth = screenCols * charWidth;
    const cssHeight = screenRows * charHeight;
    const dpr = typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1;
    this.canvas.width = Math.max(1, Math.floor(cssWidth * dpr));
    this.canvas.height = Math.max(1, Math.floor(cssHeight * dpr));
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
  }
  _render() {
    if (!this.screen) return;
    const drawStart = performance.now();
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const screenRows = this.screen.lines.length;
    const screenCols = this.screen.columns;
    const charWidth = this.bitmapFont ? this.bitmapFont.width : this.config.cellWidthPx;
    const charHeight = this.bitmapFont ? this.bitmapFont.height : this.config.cellHeightPx;
    const cssWidth = screenCols * charWidth;
    const cssHeight = screenRows * charHeight;
    const dpr = typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (this.bitmapFont) {
      const bufferedHeight = screenRows * charHeight;
      if (!this.offscreenCanvas || this.offscreenCanvas.width !== cssWidth || this.offscreenCanvas.height !== bufferedHeight) {
        this.offscreenCanvas = document.createElement("canvas");
        this.offscreenCanvas.width = cssWidth;
        this.offscreenCanvas.height = bufferedHeight;
        this.offscreenCtx = this.offscreenCanvas.getContext("2d", {
          willReadFrequently: false,
          alpha: false
        });
      }
      const offCtx = this.offscreenCtx;
      offCtx.fillStyle = this.config.background;
      offCtx.fillRect(0, 0, cssWidth, bufferedHeight);
      for (let r = 0; r < screenRows; r++) {
        const cells = this.screen.lines[r];
        if (!cells) continue;
        for (let c = 0; c < cells.length; c++) {
          const cell = cells[c];
          const x = c * charWidth;
          const y = r * charHeight;
          const fg = typeof cell.fg === "number" && cell.bold && cell.fg < 8 ? cell.fg + 8 : cell.fg;
          const fgColor = colorToCss2(fg, "#AAAAAA");
          const bgColor = colorToCss2(cell.bg, "#000000");
          const charCode = charToCp437Byte(cell.ch);
          renderGlyph(offCtx, this.bitmapFont, charCode, x, y, fgColor, bgColor);
        }
      }
      const pixelOffsetY = this.config.pixelOffsetY ?? 0;
      const bufferPixelOffset = this.bufferRows * charHeight + pixelOffsetY;
      const visibleHeight = this.config.rows * charHeight;
      ctx.fillStyle = this.config.background;
      ctx.fillRect(0, 0, cssWidth, visibleHeight);
      ctx.drawImage(
        this.offscreenCanvas,
        0,
        bufferPixelOffset,
        // source Y with pixel offset
        cssWidth,
        visibleHeight,
        // source height
        0,
        0,
        // destination
        cssWidth,
        visibleHeight
        // destination size
      );
    } else {
      ctx.fillStyle = this.config.background;
      ctx.fillRect(0, 0, cssWidth, cssHeight);
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      const fontStack = this.config.fontFamily ?? "'Flexi_IBM_VGA_True_437', 'dos437', 'PerfectDOSVGA437Win', 'PerfectDOSVGA437', 'IBM VGA 8x16', 'Cascadia Mono', 'Menlo', monospace";
      ctx.font = `${this.config.cellHeightPx}px ${fontStack}`;
      for (let r = 0; r < screenRows; r++) {
        const runs = compressLine(this.screen.lines[r]);
        let x = 0;
        for (const run of runs) {
          const w = run.text.length * this.config.cellWidthPx;
          const y = r * this.config.cellHeightPx;
          ctx.fillStyle = colorToCss2(run.bg, "#000000");
          ctx.fillRect(x, y, w, this.config.cellHeightPx);
          const fg = typeof run.fg === "number" && run.bold && run.fg < 8 ? run.fg + 8 : run.fg;
          ctx.fillStyle = colorToCss2(fg, "#AAAAAA");
          for (let i = 0; i < run.text.length; i++) {
            ctx.fillText(run.text[i], x + i * this.config.cellWidthPx, y);
          }
          x += w;
        }
      }
    }
    this.drawTime = performance.now() - drawStart;
    this.previousDrawTime = this.drawTime;
  }
  _addPerformanceOverlay(screen) {
    const screenRows = screen.lines.length;
    const screenCols = screen.columns;
    const lines = [
      `FPS: ${this.actualFps.toFixed(1)} / ${this.targetFps}`,
      `Render: ${this.renderTime.toFixed(2)}ms`,
      `Draw: ${this.previousDrawTime.toFixed(2)}ms`,
      `World: ${this.config.virtualColumns ?? screenCols}x${this.config.virtualRows ?? screenRows}`,
      `View: ${screenCols}x${screenRows} @ (${this.config.viewX ?? 0},${this.config.viewY ?? 0})`
    ];
    const maxLineLength = Math.max(...lines.map((l) => l.length));
    const overlayRows = lines.length + 2;
    const overlayCols = maxLineLength + 2;
    const visibleRows = this.config.rows;
    const visibleStartRow = this.bufferRows;
    const visibleEndRow = visibleStartRow + visibleRows;
    if (visibleRows < overlayRows || screenCols < overlayCols) {
      return;
    }
    const startRow = visibleEndRow - overlayRows;
    const startCol = screenCols - overlayCols;
    for (let r = 0; r < overlayRows; r++) {
      const rowIndex = startRow + r;
      if (!screen.lines[rowIndex]) {
        screen.lines[rowIndex] = [];
      }
      for (let c = 0; c < overlayCols; c++) {
        const colIndex = startCol + c;
        let ch;
        let fg;
        let bg;
        const isTopRow = r === 0;
        const isBottomRow = r === overlayRows - 1;
        const isLeftCol = c === 0;
        const isRightCol = c === overlayCols - 1;
        const isBorder = isTopRow || isBottomRow || isLeftCol || isRightCol;
        if (isBorder) {
          ch = "\u2588";
          fg = 0;
          bg = 0;
        } else {
          const lineIndex = r - 1;
          const charIndex = c - 1;
          const line = lines[lineIndex];
          ch = charIndex < line.length ? line[charIndex] : " ";
          fg = 15;
          bg = 0;
        }
        while (screen.lines[rowIndex].length <= colIndex) {
          screen.lines[rowIndex].push({ ch: " ", fg: 7, bg: 0, bold: false });
        }
        screen.lines[rowIndex][colIndex] = {
          ch,
          fg,
          bg,
          bold: false
        };
      }
    }
  }
};

// src/rgbToAnsi.ts
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
  const palette = [];
  if (size === 1) {
    return [[128, 128, 128]];
  }
  const cubeRoot = Math.cbrt(size);
  const steps = Math.ceil(cubeRoot);
  for (let i = 0; i < size; i++) {
    const r = Math.floor(i % steps * (255 / (steps - 1)));
    const g = Math.floor(Math.floor(i / steps) % steps * (255 / (steps - 1)));
    const b = Math.floor(Math.floor(i / (steps * steps)) * (255 / (steps - 1)));
    palette.push([r, g, b]);
  }
  if (size > 16) {
    const newPalette = [];
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
      newPalette.push([r, g, b]);
    }
    return newPalette;
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

// src/frameToAnsi.ts
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

// src/perlin.ts
var p = [
  151,
  160,
  137,
  91,
  90,
  15,
  131,
  13,
  201,
  95,
  96,
  53,
  194,
  233,
  7,
  225,
  140,
  36,
  103,
  30,
  69,
  142,
  8,
  99,
  37,
  240,
  21,
  10,
  23,
  190,
  6,
  148,
  247,
  120,
  234,
  75,
  0,
  26,
  197,
  62,
  94,
  252,
  219,
  203,
  117,
  35,
  11,
  32,
  57,
  177,
  33,
  88,
  237,
  149,
  56,
  87,
  174,
  20,
  125,
  136,
  171,
  168,
  68,
  175,
  74,
  165,
  71,
  134,
  139,
  48,
  27,
  166,
  77,
  146,
  158,
  231,
  83,
  111,
  229,
  122,
  60,
  211,
  133,
  230,
  220,
  105,
  92,
  41,
  55,
  46,
  245,
  40,
  244,
  102,
  143,
  54,
  65,
  25,
  63,
  161,
  1,
  216,
  80,
  73,
  209,
  76,
  132,
  187,
  208,
  89,
  18,
  169,
  200,
  196,
  135,
  130,
  116,
  188,
  159,
  86,
  164,
  100,
  109,
  198,
  173,
  186,
  3,
  64,
  52,
  217,
  226,
  250,
  124,
  123,
  5,
  202,
  38,
  147,
  118,
  126,
  255,
  82,
  85,
  212,
  207,
  206,
  59,
  227,
  47,
  16,
  58,
  17,
  182,
  189,
  28,
  42,
  223,
  183,
  170,
  213,
  119,
  248,
  152,
  2,
  44,
  154,
  163,
  70,
  221,
  153,
  101,
  155,
  167,
  43,
  172,
  9,
  129,
  22,
  39,
  253,
  19,
  98,
  108,
  110,
  79,
  113,
  224,
  232,
  178,
  185,
  112,
  104,
  218,
  246,
  97,
  228,
  251,
  34,
  242,
  193,
  238,
  210,
  144,
  12,
  191,
  179,
  162,
  241,
  81,
  51,
  145,
  235,
  249,
  14,
  239,
  107,
  49,
  192,
  214,
  31,
  181,
  199,
  106,
  157,
  184,
  84,
  204,
  176,
  115,
  121,
  50,
  45,
  127,
  4,
  150,
  254,
  138,
  236,
  205,
  93,
  222,
  114,
  67,
  29,
  24,
  72,
  243,
  141,
  128,
  195,
  78,
  66,
  215,
  61,
  156,
  180
];
var perm = [];
for (let i = 0; i < 512; i++) {
  perm[i] = p[i & 255];
}
var grad2 = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
];
var grad3 = [
  [1, 1, 0],
  [-1, 1, 0],
  [1, -1, 0],
  [-1, -1, 0],
  [1, 0, 1],
  [-1, 0, 1],
  [1, 0, -1],
  [-1, 0, -1],
  [0, 1, 1],
  [0, -1, 1],
  [0, 1, -1],
  [0, -1, -1],
  [1, 1, 0],
  [-1, 1, 0],
  [0, -1, 1],
  [0, -1, -1]
];
function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}
function lerp(a, b, t) {
  return a + t * (b - a);
}
function dot2d(gx, gy, x, y) {
  return gx * x + gy * y;
}
function dot3d(gx, gy, gz, x, y, z) {
  return gx * x + gy * y + gz * z;
}
function perlinNoise2D(x, y) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  const u = fade(x);
  const v = fade(y);
  const A = perm[X] + Y;
  const AA = perm[A];
  const AB = perm[A + 1];
  const B = perm[X + 1] + Y;
  const BA = perm[B];
  const BB = perm[B + 1];
  const gradAA = grad2[AA % grad2.length];
  const gradAB = grad2[AB % grad2.length];
  const gradBA = grad2[BA % grad2.length];
  const gradBB = grad2[BB % grad2.length];
  const n00 = dot2d(gradAA[0], gradAA[1], x, y);
  const n10 = dot2d(gradBA[0], gradBA[1], x - 1, y);
  const n01 = dot2d(gradAB[0], gradAB[1], x, y - 1);
  const n11 = dot2d(gradBB[0], gradBB[1], x - 1, y - 1);
  const n0 = lerp(n00, n10, u);
  const n1 = lerp(n01, n11, u);
  return lerp(n0, n1, v);
}
function perlinNoise3D(x, y, z) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  z -= Math.floor(z);
  const u = fade(x);
  const v = fade(y);
  const w = fade(z);
  const A = perm[X] + Y;
  const AA = perm[A] + Z;
  const AB = perm[A + 1] + Z;
  const B = perm[X + 1] + Y;
  const BA = perm[B] + Z;
  const BB = perm[B + 1] + Z;
  const grad000 = grad3[perm[AA] % grad3.length];
  const grad001 = grad3[perm[AA + 1] % grad3.length];
  const grad100 = grad3[perm[BA] % grad3.length];
  const grad101 = grad3[perm[BA + 1] % grad3.length];
  const grad010 = grad3[perm[AB] % grad3.length];
  const grad011 = grad3[perm[AB + 1] % grad3.length];
  const grad110 = grad3[perm[BB] % grad3.length];
  const grad111 = grad3[perm[BB + 1] % grad3.length];
  const n000 = dot3d(grad000[0], grad000[1], grad000[2], x, y, z);
  const n100 = dot3d(grad100[0], grad100[1], grad100[2], x - 1, y, z);
  const n010 = dot3d(grad010[0], grad010[1], grad010[2], x, y - 1, z);
  const n110 = dot3d(grad110[0], grad110[1], grad110[2], x - 1, y - 1, z);
  const n001 = dot3d(grad001[0], grad001[1], grad001[2], x, y, z - 1);
  const n101 = dot3d(grad101[0], grad101[1], grad101[2], x - 1, y, z - 1);
  const n011 = dot3d(grad011[0], grad011[1], grad011[2], x, y - 1, z - 1);
  const n111 = dot3d(grad111[0], grad111[1], grad111[2], x - 1, y - 1, z - 1);
  const n00 = lerp(n000, n100, u);
  const n10 = lerp(n010, n110, u);
  const n01 = lerp(n001, n101, u);
  const n11 = lerp(n011, n111, u);
  const n0 = lerp(n00, n10, v);
  const n1 = lerp(n01, n11, v);
  return lerp(n0, n1, w);
}
function perlinNoise(x, y, z) {
  if (z !== void 0) {
    return perlinNoise3D(x, y, z);
  }
  return perlinNoise2D(x, y);
}

// src/plasma.ts
function generatePlasmaFrame(frame, width, height) {
  const pixels = new Uint8Array(width * height * 3);
  const time = frame * 0.05;
  const octaves = [
    { scale: 0.02, intensity: 1 },
    { scale: 0.05, intensity: 0.5 },
    { scale: 0.1, intensity: 0.25 }
  ];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;
      const octaves2 = [
        { scale: 0.02, intensity: 1 },
        { scale: 0.05, intensity: 0.5 },
        { scale: 0.1, intensity: 0.25 }
      ];
      for (const octave of octaves2) {
        const nx = x * octave.scale;
        const ny = y * octave.scale;
        const nz = time * 0.1;
        const noise1 = perlinNoise3D(nx, ny, nz);
        const noise2 = perlinNoise3D(nx * 1.3 + 100, ny * 1.3 + 50, nz * 0.8);
        const noise3 = perlinNoise3D((x + y) * 0.03, (x - y) * 0.03, nz * 0.5);
        const combined = (noise1 + noise2 * 0.7 + noise3 * 0.5) / 2.2;
        value += combined * octave.intensity;
      }
      value = (value + 2) / 4;
      value = Math.max(0, Math.min(1, value));
      const r = Math.sin(value * Math.PI * 2 + 0) * 0.5 + 0.5;
      const g = Math.sin(value * Math.PI * 2 + 2 * Math.PI / 3) * 0.5 + 0.5;
      const b = Math.sin(value * Math.PI * 2 + 4 * Math.PI / 3) * 0.5 + 0.5;
      const noiseR = perlinNoise3D(x * 0.1, y * 0.1, time * 0.2) * 0.2;
      const noiseG = perlinNoise3D(x * 0.12 + 200, y * 0.08 + 100, time * 0.15) * 0.2;
      const noiseB = perlinNoise3D(x * 0.09 - 150, y * 0.11 - 50, time * 0.18) * 0.2;
      const finalR = Math.max(0, Math.min(1, r + noiseR));
      const finalG = Math.max(0, Math.min(1, g + noiseG));
      const finalB = Math.max(0, Math.min(1, b + noiseB));
      const index = (y * width + x) * 3;
      pixels[index] = Math.floor(finalR * 255);
      pixels[index + 1] = Math.floor(finalG * 255);
      pixels[index + 2] = Math.floor(finalB * 255);
    }
  }
  return {
    width,
    height,
    pixels
  };
}

// src/AnsiVirtualDisplay.tsx
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var defaultFrameGenerator = {
  generator: generatePlasmaFrame,
  converter: convertFrameDataToAnsi
};
function AnsiVirtualDisplay({
  columns = 80,
  rows = 25,
  cellWidthPx = 8,
  cellHeightPx = 16,
  frameGenerator = defaultFrameGenerator,
  fps = 30,
  fontFamily,
  background = "#000",
  bitmapFontUrl,
  showControls = false,
  showPerformanceOverlay = false,
  fillContainer = false,
  virtualColumns,
  virtualRows,
  viewX = 0,
  viewY = 0,
  pixelOffsetX = 0,
  pixelOffsetY = 0,
  onViewChange
}) {
  const canvasRef = useRef2(null);
  const engineRef = useRef2(null);
  const [bitmapFont, setBitmapFont] = useState2(null);
  const [isPlaying, setIsPlaying] = useState2(true);
  const effectiveFrameGenerator = useMemo2(() => {
    return frameGenerator;
  }, [frameGenerator]);
  useEffect2(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!engineRef.current) {
      engineRef.current = new AnsiVirtualDisplayEngine(canvas, {
        columns,
        rows,
        cellWidthPx,
        cellHeightPx,
        frameGenerator: effectiveFrameGenerator,
        fps,
        fontFamily,
        background,
        showPerformanceOverlay,
        virtualColumns,
        virtualRows,
        viewX,
        viewY,
        pixelOffsetX,
        pixelOffsetY
      });
    }
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);
  useEffect2(() => {
    if (!engineRef.current) return;
    engineRef.current.updateConfig({
      columns,
      rows,
      cellWidthPx,
      cellHeightPx,
      frameGenerator: effectiveFrameGenerator,
      fps,
      fontFamily,
      background,
      showPerformanceOverlay,
      virtualColumns,
      virtualRows,
      viewX,
      viewY,
      pixelOffsetX,
      pixelOffsetY
    });
  }, [
    columns,
    rows,
    cellWidthPx,
    cellHeightPx,
    effectiveFrameGenerator,
    fps,
    fontFamily,
    background,
    showPerformanceOverlay,
    virtualColumns,
    virtualRows,
    viewX,
    viewY,
    pixelOffsetX,
    pixelOffsetY
  ]);
  useEffect2(() => {
    if (!engineRef.current) return;
    engineRef.current.setBitmapFont(bitmapFont);
  }, [bitmapFont]);
  useEffect2(() => {
    if (!bitmapFontUrl) {
      setBitmapFont(null);
      return;
    }
    let cancelled = false;
    async function loadFont() {
      try {
        const fontData = await extractFontFromFON(bitmapFontUrl);
        if (fontData && fontData.length >= 4096) {
          const glyphs = [];
          for (let i = 0; i < 256; i++) {
            glyphs.push(fontData.slice(i * 16, (i + 1) * 16));
          }
          if (!cancelled) setBitmapFont({ width: 8, height: 16, glyphs, rawBitmapData: fontData });
        } else {
          const font = await loadRawBitmapFont(bitmapFontUrl, 8, 16);
          if (!cancelled) setBitmapFont(font);
        }
      } catch (e) {
        console.warn("Failed to load bitmap font:", e);
        if (!cancelled) setBitmapFont(null);
      }
    }
    loadFont();
    return () => {
      cancelled = true;
    };
  }, [bitmapFontUrl]);
  const handlePlayPause = () => {
    if (!engineRef.current) return;
    if (isPlaying) {
      engineRef.current.pause();
      setIsPlaying(false);
    } else {
      engineRef.current.play();
      setIsPlaying(true);
    }
  };
  const handleRestart = () => {
    if (!engineRef.current) return;
    engineRef.current.restart();
    setIsPlaying(true);
  };
  const baseRootStyle = useMemo2(() => {
    return {
      fontFamily: fontFamily ?? "'Flexi_IBM_VGA_True_437', 'dos437', 'PerfectDOSVGA437Win', 'PerfectDOSVGA437', 'IBM VGA 8x16', 'Cascadia Mono', 'Menlo', monospace",
      fontSize: "16px",
      lineHeight: "16px",
      letterSpacing: 0,
      whiteSpace: "pre",
      background: "#000",
      color: "#aaa",
      margin: 0,
      padding: 0,
      display: "block",
      WebkitFontSmoothing: "none",
      MozOsxFontSmoothing: "grayscale",
      width: fillContainer ? "100%" : "fit-content",
      fontVariantLigatures: "none",
      fontFeatureSettings: "'liga' 0, 'clig' 0",
      textRendering: "geometricPrecision"
    };
  }, [fontFamily, fillContainer]);
  const rootStyle = useMemo2(() => {
    return {
      ...baseRootStyle,
      background
    };
  }, [baseRootStyle, background]);
  return /* @__PURE__ */ jsxs2("div", { children: [
    showControls && /* @__PURE__ */ jsxs2(
      "div",
      {
        style: {
          display: "flex",
          gap: "8px",
          marginBottom: "8px",
          alignItems: "center"
        },
        children: [
          /* @__PURE__ */ jsx2(
            "button",
            {
              onClick: handlePlayPause,
              style: {
                padding: "6px 12px",
                background: "#333",
                color: "#AAA",
                border: "1px solid #555",
                cursor: "pointer",
                fontSize: "14px",
                fontFamily: "monospace"
              },
              onMouseEnter: (e) => {
                e.currentTarget.style.background = "#444";
              },
              onMouseLeave: (e) => {
                e.currentTarget.style.background = "#333";
              },
              children: isPlaying ? "\u23F8 Pause" : "\u25B6 Play"
            }
          ),
          /* @__PURE__ */ jsx2(
            "button",
            {
              onClick: handleRestart,
              style: {
                padding: "6px 12px",
                background: "#333",
                color: "#AAA",
                border: "1px solid #555",
                cursor: "pointer",
                fontSize: "14px",
                fontFamily: "monospace"
              },
              onMouseEnter: (e) => {
                e.currentTarget.style.background = "#444";
              },
              onMouseLeave: (e) => {
                e.currentTarget.style.background = "#333";
              },
              children: "\u23EE Restart"
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsx2("canvas", { ref: canvasRef, style: rootStyle, "aria-label": "ANSI Virtual Display" })
  ] });
}

// src/asciiPerlinPlasma.tsx
import React3 from "react";
import { jsx as jsx3 } from "react/jsx-runtime";
var DEFAULT_CHAR_WIDTH = 10;
var DEFAULT_CHAR_HEIGHT = 14;
var DEFAULT_CHARS = [
  "@",
  "0",
  "#",
  "2",
  "$",
  "*",
  "+",
  ":",
  ",",
  ".",
  " ",
  " ",
  " ",
  " ",
  " ",
  " "
];
var DEFAULT_TIME_SCALE = 0.4;
var DEFAULT_FPS_CAP = 24;
var DEFAULT_COLOR = "rgba(138, 230, 230, 1)";
var DEFAULT_OCTAVES = [
  {
    scale: 0.02,
    amplitude: 1,
    timeScaleX: -1,
    // Move right
    timeScaleY: -0.5
    // Move down
  },
  {
    scale: 0.04,
    amplitude: 1,
    timeScaleX: -0.5,
    // Move right
    timeScaleY: -0.3
    // Move down
  }
];
var FADE_TABLE = new Float32Array(512);
for (let i = 0; i < 512; i++) {
  const t = i / 511;
  FADE_TABLE[i] = t * t * t * (t * (t * 6 - 15) + 10);
}
function fastFade(t) {
  return FADE_TABLE[t * 511 | 0];
}
var GRAD_VECTORS = new Float32Array([
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
  -1,
  0.866,
  0.5,
  -0.866,
  0.5,
  0.866,
  -0.5,
  -0.866,
  -0.5
]);
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
function fastGrad(hash3, x, y) {
  const h = (hash3 & 7) << 1;
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
var AsciiPerlinPlasma = (props) => {
  const {
    charWidth = DEFAULT_CHAR_WIDTH,
    charHeight = DEFAULT_CHAR_HEIGHT,
    chars = DEFAULT_CHARS,
    timeScale = DEFAULT_TIME_SCALE,
    fpsCap = DEFAULT_FPS_CAP,
    color = DEFAULT_COLOR,
    octaves = DEFAULT_OCTAVES,
    className,
    yOffset = 0,
    virtualHeight
  } = props;
  const charCount = chars.length;
  const fpsInterval = 1e3 / fpsCap;
  const canvasRef = React3.useRef(null);
  const dims = React3.useRef({ width: 0, height: 0 });
  const rafId = React3.useRef();
  const lastFrameTime = React3.useRef(0);
  const yOffsetRef = React3.useRef(yOffset);
  const virtualHeightRef = React3.useRef(virtualHeight);
  const perm2 = React3.useRef(new Uint8Array(256));
  const rows = React3.useRef([]);
  const rowBuffer = React3.useRef([]);
  const charLookup = React3.useRef([]);
  const octaveConfigs = React3.useRef([]);
  const ctx = React3.useRef(null);
  function noise2D2(x, y) {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    x -= X;
    y -= Y;
    const u = fastFade(x);
    const v = fastFade(y);
    const seed = perm2.current[0];
    const A = Math.abs(hash(X, Y, seed)) % 256;
    const B = Math.abs(hash(X + 1, Y, seed)) % 256;
    const C = Math.abs(hash(X, Y + 1, seed)) % 256;
    const D = Math.abs(hash(X + 1, Y + 1, seed)) % 256;
    const g00 = fastGrad(perm2.current[A], x, y);
    const g10 = fastGrad(perm2.current[B], x - 1, y);
    const g01 = fastGrad(perm2.current[C], x, y - 1);
    const g11 = fastGrad(perm2.current[D], x - 1, y - 1);
    const a = g00 + u * (g10 - g00);
    const b = g01 + u * (g11 - g01);
    return a + v * (b - a);
  }
  function drawPlasma(time = 0) {
    const now = performance.now();
    if (now - lastFrameTime.current < fpsInterval) {
      rafId.current = requestAnimationFrame(() => drawPlasma(time));
      return;
    }
    lastFrameTime.current = now;
    const { width, height } = dims.current;
    if (time % 60 === 0) {
      console.log("[AsciiPerlinPlasma] Drawing frame:", {
        time,
        yOffset: yOffsetRef.current,
        virtualHeight: virtualHeightRef.current,
        yOffsetInChars: yOffsetRef.current / charHeight,
        canvasSize: { width, height }
      });
    }
    if (rows.current.length !== height) {
      rows.current.length = height;
    }
    if (rowBuffer.current.length !== width) {
      rowBuffer.current.length = width;
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let value = 0;
        const currentCharHeight = charHeight;
        const yOffsetInChars = yOffsetRef.current / currentCharHeight;
        const yPos = y + yOffsetInChars;
        for (const octave of octaveConfigs.current) {
          value += noise2D2(
            (x + time * octave.timeScaleX) * octave.scaleX,
            (yPos + time * octave.timeScaleY) * octave.scaleY
          ) * octave.amplitude;
        }
        const clampedValue = value < -1 ? -1 : value > 1 ? 1 : value;
        const charIndex = (clampedValue + 1) * 127.5 | 0;
        rowBuffer.current[x] = charLookup.current[charIndex];
      }
      rows.current[y] = rowBuffer.current.join("");
    }
    if (ctx.current) {
      const canvas = ctx.current.canvas;
      ctx.current.fillStyle = color;
      ctx.current.clearRect(0, 0, canvas.width, canvas.height);
      for (let y = 0; y < height; y++) {
        const row = rows.current[y];
        for (let x = 0; x < width; x++) {
          const char = row[x];
          ctx.current.fillText(char, x * charWidth, (y + 1) * charHeight);
        }
      }
    }
    rafId.current = requestAnimationFrame(() => drawPlasma(time + timeScale));
  }
  function handleResize() {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const newDims = {
      width: Math.ceil(rect.width / charWidth),
      height: Math.ceil(rect.height / charHeight)
    };
    if (newDims.width !== dims.current.width || newDims.height !== dims.current.height) {
      dims.current = newDims;
      const canvas = canvasRef.current;
      const devicePixelRatio = window.devicePixelRatio || 1;
      canvas.width = newDims.width * charWidth * devicePixelRatio;
      canvas.height = newDims.height * charHeight * devicePixelRatio;
      canvas.style.width = `${newDims.width * charWidth}px`;
      canvas.style.height = `${newDims.height * charHeight}px`;
      if (ctx.current) {
        ctx.current.scale(devicePixelRatio, devicePixelRatio);
        ctx.current.font = `${charHeight}px monospace`;
        ctx.current.textBaseline = "bottom";
        ctx.current.fillStyle = color;
      }
    }
  }
  React3.useEffect(() => {
    console.log("[AsciiPerlinPlasma] Updating refs:", { yOffset, virtualHeight });
    yOffsetRef.current = yOffset;
    virtualHeightRef.current = virtualHeight;
  }, [yOffset, virtualHeight]);
  React3.useEffect(() => {
    charLookup.current = new Array(256);
    for (let i = 0; i < 256; i++) {
      const normalizedValue = i / 255;
      charLookup.current[i] = chars[Math.floor(normalizedValue * (charCount - 1e-3))];
    }
    octaveConfigs.current = octaves.map((octave) => ({
      scaleX: octave.scale,
      scaleY: octave.scale,
      timeScaleX: octave.timeScaleX,
      timeScaleY: octave.timeScaleY,
      amplitude: octave.amplitude
    }));
    if (canvasRef.current && !ctx.current) {
      ctx.current = canvasRef.current.getContext("2d");
      if (ctx.current) {
        ctx.current.font = `${charHeight}px monospace`;
        ctx.current.textBaseline = "bottom";
        ctx.current.fillStyle = color;
      }
    }
    for (let i = 0; i < 256; i++) perm2.current[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [perm2.current[i], perm2.current[j]] = [perm2.current[j], perm2.current[i]];
    }
    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    if (canvasRef.current) {
      resizeObserver.observe(canvasRef.current);
    }
    drawPlasma();
    return () => {
      resizeObserver.disconnect();
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [charWidth, charHeight, chars, timeScale, fpsCap, color, octaves, yOffset]);
  return /* @__PURE__ */ jsx3(
    "canvas",
    {
      ref: canvasRef,
      className,
      style: { display: "block", width: "100%", height: "100%" }
    }
  );
};

// src/PlasmaBackgroundLayout.tsx
import { useCallback as useCallback2, useEffect as useEffect3, useMemo as useMemo3, useRef as useRef3, useState as useState3 } from "react";

// src/generators/asciiPerlinPlasmaGenerator.ts
var DEFAULT_CHARS2 = [
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
var DEFAULT_OCTAVES2 = [
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
var DEFAULT_TIME_SCALE2 = 0.9;
var DEFAULT_FG_COLOR = "#55FFFF";
var DEFAULT_BG_COLOR = "#000000";
var FADE_TABLE2 = new Float32Array(512);
for (let i = 0; i < 512; i++) {
  const t = i / 511;
  FADE_TABLE2[i] = t * t * t * (t * (t * 6 - 15) + 10);
}
function fastFade2(t) {
  return FADE_TABLE2[t * 511 | 0];
}
var GRAD_TABLE2 = new Float32Array([
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
function fastGrad2(hash3, x, y) {
  const h = (hash3 & 7) << 1;
  return GRAD_TABLE2[h] * x + GRAD_TABLE2[h | 1] * y;
}
function hash2(x, y, seed) {
  let h = x * 73856093 ^ y * 19349663 ^ seed;
  h = h >>> 16 ^ h;
  h *= 2146121005;
  h ^= h >>> 15;
  h *= 2221713035;
  return h ^ h >>> 16;
}
function generatePermutation(seed) {
  const perm2 = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm2[i] = i;
  let randomSeed = seed;
  function random() {
    randomSeed = (randomSeed * 9301 + 49297) % 233280;
    return randomSeed / 233280;
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [perm2[i], perm2[j]] = [perm2[j], perm2[i]];
  }
  return perm2;
}
function noise2D(x, y, perm2) {
  const X = Math.floor(x);
  const Y = Math.floor(y);
  x -= X;
  y -= Y;
  const u = fastFade2(x);
  const v = fastFade2(y);
  const seed = perm2[0];
  const A = Math.abs(hash2(X, Y, seed)) % 256;
  const B = Math.abs(hash2(X + 1, Y, seed)) % 256;
  const C = Math.abs(hash2(X, Y + 1, seed)) % 256;
  const D = Math.abs(hash2(X + 1, Y + 1, seed)) % 256;
  const g00 = fastGrad2(perm2[A], x, y);
  const g10 = fastGrad2(perm2[B], x - 1, y);
  const g01 = fastGrad2(perm2[C], x, y - 1);
  const g11 = fastGrad2(perm2[D], x - 1, y - 1);
  const a = g00 + u * (g10 - g00);
  const b = g01 + u * (g11 - g01);
  return a + v * (b - a);
}
function generateAsciiPerlinPlasmaFrame(frame, columns, rows, options = {}) {
  const {
    chars = DEFAULT_CHARS2,
    timeScale = DEFAULT_TIME_SCALE2,
    fgColor = DEFAULT_FG_COLOR,
    bgColor = DEFAULT_BG_COLOR,
    octaves = DEFAULT_OCTAVES2,
    seed = 12345
    // Fixed default seed for consistent patterns
  } = options;
  const charCount = chars.length;
  const time = frame * timeScale;
  const perm2 = generatePermutation(seed);
  const charLookup = new Array(256);
  for (let i = 0; i < 256; i++) {
    const normalizedValue = i / 255;
    charLookup[i] = chars[Math.floor(normalizedValue * (charCount - 1e-3))];
  }
  const octaveConfigs = octaves.map((octave) => ({
    scaleX: octave.scale,
    scaleY: octave.scale,
    timeScaleX: octave.timeScaleX,
    timeScaleY: octave.timeScaleY,
    amplitude: octave.amplitude
  }));
  const lines = [];
  for (let y = 0; y < rows; y++) {
    const line = [];
    for (let x = 0; x < columns; x++) {
      let value = 0;
      for (const octave of octaveConfigs) {
        value += noise2D(
          (x + time * octave.timeScaleX) * octave.scaleX,
          (y + time * octave.timeScaleY) * octave.scaleY,
          perm2
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
    chars = DEFAULT_CHARS2,
    timeScale = DEFAULT_TIME_SCALE2,
    fgColor = DEFAULT_FG_COLOR,
    bgColor = DEFAULT_BG_COLOR,
    octaves = DEFAULT_OCTAVES2,
    seed = 12345
  } = options;
  const charCount = chars.length;
  const time = frame * timeScale;
  const perm2 = generatePermutation(seed);
  const charLookup = new Array(256);
  for (let i = 0; i < 256; i++) {
    const normalizedValue = i / 255;
    charLookup[i] = chars[Math.floor(normalizedValue * (charCount - 1e-3))];
  }
  const octaveConfigs = octaves.map((octave) => ({
    scaleX: octave.scale,
    scaleY: octave.scale,
    timeScaleX: octave.timeScaleX,
    timeScaleY: octave.timeScaleY,
    amplitude: octave.amplitude
  }));
  return (x, y) => {
    let value = 0;
    for (const octave of octaveConfigs) {
      value += noise2D(
        (x + time * octave.timeScaleX) * octave.scaleX,
        (y + time * octave.timeScaleY) * octave.scaleY,
        perm2
      ) * octave.amplitude;
    }
    const clampedValue = value < -1 ? -1 : value > 1 ? 1 : value;
    const charIndex = (clampedValue + 1) * 127.5 | 0;
    const ch = charLookup[charIndex];
    return { ch, fg: fgColor, bg: bgColor, bold: false };
  };
}

// src/PlasmaBackgroundLayout.tsx
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
function PlasmaBackgroundLayout({
  children,
  mode = "fixed",
  contentClassName,
  contentStyle,
  plasmaClassName,
  virtualWidthPx,
  virtualHeightPx,
  fgColor,
  bgColor,
  showPerformanceOverlay = false,
  fps = 30,
  bitmapFontUrl = "/ansi/fonts/Bm437_IBM_VGA_8x16.FON",
  ...plasmaProps
}) {
  const containerRef = useRef3(null);
  const scrollableRef = useRef3(null);
  const [viewportBounds, setViewportBounds] = useState3({ top: 0, height: 0 });
  const [viewportSize, setViewportSize] = useState3({ width: 0, height: 0 });
  const [containerHeight, setContainerHeight] = useState3(0);
  const [scrollTop, setScrollTop] = useState3(0);
  const [maxScrollTop, setMaxScrollTop] = useState3(0);
  const [isMounted, setIsMounted] = useState3(false);
  useEffect3(() => {
    if (typeof window === "undefined") return;
    const updateViewportSize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    updateViewportSize();
    const initialHeight = window.innerHeight;
    setViewportBounds({ top: 0, height: initialHeight });
    setContainerHeight(initialHeight);
    setIsMounted(true);
    window.addEventListener("resize", updateViewportSize);
    return () => window.removeEventListener("resize", updateViewportSize);
  }, []);
  useEffect3(() => {
    if (mode !== "scrollable" || typeof window === "undefined" || !isMounted) {
      return;
    }
    const updateBounds = () => {
      if (!containerRef.current || !scrollableRef.current || typeof window === "undefined") {
        return;
      }
      const containerRect = containerRef.current.getBoundingClientRect();
      const scrollableEl2 = scrollableRef.current;
      const scrollHeight = scrollableEl2.scrollHeight;
      const clientHeight = scrollableEl2.clientHeight;
      const currentScrollTop = scrollableEl2.scrollTop;
      setContainerHeight(scrollHeight);
      setScrollTop(currentScrollTop);
      const maxScroll = Math.max(0, scrollHeight - clientHeight);
      setMaxScrollTop(maxScroll);
      const containerRect2 = containerRef.current.getBoundingClientRect();
      const visibleTop = Math.max(0, -containerRect2.top);
      const visibleBottom = Math.min(containerRect2.height, window.innerHeight - containerRect2.top);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      setViewportBounds({
        top: Math.max(0, containerRect2.top),
        height: Math.max(0, Math.min(visibleHeight, window.innerHeight))
      });
    };
    updateBounds();
    const handleScroll = () => {
      const scrollableEl2 = scrollableRef.current;
      if (!scrollableEl2) {
        return;
      }
      const currentScrollTop = scrollableEl2.scrollTop;
      setScrollTop(currentScrollTop);
      requestAnimationFrame(() => {
        if (!containerRef.current || !scrollableRef.current || typeof window === "undefined") return;
        const containerRect = containerRef.current.getBoundingClientRect();
        const visibleTop = Math.max(0, -containerRect.top);
        const visibleBottom = Math.min(containerRect.height, window.innerHeight - containerRect.top);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        setViewportBounds({
          top: Math.max(0, containerRect.top),
          height: Math.max(0, Math.min(visibleHeight, window.innerHeight))
        });
      });
    };
    const resizeObserver = new ResizeObserver(() => {
      updateBounds();
    });
    const scrollableEl = scrollableRef.current;
    const containerEl = containerRef.current;
    if (containerEl) {
      resizeObserver.observe(containerEl);
    }
    if (scrollableEl) {
      resizeObserver.observe(scrollableEl);
      scrollableEl.addEventListener("scroll", handleScroll, { passive: true });
    }
    if (typeof window !== "undefined") {
      window.addEventListener("resize", updateBounds, { passive: true });
    }
    return () => {
      resizeObserver.disconnect();
      if (scrollableEl) {
        scrollableEl.removeEventListener("scroll", handleScroll);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", updateBounds);
      }
    };
  }, [mode, isMounted]);
  const memoizedPlasmaProps = useMemo3(
    () => plasmaProps,
    [
      plasmaProps.charWidth,
      plasmaProps.charHeight,
      plasmaProps.chars,
      plasmaProps.timeScale,
      plasmaProps.fpsCap,
      plasmaProps.color,
      plasmaProps.octaves,
      plasmaProps.yOffset,
      plasmaProps.virtualHeight
    ]
  );
  const mergedOptions = useMemo3(() => {
    const { color, ...restPlasmaProps } = memoizedPlasmaProps;
    const finalFgColor = fgColor || color;
    const options = {
      ...restPlasmaProps,
      ...finalFgColor && { fgColor: finalFgColor },
      ...bgColor && { bgColor }
    };
    return options;
  }, [memoizedPlasmaProps, fgColor, bgColor]);
  const fixedFrameGenerator = useCallback2(
    (frame, columns, rows) => {
      return generateAsciiPerlinPlasmaFrame(frame, columns, rows, mergedOptions);
    },
    [mergedOptions]
  );
  const scrollableFrameGenerator = useCallback2(
    (frame, reqColumns, reqRows) => {
      const sampler = createAsciiPerlinPlasmaSampler(frame, mergedOptions);
      const lines = [];
      for (let y = 0; y < reqRows; y++) {
        const line = [];
        for (let x = 0; x < reqColumns; x++) {
          const cell = sampler(x, y);
          line.push(cell);
        }
        lines.push(line);
      }
      return { lines, columns: reqColumns };
    },
    [mergedOptions]
  );
  if (mode === "fixed") {
    return /* @__PURE__ */ jsxs3(
      "div",
      {
        ref: containerRef,
        style: {
          position: "relative",
          minHeight: "100vh",
          width: "100%"
        },
        children: [
          /* @__PURE__ */ jsx4(
            "div",
            {
              style: {
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 0,
                pointerEvents: "none"
              },
              children: (() => {
                const columns = Math.max(1, Math.ceil(viewportSize.width / 8));
                const rows = Math.max(1, Math.ceil(viewportSize.height / 16));
                const actualCellWidth = viewportSize.width / columns;
                const actualCellHeight = viewportSize.height / rows;
                return /* @__PURE__ */ jsx4(
                  AnsiVirtualDisplay,
                  {
                    columns,
                    rows,
                    cellWidthPx: actualCellWidth,
                    cellHeightPx: actualCellHeight,
                    fillContainer: true,
                    bitmapFontUrl,
                    frameGenerator: fixedFrameGenerator,
                    fps,
                    background: bgColor || "#000",
                    showPerformanceOverlay
                  }
                );
              })()
            }
          ),
          /* @__PURE__ */ jsx4(
            "div",
            {
              ref: scrollableRef,
              className: contentClassName,
              style: {
                position: "relative",
                zIndex: 1,
                minHeight: "100vh",
                overflowY: "auto",
                color: "inherit",
                ...contentStyle
              },
              children
            }
          )
        ]
      }
    );
  }
  if (!isMounted) {
    return /* @__PURE__ */ jsx4(
      "div",
      {
        ref: containerRef,
        style: {
          position: "relative",
          width: "100%",
          minHeight: "100vh"
        },
        children: /* @__PURE__ */ jsx4(
          "div",
          {
            ref: scrollableRef,
            className: contentClassName,
            style: {
              position: "relative",
              zIndex: 1,
              minHeight: "100vh",
              overflowY: "auto",
              ...contentStyle
            },
            children
          }
        )
      }
    );
  }
  const cellHeightPx = 16;
  const cellWidthPx = 8;
  const visibleColumns = Math.max(1, Math.ceil(viewportSize.width / cellWidthPx));
  const visibleRows = Math.max(
    1,
    Math.ceil((viewportBounds.height || window.innerHeight) / cellHeightPx)
  );
  const calculatedVirtualWidthPx = virtualWidthPx || Math.max(viewportSize.width, containerHeight);
  const calculatedVirtualHeightPx = virtualHeightPx || Math.max(viewportSize.height, containerHeight);
  const virtualColumns = Math.max(visibleColumns, Math.ceil(calculatedVirtualWidthPx / cellWidthPx));
  const virtualRows = Math.max(visibleRows, Math.ceil(calculatedVirtualHeightPx / cellHeightPx));
  const viewX = 0;
  const viewY = Math.max(0, Math.floor(scrollTop / cellHeightPx));
  const pixelOffsetY = scrollTop % cellHeightPx;
  return /* @__PURE__ */ jsxs3(
    "div",
    {
      ref: containerRef,
      style: {
        position: "relative",
        width: "100%",
        minHeight: "100vh"
      },
      children: [
        /* @__PURE__ */ jsx4(
          "div",
          {
            style: {
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 0,
              pointerEvents: "none"
            },
            children: (() => {
              const actualCellWidth = viewportSize.width / visibleColumns;
              const actualCellHeight = viewportBounds.height / visibleRows;
              return /* @__PURE__ */ jsx4(
                AnsiVirtualDisplay,
                {
                  columns: visibleColumns,
                  rows: visibleRows,
                  cellWidthPx: actualCellWidth,
                  cellHeightPx: actualCellHeight,
                  fillContainer: true,
                  bitmapFontUrl,
                  virtualColumns,
                  virtualRows,
                  viewX,
                  viewY,
                  pixelOffsetY,
                  frameGenerator: scrollableFrameGenerator,
                  fps,
                  background: bgColor || "#000",
                  showPerformanceOverlay
                }
              );
            })()
          }
        ),
        /* @__PURE__ */ jsx4(
          "div",
          {
            ref: scrollableRef,
            className: contentClassName,
            style: {
              position: "relative",
              zIndex: 1,
              height: "100vh",
              overflowY: "auto",
              overflowX: "hidden",
              color: "inherit",
              ...contentStyle
            },
            children
          }
        )
      ]
    }
  );
}

// src/FontCharacterChart.tsx
import { useEffect as useEffect4, useMemo as useMemo4, useRef as useRef4, useState as useState4 } from "react";
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
function FontCharacterChart({ bitmapFontUrl }) {
  const [bitmapFont, setBitmapFont] = useState4(null);
  const [loading, setLoading] = useState4(true);
  const [error, setError] = useState4(null);
  const [sorted, setSorted] = useState4(false);
  const canvasRefs = useRef4(/* @__PURE__ */ new Map());
  useEffect4(() => {
    let cancelled = false;
    async function loadFont() {
      setLoading(true);
      setError(null);
      try {
        const fontData = await extractFontFromFON(bitmapFontUrl);
        if (fontData && fontData.length >= 4096) {
          const glyphs = [];
          for (let i = 0; i < 256; i++) {
            glyphs.push(fontData.slice(i * 16, (i + 1) * 16));
          }
          if (!cancelled) {
            setBitmapFont({ width: 8, height: 16, glyphs, rawBitmapData: fontData });
          }
        } else {
          const font = await loadRawBitmapFont(bitmapFontUrl, 8, 16);
          if (!cancelled) {
            setBitmapFont(font);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load font");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    loadFont();
    return () => {
      cancelled = true;
    };
  }, [bitmapFontUrl]);
  function calculateDarkness(font, charCode) {
    const glyph = font.glyphs[charCode] || font.glyphs[0];
    let setBits = 0;
    const totalBits = font.width * font.height;
    for (let row = 0; row < font.height; row++) {
      const byte = glyph[row];
      for (let col = 0; col < font.width; col++) {
        const bit = 7 - col;
        if (byte & 1 << bit) {
          setBits++;
        }
      }
    }
    return setBits / totalBits * 100;
  }
  const characterInfo = useMemo4(() => {
    if (!bitmapFont) return [];
    const info = [];
    for (let charCode = 32; charCode <= 255; charCode++) {
      const character = cp437ByteToChar(charCode);
      const darkness = calculateDarkness(bitmapFont, charCode);
      info.push({ charCode, character, darkness });
    }
    return info;
  }, [bitmapFont]);
  const displayedCharacters = useMemo4(() => {
    if (!sorted) return characterInfo;
    return [...characterInfo].sort((a, b) => b.darkness - a.darkness);
  }, [characterInfo, sorted]);
  useEffect4(() => {
    if (!bitmapFont) return;
    displayedCharacters.forEach(({ charCode }) => {
      const canvas = canvasRefs.current.get(charCode);
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      renderGlyph(ctx, bitmapFont, charCode, 0, 0, "#FFFFFF", "#000000");
    });
  }, [bitmapFont, displayedCharacters]);
  async function copyToClipboard(character) {
    try {
      await navigator.clipboard.writeText(character);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  }
  if (loading) {
    return /* @__PURE__ */ jsx5("div", { children: "Loading font..." });
  }
  if (error) {
    return /* @__PURE__ */ jsxs4("div", { children: [
      "Error: ",
      error
    ] });
  }
  if (!bitmapFont) {
    return /* @__PURE__ */ jsx5("div", { children: "No font loaded" });
  }
  return /* @__PURE__ */ jsxs4("div", { style: { padding: "20px" }, children: [
    /* @__PURE__ */ jsx5("div", { style: { marginBottom: "20px" }, children: /* @__PURE__ */ jsx5("button", { onClick: () => setSorted(!sorted), children: sorted ? "Show Original Order" : "Sort by Darkness (Darkest to Lightest)" }) }),
    /* @__PURE__ */ jsx5(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
          gap: "10px"
        },
        children: displayedCharacters.map(({ charCode, character, darkness }) => /* @__PURE__ */ jsxs4(
          "div",
          {
            onClick: () => copyToClipboard(character),
            style: {
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              cursor: "pointer",
              padding: "10px",
              border: "1px solid #333",
              borderRadius: "4px",
              backgroundColor: "#1a1a1a"
            },
            title: `Click to copy: ${character}`,
            children: [
              /* @__PURE__ */ jsx5(
                "canvas",
                {
                  ref: (el) => {
                    if (el) canvasRefs.current.set(charCode, el);
                  },
                  width: bitmapFont.width,
                  height: bitmapFont.height,
                  style: {
                    imageRendering: "pixelated",
                    width: `${bitmapFont.width * 4}px`,
                    height: `${bitmapFont.height * 4}px`
                  }
                }
              ),
              /* @__PURE__ */ jsxs4("div", { style: { marginTop: "8px", fontSize: "12px", color: "#888" }, children: [
                darkness.toFixed(1),
                "%"
              ] })
            ]
          },
          charCode
        ))
      }
    )
  ] });
}
export {
  ANSI_COLORS_RGB,
  AnsiArt,
  AnsiVirtualDisplay,
  AsciiPerlinPlasma,
  FontCharacterChart,
  PlasmaBackgroundLayout,
  convertFrameDataToAnsi,
  createAsciiPerlinPlasmaSampler,
  generateAsciiPerlinPlasmaFrame,
  generateEvenlySpacedPalette,
  generatePlasmaFrame,
  getPalette,
  perlinNoise,
  perlinNoise2D,
  perlinNoise3D,
  rgbToAnsiColor,
  rgbToPaletteColor
};
//# sourceMappingURL=index.js.map