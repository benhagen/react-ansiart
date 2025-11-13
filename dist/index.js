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
function byteToChar(byte, encoding = "cp437") {
  switch (encoding) {
    case "cp437":
      return cp437ByteToChar(byte);
    case "cp850":
    case "cp1252":
    case "iso-8859-1":
      if (byte < 128) {
        return String.fromCharCode(byte);
      } else {
        return cp437ByteToChar(byte);
      }
    case "utf-8":
      return String.fromCharCode(byte);
    default:
      return cp437ByteToChar(byte);
  }
}
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
function parseSauce(bytes) {
  if (!isSauceTrailer(bytes)) return void 0;
  const off = bytes.length - 128;
  const dataView = new DataView(bytes.buffer, bytes.byteOffset + off);
  function readString(offset, length) {
    let result = "";
    for (let i = 0; i < length; i++) {
      const byte = bytes[off + offset + i];
      if (byte === 0) break;
      result += String.fromCharCode(byte);
    }
    return result.trim();
  }
  const id = readString(0, 5);
  const version = bytes[off + 5];
  const title = readString(6, 35);
  const author = readString(41, 20);
  const group = readString(61, 20);
  const date = readString(81, 8);
  const fileSize = dataView.getUint32(89, true);
  const dataType = bytes[off + 93];
  const fileType = bytes[off + 94];
  const tInfo1 = dataView.getUint16(95, true);
  const tInfo2 = dataView.getUint16(97, true);
  const tInfo3 = bytes[off + 99];
  const tInfo4 = bytes[off + 100];
  const comments = dataView.getUint16(101, true);
  const tFlags = bytes[off + 103];
  const commentLines = [];
  const commentStart = off + 104;
  for (let i = 0; i < comments && i < 255; i++) {
    const commentOffset = commentStart + i * 64;
    if (commentOffset + 64 > bytes.length) break;
    const comment = readString(commentOffset - off, 64);
    commentLines.push(comment);
  }
  return {
    id,
    version,
    title,
    author,
    group,
    date,
    fileSize,
    dataType,
    fileType,
    tInfo1,
    tInfo2,
    tInfo3,
    tInfo4,
    comments,
    tFlags,
    commentLines
  };
}
function parseAnsi(bytesInput, columns = 80, encoding = "cp437") {
  let bytes = bytesInput;
  const sauce = parseSauce(bytesInput);
  if (isSauceTrailer(bytes)) {
    bytes = bytes.slice(0, bytes.length - 128);
  }
  const lines = [];
  const cur = { row: 0, col: 0 };
  const savedCur = { row: 0, col: 0 };
  let fg = 7;
  let bg = 0;
  let bold = false;
  let lineWrap = true;
  let iceColors = false;
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
      if (lineWrap) {
        cur.row += 1;
        cur.col = 0;
        ensureRow(lines, cur.row, columns, fg, bg, bold);
      } else {
        return;
      }
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
      if (p === 7) {
        const tempFg = fg;
        const tempBg = bg;
        fg = tempBg;
        bg = tempFg;
        continue;
      }
      if (p === 27) {
        fg = 7;
        bg = 0;
        continue;
      }
      if (p === 25) {
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
        writeChar(byteToChar(b, encoding));
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
          if (csiParams.length < 256) {
            csiParams += ch;
          }
          break;
        }
        if (!isValidCsiCommand(ch)) {
          state = "normal";
          csiParams = "";
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
        } else if (ch === "t") {
          if (params.length >= 4) {
            const mode = get(0, 0);
            const r = Math.min(255, Math.max(0, get(1, 0)));
            const g = Math.min(255, Math.max(0, get(2, 0)));
            const b2 = Math.min(255, Math.max(0, get(3, 0)));
            const rgbColor = `rgb(${r}, ${g}, ${b2})`;
            if (mode === 0) {
              bg = rgbColor;
            } else if (mode === 1) {
              fg = rgbColor;
            }
          }
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
        } else if (ch === "E") {
          const n = Math.max(1, get(0, 1));
          cur.row += n;
          cur.col = 0;
          ensureRow(lines, cur.row, columns, fg, bg, bold);
        } else if (ch === "F") {
          const n = Math.max(1, get(0, 1));
          cur.row = Math.max(0, cur.row - n);
          cur.col = 0;
        } else if (ch === "S") {
          const n = Math.max(1, get(0, 1));
          for (let scroll = 0; scroll < n; scroll++) {
            if (lines.length > 0) {
              lines.shift();
              const newLine = [];
              for (let c = 0; c < columns; c++) newLine.push(createCell(7, 0, false));
              lines.push(newLine);
            }
          }
        } else if (ch === "T") {
          const n = Math.max(1, get(0, 1));
          for (let scroll = 0; scroll < n; scroll++) {
            if (lines.length > 0) {
              lines.pop();
              const newLine = [];
              for (let c = 0; c < columns; c++) newLine.push(createCell(7, 0, false));
              lines.unshift(newLine);
            }
          }
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
        } else if (ch === "h") {
          for (const param of params) {
            if (param === 7) {
              lineWrap = true;
            } else if (param === 33) {
              iceColors = true;
            }
          }
        } else if (ch === "l") {
          for (const param of params) {
            if (param === 7) {
              lineWrap = false;
            } else if (param === 33) {
              iceColors = false;
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
  return { lines, columns, sauce };
}
function parseAnsiIncremental(bytesInput, columns, maxByteIndex, encoding = "cp437") {
  let bytes = bytesInput;
  const sauce = parseSauce(bytesInput);
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
  let lineWrap = true;
  let iceColors = false;
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
      if (lineWrap) {
        cur.row += 1;
        cur.col = 0;
        ensureRow(lines, cur.row, columns, fg, bg, bold);
      } else {
        return;
      }
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
      if (p === 7) {
        const tempFg = fg;
        const tempBg = bg;
        fg = tempBg;
        bg = tempFg;
        continue;
      }
      if (p === 27) {
        fg = 7;
        bg = 0;
        continue;
      }
      if (p === 25) {
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
        writeChar(byteToChar(b, encoding));
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
          if (csiParams.length < 256) {
            csiParams += ch;
          }
          break;
        }
        if (!isValidCsiCommand(ch)) {
          state = "normal";
          csiParams = "";
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
        } else if (ch === "t") {
          if (params.length >= 4) {
            const mode = get(0, 0);
            const r = Math.min(255, Math.max(0, get(1, 0)));
            const g = Math.min(255, Math.max(0, get(2, 0)));
            const b2 = Math.min(255, Math.max(0, get(3, 0)));
            const rgbColor = `rgb(${r}, ${g}, ${b2})`;
            if (mode === 0) {
              bg = rgbColor;
            } else if (mode === 1) {
              fg = rgbColor;
            }
          }
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
        } else if (ch === "E") {
          const n = Math.max(1, get(0, 1));
          cur.row += n;
          cur.col = 0;
          ensureRow(lines, cur.row, columns, fg, bg, bold);
        } else if (ch === "F") {
          const n = Math.max(1, get(0, 1));
          cur.row = Math.max(0, cur.row - n);
          cur.col = 0;
        } else if (ch === "S") {
          const n = Math.max(1, get(0, 1));
          for (let scroll = 0; scroll < n; scroll++) {
            if (lines.length > 0) {
              lines.shift();
              const newLine = [];
              for (let c = 0; c < columns; c++) newLine.push(createCell(7, 0, false));
              lines.push(newLine);
            }
          }
        } else if (ch === "T") {
          const n = Math.max(1, get(0, 1));
          for (let scroll = 0; scroll < n; scroll++) {
            if (lines.length > 0) {
              lines.pop();
              const newLine = [];
              for (let c = 0; c < columns; c++) newLine.push(createCell(7, 0, false));
              lines.unshift(newLine);
            }
          }
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
        } else if (ch === "h") {
          for (const param of params) {
            if (param === 7) {
              lineWrap = true;
            } else if (param === 33) {
              iceColors = true;
            }
          }
        } else if (ch === "l") {
          for (const param of params) {
            if (param === 7) {
              lineWrap = false;
            } else if (param === 33) {
              iceColors = false;
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
  return { lines, columns, sauce };
}
function parseAnsiDynamic(bytesInput, encoding = "cp437") {
  let bytes = bytesInput;
  const sauce = parseSauce(bytesInput);
  if (isSauceTrailer(bytes)) {
    bytes = bytes.slice(0, bytes.length - 128);
  }
  const lines = [];
  const cur = { row: 0, col: 0 };
  const savedCur = { row: 0, col: 0 };
  let fg = 7;
  let bg = 0;
  let bold = false;
  let lineWrap = true;
  let iceColors = false;
  let maxCol = 0;
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
    while (lines.length <= cur.row) {
      lines.push([]);
    }
    while (lines[cur.row].length <= cur.col) {
      lines[cur.row].push(createCell(7, 0, false));
    }
    lines[cur.row][cur.col] = { ch, fg, bg, bold };
    cur.col += 1;
    if (cur.col > maxCol) {
      maxCol = cur.col;
    }
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
      if (p === 7) {
        const tempFg = fg;
        const tempBg = bg;
        fg = tempBg;
        bg = tempFg;
        continue;
      }
      if (p === 27) {
        fg = 7;
        bg = 0;
        continue;
      }
      if (p === 25) {
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
        writeChar(byteToChar(b, encoding));
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
          if (csiParams.length < 256) {
            csiParams += ch;
          }
          break;
        }
        if (!isValidCsiCommand(ch)) {
          state = "normal";
          csiParams = "";
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
          while (lines.length <= cur.row) {
            lines.push([]);
          }
        } else if (ch === "m") {
          applySGR(params.filter((p) => !Number.isNaN(p)));
        } else if (ch === "H" || ch === "f") {
          const r = Math.max(1, get(0, 1)) - 1;
          const c = Math.max(1, get(1, 1)) - 1;
          cur.row = r;
          cur.col = c;
          while (lines.length <= cur.row) {
            lines.push([]);
          }
          if (cur.col > maxCol) {
            maxCol = cur.col;
          }
        } else if (ch === "A") {
          const n = Math.max(1, get(0, 1));
          cur.row = Math.max(0, cur.row - n);
        } else if (ch === "B") {
          const n = Math.max(1, get(0, 1));
          cur.row = cur.row + n;
          while (lines.length <= cur.row) {
            lines.push([]);
          }
        } else if (ch === "C") {
          const n = Math.max(1, get(0, 1));
          cur.col = cur.col + n;
          if (cur.col > maxCol) {
            maxCol = cur.col;
          }
        } else if (ch === "D") {
          const n = Math.max(1, get(0, 1));
          cur.col = Math.max(0, cur.col - n);
        } else if (ch === "G") {
          const c = Math.max(1, get(0, 1)) - 1;
          cur.col = Math.max(0, c);
          if (cur.col > maxCol) {
            maxCol = cur.col;
          }
        } else if (ch === "K") {
          const mode = get(0, 0);
          while (lines.length <= cur.row) {
            lines.push([]);
          }
          const line = lines[cur.row];
          if (mode === 0) {
            for (let c = cur.col; c < line.length; c++) {
              line[c] = createCell(fg, bg, bold);
            }
          } else if (mode === 1) {
            for (let c = 0; c <= cur.col; c++) {
              if (c < line.length) {
                line[c] = createCell(fg, bg, bold);
              }
            }
          } else if (mode === 2) {
            line.length = 0;
          }
        } else if (ch === "J") {
          const mode = get(0, 0);
          if (mode === 2) {
            lines.length = 0;
            cur.row = 0;
            cur.col = 0;
            maxCol = 0;
          } else if (mode === 0 || mode === 1) {
            while (lines.length <= cur.row) {
              lines.push([]);
            }
            if (mode === 0) {
              const line = lines[cur.row];
              for (let c = cur.col; c < line.length; c++) {
                line[c] = createCell(fg, bg, bold);
              }
              for (let r = cur.row + 1; r < lines.length; r++) {
                lines[r].length = 0;
              }
            } else {
              for (let r = 0; r < cur.row; r++) {
                lines[r].length = 0;
              }
              const line = lines[cur.row];
              for (let c = 0; c <= cur.col; c++) {
                if (c < line.length) {
                  line[c] = createCell(fg, bg, bold);
                }
              }
            }
          }
        } else if (ch === "h") {
          for (const param of params) {
            if (param === 7) {
              lineWrap = true;
            } else if (param === 33) {
              iceColors = true;
            }
          }
        } else if (ch === "l") {
          for (const param of params) {
            if (param === 7) {
              lineWrap = false;
            } else if (param === 33) {
              iceColors = false;
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
    lines.push([]);
  }
  const actualRows = lines.length;
  const actualColumns = Math.max(1, maxCol);
  for (let r = 0; r < lines.length; r++) {
    const line = lines[r];
    while (line.length < actualColumns) {
      line.push(createCell(7, 0, false));
    }
  }
  return { lines, columns: actualColumns, sauce };
}
function parseAnsiIncrementalDynamic(bytesInput, maxByteIndex, encoding = "cp437") {
  let bytes = bytesInput;
  const sauce = parseSauce(bytesInput);
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
  let lineWrap = true;
  let iceColors = false;
  let maxCol = 0;
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
    while (lines.length <= cur.row) {
      lines.push([]);
    }
    while (lines[cur.row].length <= cur.col) {
      lines[cur.row].push(createCell(7, 0, false));
    }
    lines[cur.row][cur.col] = { ch, fg, bg, bold };
    cur.col += 1;
    if (cur.col > maxCol) {
      maxCol = cur.col;
    }
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
      if (p === 7) {
        const tempFg = fg;
        const tempBg = bg;
        fg = tempBg;
        bg = tempFg;
        continue;
      }
      if (p === 27) {
        fg = 7;
        bg = 0;
        continue;
      }
      if (p === 25) {
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
        writeChar(byteToChar(b, encoding));
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
          if (csiParams.length < 256) {
            csiParams += ch;
          }
          break;
        }
        if (!isValidCsiCommand(ch)) {
          state = "normal";
          csiParams = "";
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
          while (lines.length <= cur.row) {
            lines.push([]);
          }
        } else if (ch === "m") {
          applySGR(params.filter((p) => !Number.isNaN(p)));
        } else if (ch === "t") {
          if (params.length >= 4) {
            const mode = get(0, 0);
            const r = Math.min(255, Math.max(0, get(1, 0)));
            const g = Math.min(255, Math.max(0, get(2, 0)));
            const b2 = Math.min(255, Math.max(0, get(3, 0)));
            const rgbColor = `rgb(${r}, ${g}, ${b2})`;
            if (mode === 0) {
              bg = rgbColor;
            } else if (mode === 1) {
              fg = rgbColor;
            }
          }
        } else if (ch === "H" || ch === "f") {
          const r = Math.max(1, get(0, 1)) - 1;
          const c = Math.max(1, get(1, 1)) - 1;
          cur.row = r;
          cur.col = c;
          while (lines.length <= cur.row) {
            lines.push([]);
          }
          if (cur.col > maxCol) {
            maxCol = cur.col;
          }
        } else if (ch === "A") {
          const n = Math.max(1, get(0, 1));
          cur.row = Math.max(0, cur.row - n);
        } else if (ch === "B") {
          const n = Math.max(1, get(0, 1));
          cur.row = cur.row + n;
          while (lines.length <= cur.row) {
            lines.push([]);
          }
        } else if (ch === "C") {
          const n = Math.max(1, get(0, 1));
          cur.col = cur.col + n;
          if (cur.col > maxCol) {
            maxCol = cur.col;
          }
        } else if (ch === "D") {
          const n = Math.max(1, get(0, 1));
          cur.col = Math.max(0, cur.col - n);
        } else if (ch === "G") {
          const c = Math.max(1, get(0, 1)) - 1;
          cur.col = Math.max(0, c);
          if (cur.col > maxCol) {
            maxCol = cur.col;
          }
        } else if (ch === "K") {
          const mode = get(0, 0);
          while (lines.length <= cur.row) {
            lines.push([]);
          }
          const line = lines[cur.row];
          if (mode === 0) {
            for (let c = cur.col; c < line.length; c++) {
              line[c] = createCell(fg, bg, bold);
            }
          } else if (mode === 1) {
            for (let c = 0; c <= cur.col; c++) {
              if (c < line.length) {
                line[c] = createCell(fg, bg, bold);
              }
            }
          } else if (mode === 2) {
            line.length = 0;
          }
        } else if (ch === "J") {
          const mode = get(0, 0);
          if (mode === 2) {
            lines.length = 0;
            cur.row = 0;
            cur.col = 0;
            maxCol = 0;
          } else if (mode === 0 || mode === 1) {
            while (lines.length <= cur.row) {
              lines.push([]);
            }
            if (mode === 0) {
              const line = lines[cur.row];
              for (let c = cur.col; c < line.length; c++) {
                line[c] = createCell(fg, bg, bold);
              }
              for (let r = cur.row + 1; r < lines.length; r++) {
                lines[r].length = 0;
              }
            } else {
              for (let r = 0; r < cur.row; r++) {
                lines[r].length = 0;
              }
              const line = lines[cur.row];
              for (let c = 0; c <= cur.col; c++) {
                if (c < line.length) {
                  line[c] = createCell(fg, bg, bold);
                }
              }
            }
          }
        } else if (ch === "h") {
          for (const param of params) {
            if (param === 7) {
              lineWrap = true;
            } else if (param === 33) {
              iceColors = true;
            }
          }
        } else if (ch === "l") {
          for (const param of params) {
            if (param === 7) {
              lineWrap = false;
            } else if (param === 33) {
              iceColors = false;
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
    lines.push([]);
  }
  const actualRows = lines.length;
  const actualColumns = Math.max(1, maxCol);
  for (let r = 0; r < lines.length; r++) {
    const line = lines[r];
    while (line.length < actualColumns) {
      line.push(createCell(7, 0, false));
    }
  }
  return { lines, columns: actualColumns, sauce };
}
function detectAnimation(bytes) {
  const sauce = parseSauce(bytes);
  if (sauce && sauce.dataType === 1 && sauce.fileType === 2) {
    return true;
  }
  const maxCheck = Math.min(2048, bytes.length);
  let i = 0;
  while (i < maxCheck) {
    const b = bytes[i++];
    if (b === 27) {
      if (i < maxCheck && bytes[i] === 91) {
        i++;
        while (i < maxCheck && !isLetter(bytes[i])) {
          i++;
        }
        if (i < maxCheck) {
          const cmd = bytes[i];
          if (cmd === 72 || cmd === 102) {
            return true;
          }
        }
      }
    }
  }
  return false;
}
function isLetter(byte) {
  return byte >= 65 && byte <= 90 || byte >= 97 && byte <= 122;
}
function isValidCsiCommand(ch) {
  const validCommands = "ABCDEFGHIJKLMPSTXYZhfmlr";
  return validCommands.includes(ch);
}
function getSauceInfo(sauce) {
  if (!sauce) return null;
  const info = {
    ...sauce,
    // Interpret data types
    fileTypeDescription: getFileTypeDescription(sauce.dataType, sauce.fileType),
    // Check if file has valid dimensions
    hasDimensions: sauce.dataType === 1 && [1, 2].includes(sauce.fileType) && sauce.tInfo1 > 0 && sauce.tInfo2 > 0,
    // Get dimensions if available
    width: sauce.tInfo1 || void 0,
    height: sauce.tInfo2 || void 0,
    // Font information (for ANSI files)
    fontName: sauce.dataType === 1 && [1, 2].includes(sauce.fileType) ? getFontName(sauce.tInfo3) : void 0,
    // ICE colors flag
    iceColors: (sauce.tFlags & 1) !== 0,
    // Letter spacing (aspect ratio)
    letterSpacing: (sauce.tFlags & 2) !== 0,
    // Aspect ratio information
    aspectRatio: sauce.dataType === 1 && [1, 2].includes(sauce.fileType) ? getAspectRatio(sauce.tInfo4) : void 0
  };
  return info;
}
function getFileTypeDescription(dataType, fileType) {
  const descriptions = {
    0: {
      // Text files
      0: "ASCII Text",
      1: "ANSI Text",
      2: "Ansimation",
      3: "RIP Script",
      4: "PCBoard",
      5: "Avatar",
      6: "HTML",
      7: "Source Code",
      8: "Tundra Draw"
    },
    1: {
      // Character art
      0: "ASCII Character Art",
      1: "ANSI Character Art",
      2: "Ansimation",
      3: "RIP Character Art",
      4: "PCBoard Character Art",
      5: "Avatar Character Art",
      6: "HTML Character Art",
      7: "Source Character Art",
      8: "Tundra Draw Character Art"
    }
  };
  return descriptions[dataType]?.[fileType] || `Unknown (Type ${dataType}:${fileType})`;
}
function getFontName(fontId) {
  const fonts = {
    0: "Default",
    1: "Courier New",
    2: "Terminal",
    3: "Fixedsys",
    4: "System",
    5: "IBM VGA",
    6: "IBM VGA50",
    7: "IBM VGA25",
    8: "IBM EGA",
    9: "IBM EGA43",
    10: "Amiga Topaz 1",
    11: "Amiga Topaz 2",
    12: "Amiga P0T-NOoDLE",
    13: "Amiga MicroKnight",
    14: "Amiga MicroKnight Plus",
    15: "Amiga mO'sOul"
  };
  return fonts[fontId] || `Font ${fontId}`;
}
function getAspectRatio(flags) {
  const aspectRatios = {
    0: { width: 1, height: 1 },
    // Square pixels
    1: { width: 4, height: 3 },
    // 4:3 aspect
    2: { width: 5, height: 4 },
    // 5:4 aspect
    3: { width: 16, height: 9 }
    // 16:9 widescreen
  };
  return aspectRatios[flags] || { width: 1, height: 1 };
}
function parseAscii(bytes, encoding = "cp437") {
  const lines = [];
  let currentLine = [];
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte === 10 || byte === 13) {
      if (currentLine.length > 0 || byte === 10) {
        lines.push([...currentLine]);
        currentLine = [];
      }
      if (byte === 13 && i + 1 < bytes.length && bytes[i + 1] === 10) {
        i++;
      }
    } else if (byte === 26) {
      break;
    } else {
      const ch = byteToChar(byte, encoding);
      currentLine.push({ ch, fg: 7, bg: 0, bold: false });
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }
  let maxWidth = 0;
  for (const line of lines) {
    maxWidth = Math.max(maxWidth, line.length);
  }
  for (const line of lines) {
    while (line.length < maxWidth) {
      line.push({ ch: " ", fg: 7, bg: 0, bold: false });
    }
  }
  if (lines.length === 0) {
    lines.push(Array(maxWidth || 80).fill(null).map(() => ({ ch: " ", fg: 7, bg: 0, bold: false })));
  }
  return {
    lines,
    columns: maxWidth || 80,
    sauce: parseSauce(bytes)
  };
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
function renderText(ctx, font, text, x, y, fgColor, bgColor) {
  let xPos = x;
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    renderGlyph(ctx, font, charCode, xPos, y, fgColor, bgColor);
    xPos += font.width;
  }
  return xPos - x;
}

// src/font/fonExtractor.ts
async function extractFontFromFON(url) {
  console.log("[fonExtractor] Extracting from:", url);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load FON: ${response.status}`);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes[0] !== 77 || bytes[1] !== 90) {
    return { bitmapData: bytes, width: 8, height: 16 };
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
      console.log("[fonExtractor] Found font resource, count:", count);
      if (count > 0) {
        const fontResOffset = (bytes[pos] | bytes[pos + 1] << 8) << alignShift;
        const fontResLength = (bytes[pos + 2] | bytes[pos + 3] << 8) << alignShift;
        const fntData = bytes.slice(fontResOffset, fontResOffset + fontResLength);
        const dfPixWidth = fntData[86] | fntData[87] << 8;
        const dfPixHeight = fntData[88] | fntData[89] << 8;
        const dfFirstChar = fntData[95];
        const dfLastChar = fntData[96];
        console.log(
          "[fonExtractor] Font:",
          dfPixWidth,
          "x",
          dfPixHeight,
          "chars",
          dfFirstChar,
          "-",
          dfLastChar
        );
        const charTableStart = 117;
        const charCount = dfLastChar - dfFirstChar + 1;
        const charTableSize = charCount * 4;
        const baseOffset = charTableStart + charTableSize;
        let bitmapOffset = baseOffset;
        const bytesPerGlyph = dfPixHeight;
        let bestOffset = baseOffset;
        let bestScore = -1;
        for (let adj = -16; adj <= 16; adj++) {
          const testOffset = baseOffset + adj;
          const expectedBitmapSize2 = 256 * bytesPerGlyph;
          if (testOffset < 0 || fntData.length < testOffset + expectedBitmapSize2) continue;
          let score = 0;
          const testChar32 = fntData.slice(
            testOffset + 32 * bytesPerGlyph,
            testOffset + 32 * bytesPerGlyph + bytesPerGlyph
          );
          const spaceNonZero = testChar32.filter((b) => b !== 0).length;
          if (spaceNonZero === 0) {
            score += 20;
          } else if (spaceNonZero <= 2) {
            score += 10;
          } else {
            continue;
          }
          const testChar65 = fntData.slice(
            testOffset + 65 * bytesPerGlyph,
            testOffset + 65 * bytesPerGlyph + bytesPerGlyph
          );
          const firstNonZero = testChar65.findIndex((b) => b !== 0);
          if (firstNonZero >= 5 && firstNonZero <= 7) {
            score += 15 - Math.abs(firstNonZero - 6);
            if (testChar65[firstNonZero] >= 16 && testChar65[firstNonZero] <= 128) {
              score += 5;
            }
          } else {
            score -= 10;
          }
          const testChar219 = fntData.slice(
            testOffset + 219 * bytesPerGlyph,
            testOffset + 219 * bytesPerGlyph + bytesPerGlyph
          );
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
        console.log("[fonExtractor] Bitmap offset:", bitmapOffset, "score:", bestScore);
        const expectedBitmapSize = 256 * bytesPerGlyph;
        if (fntData.length >= bitmapOffset + expectedBitmapSize) {
          console.log("[fonExtractor] Success: extracted bitmap");
          return {
            bitmapData: fntData.slice(bitmapOffset, bitmapOffset + expectedBitmapSize),
            width: dfPixWidth,
            height: dfPixHeight
          };
        }
        const absoluteBitmapOffset = fontResOffset + bitmapOffset;
        if (bytes.length >= absoluteBitmapOffset + expectedBitmapSize) {
          console.log("[fonExtractor] Success: extracted bitmap (absolute offset)");
          return {
            bitmapData: bytes.slice(
              absoluteBitmapOffset,
              absoluteBitmapOffset + expectedBitmapSize
            ),
            width: dfPixWidth,
            height: dfPixHeight
          };
        }
        console.log("[fonExtractor] Failed: bitmap not found");
        return null;
      }
    }
    pos += count * 12;
  }
  console.log("[fonExtractor] Failed: no font resource found");
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
  debugPerformance = false,
  debugCursorCodes = false
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
  const debugCursorCodesRef = useRef(debugCursorCodes);
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
        const fontResult = await extractFontFromFON(bitmapFontUrl);
        if (fontResult) {
          const { bitmapData, width, height } = fontResult;
          if (!cancelled) setRawFontData(bitmapData);
          const bytesPerGlyph = height;
          const glyphs = [];
          for (let i = 0; i < 256; i++) {
            glyphs.push(bitmapData.slice(i * bytesPerGlyph, (i + 1) * bytesPerGlyph));
          }
          if (!cancelled) setBitmapFont({ width, height, glyphs, rawBitmapData: bitmapData });
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
    debugCursorCodesRef.current = debugCursorCodes;
  }, [
    columns,
    frameDelay,
    bytesPerFrame,
    linesPerFrame,
    animateBy,
    background,
    bitmapFont,
    debugCursorCodes
  ]);
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
        const newScreen = parseAnsiIncremental(
          data,
          columnsRef.current,
          nextByteIndex2
        );
        renderToCanvas(newScreen);
        currentByteIndexRef.current = nextByteIndex2;
      }
      const finalScreen = parseAnsiIncremental(
        data,
        columnsRef.current,
        data.length
      );
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
      const newScreen = parseAnsiIncremental(
        data,
        columnsRef.current,
        nextByteIndex
      );
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
    if (!debugFont || !rawFontData || !bitmapFont) return;
    const canvas = debugFontCanvasRef.current;
    if (!canvas) return;
    const charWidth = bitmapFont.width;
    const charHeight = bitmapFont.height;
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
    const bytesPerGlyph = charHeight;
    for (let charCode = 0; charCode < 256; charCode++) {
      const charBase = charCode * bytesPerGlyph;
      const col = charCode % 16;
      const row = Math.floor(charCode / 16);
      const baseX = col * charWidth;
      const baseY = row * charHeight;
      for (let rowIdx = 0; rowIdx < charHeight; rowIdx++) {
        const byte = rawFontData[charBase + rowIdx];
        const x = baseX;
        const y = baseY + rowIdx;
        for (let bit = 0; bit < charWidth; bit++) {
          const bitValue = charWidth - 1 - bit;
          if (byte & 1 << bitValue) {
            ctx.fillRect(x + bit, y, 1, 1);
          }
        }
      }
    }
  }, [debugFont, rawFontData, bitmapFont]);
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

// src/AnsiArtNG.tsx
import { useCallback as useCallback4, useEffect as useEffect4, useMemo as useMemo3, useRef as useRef4, useState as useState4 } from "react";

// src/AnsiVirtualDisplay.tsx
import { useCallback as useCallback3, useEffect as useEffect3, useMemo as useMemo2, useRef as useRef3, useState as useState3 } from "react";

// src/AnsiPlayerOverlay.tsx
import { useCallback as useCallback2, useEffect as useEffect2, useRef as useRef2, useState as useState2 } from "react";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var SPEED_PRESETS = [
  { label: "300 baud", value: Math.floor(300 / 10) },
  // 30 bytes/sec
  { label: "1200 baud", value: Math.floor(1200 / 10) },
  // 120 bytes/sec
  { label: "2400 baud", value: Math.floor(2400 / 10) },
  // 240 bytes/sec
  { label: "9600 baud", value: Math.floor(9600 / 10) },
  // 960 bytes/sec
  { label: "14.4k baud", value: Math.floor(14400 / 10) },
  // 1440 bytes/sec
  { label: "28.8k baud", value: Math.floor(28800 / 10) },
  // 2880 bytes/sec
  { label: "33.6k baud", value: Math.floor(33600 / 10) },
  // 3360 bytes/sec
  { label: "56k baud", value: Math.floor(56e3 / 10) }
  // 5600 bytes/sec
];
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
function AnsiPlayerOverlay({
  isPlaying,
  currentBytes,
  totalBytes,
  currentSpeed,
  isVisible,
  onPlayPause,
  onRestart,
  onSeek,
  onSpeedChange,
  onAdvanceByte,
  onRewindByte,
  onMouseMove
}) {
  const [isScrubbing, setIsScrubbing] = useState2(false);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState2(false);
  const [scrubValue, setScrubValue] = useState2(currentBytes);
  const progressBarRef = useRef2(null);
  const speedMenuRef = useRef2(null);
  useEffect2(() => {
    if (!isScrubbing) {
      setScrubValue(currentBytes);
    }
  }, [currentBytes, isScrubbing]);
  useEffect2(() => {
    function handleClickOutside(event) {
      if (speedMenuRef.current && !speedMenuRef.current.contains(event.target)) {
        setIsSpeedMenuOpen(false);
      }
    }
    if (isSpeedMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isSpeedMenuOpen]);
  const handleProgressBarClick = useCallback2(
    (e) => {
      if (!progressBarRef.current || totalBytes === 0) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const targetBytes = Math.floor(percentage * totalBytes);
      onSeek(targetBytes);
    },
    [totalBytes, onSeek]
  );
  const handleProgressBarMouseDown = useCallback2(
    (e) => {
      if (!progressBarRef.current || totalBytes === 0) return;
      setIsScrubbing(true);
      const rect = progressBarRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const targetBytes = Math.floor(percentage * totalBytes);
      setScrubValue(targetBytes);
      let finalBytes = targetBytes;
      function handleMouseMove(moveEvent) {
        if (!progressBarRef.current) return;
        const rect2 = progressBarRef.current.getBoundingClientRect();
        const x2 = moveEvent.clientX - rect2.left;
        const percentage2 = Math.max(0, Math.min(1, x2 / rect2.width));
        const targetBytes2 = Math.floor(percentage2 * totalBytes);
        finalBytes = targetBytes2;
        setScrubValue(targetBytes2);
      }
      function handleMouseUp() {
        setIsScrubbing(false);
        onSeek(finalBytes);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      }
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [totalBytes, onSeek]
  );
  const handleSpeedSelect = useCallback2(
    (speed) => {
      onSpeedChange(speed);
      setIsSpeedMenuOpen(false);
    },
    [onSpeedChange]
  );
  const progressPercent = totalBytes > 0 ? scrubValue / totalBytes * 100 : 0;
  const currentTime = currentSpeed > 0 ? currentBytes / currentSpeed : 0;
  const totalTime = currentSpeed > 0 ? totalBytes / currentSpeed : 0;
  const currentSpeedLabel = SPEED_PRESETS.find((preset) => preset.value === currentSpeed)?.label || `${currentSpeed} bps`;
  const isAtEnd = totalBytes > 0 && currentBytes >= totalBytes;
  const hasStarted = currentBytes > 0;
  const shouldShow = isVisible || isScrubbing || isSpeedMenuOpen || isAtEnd || !isPlaying;
  return /* @__PURE__ */ jsxs2(
    "div",
    {
      style: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        background: "linear-gradient(to top, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0))",
        padding: "40px 16px 16px",
        transition: "opacity 0.3s ease",
        opacity: shouldShow ? 1 : 0,
        pointerEvents: shouldShow ? "auto" : "none"
      },
      onMouseMove,
      children: [
        /* @__PURE__ */ jsxs2(
          "div",
          {
            ref: progressBarRef,
            onMouseDown: handleProgressBarMouseDown,
            onClick: handleProgressBarClick,
            style: {
              width: "100%",
              height: "8px",
              background: "rgba(255, 255, 255, 0.3)",
              borderRadius: "4px",
              cursor: "pointer",
              marginBottom: "12px",
              position: "relative"
            },
            children: [
              /* @__PURE__ */ jsx2(
                "div",
                {
                  style: {
                    position: "absolute",
                    top: 0,
                    left: 0,
                    height: "100%",
                    width: `${progressPercent}%`,
                    background: "#ff0000",
                    borderRadius: "4px",
                    transition: isScrubbing ? "none" : "width 0.1s linear"
                  }
                }
              ),
              /* @__PURE__ */ jsx2(
                "div",
                {
                  style: {
                    position: "absolute",
                    top: "50%",
                    left: `${progressPercent}%`,
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    background: "#ff0000",
                    transform: "translate(-50%, -50%)",
                    transition: isScrubbing ? "none" : "left 0.1s linear"
                  }
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ jsxs2(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "12px",
              color: "#fff",
              fontFamily: "monospace",
              fontSize: "14px"
            },
            children: [
              /* @__PURE__ */ jsx2(
                "button",
                {
                  onClick: onPlayPause,
                  style: {
                    background: "rgba(255, 255, 255, 0.2)",
                    border: "none",
                    color: "#fff",
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    transition: "background 0.2s"
                  },
                  onMouseEnter: (e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
                  },
                  onMouseLeave: (e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                  },
                  title: isAtEnd ? "Restart" : isPlaying ? "Pause" : "Play",
                  children: isAtEnd ? "\u21BB" : isPlaying ? "\u23F8" : "\u25B6"
                }
              ),
              hasStarted && !isAtEnd && /* @__PURE__ */ jsx2(
                "button",
                {
                  onClick: onRestart,
                  style: {
                    background: "rgba(255, 255, 255, 0.2)",
                    border: "none",
                    color: "#fff",
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    transition: "background 0.2s"
                  },
                  onMouseEnter: (e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
                  },
                  onMouseLeave: (e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                  },
                  title: "Return to beginning",
                  children: "\u23EE"
                }
              ),
              /* @__PURE__ */ jsx2(
                "button",
                {
                  onClick: onRewindByte,
                  disabled: currentBytes <= 0,
                  style: {
                    background: "rgba(255, 255, 255, 0.2)",
                    border: "none",
                    color: currentBytes <= 0 ? "rgba(255, 255, 255, 0.5)" : "#fff",
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    cursor: currentBytes <= 0 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    transition: "background 0.2s"
                  },
                  onMouseEnter: (e) => {
                    if (currentBytes > 0) {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
                    }
                  },
                  onMouseLeave: (e) => {
                    if (currentBytes > 0) {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                    }
                  },
                  title: "Rewind one byte",
                  children: "\u2039\u2039"
                }
              ),
              /* @__PURE__ */ jsx2(
                "button",
                {
                  onClick: onAdvanceByte,
                  disabled: currentBytes >= totalBytes,
                  style: {
                    background: "rgba(255, 255, 255, 0.2)",
                    border: "none",
                    color: currentBytes >= totalBytes ? "rgba(255, 255, 255, 0.5)" : "#fff",
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    cursor: currentBytes >= totalBytes ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    transition: "background 0.2s"
                  },
                  onMouseEnter: (e) => {
                    if (currentBytes < totalBytes) {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
                    }
                  },
                  onMouseLeave: (e) => {
                    if (currentBytes < totalBytes) {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                    }
                  },
                  title: "Advance one byte",
                  children: "\u203A\u203A"
                }
              ),
              /* @__PURE__ */ jsxs2(
                "div",
                {
                  style: {
                    minWidth: "120px",
                    textAlign: "left"
                  },
                  children: [
                    formatTime(currentTime),
                    " / ",
                    formatTime(totalTime)
                  ]
                }
              ),
              /* @__PURE__ */ jsx2("div", { style: { flex: 1 } }),
              /* @__PURE__ */ jsxs2("div", { style: { position: "relative" }, ref: speedMenuRef, children: [
                /* @__PURE__ */ jsx2(
                  "button",
                  {
                    onClick: () => setIsSpeedMenuOpen(!isSpeedMenuOpen),
                    style: {
                      background: "rgba(255, 255, 255, 0.2)",
                      border: "none",
                      color: "#fff",
                      padding: "8px 12px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontFamily: "monospace",
                      fontSize: "13px",
                      transition: "background 0.2s",
                      minWidth: "110px",
                      textAlign: "left"
                    },
                    onMouseEnter: (e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
                    },
                    onMouseLeave: (e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                    },
                    children: currentSpeedLabel
                  }
                ),
                isSpeedMenuOpen && /* @__PURE__ */ jsx2(
                  "div",
                  {
                    style: {
                      position: "absolute",
                      bottom: "100%",
                      right: 0,
                      marginBottom: "8px",
                      background: "rgba(0, 0, 0, 0.95)",
                      border: "1px solid rgba(255, 255, 255, 0.3)",
                      borderRadius: "4px",
                      overflow: "hidden",
                      minWidth: "140px",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)"
                    },
                    children: SPEED_PRESETS.map((preset) => /* @__PURE__ */ jsx2(
                      "button",
                      {
                        onClick: () => handleSpeedSelect(preset.value),
                        style: {
                          width: "100%",
                          background: preset.value === currentSpeed ? "rgba(255, 255, 255, 0.2)" : "transparent",
                          border: "none",
                          color: "#fff",
                          padding: "10px 16px",
                          textAlign: "left",
                          cursor: "pointer",
                          fontFamily: "monospace",
                          fontSize: "13px",
                          transition: "background 0.15s"
                        },
                        onMouseEnter: (e) => {
                          if (preset.value !== currentSpeed) {
                            e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                          }
                        },
                        onMouseLeave: (e) => {
                          if (preset.value !== currentSpeed) {
                            e.currentTarget.style.background = "transparent";
                          }
                        },
                        children: preset.label
                      },
                      preset.value
                    ))
                  }
                )
              ] })
            ]
          }
        )
      ]
    }
  );
}

// src/utils/performanceOverlay.ts
function drawPerformanceOverlay(ctx, stats, font) {
  const {
    actualFps,
    targetFps,
    renderTime,
    drawTime,
    virtualColumns,
    virtualRows,
    viewColumns,
    viewRows,
    viewX,
    viewY
  } = stats;
  const lines = [
    `FPS: ${actualFps.toFixed(1)} / ${targetFps}`,
    `Render: ${renderTime.toFixed(2)}ms`,
    `Draw: ${drawTime.toFixed(2)}ms`,
    `World: ${virtualColumns ?? viewColumns}x${virtualRows ?? viewRows}`,
    `View: ${viewColumns}x${viewRows} @ (${viewX},${viewY})`
  ];
  const charWidth = font.width;
  const charHeight = font.height;
  const padding = 8;
  const lineHeight = 14;
  ctx.font = "12px monospace";
  const maxTextWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
  const overlayWidth = maxTextWidth + padding * 2;
  const overlayHeight = lines.length * lineHeight + padding * 2;
  const overlayX = viewColumns * charWidth - overlayWidth - 10;
  const overlayY = viewRows * charHeight - overlayHeight - 10;
  ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
  ctx.fillRect(overlayX, overlayY, overlayWidth, overlayHeight);
  ctx.strokeStyle = "rgba(85, 85, 85, 0.9)";
  ctx.lineWidth = 1;
  ctx.strokeRect(overlayX, overlayY, overlayWidth, overlayHeight);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "12px monospace";
  ctx.textBaseline = "top";
  lines.forEach((line, i) => {
    ctx.fillText(line, overlayX + padding, overlayY + padding + i * lineHeight);
  });
}

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
var AnsiVirtualDisplayEngine = class {
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
        const currentBytes = this.getCurrentBytePosition();
        const totalBytes = this.getTotalBytes();
        if (totalBytes > 0 && currentBytes >= totalBytes) {
          this.pause();
          return;
        }
        this.currentFrame++;
        this._generateAndRender();
      }
      this.animationFrameId = requestAnimationFrame(this._animate);
    };
    this.canvas = canvas;
    this.config = { ...config };
    this.showPerformanceOverlay = config.showPerformanceOverlay ?? false;
    this.targetFps = config.fps;
    this.isPlaying = !config.startPaused;
    this._setupCanvas();
    if (this.isPlaying) {
      this._startAnimation();
    }
    this._generateAndRender();
  }
  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    const generator = this.config.frameGenerator;
    if (generator && typeof generator.clearManualBytePosition === "function") {
      this._syncFrameToBytePosition(generator);
      generator.clearManualBytePosition();
      this._generateAndRender();
    }
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
    const generator = this.config.frameGenerator;
    if (generator && typeof generator.clearManualBytePosition === "function") {
      generator.clearManualBytePosition();
    }
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
    const needsCanvasResize = config.columns !== void 0 || config.rows !== void 0;
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
  getCurrentBytePosition() {
    const generator = this.config.frameGenerator;
    if (generator && typeof generator.getCurrentBytePosition === "function") {
      return generator.getCurrentBytePosition();
    }
    if (generator && typeof generator.getCurrentSpeed === "function") {
      const bytesPerSecond = generator.getCurrentSpeed();
      const elapsedSeconds = this.currentFrame / this.config.fps;
      const totalBytes = this.getTotalBytes();
      return Math.min(Math.floor(elapsedSeconds * bytesPerSecond), totalBytes);
    }
    return 0;
  }
  getTotalBytes() {
    const generator = this.config.frameGenerator;
    if (generator && generator.capabilities && typeof generator.capabilities.getTotalBytes === "function") {
      return generator.capabilities.getTotalBytes();
    }
    return 0;
  }
  seekToBytePosition(bytePosition) {
    const generator = this.config.frameGenerator;
    if (generator && typeof generator.getCurrentSpeed === "function") {
      const bytesPerSecond = generator.getCurrentSpeed();
      if (bytesPerSecond > 0) {
        const targetSeconds = bytePosition / bytesPerSecond;
        const targetFrame = Math.floor(targetSeconds * this.config.fps);
        this.seekToFrame(targetFrame);
      }
    }
  }
  enablePerformanceOverlay(enabled) {
    this.showPerformanceOverlay = enabled;
    this._generateAndRender();
  }
  destroy() {
    this._stopAnimation();
  }
  seekToFrame(frame) {
    this.currentFrame = Math.max(0, frame);
    this._generateAndRender();
  }
  setSpeed(bytesPerSecond) {
    const generator = this.config.frameGenerator;
    if (generator && typeof generator.setSpeed === "function") {
      generator.setSpeed(bytesPerSecond);
    }
  }
  advanceByte() {
    const generator = this.config.frameGenerator;
    if (generator && typeof generator.advanceByte === "function") {
      generator.advanceByte();
      this._syncFrameToBytePosition(generator);
      this._generateAndRender();
    }
  }
  rewindByte() {
    const generator = this.config.frameGenerator;
    if (generator && typeof generator.rewindByte === "function") {
      generator.rewindByte();
      this._syncFrameToBytePosition(generator);
      this._generateAndRender();
    }
  }
  getMaxFrames() {
    const generator = this.config.frameGenerator;
    if (generator && generator.capabilities && typeof generator.capabilities.getTotalFrames === "function") {
      return generator.capabilities.getTotalFrames();
    }
    return 0;
  }
  getCurrentTime() {
    return this.currentFrame / this.config.fps;
  }
  getTotalTime() {
    const maxFrames = this.getMaxFrames();
    return maxFrames > 0 ? maxFrames / this.config.fps : 0;
  }
  getCurrentBytesPerSecond() {
    const generator = this.config.frameGenerator;
    if (generator && typeof generator.getCurrentSpeed === "function") {
      return generator.getCurrentSpeed();
    }
    return 0;
  }
  getGeneratorCapabilities() {
    const generator = this.config.frameGenerator;
    return generator?.capabilities || null;
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
  _syncFrameToBytePosition(generator) {
    if (generator && typeof generator.getCurrentBytePosition === "function" && typeof generator.getCurrentSpeed === "function") {
      const currentBytePos = generator.getCurrentBytePosition();
      const bytesPerSecond = generator.getCurrentSpeed();
      if (bytesPerSecond > 0) {
        this.currentFrame = Math.floor(currentBytePos / bytesPerSecond * this.config.fps);
      }
    }
  }
  _generateAndRender() {
    const renderStart = performance.now();
    const generator = this.config.frameGenerator;
    const viewY = this.config.viewY ?? 0;
    const cellViewY = Math.floor(viewY);
    const requestedRows = this.config.rows;
    if ("generator" in generator && "converter" in generator) {
      const pixelGen = generator;
      const frameData = pixelGen.generator(this.currentFrame, this.config.columns, requestedRows);
      this.screen = pixelGen.converter(frameData, this.config.columns, requestedRows);
    } else {
      const charGen = generator;
      this.screen = charGen(this.currentFrame, this.config.columns, requestedRows);
    }
    this.lastRenderedViewY = cellViewY;
    this.renderTime = performance.now() - renderStart;
    this._render();
  }
  _setupCanvas() {
    if (!this.canvas || !this.bitmapFont) return;
    const charWidth = this.bitmapFont.width;
    const charHeight = this.bitmapFont.height;
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
    if (!this.screen || !this.bitmapFont) return;
    const drawStart = performance.now();
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const screenRows = this.screen.lines.length;
    const screenCols = this.screen.columns;
    const charWidth = this.bitmapFont.width;
    const charHeight = this.bitmapFont.height;
    const cssWidth = screenCols * charWidth;
    const cssHeight = screenRows * charHeight;
    const dpr = typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
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
    const visibleHeight = this.config.rows * charHeight;
    ctx.fillStyle = this.config.background;
    ctx.fillRect(0, 0, cssWidth, visibleHeight);
    ctx.drawImage(
      this.offscreenCanvas,
      0,
      pixelOffsetY,
      // source Y with pixel offset (no buffer offset)
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
    this.drawTime = performance.now() - drawStart;
    this.previousDrawTime = this.drawTime;
    if (this.showPerformanceOverlay && this.bitmapFont) {
      const stats = {
        actualFps: this.actualFps,
        targetFps: this.targetFps,
        renderTime: this.renderTime,
        drawTime: this.previousDrawTime,
        virtualColumns: this.config.virtualColumns,
        virtualRows: this.config.virtualRows,
        viewColumns: this.config.columns,
        viewRows: this.config.rows,
        viewX: this.config.viewX ?? 0,
        viewY: this.config.viewY ?? 0
      };
      drawPerformanceOverlay(ctx, stats, this.bitmapFont);
    }
  }
};

// src/font/bitmapFontLoader.ts
async function loadBitmapFontFromUrl(bitmapFontUrl) {
  try {
    const fontResult = await extractFontFromFON(bitmapFontUrl);
    if (fontResult) {
      const { bitmapData, width, height } = fontResult;
      const bytesPerGlyph = height;
      const glyphs = [];
      for (let i = 0; i < 256; i++) {
        glyphs.push(bitmapData.slice(i * bytesPerGlyph, (i + 1) * bytesPerGlyph));
      }
      return { width, height, glyphs, rawBitmapData: bitmapData };
    } else {
      const font = await loadRawBitmapFont(bitmapFontUrl, 8, 16);
      return font;
    }
  } catch (e) {
    console.warn("Failed to load bitmap font:", e);
    return null;
  }
}

// src/AnsiVirtualDisplay.tsx
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
function AnsiVirtualDisplay({
  columns = 80,
  rows = 25,
  frameGenerator,
  fps = 30,
  background = "#000",
  bitmapFont: providedBitmapFont,
  bitmapFontUrl,
  showControls = false,
  showOverlayControls = false,
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
  const canvasRef = useRef3(null);
  const engineRef = useRef3(null);
  const [bitmapFont, setBitmapFont] = useState3(providedBitmapFont || null);
  const [isPlaying, setIsPlaying] = useState3(false);
  const [isOverlayVisible, setIsOverlayVisible] = useState3(false);
  const [currentBytes, setCurrentBytes] = useState3(0);
  const [totalBytes, setTotalBytes] = useState3(0);
  const [currentSpeed, setCurrentSpeed] = useState3(960);
  const hideTimeoutRef = useRef3(null);
  const effectiveFrameGenerator = useMemo2(() => {
    return frameGenerator;
  }, [frameGenerator]);
  const generatorCapabilities = useMemo2(() => {
    if ("capabilities" in frameGenerator && frameGenerator.capabilities) {
      return frameGenerator.capabilities;
    }
    return null;
  }, [frameGenerator]);
  const supportsOverlayControls = showOverlayControls && generatorCapabilities !== null && (generatorCapabilities.supportsSeek || generatorCapabilities.supportsSpeedControl);
  useEffect3(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!engineRef.current) {
      const shouldStartPaused = supportsOverlayControls;
      engineRef.current = new AnsiVirtualDisplayEngine(canvas, {
        columns,
        rows,
        frameGenerator: effectiveFrameGenerator,
        fps,
        background,
        showPerformanceOverlay,
        virtualColumns,
        virtualRows,
        viewX,
        viewY,
        pixelOffsetX,
        pixelOffsetY,
        startPaused: shouldStartPaused
        // Start paused if overlay controls enabled
      });
      setIsPlaying(!shouldStartPaused);
      if (shouldStartPaused) {
        setIsOverlayVisible(true);
      }
    }
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);
  useEffect3(() => {
    if (!engineRef.current) return;
    engineRef.current.updateConfig({
      columns,
      rows,
      frameGenerator: effectiveFrameGenerator,
      fps,
      background,
      showPerformanceOverlay,
      virtualColumns,
      virtualRows,
      viewX,
      viewY,
      pixelOffsetX,
      pixelOffsetY
    });
    if (supportsOverlayControls) {
      const bytes = engineRef.current.getTotalBytes();
      if (bytes) setTotalBytes(bytes);
      const speed = engineRef.current.getCurrentBytesPerSecond();
      if (speed) setCurrentSpeed(speed);
    }
  }, [
    columns,
    rows,
    effectiveFrameGenerator,
    fps,
    background,
    showPerformanceOverlay,
    virtualColumns,
    virtualRows,
    viewX,
    viewY,
    pixelOffsetX,
    pixelOffsetY,
    supportsOverlayControls
  ]);
  useEffect3(() => {
    if (!engineRef.current) return;
    engineRef.current.setBitmapFont(bitmapFont);
  }, [bitmapFont]);
  useEffect3(() => {
    if (providedBitmapFont) {
      setBitmapFont(providedBitmapFont);
      return;
    }
    if (!bitmapFontUrl) {
      setBitmapFont(null);
      return;
    }
    let cancelled = false;
    async function loadFont() {
      const font = await loadBitmapFontFromUrl(bitmapFontUrl);
      if (!cancelled) setBitmapFont(font);
    }
    loadFont();
    return () => {
      cancelled = true;
    };
  }, [providedBitmapFont, bitmapFontUrl]);
  const handlePlayPause = () => {
    if (!engineRef.current) return;
    if (isPlaying) {
      engineRef.current.pause();
      setIsPlaying(false);
    } else {
      const currentBytePos = engineRef.current.getCurrentBytePosition();
      const totalByteSize = engineRef.current.getTotalBytes();
      if (totalByteSize > 0 && currentBytePos >= totalByteSize) {
        engineRef.current.restart();
      } else {
        engineRef.current.play();
      }
      setIsPlaying(true);
    }
  };
  const handleRestart = () => {
    if (!engineRef.current) return;
    engineRef.current.restart();
    setCurrentBytes(0);
    setIsPlaying(true);
  };
  const handleMouseMove = useCallback3(() => {
    if (!showOverlayControls) return;
    setIsOverlayVisible(true);
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    if (isPlaying) {
      hideTimeoutRef.current = setTimeout(() => {
        setIsOverlayVisible(false);
      }, 3e3);
    }
  }, [showOverlayControls, isPlaying]);
  const handleMouseLeave = useCallback3(() => {
    if (!showOverlayControls) return;
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    if (isPlaying) {
      setIsOverlayVisible(false);
    }
  }, [showOverlayControls, isPlaying]);
  const handleSeek = useCallback3((bytePosition) => {
    if (!engineRef.current) return;
    engineRef.current.seekToBytePosition(bytePosition);
    setCurrentBytes(bytePosition);
  }, []);
  const handleSpeedChange = useCallback3((bytesPerSecond) => {
    if (!engineRef.current) return;
    engineRef.current.setSpeed(bytesPerSecond);
    setCurrentSpeed(bytesPerSecond);
  }, []);
  const handleAdvanceByte = useCallback3(() => {
    if (!engineRef.current) return;
    engineRef.current.advanceByte();
    setCurrentBytes(engineRef.current.getCurrentBytePosition());
  }, []);
  const handleRewindByte = useCallback3(() => {
    if (!engineRef.current) return;
    engineRef.current.rewindByte();
    setCurrentBytes(engineRef.current.getCurrentBytePosition());
  }, []);
  useEffect3(() => {
    if (!supportsOverlayControls || !isPlaying) return;
    const intervalId = setInterval(() => {
      if (engineRef.current) {
        const bytes = engineRef.current.getCurrentBytePosition();
        const total = engineRef.current.getTotalBytes();
        if (total > 0 && bytes >= total) {
          engineRef.current.pause();
          setIsPlaying(false);
          setCurrentBytes(total);
        } else {
          setCurrentBytes(bytes);
        }
      }
    }, 100);
    return () => clearInterval(intervalId);
  }, [supportsOverlayControls, isPlaying]);
  useEffect3(() => {
    if (engineRef.current) {
      setCurrentBytes(engineRef.current.getCurrentBytePosition());
      const speed = engineRef.current.getCurrentBytesPerSecond();
      if (speed) setCurrentSpeed(speed);
    }
  }, [isPlaying]);
  useEffect3(() => {
    if (engineRef.current && supportsOverlayControls) {
      const speed = engineRef.current.getCurrentBytesPerSecond();
      if (speed) setCurrentSpeed(speed);
      const bytes = engineRef.current.getTotalBytes();
      if (bytes) setTotalBytes(bytes);
    }
  }, [supportsOverlayControls, frameGenerator]);
  useEffect3(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);
  const rootStyle = useMemo2(() => {
    return {
      display: "block",
      width: fillContainer ? "100%" : "fit-content",
      background
    };
  }, [fillContainer, background]);
  return /* @__PURE__ */ jsxs3("div", { children: [
    showControls && !supportsOverlayControls && /* @__PURE__ */ jsxs3(
      "div",
      {
        style: {
          display: "flex",
          gap: "8px",
          marginBottom: "8px",
          alignItems: "center"
        },
        children: [
          /* @__PURE__ */ jsx3(
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
          /* @__PURE__ */ jsx3(
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
    /* @__PURE__ */ jsxs3(
      "div",
      {
        style: {
          position: "relative",
          display: "inline-block",
          width: fillContainer ? "100%" : "fit-content"
        },
        onMouseMove: handleMouseMove,
        onMouseLeave: handleMouseLeave,
        children: [
          /* @__PURE__ */ jsx3("canvas", { ref: canvasRef, style: rootStyle, "aria-label": "ANSI Virtual Display" }),
          supportsOverlayControls && /* @__PURE__ */ jsx3(
            AnsiPlayerOverlay,
            {
              isPlaying,
              currentBytes,
              totalBytes,
              currentSpeed,
              isVisible: isOverlayVisible,
              onPlayPause: handlePlayPause,
              onRestart: handleRestart,
              onSeek: handleSeek,
              onSpeedChange: handleSpeedChange,
              onAdvanceByte: handleAdvanceByte,
              onRewindByte: handleRewindByte,
              onMouseMove: handleMouseMove
            }
          ),
          supportsOverlayControls && isOverlayVisible && typeof window !== "undefined" && /* @__PURE__ */ jsxs3(
            "div",
            {
              style: {
                position: "absolute",
                top: 0,
                left: 0,
                background: "rgba(0, 0, 0, 0.8)",
                color: "#0f0",
                padding: "4px 8px",
                fontSize: "10px",
                fontFamily: "monospace",
                pointerEvents: "none"
              },
              children: [
                "Bytes: ",
                currentBytes,
                " / ",
                totalBytes,
                " | Speed: ",
                currentSpeed,
                " bytes/sec"
              ]
            }
          )
        ]
      }
    )
  ] });
}

// src/generators/ansiFrameGenerator.ts
function createEmptyRow(columns) {
  return Array(columns).fill(null).map(() => ({
    ch: " ",
    fg: 7,
    bg: 0,
    bold: false
  }));
}
function createAnsiFrameGenerator(options) {
  const {
    ansiData,
    mode,
    columns,
    rows: displayRows,
    bytesPerSecond: initialBytesPerSecond = 960,
    // Default: 9600 baud = 960 bytes/sec (baud/10 conversion)
    fps = 30,
    // Default: 30 fps
    onDimensionsChange,
    onScrollChange,
    debugCursorCodes = false
  } = options;
  let currentBytesPerSecond = initialBytesPerSecond;
  if (mode === "final") {
    let cachedScreen = null;
    if (columns !== void 0) {
      cachedScreen = parseAnsi(ansiData, columns);
    } else {
      cachedScreen = parseAnsiDynamic(ansiData);
      if (onDimensionsChange) {
        onDimensionsChange({
          columns: cachedScreen.columns,
          rows: cachedScreen.lines.length
        });
      }
    }
    const generator2 = ((frame, cols, requestedRows) => {
      if (columns !== void 0) {
        const actualContent = cachedScreen.lines;
        const paddedLines = [];
        for (let i = 0; i < actualContent.length; i++) {
          paddedLines.push(actualContent[i]);
        }
        while (paddedLines.length < requestedRows) {
          paddedLines.push(createEmptyRow(columns));
        }
        return {
          lines: paddedLines,
          columns: cachedScreen.columns
        };
      }
      return cachedScreen;
    });
    generator2.capabilities = {
      supportsSeek: false,
      supportsSpeedControl: false
    };
    return generator2;
  }
  let lastFrame = -1;
  let lastNotifiedColumns = 0;
  let lastNotifiedRows = 0;
  let lastNotifiedViewY = 0;
  const generator = ((frame, cols, rows) => {
    if (frame < lastFrame) {
      lastNotifiedColumns = 0;
      lastNotifiedRows = 0;
      lastNotifiedViewY = 0;
    }
    lastFrame = frame;
    const elapsedSeconds = frame / fps;
    const targetByteIndex = Math.min(
      Math.floor(elapsedSeconds * currentBytesPerSecond),
      ansiData.length
    );
    let screen;
    if (columns !== void 0) {
      screen = parseAnsiIncremental(ansiData, columns, targetByteIndex);
      if (displayRows !== void 0) {
        const contentRows = screen.lines.length;
        const viewY = Math.max(0, contentRows - displayRows);
        if (onScrollChange && viewY !== lastNotifiedViewY) {
          onScrollChange({
            viewY,
            contentRows
          });
          lastNotifiedViewY = viewY;
        }
        const windowStart = viewY;
        const windowEnd = Math.min(windowStart + displayRows, contentRows);
        const windowedLines = screen.lines.slice(windowStart, windowEnd);
        screen.lines = [...windowedLines];
        while (screen.lines.length < rows) {
          screen.lines.push(createEmptyRow(columns));
        }
      }
    } else {
      screen = parseAnsiIncrementalDynamic(ansiData, targetByteIndex);
      if (onDimensionsChange) {
        const currentColumns = screen.columns;
        const currentRows = screen.lines.length;
        if (currentColumns !== lastNotifiedColumns || currentRows !== lastNotifiedRows) {
          onDimensionsChange({
            columns: currentColumns,
            rows: currentRows
          });
          lastNotifiedColumns = currentColumns;
          lastNotifiedRows = currentRows;
        }
      }
    }
    return screen;
  });
  generator.capabilities = {
    supportsSeek: true,
    supportsSpeedControl: true,
    getTotalBytes: () => ansiData.length,
    getTotalFrames: () => Math.ceil(ansiData.length / currentBytesPerSecond * fps)
  };
  generator.setSpeed = (bytesPerSecond) => {
    currentBytesPerSecond = bytesPerSecond;
  };
  generator.getCurrentSpeed = () => {
    return currentBytesPerSecond;
  };
  return generator;
}
function createAnsiArtFrameGenerator(options) {
  const {
    ansiData,
    mode,
    viewscreen,
    columns,
    rows,
    dynamicColumns,
    bytesPerSecond = 960,
    // Default: 9600 baud = 960 bytes/sec
    fps = 30,
    onDimensionsChange,
    onScrollChange,
    debugCursorCodes = false
  } = options;
  if (viewscreen === "fixed" && !columns) {
    return null;
  }
  const effectiveColumns = viewscreen === "fixed" ? columns : viewscreen === "dynamic" && mode === "final" ? dynamicColumns : void 0;
  return createAnsiFrameGenerator({
    ansiData,
    mode,
    columns: effectiveColumns,
    rows,
    bytesPerSecond,
    fps,
    onDimensionsChange,
    onScrollChange,
    debugCursorCodes
  });
}

// src/AnsiArtNG.tsx
import { jsx as jsx4 } from "react/jsx-runtime";
function AnsiArtNG({
  src,
  mode = "final",
  viewscreen = "fixed",
  columns,
  rows = 25,
  background = "#000",
  bitmapFontUrl,
  showControls = false,
  showOverlayControls = false,
  showPerformanceOverlay = false,
  fps = 30,
  bytesPerSecond = 960,
  // Default: 9600 baud (960 bytes/sec after conversion from baud/10)
  allowDrop = true,
  debugCursorCodes = false
}) {
  const [ansiData, setAnsiData] = useState4(null);
  const [error, setError] = useState4(null);
  const [isDragging, setIsDragging] = useState4(false);
  const [fileName, setFileName] = useState4(null);
  const [dynamicColumns, setDynamicColumns] = useState4(80);
  const [dynamicRows, setDynamicRows] = useState4(25);
  const [scrollViewY, setScrollViewY] = useState4(0);
  const [virtualRows, setVirtualRows] = useState4(25);
  const frameGeneratorRef = useRef4(null);
  useEffect4(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setScrollViewY(0);
      setVirtualRows(rows);
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`Failed to fetch ${src}: ${res.status}`);
        const buf = new Uint8Array(await res.arrayBuffer());
        if (!cancelled) {
          setAnsiData(buf);
          setFileName(null);
        }
      } catch (e) {
        if (!cancelled) setError(String(e?.message || e));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [src, rows]);
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
      setAnsiData(buf);
      setFileName(file.name);
    } catch (err) {
      setError(String(err?.message || err));
    }
  };
  useEffect4(() => {
    if (viewscreen === "dynamic" && mode === "final" && ansiData) {
      try {
        const screen = parseAnsiDynamic(ansiData);
        setDynamicColumns(screen.columns);
        setDynamicRows(screen.lines.length);
      } catch (e) {
        setError(String(e?.message || e));
      }
    } else if (viewscreen === "dynamic" && mode === "animated") {
      setDynamicColumns(80);
      setDynamicRows(25);
    }
  }, [viewscreen, mode, ansiData]);
  const handleDimensionsChange = useCallback4(
    (dimensions) => {
      if (viewscreen === "dynamic" && mode === "animated") {
        setDynamicColumns(dimensions.columns);
        setDynamicRows(dimensions.rows);
      }
    },
    [viewscreen, mode]
  );
  const handleScrollChange = useCallback4(
    (scroll) => {
      if (viewscreen === "fixed" && mode === "animated") {
        const newVirtualRows = Math.max(rows, scroll.contentRows);
        setScrollViewY(scroll.viewY);
        setVirtualRows(newVirtualRows);
      }
    },
    [viewscreen, mode, rows]
  );
  const frameGenerator = useMemo3(() => {
    if (!ansiData) return null;
    if (viewscreen === "fixed" && !columns) {
      setError('columns is required when viewscreen is "fixed"');
      return null;
    }
    const generator = createAnsiArtFrameGenerator({
      ansiData,
      mode,
      viewscreen,
      columns,
      rows,
      dynamicColumns,
      bytesPerSecond,
      fps,
      onDimensionsChange: handleDimensionsChange,
      onScrollChange: handleScrollChange,
      debugCursorCodes
    });
    frameGeneratorRef.current = generator;
    return generator;
  }, [
    ansiData,
    mode,
    viewscreen,
    columns,
    rows,
    dynamicColumns,
    bytesPerSecond,
    fps,
    handleDimensionsChange,
    handleScrollChange,
    debugCursorCodes
  ]);
  const displayColumns = useMemo3(() => {
    if (viewscreen === "fixed") {
      return columns;
    } else {
      if (mode === "final") {
        return dynamicColumns;
      } else {
        return dynamicColumns;
      }
    }
  }, [viewscreen, mode, columns, dynamicColumns]);
  const displayRows = useMemo3(() => {
    if (viewscreen === "fixed") {
      return rows;
    } else {
      if (mode === "final") {
        return dynamicRows;
      } else {
        return dynamicRows;
      }
    }
  }, [viewscreen, mode, rows, dynamicRows]);
  const rootStyle = useMemo3(
    () => ({
      ...isDragging ? { outline: "2px dashed #888", outlineOffset: "-2px" } : {}
    }),
    [isDragging]
  );
  if (error) {
    return /* @__PURE__ */ jsx4(
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
  }
  if (!ansiData || !frameGenerator) {
    return /* @__PURE__ */ jsx4(
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
  }
  return /* @__PURE__ */ jsx4(
    "div",
    {
      style: rootStyle,
      onDragEnter,
      onDragOver,
      onDragLeave,
      onDrop,
      children: /* @__PURE__ */ jsx4(
        AnsiVirtualDisplay,
        {
          columns: displayColumns,
          rows: displayRows,
          frameGenerator,
          fps,
          background,
          bitmapFontUrl,
          showControls,
          showOverlayControls,
          showPerformanceOverlay
        }
      )
    }
  );
}

// src/PlasmaBackgroundLayout.tsx
import { useCallback as useCallback5, useEffect as useEffect5, useMemo as useMemo4, useRef as useRef5, useState as useState5 } from "react";

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
  const charCount = chars.length;
  const time = frame * timeScale;
  const perm = generatePermutation(seed);
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
  const charCount = chars.length;
  const time = frame * timeScale;
  const perm = generatePermutation(seed);
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
        perm
      ) * octave.amplitude;
    }
    const clampedValue = value < -1 ? -1 : value > 1 ? 1 : value;
    const charIndex = (clampedValue + 1) * 127.5 | 0;
    const ch = charLookup[charIndex];
    return { ch, fg: fgColor, bg: bgColor, bold: false };
  };
}

// src/PlasmaBackgroundLayout.tsx
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
function PlasmaBackgroundLayout({
  children,
  mode = "fixed",
  contentClassName,
  contentStyle,
  plasmaClassName,
  virtualWidthPx,
  virtualHeightPx,
  chars,
  timeScale,
  octaves,
  seed,
  fgColor,
  bgColor,
  showPerformanceOverlay = false,
  fps = 30,
  bitmapFontUrl
}) {
  const containerRef = useRef5(null);
  const scrollableRef = useRef5(null);
  const [viewportBounds, setViewportBounds] = useState5({ top: 0, height: 0 });
  const [viewportSize, setViewportSize] = useState5({ width: 0, height: 0 });
  const [containerHeight, setContainerHeight] = useState5(0);
  const [scrollTop, setScrollTop] = useState5(0);
  const [maxScrollTop, setMaxScrollTop] = useState5(0);
  const [isMounted, setIsMounted] = useState5(false);
  const [bitmapFont, setBitmapFont] = useState5(null);
  useEffect5(() => {
    if (!bitmapFontUrl) {
      setBitmapFont(null);
      return;
    }
    let cancelled = false;
    async function loadFont() {
      const font = await loadBitmapFontFromUrl(bitmapFontUrl);
      if (!cancelled) setBitmapFont(font);
    }
    loadFont();
    return () => {
      cancelled = true;
    };
  }, [bitmapFontUrl]);
  useEffect5(() => {
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
  useEffect5(() => {
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
  const mergedOptions = useMemo4(() => {
    const options = {};
    if (chars) options.chars = chars;
    if (timeScale !== void 0) options.timeScale = timeScale;
    if (octaves) options.octaves = octaves;
    if (seed !== void 0) options.seed = seed;
    if (fgColor) options.fgColor = fgColor;
    if (bgColor) options.bgColor = bgColor;
    return options;
  }, [chars, timeScale, octaves, seed, fgColor, bgColor]);
  const fixedFrameGenerator = useCallback5(
    (frame, columns, rows) => {
      return generateAsciiPerlinPlasmaFrame(frame, columns, rows, mergedOptions);
    },
    [mergedOptions]
  );
  const viewYRef = useRef5(0);
  const scrollableFrameGenerator = useCallback5(
    (frame, reqColumns, reqRows) => {
      const sampler = createAsciiPerlinPlasmaSampler(frame, mergedOptions);
      const lines = [];
      const currentViewY = viewYRef.current;
      const rowsToRender = reqRows + 1;
      for (let y = 0; y < rowsToRender; y++) {
        const line = [];
        for (let x = 0; x < reqColumns; x++) {
          const cell = sampler(x, currentViewY + y);
          line.push(cell);
        }
        lines.push(line);
      }
      return { lines, columns: reqColumns };
    },
    [mergedOptions]
  );
  const cellWidthPx = bitmapFont?.width || 8;
  const cellHeightPx = bitmapFont?.height || 16;
  if (mode === "fixed") {
    return /* @__PURE__ */ jsxs4(
      "div",
      {
        ref: containerRef,
        style: {
          position: "relative",
          minHeight: "100vh",
          width: "100%"
        },
        children: [
          /* @__PURE__ */ jsx5(
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
                const columns = Math.max(1, Math.ceil(viewportSize.width / cellWidthPx));
                const rows = Math.max(1, Math.ceil(viewportSize.height / cellHeightPx));
                if (!bitmapFont) return null;
                return /* @__PURE__ */ jsx5(
                  AnsiVirtualDisplay,
                  {
                    columns,
                    rows,
                    fillContainer: true,
                    bitmapFont,
                    frameGenerator: fixedFrameGenerator,
                    fps,
                    background: bgColor || "#000",
                    showPerformanceOverlay
                  }
                );
              })()
            }
          ),
          /* @__PURE__ */ jsx5(
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
    return /* @__PURE__ */ jsx5(
      "div",
      {
        ref: containerRef,
        style: {
          position: "relative",
          width: "100%",
          minHeight: "100vh"
        },
        children: /* @__PURE__ */ jsx5(
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
  viewYRef.current = viewY;
  const pixelOffsetY = scrollTop % cellHeightPx;
  return /* @__PURE__ */ jsxs4(
    "div",
    {
      ref: containerRef,
      style: {
        position: "relative",
        width: "100%",
        minHeight: "100vh"
      },
      children: [
        /* @__PURE__ */ jsx5(
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
            children: bitmapFont && /* @__PURE__ */ jsx5(
              AnsiVirtualDisplay,
              {
                columns: visibleColumns,
                rows: visibleRows,
                fillContainer: true,
                bitmapFont,
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
            )
          }
        ),
        /* @__PURE__ */ jsx5(
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
import { useEffect as useEffect6, useMemo as useMemo5, useRef as useRef6, useState as useState6 } from "react";
import { jsx as jsx6, jsxs as jsxs5 } from "react/jsx-runtime";
function FontCharacterChart({ bitmapFontUrl }) {
  const [bitmapFont, setBitmapFont] = useState6(null);
  const [loading, setLoading] = useState6(true);
  const [error, setError] = useState6(null);
  const [sorted, setSorted] = useState6(false);
  const canvasRefs = useRef6(/* @__PURE__ */ new Map());
  useEffect6(() => {
    let cancelled = false;
    async function loadFont() {
      setLoading(true);
      setError(null);
      try {
        const fontResult = await extractFontFromFON(bitmapFontUrl);
        if (fontResult) {
          const { bitmapData, width, height } = fontResult;
          const bytesPerGlyph = height;
          const glyphs = [];
          for (let i = 0; i < 256; i++) {
            glyphs.push(bitmapData.slice(i * bytesPerGlyph, (i + 1) * bytesPerGlyph));
          }
          if (!cancelled) {
            setBitmapFont({ width, height, glyphs, rawBitmapData: bitmapData });
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
  const characterInfo = useMemo5(() => {
    if (!bitmapFont) return [];
    const info = [];
    for (let charCode = 32; charCode <= 255; charCode++) {
      const character = cp437ByteToChar(charCode);
      const darkness = calculateDarkness(bitmapFont, charCode);
      info.push({ charCode, character, darkness });
    }
    return info;
  }, [bitmapFont]);
  const displayedCharacters = useMemo5(() => {
    if (!sorted) return characterInfo;
    return [...characterInfo].sort((a, b) => b.darkness - a.darkness);
  }, [characterInfo, sorted]);
  useEffect6(() => {
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
    return /* @__PURE__ */ jsx6("div", { children: "Loading font..." });
  }
  if (error) {
    return /* @__PURE__ */ jsxs5("div", { children: [
      "Error: ",
      error
    ] });
  }
  if (!bitmapFont) {
    return /* @__PURE__ */ jsx6("div", { children: "No font loaded" });
  }
  return /* @__PURE__ */ jsxs5("div", { style: { padding: "20px" }, children: [
    /* @__PURE__ */ jsx6("div", { style: { marginBottom: "20px" }, children: /* @__PURE__ */ jsx6("button", { onClick: () => setSorted(!sorted), children: sorted ? "Show Original Order" : "Sort by Darkness (Darkest to Lightest)" }) }),
    /* @__PURE__ */ jsx6(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
          gap: "10px"
        },
        children: displayedCharacters.map(({ charCode, character, darkness }) => /* @__PURE__ */ jsxs5(
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
              /* @__PURE__ */ jsx6(
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
              /* @__PURE__ */ jsxs5("div", { style: { marginTop: "8px", fontSize: "12px", color: "#888" }, children: [
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
export {
  ANSI_COLORS_RGB,
  AnsiArt,
  AnsiArtNG,
  AnsiPlayerOverlay,
  AnsiVirtualDisplay,
  FontCharacterChart,
  PlasmaBackgroundLayout,
  convertFrameDataToAnsi,
  createAnsiArtFrameGenerator,
  createAnsiFrameGenerator,
  createAsciiPerlinPlasmaSampler,
  detectAnimation,
  drawPerformanceOverlay,
  extractFontFromFON,
  generateAsciiPerlinPlasmaFrame,
  generateEvenlySpacedPalette,
  getPalette,
  getSauceInfo,
  loadBitmapFontFromUrl,
  loadRawBitmapFont,
  parseAscii,
  parseSauce,
  renderGlyph,
  renderText,
  rgbToAnsiColor,
  rgbToPaletteColor
};
//# sourceMappingURL=index.js.map