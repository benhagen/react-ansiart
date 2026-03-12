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

export {
  cp437ByteToChar,
  charToCp437Byte
};
//# sourceMappingURL=chunk-RZAN2XLW.js.map