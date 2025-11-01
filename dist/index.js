// src/AnsiArt.tsx
import { useEffect, useMemo, useRef, useState } from "react";

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
    for (const p of params) {
      if (p === 0) {
        fg = 7;
        bg = 0;
        bold = false;
        continue;
      }
      if (p === 1) {
        bold = true;
        continue;
      }
      if (p === 22) {
        bold = false;
        continue;
      }
      if (p === 39) {
        fg = 7;
        continue;
      }
      if (p === 49) {
        bg = 0;
        continue;
      }
      if (p >= 30 && p <= 37) {
        fg = ANSI_TO_DOS[p - 30];
        continue;
      }
      if (p >= 40 && p <= 47) {
        bg = ANSI_TO_DOS[p - 40];
        continue;
      }
      if (p >= 90 && p <= 97) {
        fg = 8 + ANSI_TO_DOS[p - 90];
        continue;
      }
      if (p >= 100 && p <= 107) {
        bg = 8 + ANSI_TO_DOS[p - 100];
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
          applySGR(params.filter((p) => !Number.isNaN(p)));
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
    for (const p of params) {
      if (p === 0) {
        fg = 7;
        bg = 0;
        bold = false;
        continue;
      }
      if (p === 1) {
        bold = true;
        continue;
      }
      if (p === 22) {
        bold = false;
        continue;
      }
      if (p === 39) {
        fg = 7;
        continue;
      }
      if (p === 49) {
        bg = 0;
        continue;
      }
      if (p >= 30 && p <= 37) {
        fg = ANSI_TO_DOS[p - 30];
        continue;
      }
      if (p >= 40 && p <= 47) {
        bg = ANSI_TO_DOS[p - 40];
        continue;
      }
      if (p >= 90 && p <= 97) {
        fg = 8 + ANSI_TO_DOS[p - 90];
        continue;
      }
      if (p >= 100 && p <= 107) {
        bg = 8 + ANSI_TO_DOS[p - 100];
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
          applySGR(params.filter((p) => !Number.isNaN(p)));
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
  const glyph = font.glyphs[charCode] || font.glyphs[0];
  ctx.fillStyle = bgColor;
  ctx.fillRect(x, y, font.width, font.height);
  ctx.fillStyle = fgColor;
  for (let row = 0; row < font.height; row++) {
    const byte = glyph[row];
    for (let col = 0; col < font.width; col++) {
      const bit = 7 - col;
      if (byte & 1 << bit) {
        ctx.fillRect(x + col, y + row, 1, 1);
      }
    }
  }
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
function AnsiArt({
  src,
  columns = 80,
  fontSizePx = 16,
  fontFamily,
  background = "#000",
  allowDrop = true,
  yScale = 1.2,
  renderMode = "dom",
  cellWidthPx = 8,
  cellHeightPx = 16,
  bitmapFontUrl,
  debugFont = false,
  animated = false,
  frameDelay = 50,
  animationSpeed = 1,
  showControls = false
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
  const canvasRef = useRef(null);
  const debugFontCanvasRef = useRef(null);
  const animationTimeoutRef = useRef(null);
  async function loadFromBytes(bytes, name) {
    setError(null);
    try {
      if (animated && renderMode === "canvas") {
        setRawAnsiData(bytes);
        setCurrentByteIndex(0);
        setIsPlaying(true);
        setScreen(parseAnsi(new Uint8Array(0), columns));
        if (name) setFileName(name);
      } else {
        const parsed = parseAnsi(bytes, columns);
        setScreen(parsed);
        if (name) setFileName(name);
        setRawAnsiData(null);
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
        if (animated && renderMode === "canvas") {
          if (!cancelled) {
            setRawAnsiData(buf);
            setCurrentByteIndex(0);
            setIsPlaying(true);
            setScreen(parseAnsi(new Uint8Array(0), columns));
          }
        } else {
          const parsed = parseAnsi(buf, columns);
          if (!cancelled) {
            setScreen(parsed);
            setFileName(null);
            setRawAnsiData(null);
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
  }, [src, columns, animated, renderMode]);
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
      setCurrentByteIndex(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };
  const handleRestart = () => {
    setCurrentByteIndex(0);
    setIsPlaying(true);
    if (rawAnsiData) {
      setScreen(parseAnsi(new Uint8Array(0), columns));
    }
  };
  const baseRootStyle = useMemo(() => {
    return {
      fontFamily: fontFamily || "'Flexi_IBM_VGA_True_437', 'dos437', 'PerfectDOSVGA437Win', 'PerfectDOSVGA437', 'IBM VGA 8x16', 'Cascadia Mono', 'Menlo', monospace",
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
      width: "fit-content",
      fontVariantLigatures: "none",
      fontFeatureSettings: "'liga' 0, 'clig' 0",
      textRendering: "geometricPrecision"
    };
  }, [fontFamily]);
  const rootStyle = useMemo(() => {
    const css = {
      ...baseRootStyle,
      width: `${columns}ch`,
      background,
      fontSize: `${fontSizePx}px`,
      // DOM mode uses transform to emulate cell aspect
      ...renderMode === "dom" ? { transform: `scaleY(${yScale})`, transformOrigin: "top left" } : {},
      // Add dragOver outline when dragging
      ...isDragging ? {
        outline: "2px dashed #888",
        outlineOffset: "-2px"
      } : {}
    };
    return css;
  }, [baseRootStyle, columns, fontSizePx, background, yScale, renderMode, isDragging]);
  useEffect(() => {
    if (renderMode !== "canvas") return;
    if (!screen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rows = screen.lines.length;
    const cols = screen.columns;
    const charWidth = bitmapFont ? bitmapFont.width : cellWidthPx;
    const charHeight = bitmapFont ? bitmapFont.height : cellHeightPx;
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
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    if (bitmapFont) {
      for (let r = 0; r < rows; r++) {
        const cells = screen.lines[r];
        for (let c = 0; c < cells.length; c++) {
          const cell = cells[c];
          const x = c * charWidth;
          const y = r * charHeight;
          const fgIdx = cell.bold && cell.fg < 8 ? cell.fg + 8 : cell.fg;
          const fgColor = DOS_COLORS[fgIdx] ?? "#AAAAAA";
          const bgColor = DOS_COLORS[cell.bg] ?? "#000000";
          const charCode = charToCp437Byte(cell.ch);
          renderGlyph(ctx, bitmapFont, charCode, x, y, fgColor, bgColor);
        }
      }
    } else {
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      const fontStack = fontFamily ?? "'Flexi_IBM_VGA_True_437', 'dos437', 'PerfectDOSVGA437Win'. 'PerfectDOSVGA437','IBM VGA 8x16','Cascadia Mono','Menlo',monospace";
      ctx.font = `${cellHeightPx}px ${fontStack}`;
      for (let r = 0; r < rows; r++) {
        const runs = compressLine(screen.lines[r]);
        let x = 0;
        for (const run of runs) {
          ctx.fillStyle = DOS_COLORS[run.bg] ?? "#000000";
          const w = run.text.length * cellWidthPx;
          const y = r * cellHeightPx;
          ctx.fillRect(x, y, w, cellHeightPx);
          const fgIdx = run.bold && run.fg < 8 ? run.fg + 8 : run.fg;
          ctx.fillStyle = DOS_COLORS[fgIdx] ?? "#AAAAAA";
          ctx.fillText(run.text, x, y);
          x += w;
        }
      }
    }
  }, [screen, renderMode, cellWidthPx, cellHeightPx, background, fontFamily, bitmapFont]);
  useEffect(() => {
    if (!animated || renderMode !== "canvas" || !rawAnsiData || !isPlaying) {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
      return;
    }
    const animate = () => {
      setCurrentByteIndex((prevIndex) => {
        if (!rawAnsiData) return prevIndex;
        const nextByteIndex = findNextRenderPoint(rawAnsiData, prevIndex, 50);
        if (nextByteIndex > prevIndex && nextByteIndex <= rawAnsiData.length) {
          const newScreen = parseAnsiIncremental(rawAnsiData, columns, nextByteIndex);
          setScreen(newScreen);
          if (nextByteIndex >= rawAnsiData.length) {
            setIsPlaying(false);
            return rawAnsiData.length;
          }
          const delay = Math.max(1, Math.floor(frameDelay / animationSpeed));
          animationTimeoutRef.current = window.setTimeout(animate, delay);
          return nextByteIndex;
        } else {
          setIsPlaying(false);
          return prevIndex;
        }
      });
    };
    animate();
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
    };
  }, [animated, renderMode, rawAnsiData, isPlaying, columns, frameDelay, animationSpeed]);
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
        style: rootStyle,
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
        style: rootStyle,
        onDragEnter,
        onDragOver,
        onDragLeave,
        onDrop,
        children: "Loading\u2026"
      }
    );
  return /* @__PURE__ */ jsxs("div", { children: [
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
          style: {
            border: "1px solid #555",
            display: "block",
            background: "#000"
          }
        }
      )
    ] }),
    showControls && animated && renderMode === "canvas" && /* @__PURE__ */ jsxs(
      "div",
      {
        style: {
          display: "flex",
          gap: "8px",
          marginBottom: "8px",
          alignItems: "center"
        },
        children: [
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
              onMouseEnter: (e) => {
                e.currentTarget.style.background = "#444";
              },
              onMouseLeave: (e) => {
                e.currentTarget.style.background = "#333";
              },
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
    renderMode === "canvas" ? /* @__PURE__ */ jsx(
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
    ) : /* @__PURE__ */ jsx(
      "pre",
      {
        style: rootStyle,
        "aria-label": `ANSI Art${fileName ? ` - ${fileName}` : ""}`,
        onDragEnter,
        onDragOver,
        onDragLeave,
        onDrop,
        children: screen.lines.map((cells, rowIdx) => /* @__PURE__ */ jsx("div", { style: { display: "flex", height: `${fontSizePx}px` }, children: cells.map((cell, colIdx) => {
          const fgIdx = cell.bold && cell.fg < 8 ? cell.fg + 8 : cell.fg;
          return /* @__PURE__ */ jsx(
            "span",
            {
              style: {
                display: "inline-block",
                textAlign: "center",
                width: `${fontSizePx * 0.6}px`,
                height: `${fontSizePx}px`,
                color: DOS_COLORS[fgIdx] ?? "#AAAAAA",
                backgroundColor: DOS_COLORS[cell.bg] ?? "#000000",
                fontWeight: "normal",
                overflow: "hidden",
                flexShrink: 0
              },
              children: cell.ch
            },
            colIdx
          );
        }) }, rowIdx))
      }
    )
  ] });
}
export {
  AnsiArt
};
//# sourceMappingURL=index.js.map