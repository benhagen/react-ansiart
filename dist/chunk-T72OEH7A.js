import {
  createAnsiArtFrameGenerator
} from "./chunk-LSGSMP4Z.js";
import {
  detectAnimation,
  parseAnsiCore
} from "./chunk-3PHKD3AN.js";
import {
  getSauceInfo,
  parseSauce
} from "./chunk-Y5FXFALI.js";
import {
  AnsiVirtualDisplay
} from "./chunk-4RKQEKOE.js";

// src/components/AnsiArt.tsx
import { useCallback, useEffect as useEffect2, useMemo, useRef as useRef2, useState } from "react";

// src/components/SauceMetadataModal.tsx
import { useEffect, useRef } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
function SauceMetadataModal({ sauce, isOpen, onClose }) {
  const modalRef = useRef(null);
  useEffect(() => {
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
  useEffect(() => {
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
  return /* @__PURE__ */ jsx(
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
      children: /* @__PURE__ */ jsxs(
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
            /* @__PURE__ */ jsxs(
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
                  /* @__PURE__ */ jsx(
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
                  /* @__PURE__ */ jsx(
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
            /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: "16px" }, children: [
              sauce.title && /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("div", { style: { color: "#888", marginBottom: "4px" }, children: "Title:" }),
                /* @__PURE__ */ jsx("div", { style: { color: "#fff" }, children: sauce.title })
              ] }),
              sauce.author && /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("div", { style: { color: "#888", marginBottom: "4px" }, children: "Author:" }),
                /* @__PURE__ */ jsx("div", { style: { color: "#fff" }, children: sauce.author })
              ] }),
              sauce.group && /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("div", { style: { color: "#888", marginBottom: "4px" }, children: "Group:" }),
                /* @__PURE__ */ jsx("div", { style: { color: "#fff" }, children: sauce.group })
              ] }),
              sauce.date && /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("div", { style: { color: "#888", marginBottom: "4px" }, children: "Date:" }),
                /* @__PURE__ */ jsx("div", { style: { color: "#fff" }, children: sauce.date.length === 8 ? `${sauce.date.slice(0, 4)}-${sauce.date.slice(4, 6)}-${sauce.date.slice(6, 8)}` : sauce.date })
              ] }),
              sauceInfo && /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("div", { style: { color: "#888", marginBottom: "4px" }, children: "File Type:" }),
                /* @__PURE__ */ jsxs("div", { style: { color: "#fff" }, children: [
                  sauceInfo.fileTypeDescription,
                  " (DataType: ",
                  sauce.dataType,
                  ", FileType: ",
                  sauce.fileType,
                  ")"
                ] })
              ] }),
              sauceInfo?.hasDimensions ? /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("div", { style: { color: "#888", marginBottom: "4px" }, children: "Dimensions:" }),
                /* @__PURE__ */ jsxs("div", { style: { color: "#fff" }, children: [
                  sauceInfo.width,
                  " \xD7 ",
                  sauceInfo.height,
                  " characters"
                ] })
              ] }) : /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("div", { style: { color: "#888", marginBottom: "4px" }, children: "Dimensions:" }),
                /* @__PURE__ */ jsx("div", { style: { color: "#666" }, children: "Not specified" })
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("div", { style: { color: "#888", marginBottom: "4px" }, children: "Type Info Fields:" }),
                /* @__PURE__ */ jsxs("div", { style: { color: "#fff", fontSize: "12px", fontFamily: "monospace" }, children: [
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
              sauce.tInfoS && /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("div", { style: { color: "#888", marginBottom: "4px" }, children: "TInfoS:" }),
                /* @__PURE__ */ jsx("div", { style: { color: "#fff" }, children: sauce.tInfoS })
              ] }),
              sauceInfo?.fontName && /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("div", { style: { color: "#888", marginBottom: "4px" }, children: "Font:" }),
                /* @__PURE__ */ jsx("div", { style: { color: "#fff" }, children: sauceInfo.fontName })
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("div", { style: { color: "#888", marginBottom: "4px" }, children: "Flags:" }),
                /* @__PURE__ */ jsxs("div", { style: { color: "#fff", display: "flex", flexDirection: "column", gap: "4px" }, children: [
                  sauceInfo?.iceColors && /* @__PURE__ */ jsx("div", { children: "\u2022 ICE Colors enabled" }),
                  sauceInfo?.letterSpacing && /* @__PURE__ */ jsx("div", { children: "\u2022 Letter spacing enabled" }),
                  !sauceInfo?.iceColors && !sauceInfo?.letterSpacing && /* @__PURE__ */ jsx("div", { style: { color: "#666" }, children: "None" })
                ] })
              ] }),
              sauceInfo?.aspectRatio && /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("div", { style: { color: "#888", marginBottom: "4px" }, children: "Aspect Ratio:" }),
                /* @__PURE__ */ jsxs("div", { style: { color: "#fff" }, children: [
                  sauceInfo.aspectRatio.width,
                  ":",
                  sauceInfo.aspectRatio.height
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("div", { style: { color: "#888", marginBottom: "4px" }, children: "File Size:" }),
                /* @__PURE__ */ jsxs("div", { style: { color: "#fff" }, children: [
                  sauce.fileSize.toLocaleString(),
                  " bytes"
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("div", { style: { color: "#888", marginBottom: "4px" }, children: "SAUCE Version:" }),
                /* @__PURE__ */ jsx("div", { style: { color: "#fff" }, children: sauce.version })
              ] }),
              /* @__PURE__ */ jsxs(
                "div",
                {
                  style: {
                    marginTop: "8px",
                    paddingTop: "16px",
                    borderTop: "1px solid #333"
                  },
                  children: [
                    /* @__PURE__ */ jsx("div", { style: { color: "#888", marginBottom: "12px", fontSize: "12px", fontWeight: "bold" }, children: "Technical Details" }),
                    /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: "8px", fontSize: "11px", color: "#aaa" }, children: [
                      /* @__PURE__ */ jsxs("div", { children: [
                        "ID: ",
                        sauce.id
                      ] }),
                      /* @__PURE__ */ jsxs("div", { children: [
                        "Version: ",
                        sauce.version
                      ] }),
                      /* @__PURE__ */ jsxs("div", { children: [
                        "DataType: ",
                        sauce.dataType
                      ] }),
                      /* @__PURE__ */ jsxs("div", { children: [
                        "FileType: ",
                        sauce.fileType
                      ] }),
                      /* @__PURE__ */ jsxs("div", { children: [
                        "TInfo1: ",
                        sauce.tInfo1,
                        " | TInfo2: ",
                        sauce.tInfo2,
                        " | TInfo3: ",
                        sauce.tInfo3,
                        " | TInfo4: ",
                        sauce.tInfo4
                      ] }),
                      /* @__PURE__ */ jsxs("div", { children: [
                        "tFlags: 0x",
                        sauce.tFlags.toString(16).toUpperCase().padStart(2, "0"),
                        " (",
                        sauce.tFlags,
                        ")"
                      ] }),
                      sauce.tInfoS && /* @__PURE__ */ jsxs("div", { children: [
                        "TInfoS: ",
                        sauce.tInfoS
                      ] }),
                      /* @__PURE__ */ jsxs("div", { children: [
                        "Comments: ",
                        sauce.comments
                      ] }),
                      /* @__PURE__ */ jsxs("div", { children: [
                        "FileSize: ",
                        sauce.fileSize,
                        " bytes"
                      ] })
                    ] })
                  ]
                }
              ),
              sauce.comments > 0 && sauce.commentLines.length > 0 && /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsxs("div", { style: { color: "#888", marginBottom: "8px" }, children: [
                  "Comments (",
                  sauce.comments,
                  "):"
                ] }),
                /* @__PURE__ */ jsx(
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
                    children: sauce.commentLines.map((comment, idx) => /* @__PURE__ */ jsx("div", { style: { marginBottom: idx < sauce.commentLines.length - 1 ? "8px" : "0" }, children: comment }, idx))
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
import { jsx as jsx2 } from "react/jsx-runtime";
function SauceOverlay({ isVisible, onClick }) {
  if (!isVisible) return null;
  return /* @__PURE__ */ jsx2(
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
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
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
  const [ansiData, setAnsiData] = useState(null);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [dynamicColumns, setDynamicColumns] = useState(80);
  const [dynamicRows, setDynamicRows] = useState(25);
  const [detectedFinalRows, setDetectedFinalRows] = useState(null);
  const [finalHeightForAnimated, setFinalHeightForAnimated] = useState(null);
  const [scrollViewY, setScrollViewY] = useState(0);
  const [virtualRows, setVirtualRows] = useState(25);
  const [sauce, setSauce] = useState(void 0);
  const [isSauceModalOpen, setIsSauceModalOpen] = useState(false);
  const [isSauceOverlayVisible, setIsSauceOverlayVisible] = useState(false);
  const [detectedMode, setDetectedMode] = useState("final");
  const sauceOverlayTimeoutRef = useRef2(null);
  useEffect2(() => {
    if (mode === "auto" && ansiData) {
      const isAnimated = detectAnimation(ansiData);
      setDetectedMode(isAnimated ? "animated" : "final");
    } else if (mode !== "auto") {
      setDetectedMode("final");
    }
  }, [mode, ansiData]);
  const effectiveMode = useMemo(() => {
    if (mode === "auto") {
      return detectedMode;
    }
    return mode;
  }, [mode, detectedMode]);
  useEffect2(() => {
    if (ansiData && sauceOverlay) {
      const parsedSauce = parseSauce(ansiData);
      if (parsedSauce) {
        setSauce(parsedSauce);
      }
    } else if (!sauceOverlay) {
      setSauce(void 0);
    }
  }, [ansiData, sauceOverlay]);
  useEffect2(() => {
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
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
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
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  useEffect2(() => {
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
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [effectiveMode, ansiData, columns, rows]);
  const handleDimensionsChange = useCallback(
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
  const handleScrollChange = useCallback(
    (scroll) => {
      if (effectiveMode === "animated" && typeof columns === "number" && typeof rows === "number") {
        const newVirtualRows = Math.max(rows, scroll.contentRows);
        setScrollViewY(scroll.viewY);
        setVirtualRows(newVirtualRows);
      }
    },
    [effectiveMode, columns, rows]
  );
  const frameGenerator = useMemo(() => {
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
  const displayColumns = useMemo(() => {
    if (columns === "auto") {
      return dynamicColumns;
    } else {
      return columns;
    }
  }, [columns, dynamicColumns]);
  const displayRows = useMemo(() => {
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
  const rootStyle = useMemo(
    () => ({
      ...isDragging ? { outline: "2px dashed #888", outlineOffset: "-2px" } : {}
    }),
    [isDragging]
  );
  const handleSauceClick = useCallback(() => {
    if (sauce) {
      setIsSauceModalOpen(true);
    }
  }, [sauce]);
  const handleSauceMouseMove = useCallback(() => {
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
  const handleSauceMouseLeave = useCallback(() => {
    if (!showOverlayControls && sauceOverlay && sauce) {
      if (sauceOverlayTimeoutRef.current) {
        clearTimeout(sauceOverlayTimeoutRef.current);
      }
      setIsSauceOverlayVisible(false);
    }
  }, [showOverlayControls, sauceOverlay, sauce]);
  useEffect2(() => {
    return () => {
      if (sauceOverlayTimeoutRef.current) {
        clearTimeout(sauceOverlayTimeoutRef.current);
      }
    };
  }, []);
  if (error) {
    return /* @__PURE__ */ jsx3(
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
    return /* @__PURE__ */ jsx3(
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
  return /* @__PURE__ */ jsxs2(
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
        /* @__PURE__ */ jsx3(
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
        !showOverlayControls && sauceOverlay && sauce && /* @__PURE__ */ jsx3(SauceOverlay, { isVisible: isSauceOverlayVisible, onClick: handleSauceClick }),
        sauce && /* @__PURE__ */ jsx3(
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

export {
  AnsiArt
};
//# sourceMappingURL=chunk-T72OEH7A.js.map