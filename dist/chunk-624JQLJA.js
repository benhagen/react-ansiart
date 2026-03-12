import {
  extractFontFromFON
} from "./chunk-ISKFY25D.js";
import {
  getEmbeddedVgaFont
} from "./chunk-H72Q7PYO.js";
import {
  cp437ByteToChar
} from "./chunk-RZAN2XLW.js";
import {
  loadRawBitmapFont,
  renderGlyph
} from "./chunk-R3T57YO4.js";

// src/components/FontCharacterChart.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
function FontCharacterChart({ bitmapFontUrl }) {
  const [bitmapFont, setBitmapFont] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sorted, setSorted] = useState(false);
  const canvasRefs = useRef(/* @__PURE__ */ new Map());
  useEffect(() => {
    if (!bitmapFontUrl) {
      setBitmapFont(getEmbeddedVgaFont());
      setLoading(false);
      return;
    }
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
  const characterInfo = useMemo(() => {
    if (!bitmapFont) return [];
    const info = [];
    for (let charCode = 32; charCode <= 255; charCode++) {
      const character = cp437ByteToChar(charCode);
      const darkness = calculateDarkness(bitmapFont, charCode);
      info.push({ charCode, character, darkness });
    }
    return info;
  }, [bitmapFont]);
  const displayedCharacters = useMemo(() => {
    if (!sorted) return characterInfo;
    return [...characterInfo].sort((a, b) => b.darkness - a.darkness);
  }, [characterInfo, sorted]);
  useEffect(() => {
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
    } catch {
    }
  }
  if (loading) {
    return /* @__PURE__ */ jsx("div", { children: "Loading font..." });
  }
  if (error) {
    return /* @__PURE__ */ jsxs("div", { children: [
      "Error: ",
      error
    ] });
  }
  if (!bitmapFont) {
    return /* @__PURE__ */ jsx("div", { children: "No font loaded" });
  }
  return /* @__PURE__ */ jsxs("div", { style: { padding: "20px" }, children: [
    /* @__PURE__ */ jsx("div", { style: { marginBottom: "20px" }, children: /* @__PURE__ */ jsx("button", { onClick: () => setSorted(!sorted), children: sorted ? "Show Original Order" : "Sort by Darkness (Darkest to Lightest)" }) }),
    /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
          gap: "10px"
        },
        children: displayedCharacters.map(({ charCode, character, darkness }) => /* @__PURE__ */ jsxs(
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
              /* @__PURE__ */ jsx(
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
              /* @__PURE__ */ jsxs("div", { style: { marginTop: "8px", fontSize: "12px", color: "#888" }, children: [
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
  FontCharacterChart
};
//# sourceMappingURL=chunk-624JQLJA.js.map