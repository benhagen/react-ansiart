// src/generators/charLookup.ts
function buildCharLookup(chars) {
  const charCount = chars.length;
  const lookup = new Array(256);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    lookup[i] = chars[Math.floor(t * (charCount - 1e-3))];
  }
  return lookup;
}

export {
  buildCharLookup
};
//# sourceMappingURL=chunk-IA5TXP7D.js.map