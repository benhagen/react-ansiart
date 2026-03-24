import {
  extractFontFromFON
} from "./chunk-ISKFY25D.js";
import {
  loadRawBitmapFont
} from "./chunk-XYPTVL3M.js";

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
  } catch {
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
    if (e instanceof DOMException && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED")) {
      console.warn("[fontCache] localStorage quota exceeded, cannot cache font");
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
  } catch {
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
    console.warn("Failed to load bitmap font:", e instanceof Error ? e.message : e);
    return null;
  }
}

export {
  clearFontCache,
  loadBitmapFontFromUrl
};
//# sourceMappingURL=chunk-GBKXSTBJ.js.map