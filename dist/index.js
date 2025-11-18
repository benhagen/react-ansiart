// src/components/AnsiArt.tsx
import { useCallback as useCallback3, useEffect as useEffect4, useMemo as useMemo2, useRef as useRef4, useState as useState3 } from "react";

// src/utils/cp437.ts
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
function decodeCp437(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += cp437ByteToChar(bytes[i]);
  }
  return out;
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

// src/utils/sauce.ts
var SAUCE_ID_S = 83;
var SAUCE_ID_A = 65;
var SAUCE_ID_U = 85;
var SAUCE_ID_C = 67;
var SAUCE_ID_E = 69;
var SAUCE_TRAILER_SIZE = 128;
var SAUCE_EOF = 26;
var COMMENT_ID_C = 67;
var COMMENT_ID_O = 79;
var COMMENT_ID_M = 77;
var COMMENT_ID_N = 78;
var COMMENT_ID_T = 84;
var COMMENT_SIZE = 64;
var COMMENT_ID_SIZE = 5;
function isSauceTrailer(bytes) {
  if (bytes.length < SAUCE_TRAILER_SIZE + 1) return false;
  const offWithEof = bytes.length - SAUCE_TRAILER_SIZE - 1;
  const offWithoutEof = bytes.length - SAUCE_TRAILER_SIZE;
  if (bytes[offWithEof] === SAUCE_EOF) {
    return bytes[offWithEof + 1] === SAUCE_ID_S && bytes[offWithEof + 2] === SAUCE_ID_A && bytes[offWithEof + 3] === SAUCE_ID_U && bytes[offWithEof + 4] === SAUCE_ID_C && bytes[offWithEof + 5] === SAUCE_ID_E;
  }
  return bytes[offWithoutEof] === SAUCE_ID_S && bytes[offWithoutEof + 1] === SAUCE_ID_A && bytes[offWithoutEof + 2] === SAUCE_ID_U && bytes[offWithoutEof + 3] === SAUCE_ID_C && bytes[offWithoutEof + 4] === SAUCE_ID_E;
}
function parseSauce(bytes) {
  if (bytes.length < SAUCE_TRAILER_SIZE + 1) return void 0;
  let saucePos = bytes.length - SAUCE_TRAILER_SIZE;
  let hasEof = false;
  if (bytes.length >= SAUCE_TRAILER_SIZE + 1) {
    const eofPos = bytes.length - SAUCE_TRAILER_SIZE - 1;
    if (bytes[eofPos] === SAUCE_EOF) {
      hasEof = true;
      saucePos = eofPos + 1;
    }
  }
  if (bytes[saucePos] !== SAUCE_ID_S || bytes[saucePos + 1] !== SAUCE_ID_A || bytes[saucePos + 2] !== SAUCE_ID_U || bytes[saucePos + 3] !== SAUCE_ID_C || bytes[saucePos + 4] !== SAUCE_ID_E) {
    return void 0;
  }
  const dataView = new DataView(bytes.buffer, bytes.byteOffset + saucePos);
  function readString(offset, length) {
    const charCodes = [];
    for (let i = 0; i < length; i++) {
      const byte = bytes[saucePos + offset + i];
      charCodes.push(byte);
    }
    return String.fromCharCode(...charCodes).replace(/\0+$/, "").trimEnd();
  }
  const id = readString(0, 5);
  const version = bytes[saucePos + 5];
  const title = readString(7, 35);
  const author = readString(42, 20);
  const group = readString(62, 20);
  const date = readString(82, 8);
  const fileSize = dataView.getUint32(89, true);
  const dataType = bytes[saucePos + 93];
  const fileType = bytes[saucePos + 94];
  const tInfo1 = dataView.getUint16(95, true);
  const tInfo2 = dataView.getUint16(97, true);
  const tInfo3 = dataView.getUint16(99, true);
  const tInfo4 = dataView.getUint16(101, true);
  const numComments = bytes[saucePos + 103];
  const tFlags = bytes[saucePos + 104];
  const tInfoSBytes = new Uint8Array(bytes.buffer, bytes.byteOffset + saucePos + 105, 22);
  let tInfoSEnd = 22;
  for (let i = 0; i < 22; i++) {
    if (tInfoSBytes[i] === 0) {
      tInfoSEnd = i;
      break;
    }
  }
  const tInfoS = String.fromCharCode(...Array.from(tInfoSBytes.slice(0, tInfoSEnd)));
  const commentLines = [];
  if (numComments > 0) {
    const commentStart = saucePos - numComments * COMMENT_SIZE - COMMENT_ID_SIZE;
    if (commentStart >= 0) {
      if (bytes[commentStart] === COMMENT_ID_C && bytes[commentStart + 1] === COMMENT_ID_O && bytes[commentStart + 2] === COMMENT_ID_M && bytes[commentStart + 3] === COMMENT_ID_N && bytes[commentStart + 4] === COMMENT_ID_T) {
        for (let i = 0; i < numComments && i < 255; i++) {
          const commentOffset = commentStart + COMMENT_ID_SIZE + i * COMMENT_SIZE;
          if (commentOffset + COMMENT_SIZE > bytes.length) break;
          const comment = readString(commentOffset - saucePos, COMMENT_SIZE);
          if (comment) {
            commentLines.push(comment);
          }
        }
      }
    }
  }
  let actualFileSize = bytes.length - SAUCE_TRAILER_SIZE;
  if (numComments > 0) {
    actualFileSize -= COMMENT_ID_SIZE + numComments * COMMENT_SIZE;
  }
  if (hasEof) {
    actualFileSize -= 1;
  }
  return {
    id,
    version,
    title,
    author,
    group,
    date,
    fileSize: actualFileSize,
    dataType,
    fileType,
    tInfo1,
    tInfo2,
    tInfo3,
    tInfo4,
    comments: numComments,
    tFlags,
    tInfoS: tInfoS || void 0,
    commentLines
  };
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

// src/ansi/parser.ts
var ESC = 27;
var CSI_BRACKET = 91;
var SOFT_EOF = 26;
var LF = 10;
var CR = 13;
var DIGIT_MIN = 48;
var DIGIT_MAX = 57;
var PARAMETER_BYTE_MIN = 48;
var PARAMETER_BYTE_MAX = 63;
var SEMICOLON = 59;
var SPACE = 32;
var QUESTION_MARK = 63;
var MAX_CSI_PARAMS = 256;
var ANSI_RESET = 0;
var ANSI_BOLD = 1;
var ANSI_BOLD_OFF = 22;
var ANSI_REVERSE_VIDEO = 7;
var ANSI_REVERSE_VIDEO_OFF = 27;
var ANSI_BLINK_OFF = 25;
var ANSI_FG_DEFAULT = 39;
var ANSI_BG_DEFAULT = 49;
var ANSI_FG_BASE_MIN = 30;
var ANSI_FG_BASE_MAX = 37;
var ANSI_BG_BASE_MIN = 40;
var ANSI_BG_BASE_MAX = 47;
var ANSI_FG_BRIGHT_MIN = 90;
var ANSI_FG_BRIGHT_MAX = 97;
var ANSI_BG_BRIGHT_MIN = 100;
var ANSI_BG_BRIGHT_MAX = 107;
var ANSI_TO_DOS = [0, 4, 2, 6, 1, 5, 3, 7];
var DEFAULT_FG = 7;
var DEFAULT_BG = 0;
var DEFAULT_COLUMNS = 80;
var CSI_CMD_CURSOR_UP = "A";
var CSI_CMD_CURSOR_DOWN = "B";
var CSI_CMD_CURSOR_FORWARD = "C";
var CSI_CMD_CURSOR_BACK = "D";
var CSI_CMD_CURSOR_NEXT_LINE = "E";
var CSI_CMD_CURSOR_PREV_LINE = "F";
var CSI_CMD_CURSOR_HORIZONTAL_ABS = "G";
var CSI_CMD_CURSOR_POSITION = "H";
var CSI_CMD_CURSOR_POSITION_ALT = "f";
var CSI_CMD_CURSOR_SAVE = "s";
var CSI_CMD_CURSOR_RESTORE = "u";
var CSI_CMD_ERASE_LINE = "K";
var CSI_CMD_ERASE_DISPLAY = "J";
var CSI_CMD_SCROLL_UP = "S";
var CSI_CMD_SCROLL_DOWN = "T";
var CSI_CMD_SGR = "m";
var CSI_CMD_ICE_COLOR = "t";
var CSI_CMD_SET_MODE = "h";
var CSI_CMD_RESET_MODE = "l";
var MODE_LINE_WRAP = 7;
var MODE_ICE_COLORS = 33;
var LETTER_UPPER_MIN = 65;
var LETTER_UPPER_MAX = 90;
var LETTER_LOWER_MIN = 97;
var LETTER_LOWER_MAX = 122;
var VALID_CSI_COMMANDS = "ABCDEFGHIJKLMPSTXYZhfmlrmsu";
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
var DEFAULT_CELL = createCell(DEFAULT_FG, DEFAULT_BG, false);
function createEmptyLine(columns) {
  return Array.from({ length: columns }, () => ({ ...DEFAULT_CELL }));
}
function parseCsiParams(csiParamBytes) {
  if (csiParamBytes.length === 0) return [];
  const params = [];
  let currentParam = 0;
  let hasValue = false;
  for (let i = 0; i < csiParamBytes.length; i++) {
    const byte = csiParamBytes[i];
    if (byte === SPACE || byte === QUESTION_MARK) continue;
    if (byte === SEMICOLON) {
      params.push(hasValue ? currentParam : NaN);
      currentParam = 0;
      hasValue = false;
      continue;
    }
    if (byte >= DIGIT_MIN && byte <= DIGIT_MAX) {
      currentParam = currentParam * 10 + (byte - DIGIT_MIN);
      hasValue = true;
    } else {
      if (hasValue) {
        params.push(currentParam);
        currentParam = 0;
        hasValue = false;
      }
    }
  }
  if (hasValue) {
    params.push(currentParam);
  }
  return params;
}
function ensureRow(lines, row, columns, fg, bg, bold) {
  while (lines.length <= row) {
    lines.push(createEmptyLine(columns));
  }
}
function clearLine(line, from, to, fg, bg, bold) {
  const start = Math.max(0, from);
  const end = Math.min(line.length - 1, to);
  for (let c = start; c <= end; c++) {
    line[c] = createCell(fg, bg, bold);
  }
}
function isLetter(byte) {
  return byte >= LETTER_UPPER_MIN && byte <= LETTER_UPPER_MAX || byte >= LETTER_LOWER_MIN && byte <= LETTER_LOWER_MAX;
}
function isValidCsiCommand(ch) {
  return VALID_CSI_COMMANDS.includes(ch);
}
function applySGR(params, state) {
  if (params.length === 0) params = [ANSI_RESET];
  for (const p of params) {
    if (p === ANSI_RESET) {
      state.fg = DEFAULT_FG;
      state.bg = DEFAULT_BG;
      state.bold = false;
      continue;
    }
    if (p === ANSI_BOLD) {
      state.bold = true;
      continue;
    }
    if (p === ANSI_BOLD_OFF) {
      state.bold = false;
      continue;
    }
    if (p === ANSI_FG_DEFAULT) {
      state.fg = DEFAULT_FG;
      continue;
    }
    if (p === ANSI_BG_DEFAULT) {
      state.bg = DEFAULT_BG;
      continue;
    }
    if (p === ANSI_REVERSE_VIDEO) {
      const tempFg = state.fg;
      const tempBg = state.bg;
      state.fg = tempBg;
      state.bg = tempFg;
      continue;
    }
    if (p === ANSI_REVERSE_VIDEO_OFF) {
      state.fg = DEFAULT_FG;
      state.bg = DEFAULT_BG;
      continue;
    }
    if (p === ANSI_BLINK_OFF) {
      continue;
    }
    if (p >= ANSI_FG_BASE_MIN && p <= ANSI_FG_BASE_MAX) {
      state.fg = ANSI_TO_DOS[p - ANSI_FG_BASE_MIN];
      continue;
    }
    if (p >= ANSI_BG_BASE_MIN && p <= ANSI_BG_BASE_MAX) {
      state.bg = ANSI_TO_DOS[p - ANSI_BG_BASE_MIN];
      continue;
    }
    if (p >= ANSI_FG_BRIGHT_MIN && p <= ANSI_FG_BRIGHT_MAX) {
      state.fg = 8 + ANSI_TO_DOS[p - ANSI_FG_BRIGHT_MIN];
      continue;
    }
    if (p >= ANSI_BG_BRIGHT_MIN && p <= ANSI_BG_BRIGHT_MAX) {
      state.bg = 8 + ANSI_TO_DOS[p - ANSI_BG_BRIGHT_MIN];
      continue;
    }
  }
}
function handleCursorSave(ctx) {
  if (ctx.params.length === 0) {
    ctx.state.savedCur.row = ctx.state.cur.row;
    ctx.state.savedCur.col = ctx.state.cur.col;
  }
}
function handleCursorRestore(ctx) {
  if (ctx.params.length === 0) {
    ctx.state.cur.row = ctx.state.savedCur.row;
    ctx.state.cur.col = ctx.state.savedCur.col;
    ctx.ensureRow();
  }
}
function handleCursorPosition(ctx) {
  const r = Math.max(1, ctx.get(0, 1)) - 1;
  const c = Math.max(1, ctx.get(1, 1)) - 1;
  ctx.state.cur.row = r;
  if (ctx.state.isDynamic) {
    ctx.state.cur.col = Math.max(0, c);
    if (ctx.state.maxCol !== void 0 && ctx.state.cur.col > ctx.state.maxCol) {
      ctx.state.maxCol = ctx.state.cur.col;
    }
  } else {
    ctx.state.cur.col = Math.max(0, Math.min(ctx.columns - 1, c));
  }
  ctx.ensureRow();
}
function handleCursorUp(ctx) {
  const n = Math.max(1, ctx.get(0, 1));
  ctx.state.cur.row = Math.max(0, ctx.state.cur.row - n);
}
function handleCursorDown(ctx) {
  const n = Math.max(1, ctx.get(0, 1));
  ctx.state.cur.row = ctx.state.cur.row + n;
  ctx.ensureRow();
}
function handleCursorForward(ctx) {
  const n = Math.max(1, ctx.get(0, 1));
  if (ctx.state.isDynamic) {
    ctx.state.cur.col = ctx.state.cur.col + n;
    if (ctx.state.maxCol !== void 0 && ctx.state.cur.col > ctx.state.maxCol) {
      ctx.state.maxCol = ctx.state.cur.col;
    }
  } else {
    ctx.state.cur.col = Math.min(ctx.columns - 1, ctx.state.cur.col + n);
  }
}
function handleCursorBack(ctx) {
  const n = Math.max(1, ctx.get(0, 1));
  ctx.state.cur.col = Math.max(0, ctx.state.cur.col - n);
}
function handleCursorHorizontalAbsolute(ctx) {
  const c = Math.max(1, ctx.get(0, 1)) - 1;
  if (ctx.state.isDynamic) {
    ctx.state.cur.col = Math.max(0, c);
    if (ctx.state.maxCol !== void 0 && ctx.state.cur.col > ctx.state.maxCol) {
      ctx.state.maxCol = ctx.state.cur.col;
    }
  } else {
    ctx.state.cur.col = Math.max(0, Math.min(ctx.columns - 1, c));
  }
}
function handleCursorNextLine(ctx) {
  const n = Math.max(1, ctx.get(0, 1));
  ctx.state.cur.row += n;
  ctx.state.cur.col = 0;
  ctx.ensureRow();
}
function handleCursorPrevLine(ctx) {
  const n = Math.max(1, ctx.get(0, 1));
  ctx.state.cur.row = Math.max(0, ctx.state.cur.row - n);
  ctx.state.cur.col = 0;
}
function handleSGR(ctx) {
  applySGR(
    ctx.params.filter((p) => !Number.isNaN(p)),
    ctx.state
  );
}
function handleIceColors(ctx) {
  if (ctx.params.length >= 4) {
    const mode = ctx.get(0, 0);
    const r = Math.min(255, Math.max(0, ctx.get(1, 0)));
    const g = Math.min(255, Math.max(0, ctx.get(2, 0)));
    const b = Math.min(255, Math.max(0, ctx.get(3, 0)));
    const rgbColor = `rgb(${r}, ${g}, ${b})`;
    if (mode === 0) {
      ctx.state.bg = rgbColor;
    } else if (mode === 1) {
      ctx.state.fg = rgbColor;
    }
  }
}
function handleEraseLine(ctx) {
  const mode = ctx.get(0, 0);
  ctx.ensureRow();
  if (ctx.state.isDynamic) {
    const line = ctx.state.lines[ctx.state.cur.row];
    if (mode === 0) {
      for (let c = ctx.state.cur.col; c < line.length; c++) {
        line[c] = createCell(ctx.state.fg, ctx.state.bg, ctx.state.bold);
      }
    } else if (mode === 1) {
      for (let c = 0; c <= ctx.state.cur.col; c++) {
        if (c < line.length) {
          line[c] = createCell(ctx.state.fg, ctx.state.bg, ctx.state.bold);
        }
      }
    } else if (mode === 2) {
      line.length = 0;
    }
  } else {
    if (mode === 0) {
      clearLine(
        ctx.state.lines[ctx.state.cur.row],
        ctx.state.cur.col,
        ctx.columns - 1,
        ctx.state.fg,
        ctx.state.bg,
        ctx.state.bold
      );
    } else if (mode === 1) {
      clearLine(
        ctx.state.lines[ctx.state.cur.row],
        0,
        ctx.state.cur.col,
        ctx.state.fg,
        ctx.state.bg,
        ctx.state.bold
      );
    } else if (mode === 2) {
      clearLine(
        ctx.state.lines[ctx.state.cur.row],
        0,
        ctx.columns - 1,
        ctx.state.fg,
        ctx.state.bg,
        ctx.state.bold
      );
    }
  }
}
function handleEraseDisplay(ctx) {
  const mode = ctx.get(0, 0);
  if (mode === 2) {
    ctx.state.lines.length = 0;
    if (ctx.state.isDynamic && ctx.state.maxCol !== void 0) {
      const newLine = [];
      for (let c = 0; c < Math.max(ctx.state.maxCol + 1, DEFAULT_COLUMNS); c++) {
        newLine.push(createCell(DEFAULT_FG, DEFAULT_BG, false));
      }
      ctx.state.lines.push(newLine);
      ctx.state.maxCol = 0;
    } else {
      ctx.state.lines.push(createEmptyLine(ctx.columns));
    }
    ctx.state.cur.row = 0;
    ctx.state.cur.col = 0;
  } else if (mode === 0 || mode === 1) {
    ctx.ensureRow();
    if (ctx.state.isDynamic) {
      if (mode === 0) {
        const line = ctx.state.lines[ctx.state.cur.row];
        for (let c = ctx.state.cur.col; c < line.length; c++) {
          line[c] = createCell(ctx.state.fg, ctx.state.bg, ctx.state.bold);
        }
        for (let r = ctx.state.cur.row + 1; r < ctx.state.lines.length; r++) {
          ctx.state.lines[r].length = 0;
        }
      } else {
        for (let r = 0; r < ctx.state.cur.row; r++) {
          ctx.state.lines[r].length = 0;
        }
        const line = ctx.state.lines[ctx.state.cur.row];
        for (let c = 0; c <= ctx.state.cur.col; c++) {
          if (c < line.length) {
            line[c] = createCell(ctx.state.fg, ctx.state.bg, ctx.state.bold);
          }
        }
      }
    } else {
      if (mode === 0) {
        clearLine(
          ctx.state.lines[ctx.state.cur.row],
          ctx.state.cur.col,
          ctx.columns - 1,
          ctx.state.fg,
          ctx.state.bg,
          ctx.state.bold
        );
        for (let r = ctx.state.cur.row + 1; r < ctx.state.lines.length; r++)
          clearLine(
            ctx.state.lines[r],
            0,
            ctx.columns - 1,
            ctx.state.fg,
            ctx.state.bg,
            ctx.state.bold
          );
      } else {
        for (let r = 0; r < ctx.state.cur.row; r++)
          clearLine(
            ctx.state.lines[r],
            0,
            ctx.columns - 1,
            ctx.state.fg,
            ctx.state.bg,
            ctx.state.bold
          );
        clearLine(
          ctx.state.lines[ctx.state.cur.row],
          0,
          ctx.state.cur.col,
          ctx.state.fg,
          ctx.state.bg,
          ctx.state.bold
        );
      }
    }
  }
}
function handleScrollUp(ctx) {
  const n = Math.max(1, ctx.get(0, 1));
  for (let scroll = 0; scroll < n; scroll++) {
    if (ctx.state.lines.length > 0) {
      ctx.state.lines.shift();
      if (ctx.state.isDynamic) {
        const colWidth = ctx.state.maxCol !== void 0 ? Math.max(ctx.state.maxCol + 1, DEFAULT_COLUMNS) : DEFAULT_COLUMNS;
        ctx.state.lines.push(createEmptyLine(colWidth));
      } else {
        ctx.state.lines.push(createEmptyLine(ctx.columns));
      }
    }
  }
}
function handleScrollDown(ctx) {
  const n = Math.max(1, ctx.get(0, 1));
  for (let scroll = 0; scroll < n; scroll++) {
    if (ctx.state.lines.length > 0) {
      ctx.state.lines.pop();
      if (ctx.state.isDynamic) {
        const colWidth = ctx.state.maxCol !== void 0 ? Math.max(ctx.state.maxCol + 1, DEFAULT_COLUMNS) : DEFAULT_COLUMNS;
        ctx.state.lines.unshift(createEmptyLine(colWidth));
      } else {
        ctx.state.lines.unshift(createEmptyLine(ctx.columns));
      }
    }
  }
}
function handleSetMode(ctx) {
  for (const param of ctx.params) {
    if (param === MODE_LINE_WRAP) {
      ctx.state.lineWrap = true;
    } else if (param === MODE_ICE_COLORS) {
      ctx.state.iceColors = true;
    }
  }
}
function handleResetMode(ctx) {
  for (const param of ctx.params) {
    if (param === MODE_LINE_WRAP) {
      ctx.state.lineWrap = false;
    } else if (param === MODE_ICE_COLORS) {
      ctx.state.iceColors = false;
    }
  }
}
var CSI_HANDLERS = {
  [CSI_CMD_CURSOR_SAVE]: handleCursorSave,
  [CSI_CMD_CURSOR_RESTORE]: handleCursorRestore,
  [CSI_CMD_CURSOR_POSITION]: handleCursorPosition,
  [CSI_CMD_CURSOR_POSITION_ALT]: handleCursorPosition,
  [CSI_CMD_CURSOR_UP]: handleCursorUp,
  [CSI_CMD_CURSOR_DOWN]: handleCursorDown,
  [CSI_CMD_CURSOR_FORWARD]: handleCursorForward,
  [CSI_CMD_CURSOR_BACK]: handleCursorBack,
  [CSI_CMD_CURSOR_HORIZONTAL_ABS]: handleCursorHorizontalAbsolute,
  [CSI_CMD_CURSOR_NEXT_LINE]: handleCursorNextLine,
  [CSI_CMD_CURSOR_PREV_LINE]: handleCursorPrevLine,
  [CSI_CMD_SGR]: handleSGR,
  [CSI_CMD_ICE_COLOR]: handleIceColors,
  [CSI_CMD_ERASE_LINE]: handleEraseLine,
  [CSI_CMD_ERASE_DISPLAY]: handleEraseDisplay,
  [CSI_CMD_SCROLL_UP]: handleScrollUp,
  [CSI_CMD_SCROLL_DOWN]: handleScrollDown,
  [CSI_CMD_SET_MODE]: handleSetMode,
  [CSI_CMD_RESET_MODE]: handleResetMode
};
function parseAnsiCore(bytesInput, options = {}) {
  const { columns, maxByteIndex, encoding = "cp437" } = options;
  const isDynamic = columns === void 0;
  const isIncremental = maxByteIndex !== void 0;
  let bytes = bytesInput;
  const sauce = parseSauce(bytesInput);
  if (isSauceTrailer(bytes)) {
    let stripSize = SAUCE_TRAILER_SIZE;
    const eofPos = bytes.length - SAUCE_TRAILER_SIZE - 1;
    if (eofPos >= 0 && bytes[eofPos] === SAUCE_EOF) {
      stripSize += 1;
    }
    if (sauce && sauce.comments > 0) {
      stripSize += COMMENT_ID_SIZE + sauce.comments * COMMENT_SIZE;
    }
    bytes = bytes.slice(0, bytes.length - stripSize);
  }
  const stopAt = isIncremental ? Math.min(maxByteIndex, bytes.length) : bytes.length;
  const state = {
    lines: [],
    cur: { row: 0, col: 0 },
    savedCur: { row: 0, col: 0 },
    fg: DEFAULT_FG,
    bg: DEFAULT_BG,
    bold: false,
    lineWrap: true,
    iceColors: false,
    columns,
    maxCol: isDynamic ? 0 : void 0,
    isDynamic
  };
  let i = 0;
  let parserState = "normal";
  let csiParams = [];
  const writeChar = (ch) => {
    if (ch === "") return;
    if (ch === "\n") {
      state.cur.row += 1;
      state.cur.col = 0;
      return;
    }
    if (ch === "\r") {
      return;
    }
    if (state.cur.col < 0) state.cur.col = 0;
    if (isDynamic) {
      while (state.lines.length <= state.cur.row) {
        state.lines.push([]);
      }
      while (state.lines[state.cur.row].length <= state.cur.col) {
        state.lines[state.cur.row].push(createCell(DEFAULT_FG, DEFAULT_BG, false));
      }
      state.lines[state.cur.row][state.cur.col] = {
        ch,
        fg: state.fg,
        bg: state.bg,
        bold: state.bold
      };
      state.cur.col += 1;
      if (state.maxCol !== void 0 && state.cur.col > state.maxCol) {
        state.maxCol = state.cur.col;
      }
    } else {
      ensureRow(state.lines, state.cur.row, columns, state.fg, state.bg, state.bold);
      if (state.cur.col >= 0 && state.cur.col < columns) {
        state.lines[state.cur.row][state.cur.col] = {
          ch,
          fg: state.fg,
          bg: state.bg,
          bold: state.bold
        };
      }
      state.cur.col += 1;
      if (state.cur.col > columns - 1) {
        if (state.lineWrap) {
          state.cur.row += 1;
          state.cur.col = 0;
        } else {
          state.cur.col = columns - 1;
        }
      }
    }
  };
  while (i < stopAt) {
    const b = bytes[i++];
    if (b === SOFT_EOF) break;
    switch (parserState) {
      case "normal": {
        if (b === ESC) {
          parserState = "esc";
          break;
        }
        writeChar(byteToChar(b, encoding));
        break;
      }
      case "esc": {
        if (b === CSI_BRACKET) {
          parserState = "csi";
          csiParams = [];
          break;
        }
        parserState = "normal";
        break;
      }
      case "csi": {
        const ch = String.fromCharCode(b);
        if (b >= PARAMETER_BYTE_MIN && b <= PARAMETER_BYTE_MAX || ch === " " || ch === "?") {
          if (csiParams.length < MAX_CSI_PARAMS) {
            csiParams.push(b);
          }
          break;
        }
        if (!isValidCsiCommand(ch)) {
          parserState = "normal";
          csiParams = [];
          break;
        }
        const params = parseCsiParams(csiParams);
        const get = (idx, def) => Number.isNaN(params[idx]) || params[idx] === void 0 ? def : params[idx];
        const handler = CSI_HANDLERS[ch];
        if (handler) {
          const ctx = {
            state,
            params,
            get,
            columns: columns || 0,
            ensureRow: () => {
              if (isDynamic) {
                while (state.lines.length <= state.cur.row) {
                  state.lines.push([]);
                }
              } else {
                ensureRow(state.lines, state.cur.row, columns, state.fg, state.bg, state.bold);
              }
            }
          };
          handler(ctx);
        }
        parserState = "normal";
        csiParams = [];
        break;
      }
    }
  }
  if (state.lines.length === 0) {
    if (isDynamic) {
      state.lines.push([]);
    } else {
      state.lines.push(createEmptyLine(columns));
    }
  }
  let finalColumns;
  if (isDynamic) {
    finalColumns = Math.max(1, state.maxCol || 0);
    for (let r = 0; r < state.lines.length; r++) {
      const line = state.lines[r];
      while (line.length < finalColumns) {
        line.push({ ...DEFAULT_CELL });
      }
    }
  } else {
    finalColumns = columns;
    for (let r = 0; r < state.lines.length; r++) {
      const line = state.lines[r];
      if (!line) {
        state.lines[r] = createEmptyLine(columns);
      } else {
        while (line.length < columns) {
          line.push({ ...DEFAULT_CELL });
        }
      }
    }
  }
  return { lines: state.lines, columns: finalColumns, sauce };
}
function parseAnsi(bytesInput, columns = DEFAULT_COLUMNS, encoding = "cp437") {
  return parseAnsiCore(bytesInput, { columns, encoding });
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
    if (b === ESC) {
      if (i < maxCheck && bytes[i] === CSI_BRACKET) {
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
function parseAscii(bytes, encoding = "cp437") {
  let bytesToParse = bytes;
  const sauce = parseSauce(bytes);
  if (isSauceTrailer(bytes)) {
    let stripSize = SAUCE_TRAILER_SIZE;
    const eofPos = bytes.length - SAUCE_TRAILER_SIZE - 1;
    if (eofPos >= 0 && bytes[eofPos] === SAUCE_EOF) {
      stripSize += 1;
    }
    if (sauce && sauce.comments > 0) {
      stripSize += COMMENT_ID_SIZE + sauce.comments * COMMENT_SIZE;
    }
    bytesToParse = bytes.slice(0, bytes.length - stripSize);
  }
  const lines = [];
  let currentLine = [];
  for (let i = 0; i < bytesToParse.length; i++) {
    const byte = bytesToParse[i];
    if (byte === LF || byte === CR) {
      if (currentLine.length > 0 || byte === LF) {
        lines.push([...currentLine]);
        currentLine = [];
      }
      if (byte === CR && i + 1 < bytes.length && bytes[i + 1] === LF) {
        i++;
      }
    } else if (byte === SOFT_EOF) {
      break;
    } else {
      const ch = byteToChar(byte, encoding);
      currentLine.push({ ch, fg: DEFAULT_FG, bg: DEFAULT_BG, bold: false });
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
      line.push({ ch: " ", fg: DEFAULT_FG, bg: DEFAULT_BG, bold: false });
    }
  }
  if (lines.length === 0) {
    lines.push(
      Array(maxWidth || DEFAULT_COLUMNS).fill(null).map(() => ({ ch: " ", fg: DEFAULT_FG, bg: DEFAULT_BG, bold: false }))
    );
  }
  return {
    lines,
    columns: maxWidth || DEFAULT_COLUMNS,
    sauce
  };
}

// src/components/AnsiVirtualDisplay.tsx
import { useCallback as useCallback2, useEffect as useEffect2, useMemo, useRef as useRef2, useState as useState2 } from "react";

// src/components/AnsiPlayerOverlay.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
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
  onMouseMove,
  sauce,
  onSauceClick
}) {
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const [scrubValue, setScrubValue] = useState(currentBytes);
  const progressBarRef = useRef(null);
  const speedMenuRef = useRef(null);
  useEffect(() => {
    if (!isScrubbing) {
      setScrubValue(currentBytes);
    }
  }, [currentBytes, isScrubbing]);
  useEffect(() => {
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
  const handleProgressBarClick = useCallback(
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
  const handleProgressBarMouseDown = useCallback(
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
  const handleSpeedSelect = useCallback(
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
  return /* @__PURE__ */ jsxs(
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
        /* @__PURE__ */ jsxs(
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
              /* @__PURE__ */ jsx(
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
              /* @__PURE__ */ jsx(
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
        /* @__PURE__ */ jsxs(
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
              /* @__PURE__ */ jsx(
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
              hasStarted && !isAtEnd && /* @__PURE__ */ jsx(
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
              /* @__PURE__ */ jsx(
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
              /* @__PURE__ */ jsx(
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
              /* @__PURE__ */ jsxs(
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
              /* @__PURE__ */ jsx("div", { style: { flex: 1 } }),
              sauce && onSauceClick && /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: onSauceClick,
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
                    fontSize: "10px",
                    fontWeight: "bold",
                    transition: "background 0.2s",
                    lineHeight: "1",
                    padding: 0
                  },
                  onMouseEnter: (e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
                  },
                  onMouseLeave: (e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                  },
                  title: "View SAUCE metadata",
                  children: "S"
                }
              ),
              /* @__PURE__ */ jsxs("div", { style: { position: "relative" }, ref: speedMenuRef, children: [
                /* @__PURE__ */ jsx(
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
                isSpeedMenuOpen && /* @__PURE__ */ jsx(
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
                    children: SPEED_PRESETS.map((preset) => /* @__PURE__ */ jsx(
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

// src/engines/AnsiVirtualDisplayEngine.ts
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
  _isFinalMode() {
    const generator = this.config.frameGenerator;
    return generator && generator.capabilities && generator.capabilities.supportsSeek === false;
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
    if (this._isFinalMode() && this.screen && this.screen.lines.length !== this.config.rows) {
      this.config.rows = this.screen.lines.length;
      this._setupCanvas();
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
        const fgColor = colorToCss(fg, "#AAAAAA");
        const bgColor = colorToCss(cell.bg, "#000000");
        const charCode = charToCp437Byte(cell.ch);
        renderGlyph(offCtx, this.bitmapFont, charCode, x, y, fgColor, bgColor);
      }
    }
    const pixelOffsetY = this.config.pixelOffsetY ?? 0;
    const isFinalMode = this._isFinalMode();
    const visibleHeight = isFinalMode ? screenRows * charHeight : this.config.rows * charHeight;
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

// src/font/fontCache.ts
var CACHE_PREFIX = "react-ansiart:font:";
var CACHE_VERSION = "1";
function getCachedFont(url) {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  try {
    const cacheKey = `${CACHE_PREFIX}${encodeURIComponent(url)}`;
    const cached = window.localStorage.getItem(cacheKey);
    if (!cached) {
      return null;
    }
    const data = JSON.parse(cached);
    if (data.version !== CACHE_VERSION) {
      window.localStorage.removeItem(cacheKey);
      return null;
    }
    const glyphs = data.glyphs.map((base64) => base64ToUint8Array(base64));
    const rawBitmapData = data.rawBitmapData ? base64ToUint8Array(data.rawBitmapData) : void 0;
    return {
      width: data.width,
      height: data.height,
      glyphs,
      rawBitmapData
      // Don't restore glyphCache - it's runtime-only
    };
  } catch (e) {
    console.warn("[fontCache] Failed to read cached font:", e);
    return null;
  }
}
function setCachedFont(url, font) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    const cacheKey = `${CACHE_PREFIX}${encodeURIComponent(url)}`;
    const glyphsBase64 = font.glyphs.map((glyph) => uint8ArrayToBase64(glyph));
    const rawBitmapDataBase64 = font.rawBitmapData ? uint8ArrayToBase64(font.rawBitmapData) : void 0;
    const data = {
      glyphs: glyphsBase64,
      rawBitmapData: rawBitmapDataBase64,
      width: font.width,
      height: font.height,
      version: CACHE_VERSION
    };
    window.localStorage.setItem(cacheKey, JSON.stringify(data));
  } catch (e) {
    if (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED") {
      console.warn("[fontCache] localStorage quota exceeded, cannot cache font");
    } else {
      console.warn("[fontCache] Failed to cache font:", e);
    }
  }
}
function clearFontCache(url) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    if (url) {
      const cacheKey = `${CACHE_PREFIX}${encodeURIComponent(url)}`;
      window.localStorage.removeItem(cacheKey);
    } else {
      const keysToRemove = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => window.localStorage.removeItem(key));
    }
  } catch (e) {
    console.warn("[fontCache] Failed to clear cache:", e);
  }
}
function uint8ArrayToBase64(bytes) {
  if (typeof btoa !== "undefined") {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  throw new Error("btoa not available - cannot serialize font data");
}
function base64ToUint8Array(base64) {
  if (typeof atob !== "undefined") {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  throw new Error("atob not available - cannot deserialize font data");
}

// src/font/bitmapFontLoader.ts
async function loadBitmapFontFromUrl(bitmapFontUrl) {
  const cached = getCachedFont(bitmapFontUrl);
  if (cached) {
    console.log("[bitmapFontLoader] Using cached font for:", bitmapFontUrl);
    return cached;
  }
  try {
    const fontResult = await extractFontFromFON(bitmapFontUrl);
    if (fontResult) {
      const { bitmapData, width, height } = fontResult;
      const bytesPerGlyph = height;
      const glyphs = [];
      for (let i = 0; i < 256; i++) {
        glyphs.push(bitmapData.slice(i * bytesPerGlyph, (i + 1) * bytesPerGlyph));
      }
      const font = { width, height, glyphs, rawBitmapData: bitmapData };
      setCachedFont(bitmapFontUrl, font);
      return font;
    } else {
      const font = await loadRawBitmapFont(bitmapFontUrl, 8, 16);
      if (font) {
        setCachedFont(bitmapFontUrl, font);
      }
      return font;
    }
  } catch (e) {
    console.warn("Failed to load bitmap font:", e);
    return null;
  }
}

// src/components/AnsiVirtualDisplay.tsx
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
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
  onViewChange,
  sauce,
  onSauceClick,
  autoStart
}) {
  const canvasRef = useRef2(null);
  const engineRef = useRef2(null);
  const previousFrameGeneratorRef = useRef2(null);
  const [bitmapFont, setBitmapFont] = useState2(providedBitmapFont || null);
  const [isPlaying, setIsPlaying] = useState2(false);
  const [isOverlayVisible, setIsOverlayVisible] = useState2(false);
  const [currentBytes, setCurrentBytes] = useState2(0);
  const [totalBytes, setTotalBytes] = useState2(0);
  const [currentSpeed, setCurrentSpeed] = useState2(960);
  const hideTimeoutRef = useRef2(null);
  const effectiveFrameGenerator = useMemo(() => {
    return frameGenerator;
  }, [frameGenerator]);
  const generatorCapabilities = useMemo(() => {
    if ("capabilities" in frameGenerator && frameGenerator.capabilities) {
      return frameGenerator.capabilities;
    }
    return null;
  }, [frameGenerator]);
  const supportsOverlayControls = showOverlayControls && generatorCapabilities !== null && (generatorCapabilities.supportsSeek || generatorCapabilities.supportsSpeedControl);
  useEffect2(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!engineRef.current) {
      const shouldStartPaused = autoStart === false ? true : autoStart === true ? false : supportsOverlayControls;
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
      });
      previousFrameGeneratorRef.current = effectiveFrameGenerator;
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
  useEffect2(() => {
    if (!engineRef.current) return;
    const previousFrameGenerator = previousFrameGeneratorRef.current;
    const frameGeneratorChanged = effectiveFrameGenerator !== previousFrameGenerator;
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
    if (frameGeneratorChanged && previousFrameGenerator !== null && autoStart !== false) {
      engineRef.current.restart();
      if (!engineRef.current.getPlayingState()) {
        engineRef.current.play();
        setIsPlaying(true);
      }
    }
    previousFrameGeneratorRef.current = effectiveFrameGenerator;
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
    supportsOverlayControls,
    autoStart
  ]);
  useEffect2(() => {
    if (!engineRef.current) return;
    engineRef.current.setBitmapFont(bitmapFont);
  }, [bitmapFont]);
  useEffect2(() => {
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
  const handleMouseMove = useCallback2(() => {
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
  const handleMouseLeave = useCallback2(() => {
    if (!showOverlayControls) return;
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    if (isPlaying) {
      setIsOverlayVisible(false);
    }
  }, [showOverlayControls, isPlaying]);
  const handleSeek = useCallback2((bytePosition) => {
    if (!engineRef.current) return;
    engineRef.current.seekToBytePosition(bytePosition);
    setCurrentBytes(bytePosition);
  }, []);
  const handleSpeedChange = useCallback2((bytesPerSecond) => {
    if (!engineRef.current) return;
    engineRef.current.setSpeed(bytesPerSecond);
    setCurrentSpeed(bytesPerSecond);
  }, []);
  const handleAdvanceByte = useCallback2(() => {
    if (!engineRef.current) return;
    engineRef.current.advanceByte();
    setCurrentBytes(engineRef.current.getCurrentBytePosition());
  }, []);
  const handleRewindByte = useCallback2(() => {
    if (!engineRef.current) return;
    engineRef.current.rewindByte();
    setCurrentBytes(engineRef.current.getCurrentBytePosition());
  }, []);
  useEffect2(() => {
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
  useEffect2(() => {
    if (engineRef.current) {
      setCurrentBytes(engineRef.current.getCurrentBytePosition());
      const speed = engineRef.current.getCurrentBytesPerSecond();
      if (speed) setCurrentSpeed(speed);
    }
  }, [isPlaying]);
  useEffect2(() => {
    if (engineRef.current && supportsOverlayControls) {
      const speed = engineRef.current.getCurrentBytesPerSecond();
      if (speed) setCurrentSpeed(speed);
      const bytes = engineRef.current.getTotalBytes();
      if (bytes) setTotalBytes(bytes);
    }
  }, [supportsOverlayControls, frameGenerator]);
  useEffect2(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);
  const rootStyle = useMemo(() => {
    return {
      display: "block",
      width: fillContainer ? "100%" : "fit-content",
      background
    };
  }, [fillContainer, background]);
  return /* @__PURE__ */ jsxs2("div", { children: [
    showControls && !supportsOverlayControls && /* @__PURE__ */ jsxs2(
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
    /* @__PURE__ */ jsxs2(
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
          /* @__PURE__ */ jsx2("canvas", { ref: canvasRef, style: rootStyle, "aria-label": "ANSI Virtual Display" }),
          supportsOverlayControls && /* @__PURE__ */ jsx2(
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
              onMouseMove: handleMouseMove,
              sauce,
              onSauceClick
            }
          ),
          supportsOverlayControls && isOverlayVisible && typeof window !== "undefined" && /* @__PURE__ */ jsxs2(
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
    finalHeightForCanvas,
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
      cachedScreen = parseAnsiCore(ansiData, { columns });
    } else {
      cachedScreen = parseAnsiCore(ansiData);
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
      screen = parseAnsiCore(ansiData, { columns, maxByteIndex: targetByteIndex });
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
        while (screen.lines.length < displayRows) {
          screen.lines.push(createEmptyRow(columns));
        }
      } else if (displayRows === void 0 && finalHeightForCanvas !== void 0) {
        while (screen.lines.length < finalHeightForCanvas) {
          screen.lines.push(createEmptyRow(columns));
        }
      }
    } else {
      screen = parseAnsiCore(ansiData, { maxByteIndex: targetByteIndex });
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
    columns,
    rows,
    finalHeightForAnimated,
    bytesPerSecond = 960,
    // Default: 9600 baud = 960 bytes/sec
    fps = 30,
    onDimensionsChange,
    onScrollChange,
    debugCursorCodes = false
  } = options;
  return createAnsiFrameGenerator({
    ansiData,
    mode,
    columns,
    rows,
    finalHeightForCanvas: finalHeightForAnimated,
    bytesPerSecond,
    fps,
    onDimensionsChange,
    onScrollChange,
    debugCursorCodes
  });
}

// src/components/SauceMetadataModal.tsx
import { useEffect as useEffect3, useRef as useRef3 } from "react";
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
function SauceMetadataModal({ sauce, isOpen, onClose }) {
  const modalRef = useRef3(null);
  useEffect3(() => {
    if (!isOpen) return;
    function handleEscape(e) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);
  useEffect3(() => {
    if (!isOpen) return;
    function handleClickOutside(e) {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);
  if (!isOpen) return null;
  const sauceInfo = getSauceInfo(sauce);
  return /* @__PURE__ */ jsx3(
    "div",
    {
      style: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1e4
      },
      children: /* @__PURE__ */ jsxs3(
        "div",
        {
          ref: modalRef,
          style: {
            background: "#1a1a1a",
            border: "1px solid #444",
            borderRadius: "8px",
            padding: "24px",
            maxWidth: "600px",
            maxHeight: "80vh",
            overflow: "auto",
            color: "#fff",
            fontFamily: "monospace",
            fontSize: "13px",
            lineHeight: "1.6",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)"
          },
          children: [
            /* @__PURE__ */ jsxs3(
              "div",
              {
                style: {
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "20px",
                  paddingBottom: "12px",
                  borderBottom: "1px solid #444"
                },
                children: [
                  /* @__PURE__ */ jsx3(
                    "h2",
                    {
                      style: {
                        margin: 0,
                        fontSize: "18px",
                        fontWeight: "bold",
                        color: "#fff"
                      },
                      children: "SAUCE Metadata"
                    }
                  ),
                  /* @__PURE__ */ jsx3(
                    "button",
                    {
                      onClick: onClose,
                      style: {
                        background: "rgba(255, 255, 255, 0.1)",
                        border: "1px solid #555",
                        color: "#fff",
                        width: "32px",
                        height: "32px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "18px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "background 0.2s"
                      },
                      onMouseEnter: (e) => {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                      },
                      onMouseLeave: (e) => {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                      },
                      title: "Close",
                      children: "\xD7"
                    }
                  )
                ]
              }
            ),
            /* @__PURE__ */ jsxs3("div", { style: { display: "flex", flexDirection: "column", gap: "16px" }, children: [
              sauce.title && /* @__PURE__ */ jsxs3("div", { children: [
                /* @__PURE__ */ jsx3("div", { style: { color: "#888", marginBottom: "4px" }, children: "Title:" }),
                /* @__PURE__ */ jsx3("div", { style: { color: "#fff" }, children: sauce.title })
              ] }),
              sauce.author && /* @__PURE__ */ jsxs3("div", { children: [
                /* @__PURE__ */ jsx3("div", { style: { color: "#888", marginBottom: "4px" }, children: "Author:" }),
                /* @__PURE__ */ jsx3("div", { style: { color: "#fff" }, children: sauce.author })
              ] }),
              sauce.group && /* @__PURE__ */ jsxs3("div", { children: [
                /* @__PURE__ */ jsx3("div", { style: { color: "#888", marginBottom: "4px" }, children: "Group:" }),
                /* @__PURE__ */ jsx3("div", { style: { color: "#fff" }, children: sauce.group })
              ] }),
              sauce.date && /* @__PURE__ */ jsxs3("div", { children: [
                /* @__PURE__ */ jsx3("div", { style: { color: "#888", marginBottom: "4px" }, children: "Date:" }),
                /* @__PURE__ */ jsx3("div", { style: { color: "#fff" }, children: sauce.date.length === 8 ? `${sauce.date.slice(0, 4)}-${sauce.date.slice(4, 6)}-${sauce.date.slice(6, 8)}` : sauce.date })
              ] }),
              sauceInfo && /* @__PURE__ */ jsxs3("div", { children: [
                /* @__PURE__ */ jsx3("div", { style: { color: "#888", marginBottom: "4px" }, children: "File Type:" }),
                /* @__PURE__ */ jsxs3("div", { style: { color: "#fff" }, children: [
                  sauceInfo.fileTypeDescription,
                  " (DataType: ",
                  sauce.dataType,
                  ", FileType: ",
                  sauce.fileType,
                  ")"
                ] })
              ] }),
              sauceInfo?.hasDimensions ? /* @__PURE__ */ jsxs3("div", { children: [
                /* @__PURE__ */ jsx3("div", { style: { color: "#888", marginBottom: "4px" }, children: "Dimensions:" }),
                /* @__PURE__ */ jsxs3("div", { style: { color: "#fff" }, children: [
                  sauceInfo.width,
                  " \xD7 ",
                  sauceInfo.height,
                  " characters"
                ] })
              ] }) : /* @__PURE__ */ jsxs3("div", { children: [
                /* @__PURE__ */ jsx3("div", { style: { color: "#888", marginBottom: "4px" }, children: "Dimensions:" }),
                /* @__PURE__ */ jsx3("div", { style: { color: "#666" }, children: "Not specified" })
              ] }),
              /* @__PURE__ */ jsxs3("div", { children: [
                /* @__PURE__ */ jsx3("div", { style: { color: "#888", marginBottom: "4px" }, children: "Type Info Fields:" }),
                /* @__PURE__ */ jsxs3("div", { style: { color: "#fff", fontSize: "12px", fontFamily: "monospace" }, children: [
                  "TInfo1: ",
                  sauce.tInfo1,
                  " | TInfo2: ",
                  sauce.tInfo2,
                  " | TInfo3: ",
                  sauce.tInfo3,
                  " | TInfo4: ",
                  sauce.tInfo4
                ] })
              ] }),
              sauce.tInfoS && /* @__PURE__ */ jsxs3("div", { children: [
                /* @__PURE__ */ jsx3("div", { style: { color: "#888", marginBottom: "4px" }, children: "TInfoS:" }),
                /* @__PURE__ */ jsx3("div", { style: { color: "#fff" }, children: sauce.tInfoS })
              ] }),
              sauceInfo?.fontName && /* @__PURE__ */ jsxs3("div", { children: [
                /* @__PURE__ */ jsx3("div", { style: { color: "#888", marginBottom: "4px" }, children: "Font:" }),
                /* @__PURE__ */ jsx3("div", { style: { color: "#fff" }, children: sauceInfo.fontName })
              ] }),
              /* @__PURE__ */ jsxs3("div", { children: [
                /* @__PURE__ */ jsx3("div", { style: { color: "#888", marginBottom: "4px" }, children: "Flags:" }),
                /* @__PURE__ */ jsxs3("div", { style: { color: "#fff", display: "flex", flexDirection: "column", gap: "4px" }, children: [
                  sauceInfo?.iceColors && /* @__PURE__ */ jsx3("div", { children: "\u2022 ICE Colors enabled" }),
                  sauceInfo?.letterSpacing && /* @__PURE__ */ jsx3("div", { children: "\u2022 Letter spacing enabled" }),
                  !sauceInfo?.iceColors && !sauceInfo?.letterSpacing && /* @__PURE__ */ jsx3("div", { style: { color: "#666" }, children: "None" })
                ] })
              ] }),
              sauceInfo?.aspectRatio && /* @__PURE__ */ jsxs3("div", { children: [
                /* @__PURE__ */ jsx3("div", { style: { color: "#888", marginBottom: "4px" }, children: "Aspect Ratio:" }),
                /* @__PURE__ */ jsxs3("div", { style: { color: "#fff" }, children: [
                  sauceInfo.aspectRatio.width,
                  ":",
                  sauceInfo.aspectRatio.height
                ] })
              ] }),
              /* @__PURE__ */ jsxs3("div", { children: [
                /* @__PURE__ */ jsx3("div", { style: { color: "#888", marginBottom: "4px" }, children: "File Size:" }),
                /* @__PURE__ */ jsxs3("div", { style: { color: "#fff" }, children: [
                  sauce.fileSize.toLocaleString(),
                  " bytes"
                ] })
              ] }),
              /* @__PURE__ */ jsxs3("div", { children: [
                /* @__PURE__ */ jsx3("div", { style: { color: "#888", marginBottom: "4px" }, children: "SAUCE Version:" }),
                /* @__PURE__ */ jsx3("div", { style: { color: "#fff" }, children: sauce.version })
              ] }),
              /* @__PURE__ */ jsxs3(
                "div",
                {
                  style: {
                    marginTop: "8px",
                    paddingTop: "16px",
                    borderTop: "1px solid #333"
                  },
                  children: [
                    /* @__PURE__ */ jsx3("div", { style: { color: "#888", marginBottom: "12px", fontSize: "12px", fontWeight: "bold" }, children: "Technical Details" }),
                    /* @__PURE__ */ jsxs3("div", { style: { display: "flex", flexDirection: "column", gap: "8px", fontSize: "11px", color: "#aaa" }, children: [
                      /* @__PURE__ */ jsxs3("div", { children: [
                        "ID: ",
                        sauce.id
                      ] }),
                      /* @__PURE__ */ jsxs3("div", { children: [
                        "Version: ",
                        sauce.version
                      ] }),
                      /* @__PURE__ */ jsxs3("div", { children: [
                        "DataType: ",
                        sauce.dataType
                      ] }),
                      /* @__PURE__ */ jsxs3("div", { children: [
                        "FileType: ",
                        sauce.fileType
                      ] }),
                      /* @__PURE__ */ jsxs3("div", { children: [
                        "TInfo1: ",
                        sauce.tInfo1,
                        " | TInfo2: ",
                        sauce.tInfo2,
                        " | TInfo3: ",
                        sauce.tInfo3,
                        " | TInfo4: ",
                        sauce.tInfo4
                      ] }),
                      /* @__PURE__ */ jsxs3("div", { children: [
                        "tFlags: 0x",
                        sauce.tFlags.toString(16).toUpperCase().padStart(2, "0"),
                        " (",
                        sauce.tFlags,
                        ")"
                      ] }),
                      sauce.tInfoS && /* @__PURE__ */ jsxs3("div", { children: [
                        "TInfoS: ",
                        sauce.tInfoS
                      ] }),
                      /* @__PURE__ */ jsxs3("div", { children: [
                        "Comments: ",
                        sauce.comments
                      ] }),
                      /* @__PURE__ */ jsxs3("div", { children: [
                        "FileSize: ",
                        sauce.fileSize,
                        " bytes"
                      ] })
                    ] })
                  ]
                }
              ),
              sauce.comments > 0 && sauce.commentLines.length > 0 && /* @__PURE__ */ jsxs3("div", { children: [
                /* @__PURE__ */ jsxs3("div", { style: { color: "#888", marginBottom: "8px" }, children: [
                  "Comments (",
                  sauce.comments,
                  "):"
                ] }),
                /* @__PURE__ */ jsx3(
                  "div",
                  {
                    style: {
                      color: "#fff",
                      background: "rgba(0, 0, 0, 0.3)",
                      padding: "12px",
                      borderRadius: "4px",
                      border: "1px solid #333",
                      maxHeight: "200px",
                      overflow: "auto"
                    },
                    children: sauce.commentLines.map((comment, idx) => /* @__PURE__ */ jsx3("div", { style: { marginBottom: idx < sauce.commentLines.length - 1 ? "8px" : "0" }, children: comment }, idx))
                  }
                )
              ] })
            ] })
          ]
        }
      )
    }
  );
}

// src/components/SauceOverlay.tsx
import { jsx as jsx4 } from "react/jsx-runtime";
function SauceOverlay({ isVisible, onClick }) {
  if (!isVisible) return null;
  return /* @__PURE__ */ jsx4(
    "button",
    {
      onClick,
      style: {
        position: "absolute",
        top: "16px",
        right: "16px",
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
        fontSize: "10px",
        fontWeight: "bold",
        transition: "background 0.2s, opacity 0.3s",
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? "auto" : "none",
        zIndex: 1e3,
        lineHeight: "1",
        padding: 0
      },
      onMouseEnter: (e) => {
        e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
      },
      title: "View SAUCE metadata",
      children: "S"
    }
  );
}

// src/components/AnsiArt.tsx
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
function AnsiArt({
  src,
  mode = "final",
  columns = 80,
  rows = "auto",
  background = "#000",
  bitmapFontUrl,
  showControls = false,
  showOverlayControls = false,
  showPerformanceOverlay = false,
  sauceOverlay = false,
  fps = 30,
  bytesPerSecond = 960,
  // Default: 9600 baud (960 bytes/sec after conversion from baud/10)
  autoStart = true,
  allowDrop = true,
  debugCursorCodes = false
}) {
  const [ansiData, setAnsiData] = useState3(null);
  const [error, setError] = useState3(null);
  const [isDragging, setIsDragging] = useState3(false);
  const [fileName, setFileName] = useState3(null);
  const [dynamicColumns, setDynamicColumns] = useState3(80);
  const [dynamicRows, setDynamicRows] = useState3(25);
  const [detectedFinalRows, setDetectedFinalRows] = useState3(null);
  const [finalHeightForAnimated, setFinalHeightForAnimated] = useState3(null);
  const [scrollViewY, setScrollViewY] = useState3(0);
  const [virtualRows, setVirtualRows] = useState3(25);
  const [sauce, setSauce] = useState3(void 0);
  const [isSauceModalOpen, setIsSauceModalOpen] = useState3(false);
  const [isSauceOverlayVisible, setIsSauceOverlayVisible] = useState3(false);
  const [detectedMode, setDetectedMode] = useState3("final");
  const sauceOverlayTimeoutRef = useRef4(null);
  const frameGeneratorRef = useRef4(null);
  useEffect4(() => {
    if (mode === "auto" && ansiData) {
      const isAnimated = detectAnimation(ansiData);
      setDetectedMode(isAnimated ? "animated" : "final");
    } else if (mode !== "auto") {
      setDetectedMode("final");
    }
  }, [mode, ansiData]);
  const effectiveMode = useMemo2(() => {
    if (mode === "auto") {
      return detectedMode;
    }
    return mode;
  }, [mode, detectedMode]);
  useEffect4(() => {
    if (ansiData && sauceOverlay) {
      const parsedSauce = parseSauce(ansiData);
      if (parsedSauce) {
        console.log("[SAUCE] Metadata detected:", {
          title: parsedSauce.title || "(no title)",
          author: parsedSauce.author || "(no author)",
          group: parsedSauce.group || "(no group)",
          date: parsedSauce.date || "(no date)",
          fileType: `${parsedSauce.dataType}:${parsedSauce.fileType}`,
          dimensions: parsedSauce.tInfo1 > 0 && parsedSauce.tInfo2 > 0 ? `${parsedSauce.tInfo1}\xD7${parsedSauce.tInfo2}` : "N/A",
          comments: parsedSauce.comments
        });
        setSauce(parsedSauce);
      } else {
        console.log("[SAUCE] No SAUCE metadata found in file");
      }
    } else if (!sauceOverlay) {
      setSauce(void 0);
    }
  }, [ansiData, sauceOverlay]);
  useEffect4(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setScrollViewY(0);
      setVirtualRows(typeof rows === "number" ? rows : 25);
      setDetectedFinalRows(null);
      setFinalHeightForAnimated(null);
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
      setDetectedFinalRows(null);
      setFinalHeightForAnimated(null);
      setAnsiData(buf);
      setFileName(file.name);
    } catch (err) {
      setError(String(err?.message || err));
    }
  };
  useEffect4(() => {
    if (!ansiData) return;
    try {
      if (effectiveMode === "final") {
        if (columns === "auto" || rows === "auto") {
          const effectiveColumns = columns === "auto" ? void 0 : columns;
          const screen = parseAnsiCore(
            ansiData,
            effectiveColumns !== void 0 ? { columns: effectiveColumns } : {}
          );
          if (columns === "auto") {
            setDynamicColumns(screen.columns);
          }
          if (rows === "auto") {
            setDetectedFinalRows(screen.lines.length);
          } else if (typeof rows === "number") {
            setDetectedFinalRows(rows);
          }
        } else {
          setDetectedFinalRows(rows);
        }
      } else if (effectiveMode === "animated" && rows === "auto") {
        const effectiveColumns = columns === "auto" ? void 0 : columns;
        const screen = parseAnsiCore(
          ansiData,
          effectiveColumns !== void 0 ? { columns: effectiveColumns } : {}
        );
        setFinalHeightForAnimated(screen.lines.length);
        if (columns === "auto") {
          setDynamicColumns(screen.columns);
        }
      } else if (effectiveMode === "animated" && columns === "auto") {
        setDynamicColumns(80);
        setDynamicRows(typeof rows === "number" ? rows : 25);
      } else {
        setDynamicColumns(80);
        setDynamicRows(typeof rows === "number" ? rows : 25);
      }
    } catch (e) {
      setError(String(e?.message || e));
    }
  }, [effectiveMode, ansiData, columns, rows]);
  const handleDimensionsChange = useCallback3(
    (dimensions) => {
      if (effectiveMode === "animated" && (columns === "auto" || rows === "auto")) {
        if (columns === "auto") {
          setDynamicColumns(dimensions.columns);
        }
        if (rows === "auto") {
          setDynamicRows(dimensions.rows);
        }
      }
    },
    [effectiveMode, columns, rows]
  );
  const handleScrollChange = useCallback3(
    (scroll) => {
      if (effectiveMode === "animated" && typeof columns === "number" && typeof rows === "number") {
        const newVirtualRows = Math.max(rows, scroll.contentRows);
        setScrollViewY(scroll.viewY);
        setVirtualRows(newVirtualRows);
      }
    },
    [effectiveMode, columns, rows]
  );
  const frameGenerator = useMemo2(() => {
    if (!ansiData) return null;
    const effectiveColumns = columns === "auto" ? void 0 : columns;
    const effectiveRows = rows === "auto" && effectiveMode === "animated" ? void 0 : typeof rows === "number" ? rows : void 0;
    const generator = createAnsiArtFrameGenerator({
      ansiData,
      mode: effectiveMode,
      columns: effectiveColumns,
      rows: effectiveRows,
      finalHeightForAnimated: effectiveMode === "animated" && rows === "auto" ? finalHeightForAnimated ?? void 0 : void 0,
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
    effectiveMode,
    columns,
    rows,
    finalHeightForAnimated,
    bytesPerSecond,
    fps,
    handleDimensionsChange,
    handleScrollChange,
    debugCursorCodes
  ]);
  const displayColumns = useMemo2(() => {
    if (columns === "auto") {
      return dynamicColumns;
    } else {
      return columns;
    }
  }, [columns, dynamicColumns]);
  const displayRows = useMemo2(() => {
    if (effectiveMode === "final") {
      if (rows === "auto") {
        return detectedFinalRows ?? 25;
      } else {
        return rows;
      }
    } else {
      if (rows === "auto") {
        return finalHeightForAnimated ?? dynamicRows;
      } else {
        return rows;
      }
    }
  }, [effectiveMode, rows, detectedFinalRows, finalHeightForAnimated, dynamicRows]);
  const rootStyle = useMemo2(
    () => ({
      ...isDragging ? { outline: "2px dashed #888", outlineOffset: "-2px" } : {}
    }),
    [isDragging]
  );
  const handleSauceClick = useCallback3(() => {
    if (sauce) {
      setIsSauceModalOpen(true);
    }
  }, [sauce]);
  const handleSauceMouseMove = useCallback3(() => {
    if (!showOverlayControls && sauceOverlay && sauce) {
      setIsSauceOverlayVisible(true);
      if (sauceOverlayTimeoutRef.current) {
        clearTimeout(sauceOverlayTimeoutRef.current);
      }
      sauceOverlayTimeoutRef.current = setTimeout(() => {
        setIsSauceOverlayVisible(false);
      }, 3e3);
    }
  }, [showOverlayControls, sauceOverlay, sauce]);
  const handleSauceMouseLeave = useCallback3(() => {
    if (!showOverlayControls && sauceOverlay && sauce) {
      if (sauceOverlayTimeoutRef.current) {
        clearTimeout(sauceOverlayTimeoutRef.current);
      }
      setIsSauceOverlayVisible(false);
    }
  }, [showOverlayControls, sauceOverlay, sauce]);
  useEffect4(() => {
    return () => {
      if (sauceOverlayTimeoutRef.current) {
        clearTimeout(sauceOverlayTimeoutRef.current);
      }
    };
  }, []);
  if (error) {
    return /* @__PURE__ */ jsx5(
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
    return /* @__PURE__ */ jsx5(
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
  return /* @__PURE__ */ jsxs4(
    "div",
    {
      style: {
        ...rootStyle,
        position: "relative"
      },
      onDragEnter,
      onDragOver,
      onDragLeave,
      onDrop,
      onMouseMove: handleSauceMouseMove,
      onMouseLeave: handleSauceMouseLeave,
      children: [
        /* @__PURE__ */ jsx5(
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
            showPerformanceOverlay,
            autoStart: effectiveMode === "animated" ? autoStart : void 0,
            sauce: showOverlayControls && sauceOverlay ? sauce : void 0,
            onSauceClick: showOverlayControls && sauceOverlay ? handleSauceClick : void 0
          }
        ),
        !showOverlayControls && sauceOverlay && sauce && /* @__PURE__ */ jsx5(SauceOverlay, { isVisible: isSauceOverlayVisible, onClick: handleSauceClick }),
        sauce && /* @__PURE__ */ jsx5(
          SauceMetadataModal,
          {
            sauce,
            isOpen: isSauceModalOpen,
            onClose: () => setIsSauceModalOpen(false)
          }
        )
      ]
    }
  );
}

// src/components/RipArt.tsx
import { useCallback as useCallback4, useEffect as useEffect5, useMemo as useMemo3, useRef as useRef5, useState as useState4 } from "react";

// src/rip/parser.ts
var DEFAULT_RIP_PALETTE = [0, 1, 2, 3, 4, 5, 7, 20, 56, 57, 58, 59, 60, 61, 62, 63];
function cloneRipState(state) {
  return {
    ...state,
    cursor: { ...state.cursor },
    viewport: state.viewport ? { ...state.viewport } : null,
    textWindow: state.textWindow ? { ...state.textWindow } : null,
    palette: state.palette ? [...state.palette] : []
  };
}
function createInitialState() {
  return {
    color: 7,
    // Light Gray (default)
    fillColor: 0,
    // Black (default)
    fillStyle: 1 /* Solid */,
    lineStyle: 0 /* Solid */,
    fontStyle: 0 /* Default */,
    viewport: null,
    cursor: { x: 0, y: 0 },
    writeMode: 0 /* CopyPut */,
    palette: [...DEFAULT_RIP_PALETTE],
    textWindow: null
  };
}
var RipReader = class {
  constructor(data) {
    this.data = data;
    this.position = 0;
  }
  isEOF() {
    return this.position >= this.data.length;
  }
  peek() {
    if (this.isEOF()) return -1;
    return this.data[this.position];
  }
  readByte() {
    if (this.isEOF()) throw new Error("Unexpected end of file");
    return this.data[this.position++];
  }
  // Read RIP byte with backslash line continuation handling
  readRipByte() {
    let b = this.readByte();
    if (b === 92) {
      b = this.readByte();
      while (b === 10 || b === 13) {
        if (this.isEOF()) break;
        b = this.readByte();
      }
    }
    return b;
  }
  // Read base-36 number (0-9, A-Z)
  readRipNumber() {
    const b = this.readRipByte();
    if (b >= 48 && b <= 57) {
      return b - 48;
    }
    if (b >= 65 && b <= 90) {
      return b - 55;
    }
    return 0;
  }
  // Read RIP word (2 base-36 digits: 0-1295)
  readRipWord() {
    return this.readRipNumber() * 36 + this.readRipNumber();
  }
  // Read RIP int (4 base-36 digits: 0-1679615)
  readRipInt() {
    return this.readRipWord() * 1296 + this.readRipWord();
  }
  // Read RIP point (2 words: x, y)
  readRipPoint() {
    return {
      x: this.readRipWord(),
      y: this.readRipWord()
    };
  }
  // Read RIP size (2 words: width, height)
  readRipSize() {
    return {
      width: this.readRipWord(),
      height: this.readRipWord()
    };
  }
  // Read RIP rectangle (2 points: start, end)
  // Note: RIP rectangles use inclusive coordinates (both endpoints included)
  readRipRectangle() {
    const start = this.readRipPoint();
    const end = this.readRipPoint();
    return {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x) + 1,
      // +1 because coordinates are inclusive
      height: Math.abs(end.y - start.y) + 1
      // +1 because coordinates are inclusive
    };
  }
  // Read RIP string (until |, CR, LF, or EOF)
  readRipString() {
    const bytes = [];
    while (!this.isEOF()) {
      const next = this.peek();
      if (next === -1 || next === 13 || next === 10 || next === 124) {
        break;
      }
      bytes.push(this.readRipByte());
    }
    while (!this.isEOF()) {
      const b = this.peek();
      if (b === 13 || b === 10) {
        this.readByte();
      } else {
        break;
      }
    }
    return decodeCp437(new Uint8Array(bytes));
  }
  getPosition() {
    return this.position;
  }
  setPosition(pos) {
    this.position = pos;
  }
};
function parseCommand(reader, state, debug = false) {
  if (reader.isEOF()) {
    if (debug) console.log("[RIP] End of file reached");
    return null;
  }
  const startPos = reader.getPosition();
  const b = reader.readRipByte();
  if (b !== 124) {
    const isCommonWhitespace = b === 32 || b === 9 || b === 10 || b === 13;
    if (debug && !isCommonWhitespace) {
      console.log(
        `[RIP] Skipping non-command byte: 0x${b.toString(16)} (${String.fromCharCode(
          b
        )}) at position ${startPos}`
      );
    }
    return null;
  }
  let opcode = String.fromCharCode(reader.readRipByte());
  if (opcode === "1") {
    const nextByte = reader.readRipByte();
    const nextChar = String.fromCharCode(nextByte);
    if ("KBTEtCPIW".includes(nextChar)) {
      opcode += nextChar;
    } else {
      if (debug)
        console.log(`[RIP] Invalid two-char opcode: 1${nextChar} (0x${nextByte.toString(16)})`);
      reader.setPosition(reader.getPosition() - 1);
    }
  } else if (opcode === "#") {
    if (debug) console.log("[RIP] End marker (#) found");
    return null;
  }
  switch (opcode) {
    // Drawing commands
    case "L": {
      const start = reader.readRipPoint();
      const end = reader.readRipPoint();
      return { type: "Line", opcode: "L", start, end };
    }
    case "C": {
      const center = reader.readRipPoint();
      const radius = reader.readRipWord();
      return { type: "Circle", opcode: "C", center, radius };
    }
    case "O": {
      const center = reader.readRipPoint();
      const startAngle = reader.readRipWord();
      const endAngle = reader.readRipWord();
      const radius = reader.readRipSize();
      return { type: "Oval", opcode: "O", center, radius, startAngle, endAngle };
    }
    case "A": {
      const center = reader.readRipPoint();
      const startAngle = reader.readRipWord();
      const endAngle = reader.readRipWord();
      const radius = reader.readRipWord();
      return { type: "Arc", opcode: "A", center, radius, startAngle, endAngle };
    }
    case "P": {
      const count = reader.readRipWord();
      if (count < 2 || count > 512) {
        if (debug) console.log(`[RIP] Polygon point count out of range: ${count} (must be 2-512)`);
        return null;
      }
      const points = [];
      for (let i = 0; i < count; i++) {
        points.push(reader.readRipPoint());
      }
      return { type: "Polygon", opcode: "P", points };
    }
    case "l":
    case "PL": {
      const count = reader.readRipWord();
      if (count < 2 || count > 512) {
        if (debug) console.log(`[RIP] PolyLine point count out of range: ${count} (must be 2-512)`);
        return null;
      }
      const points = [];
      for (let i = 0; i < count; i++) {
        points.push(reader.readRipPoint());
      }
      return { type: "PolyLine", opcode: "l", points };
    }
    case "B": {
      const rect = reader.readRipRectangle();
      return { type: "Bar", opcode: "B", rect };
    }
    case "R":
    case "DR": {
      const rect = reader.readRipRectangle();
      return { type: "DrawRectangle", opcode: "R", rect };
    }
    case "Z":
    case "BE": {
      const points = [];
      for (let i = 0; i < 4; i++) {
        points.push(reader.readRipPoint());
      }
      const segments = reader.readRipWord();
      return { type: "Bezier", opcode: "Z", points, segments };
    }
    case "X": {
      const point = reader.readRipPoint();
      return { type: "Pixel", opcode: "X", point };
    }
    case "F": {
      const point = reader.readRipPoint();
      const border = reader.readRipWord();
      return { type: "Fill", opcode: "F", point, border };
    }
    case "p":
    case "FP": {
      const count = reader.readRipWord();
      if (count < 2 || count > 512) {
        if (debug)
          console.log(`[RIP] FilledPolygon point count out of range: ${count} (must be 2-512)`);
        return null;
      }
      const points = [];
      for (let i = 0; i < count; i++) {
        points.push(reader.readRipPoint());
      }
      return { type: "FilledPolygon", opcode: "p", points };
    }
    case "o":
    case "FO": {
      const center = reader.readRipPoint();
      const radius = reader.readRipSize();
      return { type: "FilledOval", opcode: "o", center, radius };
    }
    case "I":
    case "PS": {
      const center = reader.readRipPoint();
      const startAngle = reader.readRipWord();
      const endAngle = reader.readRipWord();
      const radius = reader.readRipWord();
      return { type: "PieSlice", opcode: "I", center, radius, startAngle, endAngle };
    }
    case "i":
    case "OPS": {
      const center = reader.readRipPoint();
      const startAngle = reader.readRipWord();
      const endAngle = reader.readRipWord();
      const radius = reader.readRipSize();
      return { type: "OvalPieSlice", opcode: "i", center, radius, startAngle, endAngle };
    }
    case "V":
    case "OA": {
      const center = reader.readRipPoint();
      const startAngle = reader.readRipWord();
      const endAngle = reader.readRipWord();
      const radius = reader.readRipSize();
      return { type: "OvalArc", opcode: "V", center, radius, startAngle, endAngle };
    }
    // State commands
    case "c": {
      const value = reader.readRipWord();
      state.color = value % 16;
      return { type: "Color", opcode: "c", value: value % 16 };
    }
    case "S":
    case "FS": {
      const style = reader.readRipWord();
      const color = reader.readRipWord();
      state.fillStyle = style;
      state.fillColor = color % 16;
      return { type: "FillStyle", opcode: "S", style, color: color % 16 };
    }
    case "=":
    case "LS": {
      const style = reader.readRipWord();
      const pattern = reader.readRipInt();
      const thickness = reader.readRipWord();
      state.lineStyle = style;
      return { type: "LineStyle", opcode: "=", style, pattern, thickness };
    }
    case "Y":
    case "FT": {
      const font = reader.readRipWord();
      const direction = reader.readRipWord();
      const characterSize = reader.readRipWord();
      reader.readRipWord();
      state.fontStyle = font;
      return {
        type: "FontStyle",
        opcode: "Y",
        font,
        direction,
        characterSize
      };
    }
    case "v": {
      const x0 = reader.readRipWord();
      const y0 = reader.readRipWord();
      const x1 = reader.readRipWord();
      const y1 = reader.readRipWord();
      if (x0 === 0 && y0 === 0 && x1 === 0 && y1 === 0) {
        state.viewport = null;
        return { type: "ViewPort", opcode: "v", rect: { x: 0, y: 0, width: 0, height: 0 } };
      }
      const minX = Math.min(x0, x1);
      const maxX = Math.max(x0, x1);
      const minY = Math.min(y0, y1);
      const maxY = Math.max(y0, y1);
      const rect = {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1
      };
      state.viewport = rect;
      return { type: "ViewPort", opcode: "v", rect };
    }
    case "g":
    case "G": {
      const point = reader.readRipPoint();
      state.cursor = point;
      return { type: "GotoXY", opcode: "g", point };
    }
    case "m": {
      const point = reader.readRipPoint();
      state.cursor = point;
      return { type: "Move", opcode: "m", point };
    }
    case "H": {
      state.cursor = { x: 0, y: 0 };
      return { type: "Home", opcode: "H" };
    }
    case "W":
    case "WM": {
      const mode = reader.readRipWord();
      state.writeMode = mode;
      return { type: "WriteMode", opcode: "W", mode };
    }
    case "Q":
    case "SP": {
      const palette = [];
      for (let i = 0; i < 16; i++) {
        const raw = reader.readRipWord();
        const egaIndex = Math.max(0, Math.min(raw, 63));
        palette.push(egaIndex);
      }
      state.palette = [...palette];
      return { type: "SetPalette", opcode: "Q", palette: [...palette] };
    }
    case "a":
    case "OP": {
      const color = reader.readRipWord();
      const paletteValue = reader.readRipWord();
      const colorIndex = color % 16;
      const egaIndex = Math.max(0, Math.min(paletteValue, 63));
      if (state.palette) {
        state.palette[colorIndex] = egaIndex;
      }
      return { type: "OnePalette", opcode: "a", color: colorIndex, palette: egaIndex };
    }
    case "s":
    case "FPAT": {
      const pattern = [];
      for (let i = 0; i < 8; i++) {
        pattern.push(reader.readRipWord());
      }
      const color = reader.readRipWord();
      state.fillStyle = 12 /* User */;
      state.fillColor = color % 16;
      return { type: "FillPattern", opcode: "s", pattern, color: color % 16 };
    }
    // Text commands
    case "1T":
    case "BT": {
      const rect = reader.readRipRectangle();
      const flags = reader.readRipWord();
      return { type: "BeginText", opcode: "1T", rect, flags };
    }
    case "1E":
    case "ET": {
      return { type: "EndText", opcode: "1E" };
    }
    case "T":
    case "OT": {
      const text = reader.readRipString();
      return { type: "OutText", opcode: "T", text };
    }
    case "@":
    case "OTX": {
      const point = reader.readRipPoint();
      const text = reader.readRipString();
      return { type: "OutTextXY", opcode: "@", point, text };
    }
    case "1t":
    case "RT": {
      const rect = reader.readRipRectangle();
      const text = reader.readRipString();
      return { type: "RegionText", opcode: "1t", rect, text };
    }
    case "w":
    case "TW": {
      const x0 = reader.readRipWord();
      const y0 = reader.readRipWord();
      const x1 = reader.readRipWord();
      const y1 = reader.readRipWord();
      const wrap = reader.readRipNumber();
      const size = reader.readRipNumber();
      const rect = {
        x: Math.min(x0, x1),
        y: Math.min(y0, y1),
        width: Math.abs(x1 - x0) + 1,
        height: Math.abs(y1 - y0) + 1
      };
      state.textWindow = rect;
      return { type: "TextWindow", opcode: "w", rect, wrap, size };
    }
    // Interactive commands
    case "U":
    case "BU": {
      const rect = reader.readRipRectangle();
      const hotKey = reader.readRipWord();
      const flags = reader.readRipNumber();
      reader.readRipNumber();
      const text = reader.readRipString();
      return { type: "Button", opcode: "U", rect, hotKey, flags, text };
    }
    case "1B":
    case "BS": {
      reader.readRipWord();
      reader.readRipWord();
      reader.readRipWord();
      reader.readRipInt();
      reader.readRipWord();
      reader.readRipWord();
      reader.readRipWord();
      reader.readRipWord();
      reader.readRipWord();
      reader.readRipWord();
      reader.readRipWord();
      reader.readRipWord();
      reader.readRipWord();
      reader.readRipWord();
      reader.readRipWord();
      return { type: "ButtonStyle", opcode: "1B" };
    }
    case "M":
    case "MO": {
      const enabled = reader.readRipWord() !== 0;
      return { type: "Mouse", opcode: "M", enabled };
    }
    case "1K":
    case "KM": {
      return { type: "KillMouseFields", opcode: "1K" };
    }
    // Erase commands
    case ">":
    case "EE": {
      return { type: "EraseEOL", opcode: ">" };
    }
    case "E":
    case "EV": {
      return { type: "EraseView", opcode: "E" };
    }
    case "e":
    case "EW": {
      return { type: "EraseWindow", opcode: "e" };
    }
    case "*":
    case "RW": {
      return { type: "ResetWindows", opcode: "*" };
    }
    // Image commands
    case "1C":
    case "GI": {
      const rect = reader.readRipRectangle();
      const id = reader.readRipNumber();
      return { type: "GetImage", opcode: "1C", rect, id };
    }
    case "1P":
    case "PI": {
      const point = reader.readRipPoint();
      const writeMode = reader.readRipWord();
      const id = reader.readRipNumber();
      return { type: "PutImage", opcode: "1P", point, writeMode, id };
    }
    case "1I":
    case "LI": {
      const point = reader.readRipPoint();
      const id = reader.readRipWord();
      const flags = reader.readRipNumber();
      const filename = reader.readRipString();
      return { type: "LoadIcon", opcode: "1I", point, id, flags, filename };
    }
    case "1W":
    case "WI": {
      const point = reader.readRipPoint();
      const id = reader.readRipWord();
      return { type: "WriteIcon", opcode: "1W", point, id };
    }
    default:
      if (debug) console.log(`[RIP] Unknown opcode: |${opcode} at position ${startPos}`);
      return null;
  }
}
function parseRip(data, debug = false) {
  if (debug) console.log(`[RIP] Starting parse of ${data.length} bytes`);
  const reader = new RipReader(data);
  const initialState = createInitialState();
  const state = createInitialState();
  const commands = [];
  let width = 640;
  let height = 350;
  let commandCount = 0;
  let errorCount = 0;
  try {
    while (!reader.isEOF()) {
      const peek = reader.peek();
      if (peek === 124) {
        break;
      }
      if (peek === -1) break;
      reader.readByte();
    }
    while (!reader.isEOF()) {
      try {
        const command = parseCommand(reader, state, debug);
        if (!command) {
          let foundNext = false;
          while (!reader.isEOF()) {
            const peek = reader.peek();
            if (peek === 124) {
              foundNext = true;
              break;
            }
            if (peek === -1) break;
            reader.readByte();
          }
          if (!foundNext) {
            break;
          }
          continue;
        }
        commands.push(command);
        commandCount++;
        if (command.type === "ViewPort") {
          width = Math.max(width, command.rect.x + command.rect.width);
          height = Math.max(height, command.rect.y + command.rect.height);
          if (debug) console.log(`[RIP] ViewPort detected: ${width}x${height}`);
        }
      } catch (e) {
        errorCount++;
        const pos = reader.getPosition();
        console.error(`[RIP] Error parsing command at position ${pos}:`, e?.message || e);
        if (debug) {
          console.error(`[RIP] Error details:`, e);
          try {
            while (!reader.isEOF()) {
              const b = reader.readRipByte();
              if (b === 124) {
                reader.setPosition(reader.getPosition() - 1);
                break;
              }
            }
          } catch (skipError) {
            console.error("[RIP] Cannot recover from parse error, stopping");
            break;
          }
        } else {
          break;
        }
      }
    }
  } catch (e) {
    console.error("[RIP] Fatal parse error:", e?.message || e);
    if (debug) console.error("[RIP] Fatal error details:", e);
  }
  if (debug && errorCount > 0) {
    console.log(`[RIP] Parse complete: ${commandCount} commands parsed, ${errorCount} errors`);
  }
  const finalState = cloneRipState(state);
  const initialStateClone = cloneRipState(initialState);
  return {
    commands,
    width,
    height,
    state: initialStateClone,
    initialState: initialStateClone,
    finalState
  };
}

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

// src/rip/toCanvas.ts
function cloneRipState2(state) {
  return {
    ...state,
    cursor: { ...state.cursor },
    viewport: state.viewport ? { ...state.viewport } : null,
    textWindow: state.textWindow ? { ...state.textWindow } : null,
    palette: state.palette ? [...state.palette] : []
  };
}
function drawLine(ctx, x1, y1, x2, y2, maxCommands) {
  const lYDelta = Math.abs(y2 - y1);
  const lXDelta = Math.abs(x2 - x1);
  if (lXDelta === 0) {
    const startY = Math.min(y1, y2);
    for (let y = 0; y <= lYDelta; y++) {
      ctx.fillRect(x1, startY + y, 1, 1);
    }
  } else if (lYDelta === 0) {
    const startX = Math.min(x1, x2);
    for (let x = 0; x <= lXDelta; x++) {
      ctx.fillRect(startX + x, y1, 1, 1);
    }
  } else if (lXDelta >= lYDelta) {
    let lAdjUp, lAdjDown, lError, lAdvance;
    let lWholeStep, lStartLength, lEndLength, lCount;
    let lRunLength;
    let lStep;
    let pos;
    lAdvance = 1;
    if (y1 < y2) {
      pos = { x: x1, y: y1 };
      lStep = x1 > x2 ? -1 : 1;
    } else {
      pos = { x: x2, y: y2 };
      lStep = x2 > x1 ? -1 : 1;
    }
    lWholeStep = Math.floor(lXDelta / lYDelta) * lStep;
    lAdjUp = lXDelta % lYDelta;
    lAdjDown = lYDelta * 2;
    lError = lAdjUp - lAdjDown;
    lAdjUp *= 2;
    lStartLength = Math.floor(lWholeStep / 2) + lStep;
    lEndLength = lStartLength;
    if (lAdjUp === 0 && (lWholeStep & 1) === 0) {
      lStartLength -= lStep;
    }
    if ((lWholeStep & 1) !== 0) {
      lError += lYDelta;
    }
    for (let i = 0; i < Math.abs(lStartLength); i++) {
      ctx.fillRect(pos.x + i * Math.sign(lStartLength), pos.y, 1, 1);
    }
    pos.x += lStartLength;
    pos.y += lAdvance;
    for (lCount = 0; lCount < lYDelta - 1; lCount++) {
      lRunLength = lWholeStep;
      if ((lError += lAdjUp) > 0) {
        lRunLength += lStep;
        lError -= lAdjDown;
      }
      for (let i = 0; i < Math.abs(lRunLength); i++) {
        ctx.fillRect(pos.x + i * Math.sign(lRunLength), pos.y, 1, 1);
      }
      pos.x += lRunLength;
      pos.y += lAdvance;
    }
    for (let i = 0; i < Math.abs(lEndLength); i++) {
      ctx.fillRect(pos.x + i * Math.sign(lEndLength), pos.y, 1, 1);
    }
  } else {
    let lAdjUp, lAdjDown, lError, lAdvance;
    let lWholeStep, lStartLength, lEndLength, lCount;
    let lRunLength;
    let pos;
    if (y1 < y2) {
      pos = { x: x1, y: y1 };
      lAdvance = x1 > x2 ? -1 : 1;
    } else {
      pos = { x: x2, y: y2 };
      lAdvance = x2 > x1 ? -1 : 1;
    }
    lWholeStep = Math.floor(lYDelta / lXDelta);
    lAdjUp = lYDelta % lXDelta;
    lAdjDown = lXDelta * 2;
    lError = lAdjUp - lAdjDown;
    lAdjUp *= 2;
    lStartLength = Math.floor(lWholeStep / 2) + 1;
    lEndLength = lStartLength;
    if (lAdjUp === 0 && (lWholeStep & 1) === 0) {
      lStartLength--;
    }
    if ((lWholeStep & 1) !== 0) {
      lError += lXDelta;
    }
    for (let i = 0; i < lStartLength; i++) {
      ctx.fillRect(pos.x, pos.y + i, 1, 1);
    }
    pos.y += lStartLength;
    pos.x += lAdvance;
    for (lCount = 0; lCount < lXDelta - 1; lCount++) {
      lRunLength = lWholeStep;
      if ((lError += lAdjUp) > 0) {
        lRunLength++;
        lError -= lAdjDown;
      }
      for (let i = 0; i < lRunLength; i++) {
        ctx.fillRect(pos.x, pos.y + i, 1, 1);
      }
      pos.y += lRunLength;
      pos.x += lAdvance;
    }
    for (let i = 0; i < lEndLength; i++) {
      ctx.fillRect(pos.x, pos.y + i, 1, 1);
    }
  }
}
function drawEllipse(ctx, x, y, startAngle, endAngle, radiusx, radiusy) {
  if (startAngle > endAngle) {
    ;
    [startAngle, endAngle] = [endAngle, startAngle];
  }
  radiusx = Math.max(1, radiusx);
  radiusy = Math.max(1, radiusy);
  const diameterx = radiusx * 2;
  const diametery = radiusy * 2;
  const b1 = diametery & 1;
  let stopx = 4 * (1 - diameterx) * diametery * diametery;
  let stopy = 4 * (b1 + 1) * diameterx * diameterx;
  let err = stopx + stopy + b1 * diameterx * diameterx;
  let xoffset = radiusx;
  let yoffset = 0;
  const incx = 8 * diameterx * diameterx;
  const incy = 8 * diametery * diametery;
  const aspect = radiusx / radiusy;
  const horizontal_angle = radiusx < radiusy ? 90 - 45 * aspect : 45 / aspect;
  do {
    const e2 = 2 * err;
    const angle = Math.atan(yoffset * aspect / xoffset) * (180 / Math.PI);
    if (angle >= startAngle && angle <= endAngle) {
      symmetryPlot(ctx, x, y, xoffset, yoffset, angle <= horizontal_angle);
      if (Math.abs(angle - horizontal_angle) < 1) {
        symmetryPlot(ctx, x, y, xoffset, yoffset, !(angle <= horizontal_angle));
      }
    }
    if (e2 <= stopy) {
      yoffset++;
      err += stopy += incx;
    }
    if (e2 >= stopx) {
      xoffset--;
      err += stopx += incy;
    }
  } while (xoffset >= 0);
}
function symmetryPlot(ctx, x, y, xoffset, yoffset, horizontal) {
  if (horizontal) {
    ctx.fillRect(x + xoffset, y + yoffset, 1, 1);
    ctx.fillRect(x - xoffset, y + yoffset, 1, 1);
    ctx.fillRect(x + xoffset, y - yoffset, 1, 1);
    ctx.fillRect(x - xoffset, y - yoffset, 1, 1);
  } else {
    ctx.fillRect(x + yoffset, y + xoffset, 1, 1);
    ctx.fillRect(x - yoffset, y + xoffset, 1, 1);
    ctx.fillRect(x + yoffset, y - xoffset, 1, 1);
    ctx.fillRect(x - yoffset, y - xoffset, 1, 1);
  }
}
function fillPolygon(ctx, points) {
  if (points.length <= 2) return;
  const rows = new Array(352);
  for (let i = 1; i < points.length; i++) {
    scanLine(points[i - 1], points[i], rows);
  }
  scanLine(points[points.length - 1], points[0], rows);
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    if (row && row.length > 0) {
      row.sort((a, b) => a - b);
      let on = false;
      let lastX = -1;
      for (const x of row) {
        if (on) {
          const width = x - lastX + 1;
          if (width > 0) {
            ctx.fillRect(lastX, y - 1, width, 1);
          }
        }
        on = !on;
        lastX = x;
      }
    }
  }
}
function scanLine(start, end, rows) {
  const yDelta = Math.abs(end.y - start.y);
  if (start.y < end.y) {
    addScanRow(rows, start.x, start.y);
  }
  if (yDelta > 0) {
    const xDelta = start.y > end.y ? start.x - end.x : end.x - start.x;
    const minX = start.y > end.y ? end.x : start.x;
    let posY = Math.min(start.y, end.y);
    posY++;
    for (let count = 1; count < yDelta; count++) {
      const posX = Math.round(xDelta * count / yDelta) + minX;
      if (posY >= -1 && posY <= 350) {
        addScanRow(rows, posX, posY);
      }
      posY++;
    }
  }
  if (end.y < start.y) {
    addScanRow(rows, end.x, end.y);
  }
}
function addScanRow(rows, x, y) {
  if (y < -1 || y > 350) return;
  const rowIndex = y + 1;
  if (!rows[rowIndex]) {
    rows[rowIndex] = [];
  }
  rows[rowIndex].push(x);
}
function getColor(index, palette) {
  if (palette && palette[index] !== void 0) {
    const egaIndex2 = Math.max(0, Math.min(palette[index], EGA_PALETTE_RGB.length - 1));
    return EGA_PALETTE_RGB[egaIndex2];
  }
  const egaIndex = Math.max(0, Math.min(index, EGA_PALETTE_RGB.length - 1));
  return EGA_PALETTE_RGB[egaIndex];
}
var FILL_PATTERNS = [
  // 0: Background Fill (Empty)
  [0, 0, 0, 0, 0, 0, 0, 0],
  // 1: Solid Fill
  [255, 255, 255, 255, 255, 255, 255, 255],
  // 2: Line Fill
  [255, 255, 0, 0, 0, 0, 0, 0],
  // 3: Light Slash Fill
  [1, 2, 4, 8, 16, 32, 64, 128],
  // 4: Normal Slash Fill
  [224, 193, 131, 7, 14, 28, 56, 112],
  // 5: Light Backslash Fill (spec shows this as "Light Backslash")
  [240, 120, 60, 30, 15, 135, 195, 225],
  // 6: Light Backslash Fill (alternate pattern from spec)
  [165, 210, 105, 180, 90, 45, 150, 75],
  // 7: Light Hatch Fill
  [255, 136, 136, 136, 255, 136, 136, 136],
  // 8: Heavy Cross Hatch Fill
  [129, 66, 36, 24, 24, 36, 66, 129],
  // 9: Interleaving Line Fill
  [204, 51, 204, 51, 204, 51, 204, 51],
  // 10 (0A): Widely Spaced Dot Fill
  [128, 0, 8, 0, 128, 0, 8, 0],
  // 11 (0B): Closely Spaced Dot Fill
  [136, 0, 34, 0, 136, 0, 34, 0],
  // 12: User (will be set dynamically)
  [170, 85, 170, 85, 170, 85, 170, 85]
];
function createFillPattern(ctx, style, fillColor, palette, userPattern) {
  if (style === 0 /* Empty */) {
    return null;
  }
  const patternCanvas = document.createElement("canvas");
  patternCanvas.width = 8;
  patternCanvas.height = 8;
  const patternCtx = patternCanvas.getContext("2d");
  const fillColorStr = getColor(fillColor, palette);
  if (style === 1 /* Solid */) {
    patternCtx.fillStyle = fillColorStr;
    patternCtx.fillRect(0, 0, 8, 8);
  } else if (style === 12 /* User */ && userPattern) {
    patternCtx.fillStyle = fillColorStr;
    for (let row = 0; row < 8; row++) {
      const byte = userPattern[row] || 0;
      for (let col = 0; col < 8; col++) {
        const bit = 7 - col;
        if (byte & 1 << bit) {
          patternCtx.fillRect(col, row, 1, 1);
        }
      }
    }
  } else {
    const pattern = FILL_PATTERNS[style] || FILL_PATTERNS[1 /* Solid */];
    patternCtx.fillStyle = fillColorStr;
    for (let row = 0; row < 8; row++) {
      const byte = pattern[row] || 0;
      for (let col = 0; col < 8; col++) {
        const bit = 7 - col;
        if (byte & 1 << bit) {
          patternCtx.fillRect(col, row, 1, 1);
        }
      }
    }
  }
  return ctx.createPattern(patternCanvas, "repeat");
}
function setLineStyle(ctx, style) {
  switch (style) {
    case 0 /* Solid */:
      ctx.setLineDash([]);
      break;
    case 1 /* Dotted */:
      ctx.setLineDash([2, 2]);
      break;
    case 2 /* Center */:
      ctx.setLineDash([8, 4, 2, 4]);
      break;
    case 3 /* Dashed */:
      ctx.setLineDash([8, 4]);
      break;
    default:
      ctx.setLineDash([]);
  }
}
function floodFill(ctx, startX, startY, fillColor, fillPattern, borderColor, width, height) {
  const fillMatch = fillColor.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
  if (!fillMatch) return;
  const fillR = parseInt(fillMatch[1], 16);
  const fillG = parseInt(fillMatch[2], 16);
  const fillB = parseInt(fillMatch[3], 16);
  const borderMatch = borderColor.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
  if (!borderMatch) return;
  const borderR = parseInt(borderMatch[1], 16);
  const borderG = parseInt(borderMatch[2], 16);
  const borderB = parseInt(borderMatch[3], 16);
  if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;
  ctx.beginPath();
  ctx.stroke();
  ctx.beginPath();
  ctx.fill();
  const imageData = ctx.getImageData(0, 0, width, height);
  const startIdx = (startY * width + startX) * 4;
  const startR = imageData.data[startIdx];
  const startG = imageData.data[startIdx + 1];
  const startB = imageData.data[startIdx + 2];
  console.log(
    `[RIP] DEBUG Fill point (${startX}, ${startY}) actual color: rgb(${startR}, ${startG}, ${startB})`
  );
  console.log(`[RIP] DEBUG Border color: rgb(${borderR}, ${borderG}, ${borderB})`);
  if (startR === borderR && startG === borderG && startB === borderB) {
    console.log(`[RIP] DEBUG Fill skipped: start pixel matches border color`);
    return;
  }
  const isBorder = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return true;
    const idx = (y * width + x) * 4;
    return imageData.data[idx] === borderR && imageData.data[idx + 1] === borderG && imageData.data[idx + 2] === borderB;
  };
  const findLine = (x, y) => {
    if (isBorder(x, y)) {
      return null;
    }
    let startx = x;
    let endx = x;
    for (endx = x; endx < width; endx++) {
      if (isBorder(endx, y)) break;
    }
    endx--;
    for (startx = x - 1; startx >= 0; startx--) {
      if (isBorder(startx, y)) break;
    }
    startx++;
    if (startx === endx && (startx === 0 || endx === width - 1)) {
      return null;
    }
    return { x1: startx, x2: endx, y };
  };
  const alreadyDrawn = (x, y) => {
    for (const li of fillLines[y]) {
      if (x >= li.x1 && x <= li.x2) return true;
    }
    return false;
  };
  const fillLineSegment = (x1, x2, y) => {
    for (let x = x1; x <= x2; x++) {
      const idx = (y * width + x) * 4;
      imageData.data[idx] = fillR;
      imageData.data[idx + 1] = fillG;
      imageData.data[idx + 2] = fillB;
    }
    if (fillPattern) {
      ctx.fillStyle = fillPattern;
    } else {
      ctx.fillStyle = fillColor;
    }
    ctx.fillRect(x1, y, x2 - x1 + 1, 1);
  };
  const fillLines = [];
  for (let i = 0; i < height; i++) {
    fillLines[i] = [];
  }
  const pointStack = [];
  const initialLine = findLine(startX, startY);
  if (initialLine) {
    fillLines[initialLine.y].push(initialLine);
    fillLineSegment(initialLine.x1, initialLine.x2, initialLine.y);
    pointStack.push({ ...initialLine, dir: 1 });
    pointStack.push({ ...initialLine, dir: -1 });
    while (pointStack.length > 0) {
      const fli = pointStack.pop();
      const cury = fli.y + fli.dir;
      if (cury < 0 || cury >= height) continue;
      for (let cx = fli.x1; cx <= fli.x2; cx++) {
        if (isBorder(cx, cury)) continue;
        if (alreadyDrawn(cx, cury)) continue;
        const li = findLine(cx, cury);
        if (li) {
          fillLines[li.y].push(li);
          fillLineSegment(li.x1, li.x2, li.y);
          cx = li.x2;
          pointStack.push({ x1: li.x1, x2: li.x2, y: li.y, dir: fli.dir });
          if (!(fillR === 0 && fillG === 0 && fillB === 0)) {
            if (li.x2 > fli.x2) {
              pointStack.push({ x1: fli.x2 + 1, x2: li.x2, y: li.y, dir: -fli.dir });
            }
            if (li.x1 < fli.x1) {
              pointStack.push({ x1: li.x1, x2: fli.x1 - 1, y: li.y, dir: -fli.dir });
            }
          }
        }
      }
    }
  }
}
function isViewportEnabled(viewport) {
  if (!viewport) return true;
  return !(viewport.x === 0 && viewport.y === 0 && viewport.width === 0 && viewport.height === 0);
}
function drawCommand(ctx, command, state, _imageData, canvasWidth, canvasHeight, userPattern, maxCommands) {
  const viewportCommands = [
    "Line",
    "Circle",
    "Oval",
    "Arc",
    "Polygon",
    "PolyLine",
    "Bar",
    "DrawRectangle",
    "Bezier",
    "Pixel",
    "Fill",
    "FilledPolygon",
    "FilledOval",
    "PieSlice",
    "OvalPieSlice",
    "OvalArc",
    "OutText",
    "OutTextXY",
    "RegionText",
    "Button"
  ];
  if (viewportCommands.includes(command.type)) {
    if (!isViewportEnabled(state.viewport)) {
      return;
    }
  }
  const color = getColor(state.color, state.palette);
  const fillColor = getColor(state.fillColor, state.palette);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  setLineStyle(ctx, state.lineStyle);
  ctx.fillStyle = color;
  const fillPattern = createFillPattern(
    ctx,
    state.fillStyle,
    state.fillColor,
    state.palette,
    userPattern
  );
  switch (command.type) {
    case "Line": {
      drawLine(ctx, command.start.x, command.start.y, command.end.x, command.end.y, maxCommands);
      break;
    }
    case "Circle": {
      const ASPECT = 350 / 480 * 1.06;
      const ry = Math.round(command.radius * ASPECT);
      const rx = command.radius;
      drawEllipse(ctx, command.center.x, command.center.y, 0, 360, rx, ry);
      break;
    }
    case "Oval": {
      const rx = command.radius.width;
      const ry = command.radius.height;
      if (command.startAngle === 0 && command.endAngle === 360) {
        drawEllipse(ctx, command.center.x, command.center.y, 0, 360, rx, ry);
      } else {
        drawEllipse(
          ctx,
          command.center.x,
          command.center.y,
          command.startAngle,
          command.endAngle,
          rx,
          ry
        );
      }
      break;
    }
    case "Arc": {
      const ASPECT = 350 / 480 * 1.06;
      const ry = Math.round(command.radius * ASPECT);
      const rx = command.radius;
      drawEllipse(
        ctx,
        command.center.x,
        command.center.y,
        command.startAngle,
        command.endAngle,
        rx,
        ry
      );
      break;
    }
    case "Polygon": {
      if (command.points.length < 2) break;
      console.log(`[RIP] Drawing polygon with ${command.points.length} points, color: ${color}`);
      for (let i = 0; i < command.points.length; i++) {
        const start = command.points[i];
        const end = command.points[(i + 1) % command.points.length];
        console.log(
          `[RIP] Drawing polygon line ${i}: (${start.x}, ${start.y}) -> (${end.x}, ${end.y})`
        );
        drawLine(ctx, start.x, start.y, end.x, end.y, maxCommands);
      }
      break;
    }
    case "PolyLine": {
      if (command.points.length < 2) break;
      for (let i = 0; i < command.points.length - 1; i++) {
        const start = command.points[i];
        const end = command.points[i + 1];
        drawLine(ctx, start.x, start.y, end.x, end.y, maxCommands);
      }
      break;
    }
    case "Bar": {
      const fillColorStr = getColor(state.fillColor, state.palette);
      ctx.fillStyle = fillPattern || fillColorStr;
      ctx.fillRect(command.rect.x, command.rect.y, command.rect.width, command.rect.height);
      if (state.color !== 0) {
        ctx.strokeRect(command.rect.x, command.rect.y, command.rect.width, command.rect.height);
      }
      break;
    }
    case "DrawRectangle": {
      ctx.strokeRect(command.rect.x, command.rect.y, command.rect.width, command.rect.height);
      break;
    }
    case "Bezier": {
      if (command.points.length < 4) break;
      ctx.beginPath();
      ctx.moveTo(command.points[0].x, command.points[0].y);
      for (let i = 1; i < command.points.length; i += 3) {
        if (i + 2 < command.points.length) {
          ctx.bezierCurveTo(
            command.points[i].x,
            command.points[i].y,
            command.points[i + 1].x,
            command.points[i + 1].y,
            command.points[i + 2].x,
            command.points[i + 2].y
          );
        }
      }
      ctx.stroke();
      break;
    }
    case "Pixel": {
      ctx.fillStyle = color;
      ctx.fillRect(command.point.x, command.point.y, 1, 1);
      break;
    }
    case "Fill": {
      if (command.point.x < 0 || command.point.x >= canvasWidth || command.point.y < 0 || command.point.y >= canvasHeight) {
        console.warn("[RIP] Fill point out of bounds, skipping:", command.point);
        break;
      }
      const borderColor = getColor(command.border & 15, state.palette);
      console.log(
        `[RIP] DEBUG Fill applied: point=(${command.point.x}, ${command.point.y}), border=${command.border}, fillColor=${fillColor}, fillStyle=${state.fillStyle}`
      );
      floodFill(
        ctx,
        command.point.x,
        command.point.y,
        fillColor,
        fillPattern,
        borderColor,
        canvasWidth,
        canvasHeight
      );
      break;
    }
    case "FilledPolygon": {
      if (command.points.length < 3) break;
      const fillColorStr = getColor(state.fillColor, state.palette);
      ctx.fillStyle = fillPattern || fillColorStr;
      fillPolygon(ctx, command.points);
      if (state.color !== 0) {
        for (let i = 0; i < command.points.length - 1; i++) {
          const start = command.points[i];
          const end = command.points[i + 1];
          drawLine(ctx, start.x, start.y, end.x, end.y, maxCommands);
        }
        const first = command.points[0];
        const last = command.points[command.points.length - 1];
        drawLine(ctx, last.x, last.y, first.x, first.y, maxCommands);
      }
      break;
    }
    case "FilledOval": {
      ctx.beginPath();
      ctx.ellipse(
        command.center.x,
        command.center.y,
        command.radius.width,
        command.radius.height,
        0,
        0,
        Math.PI * 2
      );
      const fillColorStr = getColor(state.fillColor, state.palette);
      ctx.fillStyle = fillPattern || fillColorStr;
      ctx.fill();
      if (state.color !== 0) {
        ctx.stroke();
      }
      break;
    }
    case "PieSlice": {
      const ASPECT = 0.772;
      const radiusX = command.radius;
      const radiusY = Math.trunc(command.radius * ASPECT);
      const startRad = command.startAngle * Math.PI / 180;
      const endRad = command.endAngle * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(command.center.x, command.center.y);
      ctx.lineTo(
        command.center.x + radiusX * Math.cos(startRad),
        command.center.y - radiusY * Math.sin(startRad)
      );
      ctx.ellipse(command.center.x, command.center.y, radiusX, radiusY, 0, startRad, endRad);
      ctx.closePath();
      const fillColorStr = getColor(state.fillColor, state.palette);
      ctx.fillStyle = fillPattern || fillColorStr;
      ctx.fill();
      if (state.color !== 0) {
        ctx.stroke();
      }
      break;
    }
    case "OvalPieSlice": {
      const startRad = command.startAngle * Math.PI / 180;
      const endRad = command.endAngle * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(command.center.x, command.center.y);
      ctx.lineTo(
        command.center.x + command.radius.width * Math.cos(startRad),
        command.center.y - command.radius.height * Math.sin(startRad)
      );
      ctx.ellipse(
        command.center.x,
        command.center.y,
        command.radius.width,
        command.radius.height,
        0,
        startRad,
        endRad
      );
      ctx.closePath();
      const fillColorStr = getColor(state.fillColor, state.palette);
      ctx.fillStyle = fillPattern || fillColorStr;
      ctx.fill();
      if (state.color !== 0) {
        ctx.stroke();
      }
      break;
    }
    case "OvalArc": {
      const startRad = command.startAngle * Math.PI / 180;
      const endRad = command.endAngle * Math.PI / 180;
      ctx.beginPath();
      ctx.ellipse(
        command.center.x,
        command.center.y,
        command.radius.width,
        command.radius.height,
        0,
        startRad,
        endRad
      );
      ctx.stroke();
      break;
    }
    case "OutText": {
      ctx.fillStyle = color;
      ctx.font = "12px monospace";
      ctx.textBaseline = "top";
      ctx.fillText(command.text, state.cursor.x, state.cursor.y);
      break;
    }
    case "OutTextXY": {
      ctx.fillStyle = color;
      ctx.font = "12px monospace";
      ctx.textBaseline = "top";
      ctx.fillText(command.text, command.point.x, command.point.y);
      break;
    }
    case "RegionText": {
      ctx.fillStyle = color;
      ctx.font = "12px monospace";
      ctx.textBaseline = "top";
      ctx.fillText(command.text, command.rect.x, command.rect.y);
      break;
    }
    case "Button": {
      const fillColorStr = getColor(state.fillColor, state.palette);
      ctx.fillStyle = fillPattern || fillColorStr;
      ctx.fillRect(command.rect.x, command.rect.y, command.rect.width, command.rect.height);
      if (state.color !== 0) {
        ctx.strokeRect(command.rect.x, command.rect.y, command.rect.width, command.rect.height);
      }
      ctx.fillStyle = color;
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        command.text,
        command.rect.x + command.rect.width / 2,
        command.rect.y + command.rect.height / 2
      );
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      break;
    }
    // State commands don't draw anything
    case "Color":
    case "FillStyle":
    case "LineStyle":
    case "FontStyle":
    case "ViewPort":
    case "GotoXY":
    case "Move":
    case "Home":
    case "WriteMode":
    case "SetPalette":
    case "OnePalette":
    case "FillPattern":
    case "BeginText":
    case "EndText":
    case "TextWindow":
    case "ButtonStyle":
    case "Mouse":
    case "KillMouseFields":
    case "EraseEOL":
    case "EraseView":
    case "EraseWindow":
      break;
    case "ResetWindows":
      break;
    case "GetImage":
    case "PutImage":
    case "LoadIcon":
    case "WriteIcon":
      break;
    default:
      break;
  }
}
function ripToCanvas(canvas, commands, width, height, initialState, background = "#000000", maxCommands) {
  console.log(
    `[RIP] ripToCanvas called: ${commands.length} commands, maxCommands=${maxCommands}, canvas=${width}x${height}`
  );
  if (maxCommands !== void 0) {
    console.log(`[RIP] DEBUG Canvas setup: ${width}x${height}, background: ${background}`);
  }
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", {
    willReadFrequently: true,
    alpha: false,
    // Disable alpha channel for better color matching
    desynchronized: true
    // Reduce latency
  });
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.imageSmoothingQuality = "low";
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  const limitedCommands = maxCommands !== void 0 ? commands.slice(0, maxCommands) : commands;
  const state = cloneRipState2(initialState);
  let userPattern = void 0;
  let fillCommandsProcessed = 0;
  let fillCommandsSkipped = 0;
  for (let i = 0; i < limitedCommands.length; i++) {
    const command = limitedCommands[i];
    console.log(`[RIP] Command ${i}: ${command.type} (${command.opcode})`, command, state);
    switch (command.type) {
      case "Color":
        console.log(`[RIP] Color command: changing from ${state.color} to ${command.value}`);
        state.color = command.value;
        break;
      case "FillStyle":
        state.fillStyle = command.style;
        state.fillColor = command.color;
        break;
      case "LineStyle":
        state.lineStyle = command.style;
        break;
      case "FontStyle":
        state.fontStyle = command.font;
        break;
      case "ViewPort":
        state.viewport = command.rect;
        break;
      case "GotoXY":
      case "Move":
        state.cursor = command.point;
        break;
      case "Home":
        state.cursor = { x: 0, y: 0 };
        break;
      case "WriteMode":
        state.writeMode = command.mode;
        break;
      case "SetPalette":
        state.palette = [...command.palette];
        break;
      case "OnePalette":
        if (state.palette) {
          state.palette[command.color] = command.palette;
        }
        break;
      case "FillPattern":
        state.fillStyle = 12 /* User */;
        state.fillColor = command.color;
        userPattern = command.pattern;
        break;
      case "TextWindow":
        state.textWindow = command.rect;
        break;
      case "ResetWindows":
        state.palette = Array.from({ length: 16 }, (_, i2) => {
          const defaultMapping = [0, 1, 2, 3, 4, 5, 7, 20, 56, 57, 58, 59, 60, 61, 62, 63];
          return defaultMapping[i2] || i2;
        });
        state.viewport = null;
        state.textWindow = null;
        state.cursor = { x: 0, y: 0 };
        state.color = 7;
        state.fillColor = 0;
        state.fillStyle = 1 /* Solid */;
        state.lineStyle = 0 /* Solid */;
        break;
    }
    const wasFillCommand = command.type === "Fill";
    drawCommand(ctx, command, state, null, width, height, userPattern, maxCommands);
    if (wasFillCommand) {
      fillCommandsProcessed++;
      if (fillCommandsProcessed % 100 === 0) {
        console.log(`[RIP] Processed ${fillCommandsProcessed} fill commands`);
      }
    }
  }
  console.log(`[RIP] Rendering complete: ${fillCommandsProcessed} fill commands processed`);
}

// src/components/RipArt.tsx
import { jsx as jsx6, jsxs as jsxs5 } from "react/jsx-runtime";
function RipArt({
  url,
  mode = "auto",
  width = "auto",
  height = "auto",
  background = "#000000",
  allowDrop = true,
  showOverlayControls = false,
  showPerformanceOverlay = false,
  debug = false,
  maxCommands,
  fps = 30,
  bytesPerSecond = 960,
  autoStart = true
}) {
  const [ripData, setRipData] = useState4(null);
  const [error, setError] = useState4(null);
  const [isDragging, setIsDragging] = useState4(false);
  const [fileName, setFileName] = useState4(null);
  const [detectedWidth, setDetectedWidth] = useState4(640);
  const [detectedHeight, setDetectedHeight] = useState4(350);
  const [commands, setCommands] = useState4([]);
  const [initialState, setInitialState] = useState4(null);
  const [detectedMode, setDetectedMode] = useState4("final");
  const [currentFrame, setCurrentFrame] = useState4(0);
  const [isPlaying, setIsPlaying] = useState4(autoStart);
  const [isOverlayVisible, setIsOverlayVisible] = useState4(false);
  const [currentSpeed, setCurrentSpeed] = useState4(() => bytesPerSecond);
  const animationFrameRef = useRef5(null);
  const lastFrameTimeRef = useRef5(0);
  const currentBytePositionRef = useRef5(0);
  const totalBytesRef = useRef5(0);
  const overlayTimeoutRef = useRef5(null);
  const canvasRef = useRef5(null);
  useEffect5(() => {
    if (mode === "auto" && commands.length > 0) {
      const viewportCount = commands.filter((c) => c.type === "ViewPort").length;
      const isAnimated = viewportCount > 1 || commands.length > 100;
      setDetectedMode(isAnimated ? "animated" : "final");
    } else if (mode !== "auto") {
      setDetectedMode(mode);
    }
  }, [mode, commands]);
  const effectiveMode = useMemo3(() => {
    if (mode === "auto") {
      return detectedMode;
    }
    return mode;
  }, [mode, detectedMode]);
  useEffect5(() => {
    if (!url) return;
    const urlToFetch = url;
    let cancelled = false;
    async function load() {
      setError(null);
      try {
        const res = await fetch(urlToFetch);
        if (!res.ok) throw new Error(`Failed to fetch ${urlToFetch}: ${res.status}`);
        const buf = new Uint8Array(await res.arrayBuffer());
        if (!cancelled) {
          setRipData(buf);
          setFileName(null);
          totalBytesRef.current = buf.length;
        }
      } catch (e) {
        if (!cancelled) setError(String(e?.message || e));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [url]);
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
    if (!file) {
      console.warn("[RipArt] No file in drop event");
      return;
    }
    console.log(`[RipArt] File dropped: ${file.name}, size: ${file.size} bytes`);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      console.log(`[RipArt] File loaded: ${buf.length} bytes`);
      setRipData(buf);
      setFileName(file.name);
      totalBytesRef.current = buf.length;
      setError(null);
    } catch (err) {
      const errorMsg = String(err?.message || err);
      console.error(`[RipArt] Error loading file:`, errorMsg);
      setError(errorMsg);
    }
  };
  useEffect5(() => {
    if (!ripData) return;
    try {
      if (debug) console.log(`[RipArt] Parsing RIP file: ${fileName || url || "dropped file"}, ${ripData.length} bytes`);
      const result = parseRip(ripData, debug);
      setCommands(result.commands);
      setInitialState(result.initialState ?? result.state);
      setDetectedWidth(result.width);
      setDetectedHeight(result.height);
      currentBytePositionRef.current = 0;
      setCurrentFrame(0);
    } catch (e) {
      const errorMsg = String(e?.message || e);
      console.error(`[RipArt] Parse failed:`, errorMsg);
      if (debug) console.error(`[RipArt] Error details:`, e);
      setError(errorMsg);
    }
  }, [ripData, debug, fileName, url]);
  const displayWidth = useMemo3(() => {
    if (width === "auto") {
      return detectedWidth;
    }
    return width;
  }, [width, detectedWidth]);
  const displayHeight = useMemo3(() => {
    if (height === "auto") {
      return detectedHeight;
    }
    return height;
  }, [height, detectedHeight]);
  const getCommandsForBytePosition = useCallback4(
    (bytePos) => {
      if (totalBytesRef.current === 0) return commands.length;
      const ratio = Math.min(bytePos / totalBytesRef.current, 1);
      return Math.floor(ratio * commands.length);
    },
    [commands]
  );
  useEffect5(() => {
    console.log(`[RipArt] Render effect triggered: canvas=${!!canvasRef.current}, initialState=${!!initialState}, commands=${commands.length}`);
    if (!canvasRef.current || !initialState || commands.length === 0) {
      console.log(`[RipArt] Skipping render: canvas=${!!canvasRef.current}, initialState=${!!initialState}, commands=${commands.length}`);
      return;
    }
    const canvas = canvasRef.current;
    console.log(`[RipArt] Rendering to canvas: ${displayWidth}x${displayHeight}, maxCommands=${maxCommands}`);
    let renderMaxCommands = maxCommands;
    if (effectiveMode === "animated" && renderMaxCommands === void 0) {
      renderMaxCommands = getCommandsForBytePosition(currentBytePositionRef.current);
    }
    ripToCanvas(
      canvas,
      commands,
      displayWidth,
      displayHeight,
      initialState,
      background,
      renderMaxCommands
      // Use maxCommands prop for debugging
    );
    if (debug) {
      console.log(`[RipArt] Rendered to canvas: ${commands.length} commands${renderMaxCommands !== void 0 ? `, showing ${renderMaxCommands}` : ""}`);
    }
  }, [commands, displayWidth, displayHeight, initialState, background, effectiveMode, currentFrame, debug, maxCommands, getCommandsForBytePosition]);
  useEffect5(() => {
    if (effectiveMode !== "animated" || !isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }
    const animate = (timestamp) => {
      if (lastFrameTimeRef.current === 0) {
        lastFrameTimeRef.current = timestamp;
      }
      const deltaTime = (timestamp - lastFrameTimeRef.current) / 1e3;
      const bytesToAdvance = Math.floor(deltaTime * currentSpeed);
      if (bytesToAdvance > 0) {
        currentBytePositionRef.current = Math.min(
          currentBytePositionRef.current + bytesToAdvance,
          totalBytesRef.current
        );
        setCurrentFrame((prev) => prev + 1);
        lastFrameTimeRef.current = timestamp;
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    lastFrameTimeRef.current = 0;
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [effectiveMode, isPlaying, currentSpeed]);
  const handlePlayPause = useCallback4(() => {
    if (currentBytePositionRef.current >= totalBytesRef.current) {
      currentBytePositionRef.current = 0;
      setCurrentFrame(0);
    }
    setIsPlaying((prev) => !prev);
  }, []);
  const handleRestart = useCallback4(() => {
    currentBytePositionRef.current = 0;
    setCurrentFrame(0);
    setIsPlaying(true);
  }, []);
  const handleSeek = useCallback4((bytePosition) => {
    currentBytePositionRef.current = Math.max(0, Math.min(bytePosition, totalBytesRef.current));
    setCurrentFrame((prev) => prev + 1);
  }, []);
  const handleSpeedChange = useCallback4((newBytesPerSecond) => {
    setCurrentSpeed(newBytesPerSecond);
  }, []);
  const handleAdvanceByte = useCallback4(() => {
    currentBytePositionRef.current = Math.min(
      currentBytePositionRef.current + 1,
      totalBytesRef.current
    );
    setCurrentFrame((prev) => prev + 1);
  }, []);
  const handleRewindByte = useCallback4(() => {
    currentBytePositionRef.current = Math.max(currentBytePositionRef.current - 1, 0);
    setCurrentFrame((prev) => prev + 1);
  }, []);
  const handleMouseMove = useCallback4(() => {
    setIsOverlayVisible(true);
    if (overlayTimeoutRef.current) {
      clearTimeout(overlayTimeoutRef.current);
    }
    overlayTimeoutRef.current = window.setTimeout(() => {
      setIsOverlayVisible(false);
    }, 3e3);
  }, []);
  useEffect5(() => {
    return () => {
      if (overlayTimeoutRef.current) {
        window.clearTimeout(overlayTimeoutRef.current);
      }
    };
  }, []);
  const rootStyle = useMemo3(
    () => ({
      ...isDragging ? { outline: "2px dashed #888", outlineOffset: "-2px" } : {}
    }),
    [isDragging]
  );
  if (error) {
    return /* @__PURE__ */ jsx6(
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
  if (!ripData) {
    return /* @__PURE__ */ jsx6(
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
        children: url ? "Loading\u2026" : "Drop a .rip file here or provide a URL"
      }
    );
  }
  if (!initialState || commands.length === 0) {
    return /* @__PURE__ */ jsx6(
      "div",
      {
        style: {
          ...rootStyle,
          padding: "16px",
          color: "#FFAA00",
          background: "#000",
          fontFamily: "monospace"
        },
        onDragEnter,
        onDragOver,
        onDragLeave,
        onDrop,
        children: commands.length === 0 ? `No commands parsed from file${fileName ? `: ${fileName}` : ""}. ${debug ? "Check console for details." : "Try enabling debug mode."}` : "Processing\u2026"
      }
    );
  }
  return /* @__PURE__ */ jsxs5(
    "div",
    {
      style: {
        ...rootStyle,
        position: "relative",
        display: "inline-block"
      },
      onDragEnter,
      onDragOver,
      onDragLeave,
      onDrop,
      onMouseMove: effectiveMode === "animated" && showOverlayControls ? handleMouseMove : void 0,
      children: [
        /* @__PURE__ */ jsx6(
          "canvas",
          {
            ref: canvasRef,
            width: displayWidth,
            height: displayHeight,
            style: {
              width: displayWidth,
              height: displayHeight,
              display: "block",
              imageRendering: "pixelated",
              WebkitImageSmoothingEnabled: "false",
              MozImageSmoothingEnabled: "false",
              OImageSmoothingEnabled: "false"
            }
          }
        ),
        effectiveMode === "animated" && showOverlayControls && /* @__PURE__ */ jsx6(
          AnsiPlayerOverlay,
          {
            isPlaying,
            currentBytes: currentBytePositionRef.current,
            totalBytes: totalBytesRef.current,
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
        )
      ]
    }
  );
}

// src/components/PlasmaBackgroundLayout.tsx
import { useCallback as useCallback5, useEffect as useEffect6, useMemo as useMemo4, useRef as useRef6, useState as useState5 } from "react";

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

// src/generators/asciiFireGenerator.ts
var DEFAULT_CHARS2 = [" ", ".", ":", ";", "+", "=", "x", "X", "$", "&", "#", "@"];
var DEFAULT_DARKEN_AMOUNT = 0.5;
var DEFAULT_SPARK_RANGE = [200, 255];
var DEFAULT_BG_COLOR2 = "#000000";
var DEFAULT_SEED = 12345;
function generateFirePalette() {
  const palette = [];
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let r;
    let g;
    let b;
    if (t < 0.3) {
      const localT = t / 0.3;
      r = Math.floor(localT * 50);
      g = 0;
      b = 0;
    } else if (t < 0.6) {
      const localT = (t - 0.3) / 0.3;
      r = Math.floor(50 + localT * 200);
      g = Math.floor(localT * 30);
      b = 0;
    } else if (t < 0.85) {
      const localT = (t - 0.6) / 0.25;
      r = 255;
      g = Math.floor(30 + localT * 100);
      b = 0;
    } else {
      const localT = (t - 0.85) / 0.15;
      r = 255;
      g = Math.floor(130 + localT * 125);
      b = Math.floor(localT * 50);
    }
    palette[i] = `rgb(${r},${g},${b})`;
  }
  return palette;
}
var FIRE_PALETTE = generateFirePalette();
function createRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}
function calculateNaturalFireHeight(darkenAmount, sparkRange) {
  const maxHeat = sparkRange[1];
  const naturalHeight = Math.ceil(maxHeat / darkenAmount);
  return Math.max(30, Math.min(200, naturalHeight));
}
var fireStateMap = /* @__PURE__ */ new Map();
function generateAsciiFireFrame(frame, columns, rows, options = {}) {
  const {
    chars = DEFAULT_CHARS2,
    darkenAmount = DEFAULT_DARKEN_AMOUNT,
    sparkRange = DEFAULT_SPARK_RANGE,
    bgColor = DEFAULT_BG_COLOR2,
    seed = DEFAULT_SEED
  } = options;
  const naturalHeight = calculateNaturalFireHeight(darkenAmount, sparkRange);
  const actualBufferHeight = Math.min(naturalHeight, rows);
  const charCount = chars.length;
  const charLookup = new Array(256);
  for (let i = 0; i < 256; i++) {
    const normalizedValue = i / 255;
    charLookup[i] = chars[Math.floor(normalizedValue * (charCount - 1e-3))];
  }
  const stateKey = JSON.stringify({ columns, rows, seed, darkenAmount, sparkRange, naturalHeight });
  let state = fireStateMap.get(stateKey);
  if (!state || frame < state.lastFrame) {
    const bufferRows2 = actualBufferHeight + 1;
    const buffer = new Uint8Array(columns * bufferRows2);
    const bottomRowStart2 = (bufferRows2 - 1) * columns;
    for (let x = 0; x < columns; x++) {
      buffer[bottomRowStart2 + x] = 255;
    }
    for (let y = actualBufferHeight - 1; y >= Math.max(0, actualBufferHeight - 5); y--) {
      for (let x = 0; x < columns; x++) {
        const idx = y * columns + x;
        const distFromBottom = actualBufferHeight - 1 - y;
        const heat = Math.max(0, 255 - distFromBottom * 50);
        buffer[idx] = heat;
      }
    }
    state = { buffer, lastFrame: -1 };
    fireStateMap.set(stateKey, state);
  }
  const fireBuffer = state.buffer;
  state.lastFrame = frame;
  const random = createRandom(seed + frame);
  const readBuffer = new Uint8Array(fireBuffer);
  const bufferRows = actualBufferHeight + 1;
  const bottomRowStart = (bufferRows - 1) * columns;
  for (let x = 0; x < columns; x++) {
    const sparkValue = Math.floor(sparkRange[0] + random() * (sparkRange[1] - sparkRange[0]));
    fireBuffer[bottomRowStart + x] = sparkValue;
  }
  for (let y = actualBufferHeight - 1; y >= 0; y--) {
    for (let x = 0; x < columns; x++) {
      const currentIdx = y * columns + x;
      const belowY = y + 1;
      const leftX = (x - 1 + columns) % columns;
      const rightX = (x + 1) % columns;
      const belowIdx = belowY * columns + x;
      const belowLeftIdx = belowY * columns + leftX;
      const belowRightIdx = belowY * columns + rightX;
      const avg = (readBuffer[belowIdx] + readBuffer[belowLeftIdx] + readBuffer[belowRightIdx]) / 3;
      const darkened = Math.max(0, avg - darkenAmount);
      fireBuffer[currentIdx] = Math.floor(darkened);
    }
  }
  const lines = [];
  for (let y = 0; y < actualBufferHeight; y++) {
    const line = [];
    for (let x = 0; x < columns; x++) {
      const paletteIndex = fireBuffer[y * columns + x];
      const ch = charLookup[paletteIndex];
      const fgColor = FIRE_PALETTE[paletteIndex];
      line.push({ ch, fg: fgColor, bg: bgColor, bold: false });
    }
    lines.push(line);
  }
  for (let y = actualBufferHeight; y < rows; y++) {
    const line = [];
    for (let x = 0; x < columns; x++) {
      line.push({ ch: " ", fg: FIRE_PALETTE[0], bg: bgColor, bold: false });
    }
    lines.push(line);
  }
  return { lines, columns };
}
var samplerStateMap = /* @__PURE__ */ new Map();
function createAsciiFireSampler(frame, options = {}) {
  const {
    chars = DEFAULT_CHARS2,
    darkenAmount = DEFAULT_DARKEN_AMOUNT,
    sparkRange = DEFAULT_SPARK_RANGE,
    bgColor = DEFAULT_BG_COLOR2,
    seed = DEFAULT_SEED,
    worldHeight,
    // Optional: height of virtual world in scrollable mode
    worldWidth
    // Optional: width of virtual world in scrollable mode
  } = options;
  const charCount = chars.length;
  const charLookup = new Array(256);
  for (let i = 0; i < 256; i++) {
    const normalizedValue = i / 255;
    charLookup[i] = chars[Math.floor(normalizedValue * (charCount - 1e-3))];
  }
  const naturalHeight = calculateNaturalFireHeight(darkenAmount, sparkRange);
  const bufferCols = worldWidth || 200;
  const stateKey = JSON.stringify({
    seed,
    darkenAmount,
    sparkRange,
    naturalHeight
  });
  let samplerState = samplerStateMap.get(stateKey);
  const bufferRows = naturalHeight + 1;
  if (samplerState) {
    if (frame < samplerState.lastFrame) {
      const buffer = new Uint8Array(bufferCols * bufferRows);
      const bottomRowStart = (bufferRows - 1) * bufferCols;
      for (let x = 0; x < bufferCols; x++) {
        buffer[bottomRowStart + x] = 255;
      }
      for (let y = bufferRows - 2; y >= Math.max(0, bufferRows - 6); y--) {
        for (let x = 0; x < bufferCols; x++) {
          const idx = y * bufferCols + x;
          const distFromBottom = bufferRows - 2 - y;
          const heat = Math.max(0, 255 - distFromBottom * 50);
          buffer[idx] = heat;
        }
      }
      samplerState.buffer = buffer;
      samplerState.bufferCols = bufferCols;
      samplerState.bufferRows = bufferRows;
      samplerState.lastFrame = -1;
    } else if (samplerState.bufferCols !== bufferCols || samplerState.bufferRows !== bufferRows) {
      const oldBuffer = samplerState.buffer;
      const oldCols = samplerState.bufferCols;
      const oldRows = samplerState.bufferRows;
      const newBuffer = new Uint8Array(bufferCols * bufferRows);
      for (let y = 0; y < bufferRows; y++) {
        for (let x = 0; x < bufferCols; x++) {
          const newIdx = y * bufferCols + x;
          if (x < oldCols && y < oldRows) {
            const oldIdx = y * oldCols + x;
            newBuffer[newIdx] = oldBuffer[oldIdx];
          } else {
            if (y === bufferRows - 1) {
              newBuffer[newIdx] = 255;
            } else {
              newBuffer[newIdx] = 0;
            }
          }
        }
      }
      samplerState.buffer = newBuffer;
      samplerState.bufferCols = bufferCols;
      samplerState.bufferRows = bufferRows;
    }
  } else {
    const buffer = new Uint8Array(bufferCols * bufferRows);
    const bottomRowStart = (bufferRows - 1) * bufferCols;
    for (let x = 0; x < bufferCols; x++) {
      buffer[bottomRowStart + x] = 255;
    }
    for (let y = bufferRows - 2; y >= Math.max(0, bufferRows - 6); y--) {
      for (let x = 0; x < bufferCols; x++) {
        const idx = y * bufferCols + x;
        const distFromBottom = bufferRows - 2 - y;
        const heat = Math.max(0, 255 - distFromBottom * 50);
        buffer[idx] = heat;
      }
    }
    samplerState = { buffer, bufferCols, bufferRows, lastFrame: -1 };
    samplerStateMap.set(stateKey, samplerState);
  }
  const virtualBuffer = samplerState.buffer;
  const currentBufferCols = samplerState.bufferCols;
  const currentBufferRows = samplerState.bufferRows;
  if (frame > samplerState.lastFrame) {
    const readBuffer = new Uint8Array(virtualBuffer);
    const random = createRandom(seed + frame);
    const bottomRowStart = (currentBufferRows - 1) * currentBufferCols;
    for (let x = 0; x < currentBufferCols; x++) {
      const sparkValue = Math.floor(sparkRange[0] + random() * (sparkRange[1] - sparkRange[0]));
      virtualBuffer[bottomRowStart + x] = sparkValue;
    }
    for (let y = currentBufferRows - 2; y >= 0; y--) {
      for (let x = 0; x < currentBufferCols; x++) {
        const currentIdx = y * currentBufferCols + x;
        const belowY = y + 1;
        const leftX = (x - 1 + currentBufferCols) % currentBufferCols;
        const rightX = (x + 1) % currentBufferCols;
        const belowIdx = belowY * currentBufferCols + x;
        const belowLeftIdx = belowY * currentBufferCols + leftX;
        const belowRightIdx = belowY * currentBufferCols + rightX;
        const avg = (readBuffer[belowIdx] + readBuffer[belowLeftIdx] + readBuffer[belowRightIdx]) / 3;
        const darkened = Math.max(0, avg - darkenAmount);
        virtualBuffer[currentIdx] = Math.floor(darkened);
      }
    }
    samplerState.lastFrame = frame;
  }
  return (x, y) => {
    const wrappedX = (x % currentBufferCols + currentBufferCols) % currentBufferCols;
    const actualWorldHeight = worldHeight || currentBufferRows;
    const fireStartY = Math.max(0, actualWorldHeight - naturalHeight);
    if (y < fireStartY) {
      return { ch: " ", fg: FIRE_PALETTE[0], bg: bgColor, bold: false };
    }
    const bufferY = y - fireStartY;
    const clampedY = Math.max(0, Math.min(bufferY, currentBufferRows - 2));
    const paletteIndex = virtualBuffer[clampedY * currentBufferCols + wrappedX];
    const ch = charLookup[paletteIndex];
    const fgColor = FIRE_PALETTE[paletteIndex];
    return { ch, fg: fgColor, bg: bgColor, bold: false };
  };
}
function clearFireState() {
  fireStateMap.clear();
  samplerStateMap.clear();
}

// src/components/PlasmaBackgroundLayout.tsx
import { jsx as jsx7, jsxs as jsxs6 } from "react/jsx-runtime";
function PlasmaBackgroundLayout({
  children,
  mode = "fixed",
  contentClassName,
  contentStyle,
  plasmaClassName,
  generatorType = "plasma",
  virtualWidthPx,
  virtualHeightPx,
  chars,
  timeScale,
  octaves,
  seed,
  darkenAmount,
  sparkRange,
  fgColor,
  bgColor,
  showPerformanceOverlay = false,
  fps = 30,
  bitmapFontUrl
}) {
  const containerRef = useRef6(null);
  const scrollableRef = useRef6(null);
  const [viewportBounds, setViewportBounds] = useState5({ top: 0, height: 0 });
  const [viewportSize, setViewportSize] = useState5({ width: 0, height: 0 });
  const [containerHeight, setContainerHeight] = useState5(0);
  const [scrollTop, setScrollTop] = useState5(0);
  const [maxScrollTop, setMaxScrollTop] = useState5(0);
  const [isMounted, setIsMounted] = useState5(false);
  const [bitmapFont, setBitmapFont] = useState5(null);
  useEffect6(() => {
    if (!bitmapFontUrl) {
      setBitmapFont(null);
      return;
    }
    let cancelled = false;
    async function loadFont() {
      try {
        const font = await loadBitmapFontFromUrl(bitmapFontUrl);
        if (!cancelled) {
          setBitmapFont(font);
        }
      } catch (error) {
        console.error("Font loading failed:", error);
      }
    }
    loadFont();
    return () => {
      cancelled = true;
    };
  }, [bitmapFontUrl]);
  useEffect6(() => {
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
  useEffect6(() => {
    if (mode !== "scrollable" || typeof window === "undefined" || !isMounted) {
      return;
    }
    let rafId = null;
    let lastScrollHeight = 0;
    let checkInterval = null;
    const updateBounds = () => {
      if (!containerRef.current || !scrollableRef.current || typeof window === "undefined") {
        return;
      }
      const containerRect = containerRef.current.getBoundingClientRect();
      const scrollableEl2 = scrollableRef.current;
      const scrollHeight = scrollableEl2.scrollHeight;
      const clientHeight = scrollableEl2.clientHeight;
      const currentScrollTop = scrollableEl2.scrollTop;
      if (scrollHeight !== lastScrollHeight) {
        setContainerHeight(scrollHeight);
        lastScrollHeight = scrollHeight;
      }
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
    const scheduleUpdate = () => {
      if (rafId !== null) {
        return;
      }
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updateBounds();
      });
    };
    updateBounds();
    lastScrollHeight = scrollableRef.current?.scrollHeight || 0;
    const handleScroll = () => {
      const scrollableEl2 = scrollableRef.current;
      if (!scrollableEl2) {
        return;
      }
      const currentScrollTop = scrollableEl2.scrollTop;
      setScrollTop(currentScrollTop);
      scheduleUpdate();
    };
    const resizeObserver = new ResizeObserver(() => {
      scheduleUpdate();
    });
    const mutationObserver = new MutationObserver(() => {
      scheduleUpdate();
    });
    const scrollableEl = scrollableRef.current;
    const containerEl = containerRef.current;
    if (containerEl) {
      resizeObserver.observe(containerEl);
    }
    if (scrollableEl) {
      resizeObserver.observe(scrollableEl);
      mutationObserver.observe(scrollableEl, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
      });
      scrollableEl.addEventListener("scroll", handleScroll, { passive: true });
    }
    if (typeof window !== "undefined") {
      window.addEventListener("resize", scheduleUpdate, { passive: true });
    }
    checkInterval = setInterval(() => {
      if (scrollableEl) {
        const currentScrollHeight = scrollableEl.scrollHeight;
        if (currentScrollHeight !== lastScrollHeight) {
          scheduleUpdate();
        }
      }
    }, 500);
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      if (checkInterval !== null) {
        clearInterval(checkInterval);
      }
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (scrollableEl) {
        scrollableEl.removeEventListener("scroll", handleScroll);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", scheduleUpdate);
      }
    };
  }, [mode, isMounted]);
  const mergedPlasmaOptions = useMemo4(() => {
    const options = {};
    if (chars) options.chars = chars;
    if (timeScale !== void 0) options.timeScale = timeScale;
    if (octaves) options.octaves = octaves;
    if (seed !== void 0) options.seed = seed;
    if (fgColor) options.fgColor = fgColor;
    if (bgColor) options.bgColor = bgColor;
    return options;
  }, [chars, timeScale, octaves, seed, fgColor, bgColor]);
  const mergedFireOptions = useMemo4(() => {
    const options = {};
    if (chars) options.chars = chars;
    if (darkenAmount !== void 0) options.darkenAmount = darkenAmount;
    if (sparkRange) options.sparkRange = sparkRange;
    if (seed !== void 0) options.seed = seed;
    if (bgColor) options.bgColor = bgColor;
    return options;
  }, [chars, darkenAmount, sparkRange, seed, bgColor]);
  const fixedFrameGenerator = useCallback5(
    (frame, columns, rows) => {
      if (generatorType === "fire") {
        return generateAsciiFireFrame(frame, columns, rows, mergedFireOptions);
      } else {
        return generateAsciiPerlinPlasmaFrame(frame, columns, rows, mergedPlasmaOptions);
      }
    },
    [generatorType, mergedPlasmaOptions, mergedFireOptions]
  );
  const viewYRef = useRef6(0);
  const virtualRowsRef = useRef6(0);
  const virtualColumnsRef = useRef6(0);
  const scrollableFrameGenerator = useMemo4(() => {
    if (generatorType === "fire") {
      return (frame, reqColumns, reqRows) => {
        const fireOptionsWithDimensions = {
          ...mergedFireOptions,
          worldHeight: virtualRowsRef.current,
          worldWidth: virtualColumnsRef.current
        };
        const sampler = createAsciiFireSampler(frame, fireOptionsWithDimensions);
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
      };
    } else {
      return (frame, reqColumns, reqRows) => {
        const sampler = createAsciiPerlinPlasmaSampler(frame, mergedPlasmaOptions);
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
      };
    }
  }, [generatorType, mergedFireOptions, mergedPlasmaOptions]);
  const cellWidthPx = bitmapFont?.width || 8;
  const cellHeightPx = bitmapFont?.height || 16;
  if (mode === "fixed") {
    return /* @__PURE__ */ jsxs6(
      "div",
      {
        ref: containerRef,
        style: {
          position: "relative",
          minHeight: "100vh",
          width: "100%"
        },
        children: [
          /* @__PURE__ */ jsx7(
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
                return /* @__PURE__ */ jsx7(
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
          /* @__PURE__ */ jsx7(
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
    return /* @__PURE__ */ jsx7(
      "div",
      {
        ref: containerRef,
        style: {
          position: "relative",
          width: "100%",
          minHeight: "100vh"
        },
        children: /* @__PURE__ */ jsx7(
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
  const calculatedVirtualHeightPx = virtualHeightPx || containerHeight;
  const virtualColumns = Math.max(visibleColumns, Math.ceil(calculatedVirtualWidthPx / cellWidthPx));
  const virtualRows = Math.max(visibleRows, Math.ceil(calculatedVirtualHeightPx / cellHeightPx));
  const viewX = 0;
  const viewY = Math.max(0, Math.floor(scrollTop / cellHeightPx));
  viewYRef.current = viewY;
  virtualRowsRef.current = virtualRows;
  virtualColumnsRef.current = virtualColumns;
  const pixelOffsetY = scrollTop % cellHeightPx;
  return /* @__PURE__ */ jsxs6(
    "div",
    {
      ref: containerRef,
      style: {
        position: "relative",
        width: "100%",
        minHeight: "100vh"
      },
      children: [
        /* @__PURE__ */ jsx7(
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
            children: bitmapFont && /* @__PURE__ */ jsx7(
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
        /* @__PURE__ */ jsx7(
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

// src/components/FontCharacterChart.tsx
import { useEffect as useEffect7, useMemo as useMemo5, useRef as useRef7, useState as useState6 } from "react";
import { jsx as jsx8, jsxs as jsxs7 } from "react/jsx-runtime";
function FontCharacterChart({ bitmapFontUrl }) {
  const [bitmapFont, setBitmapFont] = useState6(null);
  const [loading, setLoading] = useState6(true);
  const [error, setError] = useState6(null);
  const [sorted, setSorted] = useState6(false);
  const canvasRefs = useRef7(/* @__PURE__ */ new Map());
  useEffect7(() => {
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
  useEffect7(() => {
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
    return /* @__PURE__ */ jsx8("div", { children: "Loading font..." });
  }
  if (error) {
    return /* @__PURE__ */ jsxs7("div", { children: [
      "Error: ",
      error
    ] });
  }
  if (!bitmapFont) {
    return /* @__PURE__ */ jsx8("div", { children: "No font loaded" });
  }
  return /* @__PURE__ */ jsxs7("div", { style: { padding: "20px" }, children: [
    /* @__PURE__ */ jsx8("div", { style: { marginBottom: "20px" }, children: /* @__PURE__ */ jsx8("button", { onClick: () => setSorted(!sorted), children: sorted ? "Show Original Order" : "Sort by Darkness (Darkest to Lightest)" }) }),
    /* @__PURE__ */ jsx8(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
          gap: "10px"
        },
        children: displayedCharacters.map(({ charCode, character, darkness }) => /* @__PURE__ */ jsxs7(
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
              /* @__PURE__ */ jsx8(
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
              /* @__PURE__ */ jsxs7("div", { style: { marginTop: "8px", fontSize: "12px", color: "#888" }, children: [
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
  ANSI_COLORS_RGB,
  AnsiArt,
  AnsiPlayerOverlay,
  AnsiVirtualDisplay,
  FontCharacterChart,
  PlasmaBackgroundLayout,
  RipArt,
  clearFireState,
  clearFontCache,
  convertFrameDataToAnsi,
  createAnsiArtFrameGenerator,
  createAnsiFrameGenerator,
  createAsciiFireSampler,
  createAsciiPerlinPlasmaSampler,
  detectAnimation,
  drawPerformanceOverlay,
  extractFontFromFON,
  generateAsciiFireFrame,
  generateAsciiPerlinPlasmaFrame,
  generateEvenlySpacedPalette,
  getPalette,
  getSauceInfo,
  loadBitmapFontFromUrl,
  loadRawBitmapFont,
  parseAnsi,
  parseAscii,
  parseRip,
  parseSauce,
  renderGlyph,
  renderText,
  rgbToAnsiColor,
  rgbToPaletteColor,
  ripToCanvas
};
//# sourceMappingURL=index.js.map