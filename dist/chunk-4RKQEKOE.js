import {
  loadBitmapFontFromUrl
} from "./chunk-GBKXSTBJ.js";
import {
  AnsiPlayerOverlay
} from "./chunk-54OD6GSV.js";
import {
  getEmbeddedVgaFont
} from "./chunk-H72Q7PYO.js";
import {
  charToCp437Byte
} from "./chunk-RZAN2XLW.js";
import {
  renderGlyph
} from "./chunk-XYPTVL3M.js";

// src/components/AnsiVirtualDisplay.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  const totalTime = renderTime + drawTime;
  const lines = [
    `FPS: ${actualFps.toFixed(1)} / ${targetFps}`,
    `Frame: ${totalTime.toFixed(2)}ms (gen ${renderTime.toFixed(1)} + draw ${drawTime.toFixed(1)})`,
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
    // Dirty-cell tracking: store previous frame's cell state to skip unchanged cells
    this.previousCells = null;
    this.previousCellsCols = 0;
    this.previousCellsRows = 0;
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
        const framesToAdvance = Math.max(1, Math.floor(elapsed / frameInterval));
        this.currentFrame += framesToAdvance;
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
    const gen = this._getGeneratorMetadata();
    if (gen?.clearManualBytePosition) {
      this._syncFrameToBytePosition(gen);
      gen.clearManualBytePosition();
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
    this._getGeneratorMetadata()?.clearManualBytePosition?.();
    this._generateAndRender();
    if (this.isPlaying) {
      this._startAnimation();
    }
  }
  setBitmapFont(font) {
    if (this.bitmapFont?.glyphCache) {
      this.bitmapFont.glyphCache.clear();
    }
    this.previousCells = null;
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
    const gen = this._getGeneratorMetadata();
    if (gen?.getCurrentBytePosition) {
      return gen.getCurrentBytePosition();
    }
    if (gen?.getCurrentSpeed) {
      const bytesPerSecond = gen.getCurrentSpeed();
      const elapsedSeconds = this.currentFrame / this.config.fps;
      const totalBytes = this.getTotalBytes();
      return Math.min(Math.floor(elapsedSeconds * bytesPerSecond), totalBytes);
    }
    return 0;
  }
  getTotalBytes() {
    const gen = this._getGeneratorMetadata();
    if (gen?.capabilities?.getTotalBytes) {
      return gen.capabilities.getTotalBytes();
    }
    return 0;
  }
  seekToBytePosition(bytePosition) {
    const gen = this._getGeneratorMetadata();
    if (gen?.getCurrentSpeed) {
      const bytesPerSecond = gen.getCurrentSpeed();
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
    this._getGeneratorMetadata()?.setSpeed?.(bytesPerSecond);
  }
  advanceByte() {
    const gen = this._getGeneratorMetadata();
    if (gen?.advanceByte) {
      gen.advanceByte();
      this._syncFrameToBytePosition(gen);
      this._generateAndRender();
    }
  }
  rewindByte() {
    const gen = this._getGeneratorMetadata();
    if (gen?.rewindByte) {
      gen.rewindByte();
      this._syncFrameToBytePosition(gen);
      this._generateAndRender();
    }
  }
  getMaxFrames() {
    const gen = this._getGeneratorMetadata();
    if (gen?.capabilities?.getTotalFrames) {
      return gen.capabilities.getTotalFrames();
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
    const gen = this._getGeneratorMetadata();
    if (gen?.getCurrentSpeed) {
      return gen.getCurrentSpeed();
    }
    return 0;
  }
  getGeneratorCapabilities() {
    return this._getGeneratorMetadata()?.capabilities ?? null;
  }
  _getGeneratorMetadata() {
    const generator = this.config.frameGenerator;
    if (typeof generator === "function") {
      return generator;
    }
    return null;
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
  _syncFrameToBytePosition(gen) {
    if (gen.getCurrentBytePosition && gen.getCurrentSpeed) {
      const currentBytePos = gen.getCurrentBytePosition();
      const bytesPerSecond = gen.getCurrentSpeed();
      if (bytesPerSecond > 0) {
        this.currentFrame = Math.floor(currentBytePos / bytesPerSecond * this.config.fps);
      }
    }
  }
  _isFinalMode() {
    const gen = this._getGeneratorMetadata();
    return gen?.capabilities?.supportsSeek === false;
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
    this.previousCells = null;
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
    const totalCells = screenRows * screenCols;
    const prev = this.previousCells;
    const canDiff = prev !== null && this.previousCellsCols === screenCols && this.previousCellsRows === screenRows;
    if (!canDiff) {
      offCtx.fillStyle = this.config.background;
      offCtx.fillRect(0, 0, cssWidth, bufferedHeight);
    }
    if (!prev || prev.length !== totalCells) {
      this.previousCells = new Array(totalCells);
      for (let i = 0; i < totalCells; i++) {
        this.previousCells[i] = { ch: "", fg: -1, bg: -1, bold: false };
      }
    }
    let cellIdx = 0;
    for (let r = 0; r < screenRows; r++) {
      const cells = this.screen.lines[r];
      if (!cells) {
        cellIdx += screenCols;
        continue;
      }
      for (let c = 0; c < cells.length; c++) {
        const cell = cells[c];
        const prevCell = this.previousCells[cellIdx];
        if (canDiff && prevCell.ch === cell.ch && prevCell.fg === cell.fg && prevCell.bg === cell.bg && prevCell.bold === cell.bold) {
          cellIdx++;
          continue;
        }
        const x = c * charWidth;
        const y = r * charHeight;
        const fg = typeof cell.fg === "number" && cell.bold && cell.fg < 8 ? cell.fg + 8 : cell.fg;
        const fgColor = colorToCss(fg, "#AAAAAA");
        const bgColor = colorToCss(cell.bg, "#000000");
        const charCode = charToCp437Byte(cell.ch);
        renderGlyph(offCtx, this.bitmapFont, charCode, x, y, fgColor, bgColor);
        prevCell.ch = cell.ch;
        prevCell.fg = cell.fg;
        prevCell.bg = cell.bg;
        prevCell.bold = cell.bold;
        cellIdx++;
      }
    }
    this.previousCellsCols = screenCols;
    this.previousCellsRows = screenRows;
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

// src/components/AnsiVirtualDisplay.tsx
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
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
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const previousFrameGeneratorRef = useRef(null);
  const [bitmapFont, setBitmapFont] = useState(providedBitmapFont || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);
  const [currentBytes, setCurrentBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(960);
  const hideTimeoutRef = useRef(null);
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
  useEffect(() => {
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
  useEffect(() => {
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
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setBitmapFont(bitmapFont);
  }, [bitmapFont]);
  useEffect(() => {
    if (providedBitmapFont) {
      setBitmapFont(providedBitmapFont);
      return;
    }
    if (!bitmapFontUrl) {
      setBitmapFont(getEmbeddedVgaFont());
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
  const handleMouseMove = useCallback(() => {
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
  const handleMouseLeave = useCallback(() => {
    if (!showOverlayControls) return;
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    if (isPlaying) {
      setIsOverlayVisible(false);
    }
  }, [showOverlayControls, isPlaying]);
  const handleSeek = useCallback((bytePosition) => {
    if (!engineRef.current) return;
    engineRef.current.seekToBytePosition(bytePosition);
    setCurrentBytes(bytePosition);
  }, []);
  const handleSpeedChange = useCallback((bytesPerSecond) => {
    if (!engineRef.current) return;
    engineRef.current.setSpeed(bytesPerSecond);
    setCurrentSpeed(bytesPerSecond);
  }, []);
  const handleAdvanceByte = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.advanceByte();
    setCurrentBytes(engineRef.current.getCurrentBytePosition());
  }, []);
  const handleRewindByte = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.rewindByte();
    setCurrentBytes(engineRef.current.getCurrentBytePosition());
  }, []);
  const lastPolledBytesRef = useRef(-1);
  useEffect(() => {
    if (!supportsOverlayControls || !isPlaying) return;
    const intervalId = setInterval(() => {
      if (engineRef.current) {
        const bytes = engineRef.current.getCurrentBytePosition();
        const total = engineRef.current.getTotalBytes();
        if (total > 0 && bytes >= total) {
          engineRef.current.pause();
          setIsPlaying(false);
          setCurrentBytes(total);
          lastPolledBytesRef.current = total;
        } else if (bytes !== lastPolledBytesRef.current) {
          setCurrentBytes(bytes);
          lastPolledBytesRef.current = bytes;
        }
      }
    }, 100);
    return () => clearInterval(intervalId);
  }, [supportsOverlayControls, isPlaying]);
  useEffect(() => {
    if (engineRef.current) {
      setCurrentBytes(engineRef.current.getCurrentBytePosition());
      const speed = engineRef.current.getCurrentBytesPerSecond();
      if (speed) setCurrentSpeed(speed);
    }
  }, [isPlaying]);
  useEffect(() => {
    if (engineRef.current && supportsOverlayControls) {
      const speed = engineRef.current.getCurrentBytesPerSecond();
      if (speed) setCurrentSpeed(speed);
      const bytes = engineRef.current.getTotalBytes();
      if (bytes) setTotalBytes(bytes);
    }
  }, [supportsOverlayControls, frameGenerator]);
  useEffect(() => {
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
  const canvasContainerStyle = useMemo(() => ({
    position: "relative",
    display: "inline-block",
    width: fillContainer ? "100%" : "fit-content"
  }), [fillContainer]);
  const controlsBarStyle = useMemo(() => ({
    display: "flex",
    gap: "8px",
    marginBottom: "8px",
    alignItems: "center"
  }), []);
  const buttonStyle = useMemo(() => ({
    padding: "6px 12px",
    color: "#AAA",
    border: "1px solid #555",
    cursor: "pointer",
    fontSize: "14px",
    fontFamily: "monospace"
  }), []);
  const debugOverlayStyle = useMemo(() => ({
    position: "absolute",
    top: 0,
    left: 0,
    background: "rgba(0, 0, 0, 0.8)",
    color: "#0f0",
    padding: "4px 8px",
    fontSize: "10px",
    fontFamily: "monospace",
    pointerEvents: "none"
  }), []);
  return /* @__PURE__ */ jsxs("div", { children: [
    showControls && !supportsOverlayControls && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("style", { children: `
						.ansi-simple-btn { background: #333; }
						.ansi-simple-btn:hover { background: #444 !important; }
					` }),
      /* @__PURE__ */ jsxs("div", { style: controlsBarStyle, children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            className: "ansi-simple-btn",
            onClick: handlePlayPause,
            style: buttonStyle,
            children: isPlaying ? "\u23F8 Pause" : "\u25B6 Play"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            className: "ansi-simple-btn",
            onClick: handleRestart,
            style: buttonStyle,
            children: "\u23EE Restart"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        style: canvasContainerStyle,
        onMouseMove: handleMouseMove,
        onMouseLeave: handleMouseLeave,
        children: [
          /* @__PURE__ */ jsx("canvas", { ref: canvasRef, style: rootStyle, "aria-label": "ANSI Virtual Display" }),
          supportsOverlayControls && /* @__PURE__ */ jsx(
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
          supportsOverlayControls && isOverlayVisible && typeof window !== "undefined" && /* @__PURE__ */ jsxs("div", { style: debugOverlayStyle, children: [
            "Bytes: ",
            currentBytes,
            " / ",
            totalBytes,
            " | Speed: ",
            currentSpeed,
            " bytes/sec"
          ] })
        ]
      }
    )
  ] });
}

export {
  drawPerformanceOverlay,
  AnsiVirtualDisplay
};
//# sourceMappingURL=chunk-4RKQEKOE.js.map