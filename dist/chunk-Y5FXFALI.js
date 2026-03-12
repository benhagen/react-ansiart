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

export {
  SAUCE_TRAILER_SIZE,
  SAUCE_EOF,
  COMMENT_SIZE,
  COMMENT_ID_SIZE,
  isSauceTrailer,
  parseSauce,
  getSauceInfo
};
//# sourceMappingURL=chunk-Y5FXFALI.js.map