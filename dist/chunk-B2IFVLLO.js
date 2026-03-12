import {
  AnsiVirtualDisplay
} from "./chunk-ZCPDEUYS.js";
import {
  loadBitmapFontFromUrl
} from "./chunk-ZKKL2N7R.js";
import {
  getEmbeddedVgaFont
} from "./chunk-H72Q7PYO.js";
import {
  createAsciiPerlinPlasmaSampler,
  generateAsciiPerlinPlasmaFrame
} from "./chunk-YVQNOSJZ.js";

// src/components/PlasmaBackgroundLayout.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
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
  const containerRef = useRef(null);
  const scrollableRef = useRef(null);
  const [viewportBounds, setViewportBounds] = useState({ top: 0, height: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [containerHeight, setContainerHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [maxScrollTop, setMaxScrollTop] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const [bitmapFont, setBitmapFont] = useState(null);
  const fireModuleRef = useRef(null);
  const [fireModuleLoaded, setFireModuleLoaded] = useState(false);
  useEffect(() => {
    if (generatorType !== "fire") return;
    let cancelled = false;
    import("./generators/fire.js").then((mod) => {
      if (!cancelled) {
        fireModuleRef.current = mod;
        setFireModuleLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [generatorType]);
  useEffect(() => {
    if (!bitmapFontUrl) {
      setBitmapFont(getEmbeddedVgaFont());
      return;
    }
    let cancelled = false;
    async function loadFont() {
      try {
        const font = await loadBitmapFontFromUrl(bitmapFontUrl);
        if (!cancelled) {
          setBitmapFont(font);
        }
      } catch {
      }
    }
    loadFont();
    return () => {
      cancelled = true;
    };
  }, [bitmapFontUrl]);
  useEffect(() => {
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
  useEffect(() => {
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
  const mergedPlasmaOptions = useMemo(() => {
    const options = {};
    if (chars) options.chars = chars;
    if (timeScale !== void 0) options.timeScale = timeScale;
    if (octaves) options.octaves = octaves;
    if (seed !== void 0) options.seed = seed;
    if (fgColor) options.fgColor = fgColor;
    if (bgColor) options.bgColor = bgColor;
    return options;
  }, [chars, timeScale, octaves, seed, fgColor, bgColor]);
  const mergedFireOptions = useMemo(() => {
    const options = {};
    if (chars) options.chars = chars;
    if (darkenAmount !== void 0) options.darkenAmount = darkenAmount;
    if (sparkRange) options.sparkRange = sparkRange;
    if (seed !== void 0) options.seed = seed;
    if (bgColor) options.bgColor = bgColor;
    return options;
  }, [chars, darkenAmount, sparkRange, seed, bgColor]);
  const fixedFrameGenerator = useCallback(
    (frame, columns, rows) => {
      if (generatorType === "fire" && fireModuleRef.current) {
        return fireModuleRef.current.generateAsciiFireFrame(frame, columns, rows, mergedFireOptions);
      }
      return generateAsciiPerlinPlasmaFrame(frame, columns, rows, mergedPlasmaOptions);
    },
    [generatorType, mergedPlasmaOptions, mergedFireOptions, fireModuleLoaded]
  );
  const viewYRef = useRef(0);
  const virtualRowsRef = useRef(0);
  const virtualColumnsRef = useRef(0);
  const scrollableFrameGenerator = useMemo(() => {
    if (generatorType === "fire" && fireModuleRef.current) {
      const fireMod = fireModuleRef.current;
      return (frame, reqColumns, reqRows) => {
        const fireOptionsWithDimensions = {
          ...mergedFireOptions,
          worldHeight: virtualRowsRef.current,
          worldWidth: virtualColumnsRef.current
        };
        const sampler = fireMod.createAsciiFireSampler(frame, fireOptionsWithDimensions);
        const lines = [];
        const currentViewY = viewYRef.current;
        const rowsToRender = reqRows + 1;
        for (let y = 0; y < rowsToRender; y++) {
          const line = [];
          for (let x = 0; x < reqColumns; x++) {
            line.push(sampler(x, currentViewY + y));
          }
          lines.push(line);
        }
        return { lines, columns: reqColumns };
      };
    }
    return (frame, reqColumns, reqRows) => {
      const sampler = createAsciiPerlinPlasmaSampler(frame, mergedPlasmaOptions);
      const lines = [];
      const currentViewY = viewYRef.current;
      const rowsToRender = reqRows + 1;
      for (let y = 0; y < rowsToRender; y++) {
        const line = [];
        for (let x = 0; x < reqColumns; x++) {
          line.push(sampler(x, currentViewY + y));
        }
        lines.push(line);
      }
      return { lines, columns: reqColumns };
    };
  }, [generatorType, mergedFireOptions, mergedPlasmaOptions, fireModuleLoaded]);
  const cellWidthPx = bitmapFont?.width || 8;
  const cellHeightPx = bitmapFont?.height || 16;
  if (mode === "fixed") {
    return /* @__PURE__ */ jsxs(
      "div",
      {
        ref: containerRef,
        style: {
          position: "relative",
          minHeight: "100vh",
          width: "100%"
        },
        children: [
          /* @__PURE__ */ jsx(
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
                return /* @__PURE__ */ jsx(
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
          /* @__PURE__ */ jsx(
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
    return /* @__PURE__ */ jsx(
      "div",
      {
        ref: containerRef,
        style: {
          position: "relative",
          width: "100%",
          minHeight: "100vh"
        },
        children: /* @__PURE__ */ jsx(
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
  return /* @__PURE__ */ jsxs(
    "div",
    {
      ref: containerRef,
      style: {
        position: "relative",
        width: "100%",
        minHeight: "100vh"
      },
      children: [
        /* @__PURE__ */ jsx(
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
            children: bitmapFont && /* @__PURE__ */ jsx(
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
        /* @__PURE__ */ jsx(
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

export {
  PlasmaBackgroundLayout
};
//# sourceMappingURL=chunk-B2IFVLLO.js.map