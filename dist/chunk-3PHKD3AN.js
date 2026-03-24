import {
  COMMENT_ID_SIZE,
  COMMENT_SIZE,
  SAUCE_EOF,
  SAUCE_TRAILER_SIZE,
  isSauceTrailer,
  parseSauce
} from "./chunk-Y5FXFALI.js";
import {
  cp437ByteToChar
} from "./chunk-RZAN2XLW.js";

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
var MAX_CSI_PARAMS = 64;
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
    if (p === 2) {
      if (typeof state.fg === "number" && state.fg >= 8 && state.fg <= 15) {
        state.fg -= 8;
      }
      continue;
    }
    if (p === 3 || p === 4 || p === 9) {
      continue;
    }
    if (p === ANSI_BOLD_OFF) {
      state.bold = false;
      continue;
    }
    if (p === 23 || p === 24 || p === 29) {
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
function getLineWidth(ctx) {
  if (ctx.state.isDynamic) {
    return ctx.state.maxCol !== void 0 ? Math.max(ctx.state.maxCol + 1, DEFAULT_COLUMNS) : DEFAULT_COLUMNS;
  }
  return ctx.columns;
}
function handleScrollUp(ctx) {
  const n = Math.max(1, ctx.get(0, 1));
  const colWidth = getLineWidth(ctx);
  for (let scroll = 0; scroll < n; scroll++) {
    if (ctx.state.lines.length > 0) {
      ctx.state.lines.shift();
      ctx.state.lines.push(createEmptyLine(colWidth));
    }
  }
}
function handleScrollDown(ctx) {
  const n = Math.max(1, ctx.get(0, 1));
  const colWidth = getLineWidth(ctx);
  for (let scroll = 0; scroll < n; scroll++) {
    if (ctx.state.lines.length > 0) {
      ctx.state.lines.pop();
      ctx.state.lines.unshift(createEmptyLine(colWidth));
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
function parseAnsiIncremental(bytesInput, columns, maxByteIndex, encoding = "cp437") {
  return parseAnsiCore(bytesInput, { columns, maxByteIndex, encoding });
}
function parseAnsiDynamic(bytesInput, encoding = "cp437") {
  return parseAnsiCore(bytesInput, { encoding });
}
function parseAnsiIncrementalDynamic(bytesInput, maxByteIndex, encoding = "cp437") {
  return parseAnsiCore(bytesInput, { maxByteIndex, encoding });
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
function findNextRenderPoint(bytes, startIndex, batchSize = 50) {
  if (startIndex >= bytes.length) return bytes.length;
  let i = startIndex;
  let state = "normal";
  let normalCharCount = 0;
  while (i < bytes.length) {
    const b = bytes[i++];
    if (b === SOFT_EOF) return i;
    switch (state) {
      case "normal": {
        if (b === ESC) {
          if (normalCharCount > 0) return i - 1;
          state = "esc";
          break;
        }
        if (b === LF || b === CR) {
          return i;
        }
        normalCharCount++;
        if (normalCharCount >= batchSize) {
          return i;
        }
        break;
      }
      case "esc": {
        if (b === CSI_BRACKET) {
          state = "csi";
          break;
        }
        return i;
      }
      case "csi": {
        const ch = String.fromCharCode(b);
        if (b >= PARAMETER_BYTE_MIN && b <= PARAMETER_BYTE_MAX || ch === " " || ch === "?") {
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
  let state = "normal";
  let csiParams = [];
  let normalCharCount = 0;
  let newlineCount = 0;
  let foundAnyCursorCommand = false;
  while (i < bytes.length) {
    const b = bytes[i++];
    if (b === SOFT_EOF) return i;
    switch (state) {
      case "normal": {
        if (b === ESC) {
          state = "esc";
          csiParams = [];
          break;
        }
        if (b === LF || b === CR) {
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
        if (b === CSI_BRACKET) {
          state = "csi";
          break;
        }
        state = "normal";
        break;
      }
      case "csi": {
        const ch = String.fromCharCode(b);
        if (b >= PARAMETER_BYTE_MIN && b <= PARAMETER_BYTE_MAX || ch === " " || ch === "?") {
          csiParams.push(b);
          break;
        }
        const isCursorMove = ch === CSI_CMD_CURSOR_POSITION || // Cursor Position
        ch === CSI_CMD_CURSOR_POSITION_ALT || // Horizontal Vertical Position
        ch === CSI_CMD_CURSOR_UP || // Cursor Up
        ch === CSI_CMD_CURSOR_DOWN || // Cursor Down
        ch === CSI_CMD_CURSOR_FORWARD || // Cursor Forward
        ch === CSI_CMD_CURSOR_BACK || // Cursor Back
        ch === CSI_CMD_CURSOR_HORIZONTAL_ABS || // Cursor Horizontal Absolute
        ch === CSI_CMD_CURSOR_SAVE || // Save Cursor Position
        ch === CSI_CMD_CURSOR_RESTORE;
        state = "normal";
        csiParams = [];
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

export {
  parseAnsiCore,
  parseAnsi,
  parseAnsiIncremental,
  parseAnsiDynamic,
  parseAnsiIncrementalDynamic,
  detectAnimation,
  parseAscii,
  findNextRenderPoint,
  findNextCursorMove
};
//# sourceMappingURL=chunk-3PHKD3AN.js.map