// src/font/fonExtractor.ts
async function extractFontFromFON(url) {
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
      if (count > 0) {
        const fontResOffset = (bytes[pos] | bytes[pos + 1] << 8) << alignShift;
        const fontResLength = (bytes[pos + 2] | bytes[pos + 3] << 8) << alignShift;
        const fntData = bytes.slice(fontResOffset, fontResOffset + fontResLength);
        const dfPixWidth = fntData[86] | fntData[87] << 8;
        const dfPixHeight = fntData[88] | fntData[89] << 8;
        const dfFirstChar = fntData[95];
        const dfLastChar = fntData[96];
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
        const expectedBitmapSize = 256 * bytesPerGlyph;
        if (fntData.length >= bitmapOffset + expectedBitmapSize) {
          return {
            bitmapData: fntData.slice(bitmapOffset, bitmapOffset + expectedBitmapSize),
            width: dfPixWidth,
            height: dfPixHeight
          };
        }
        const absoluteBitmapOffset = fontResOffset + bitmapOffset;
        if (bytes.length >= absoluteBitmapOffset + expectedBitmapSize) {
          return {
            bitmapData: bytes.slice(
              absoluteBitmapOffset,
              absoluteBitmapOffset + expectedBitmapSize
            ),
            width: dfPixWidth,
            height: dfPixHeight
          };
        }
        return null;
      }
    }
    pos += count * 12;
  }
  return null;
}

export {
  extractFontFromFON
};
//# sourceMappingURL=chunk-ISKFY25D.js.map