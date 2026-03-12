// src/components/AnsiPlayerOverlay.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
var SPEED_PRESETS = [
  { label: "300 baud", value: Math.floor(300 / 10) },
  // 30 bytes/sec
  { label: "1200 baud", value: Math.floor(1200 / 10) },
  // 120 bytes/sec
  { label: "2400 baud", value: Math.floor(2400 / 10) },
  // 240 bytes/sec
  { label: "9600 baud", value: Math.floor(9600 / 10) },
  // 960 bytes/sec
  { label: "14.4k baud", value: Math.floor(14400 / 10) },
  // 1440 bytes/sec
  { label: "28.8k baud", value: Math.floor(28800 / 10) },
  // 2880 bytes/sec
  { label: "33.6k baud", value: Math.floor(33600 / 10) },
  // 3360 bytes/sec
  { label: "56k baud", value: Math.floor(56e3 / 10) }
  // 5600 bytes/sec
];
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
function AnsiPlayerOverlay({
  isPlaying,
  currentBytes,
  totalBytes,
  currentSpeed,
  isVisible,
  onPlayPause,
  onRestart,
  onSeek,
  onSpeedChange,
  onAdvanceByte,
  onRewindByte,
  onMouseMove,
  sauce,
  onSauceClick
}) {
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const [scrubValue, setScrubValue] = useState(currentBytes);
  const progressBarRef = useRef(null);
  const speedMenuRef = useRef(null);
  useEffect(() => {
    if (!isScrubbing) {
      setScrubValue(currentBytes);
    }
  }, [currentBytes, isScrubbing]);
  useEffect(() => {
    function handleClickOutside(event) {
      if (speedMenuRef.current && !speedMenuRef.current.contains(event.target)) {
        setIsSpeedMenuOpen(false);
      }
    }
    if (isSpeedMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isSpeedMenuOpen]);
  const handleProgressBarClick = useCallback(
    (e) => {
      if (!progressBarRef.current || totalBytes === 0) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const targetBytes = Math.floor(percentage * totalBytes);
      onSeek(targetBytes);
    },
    [totalBytes, onSeek]
  );
  const handleProgressBarMouseDown = useCallback(
    (e) => {
      if (!progressBarRef.current || totalBytes === 0) return;
      setIsScrubbing(true);
      const rect = progressBarRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const targetBytes = Math.floor(percentage * totalBytes);
      setScrubValue(targetBytes);
      let finalBytes = targetBytes;
      function handleMouseMove(moveEvent) {
        if (!progressBarRef.current) return;
        const rect2 = progressBarRef.current.getBoundingClientRect();
        const x2 = moveEvent.clientX - rect2.left;
        const percentage2 = Math.max(0, Math.min(1, x2 / rect2.width));
        const targetBytes2 = Math.floor(percentage2 * totalBytes);
        finalBytes = targetBytes2;
        setScrubValue(targetBytes2);
      }
      function handleMouseUp() {
        setIsScrubbing(false);
        onSeek(finalBytes);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      }
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [totalBytes, onSeek]
  );
  const handleSpeedSelect = useCallback(
    (speed) => {
      onSpeedChange(speed);
      setIsSpeedMenuOpen(false);
    },
    [onSpeedChange]
  );
  const progressPercent = totalBytes > 0 ? scrubValue / totalBytes * 100 : 0;
  const currentTime = currentSpeed > 0 ? currentBytes / currentSpeed : 0;
  const totalTime = currentSpeed > 0 ? totalBytes / currentSpeed : 0;
  const currentSpeedLabel = SPEED_PRESETS.find((preset) => preset.value === currentSpeed)?.label || `${currentSpeed} bps`;
  const isAtEnd = totalBytes > 0 && currentBytes >= totalBytes;
  const hasStarted = currentBytes > 0;
  const shouldShow = isVisible || isScrubbing || isSpeedMenuOpen || isAtEnd || !isPlaying;
  return /* @__PURE__ */ jsxs(
    "div",
    {
      style: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        background: "linear-gradient(to top, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0))",
        padding: "40px 16px 16px",
        transition: "opacity 0.3s ease",
        opacity: shouldShow ? 1 : 0,
        pointerEvents: shouldShow ? "auto" : "none"
      },
      onMouseMove,
      children: [
        /* @__PURE__ */ jsx("style", { children: `
				.ansi-player-btn { background: rgba(255, 255, 255, 0.2); }
				.ansi-player-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.3) !important; }
				.ansi-player-btn-text { background: rgba(255, 255, 255, 0.2); }
				.ansi-player-btn-text:hover { background: rgba(255, 255, 255, 0.3) !important; }
				.ansi-player-speed-item { background: transparent; }
				.ansi-player-speed-item:hover { background: rgba(255, 255, 255, 0.1) !important; }
			` }),
        /* @__PURE__ */ jsxs(
          "div",
          {
            ref: progressBarRef,
            onMouseDown: handleProgressBarMouseDown,
            onClick: handleProgressBarClick,
            style: {
              width: "100%",
              height: "8px",
              background: "rgba(255, 255, 255, 0.3)",
              borderRadius: "4px",
              cursor: "pointer",
              marginBottom: "12px",
              position: "relative"
            },
            children: [
              /* @__PURE__ */ jsx(
                "div",
                {
                  style: {
                    position: "absolute",
                    top: 0,
                    left: 0,
                    height: "100%",
                    width: `${progressPercent}%`,
                    background: "#ff0000",
                    borderRadius: "4px",
                    transition: isScrubbing ? "none" : "width 0.1s linear"
                  }
                }
              ),
              /* @__PURE__ */ jsx(
                "div",
                {
                  style: {
                    position: "absolute",
                    top: "50%",
                    left: `${progressPercent}%`,
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    background: "#ff0000",
                    transform: "translate(-50%, -50%)",
                    transition: isScrubbing ? "none" : "left 0.1s linear"
                  }
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "12px",
              color: "#fff",
              fontFamily: "monospace",
              fontSize: "14px"
            },
            children: [
              /* @__PURE__ */ jsx(
                "button",
                {
                  className: "ansi-player-btn",
                  onClick: onPlayPause,
                  style: {
                    border: "none",
                    color: "#fff",
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    transition: "background 0.2s"
                  },
                  title: isAtEnd ? "Restart" : isPlaying ? "Pause" : "Play",
                  children: isAtEnd ? "\u21BB" : isPlaying ? "\u23F8" : "\u25B6"
                }
              ),
              hasStarted && !isAtEnd && /* @__PURE__ */ jsx(
                "button",
                {
                  className: "ansi-player-btn",
                  onClick: onRestart,
                  style: {
                    border: "none",
                    color: "#fff",
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    transition: "background 0.2s"
                  },
                  title: "Return to beginning",
                  children: "\u23EE"
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  className: "ansi-player-btn",
                  onClick: onRewindByte,
                  disabled: currentBytes <= 0,
                  style: {
                    border: "none",
                    color: currentBytes <= 0 ? "rgba(255, 255, 255, 0.5)" : "#fff",
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    cursor: currentBytes <= 0 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    transition: "background 0.2s"
                  },
                  title: "Rewind one byte",
                  children: "\u2039\u2039"
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  className: "ansi-player-btn",
                  onClick: onAdvanceByte,
                  disabled: currentBytes >= totalBytes,
                  style: {
                    border: "none",
                    color: currentBytes >= totalBytes ? "rgba(255, 255, 255, 0.5)" : "#fff",
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    cursor: currentBytes >= totalBytes ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    transition: "background 0.2s"
                  },
                  title: "Advance one byte",
                  children: "\u203A\u203A"
                }
              ),
              /* @__PURE__ */ jsxs(
                "div",
                {
                  style: {
                    minWidth: "120px",
                    textAlign: "left"
                  },
                  children: [
                    formatTime(currentTime),
                    " / ",
                    formatTime(totalTime)
                  ]
                }
              ),
              /* @__PURE__ */ jsx("div", { style: { flex: 1 } }),
              sauce && onSauceClick && /* @__PURE__ */ jsx(
                "button",
                {
                  className: "ansi-player-btn",
                  onClick: onSauceClick,
                  style: {
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
                    transition: "background 0.2s",
                    lineHeight: "1",
                    padding: 0
                  },
                  title: "View SAUCE metadata",
                  children: "S"
                }
              ),
              /* @__PURE__ */ jsxs("div", { style: { position: "relative" }, ref: speedMenuRef, children: [
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    className: "ansi-player-btn-text",
                    onClick: () => setIsSpeedMenuOpen(!isSpeedMenuOpen),
                    style: {
                      border: "none",
                      color: "#fff",
                      padding: "8px 12px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontFamily: "monospace",
                      fontSize: "13px",
                      transition: "background 0.2s",
                      minWidth: "110px",
                      textAlign: "left"
                    },
                    children: currentSpeedLabel
                  }
                ),
                isSpeedMenuOpen && /* @__PURE__ */ jsx(
                  "div",
                  {
                    style: {
                      position: "absolute",
                      bottom: "100%",
                      right: 0,
                      marginBottom: "8px",
                      background: "rgba(0, 0, 0, 0.95)",
                      border: "1px solid rgba(255, 255, 255, 0.3)",
                      borderRadius: "4px",
                      overflow: "hidden",
                      minWidth: "140px",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)"
                    },
                    children: SPEED_PRESETS.map((preset) => /* @__PURE__ */ jsx(
                      "button",
                      {
                        className: preset.value === currentSpeed ? void 0 : "ansi-player-speed-item",
                        onClick: () => handleSpeedSelect(preset.value),
                        style: {
                          width: "100%",
                          background: preset.value === currentSpeed ? "rgba(255, 255, 255, 0.2)" : "transparent",
                          border: "none",
                          color: "#fff",
                          padding: "10px 16px",
                          textAlign: "left",
                          cursor: "pointer",
                          fontFamily: "monospace",
                          fontSize: "13px",
                          transition: "background 0.15s"
                        },
                        children: preset.label
                      },
                      preset.value
                    ))
                  }
                )
              ] })
            ]
          }
        )
      ]
    }
  );
}

export {
  AnsiPlayerOverlay
};
//# sourceMappingURL=chunk-54OD6GSV.js.map