import type { AnsiScreen } from '../ansi/types'
import { charToCp437Byte } from '../utils/cp437'
import { BitmapFont, renderGlyph } from '../font/bitmapFont'
import type { CharacterFrameGenerator, CharacterFrameGeneratorWithMetadata, DisplayFrameGenerator, GeneratorCapabilities, PixelFrameGenerator } from '../types/types'
import { drawPerformanceOverlay, type PerformanceStats } from '../utils/performanceOverlay'

const DOS_COLORS: Record<number, string> = {
	0: '#000000',
	1: '#0000AA',
	2: '#00AA00',
	3: '#00AAAA',
	4: '#AA0000',
	5: '#AA00AA',
	6: '#AA5500',
	7: '#AAAAAA',
	8: '#555555',
	9: '#5555FF',
	10: '#55FF55',
	11: '#55FFFF',
	12: '#FF5555',
	13: '#FF55FF',
	14: '#FFFF55',
	15: '#FFFFFF',
}

/**
 * Convert color value (ANSI index or CSS string) to CSS color string
 */
function colorToCss(color: number | string, defaultColor: string = '#AAAAAA'): string {
	if (typeof color === 'string') {
		return color
	}
	return DOS_COLORS[color] ?? defaultColor
}

export type DisplayConfig = {
	columns: number
	rows: number
	frameGenerator: DisplayFrameGenerator
	fps: number
	background: string
	showPerformanceOverlay?: boolean
	// Virtual world and viewport information for performance overlay
	virtualColumns?: number
	virtualRows?: number
	viewX?: number
	viewY?: number
	// Pixel-precise scroll offsets (for smooth scrolling)
	pixelOffsetX?: number
	pixelOffsetY?: number
}

export type DisplayConfigWithInitialState = DisplayConfig & {
	startPaused?: boolean // Start in paused state (useful for overlay controls)
}

export class AnsiVirtualDisplayEngine {
	private canvas: HTMLCanvasElement
	private config: DisplayConfig
	private bitmapFont: BitmapFont | null = null
	private currentFrame: number = 0
	private isPlaying: boolean = true
	private screen: AnsiScreen | null = null
	private animationFrameId: number | null = null
	private lastFrameTime: number = 0
	private showPerformanceOverlay: boolean = false
	private renderTime: number = 0
	private drawTime: number = 0
	private previousDrawTime: number = 0
	private fpsHistory: number[] = []
	private actualFps: number = 0
	private targetFps: number = 0
	private offscreenCanvas: HTMLCanvasElement | null = null
	private offscreenCtx: CanvasRenderingContext2D | null = null
	// Onscreen context: fetched once (context creation attributes only apply on the
	// FIRST getContext() call for a canvas) and reused across renders.
	private ctx: CanvasRenderingContext2D | null = null
	private lastRenderedViewY: number = -1
	// Dirty-cell tracking: store previous frame's cell state to skip unchanged cells
	private previousCells: Array<{ ch: string; fg: number | string; bg: number | string; bold: boolean }> | null = null
	private previousCellsCols: number = 0
	private previousCellsRows: number = 0
	// When true, the next _render() call always performs the onscreen clear+blit even if the
	// dirty-cell diff finds nothing changed. Set by any explicit/user-triggered action (config
	// update, seek, restart, font swap, ...) so those paths always paint; left false for the
	// steady-state RAF-driven render, which is where the skip-when-unchanged optimization matters.
	private forceNextBlit: boolean = true

	constructor(canvas: HTMLCanvasElement, config: DisplayConfigWithInitialState) {
		this.canvas = canvas
		this.config = { ...config }
		this.showPerformanceOverlay = config.showPerformanceOverlay ?? false
		this.targetFps = config.fps
		this.isPlaying = !config.startPaused // Start paused if requested
		this._setupCanvas()
		// Only auto-start animation if playing
		if (this.isPlaying) {
			this._startAnimation()
		}
		// Always render the first frame (at position 0)
		this._generateAndRender()
	}

	play(): void {
		if (this.isPlaying) return
		this.isPlaying = true
		// Clear manual byte position when resuming playback so time-based progression works
		const gen = this._getGeneratorMetadata()
		if (gen?.clearManualBytePosition) {
			this._syncFrameToBytePosition(gen)
			gen.clearManualBytePosition()
			this.forceNextBlit = true
			this._generateAndRender()
		}
		this._startAnimation()
	}

	pause(): void {
		if (!this.isPlaying) return
		this.isPlaying = false
		this._stopAnimation()
	}

	restart(): void {
		this.currentFrame = 0
		this.isPlaying = true
		// Clear manual byte position when restarting
		this._getGeneratorMetadata()?.clearManualBytePosition?.()
		this.forceNextBlit = true
		this._generateAndRender()
		if (this.isPlaying) {
			this._startAnimation()
		}
	}

	setBitmapFont(font: BitmapFont | null): void {
		// Release the outgoing font's rendered glyphs; they are keyed to its bitmaps.
		this.bitmapFont?.glyphCache?.clear()
		this.bitmapFont?.glyphMaskCache?.clear()
		this.previousCells = null
		this.bitmapFont = font
		this.forceNextBlit = true
		this._setupCanvas()
		this._render()
	}

	updateConfig(config: Partial<DisplayConfig>): void {
		const needsCanvasResize = config.columns !== undefined || config.rows !== undefined

		const overlayToggled =
			config.showPerformanceOverlay !== undefined &&
			config.showPerformanceOverlay !== this.showPerformanceOverlay

		// Conservative: any config update (background, viewport, pixel scroll offset, etc.)
		// may affect the composite even with zero dirty cells, so always force the next blit.
		this.forceNextBlit = true

		this.config = { ...this.config, ...config }

		if (config.showPerformanceOverlay !== undefined) {
			this.showPerformanceOverlay = config.showPerformanceOverlay
		}

		if (config.fps !== undefined) {
			this.targetFps = config.fps
		}

		if (needsCanvasResize) {
			this._setupCanvas()
		}

		// Regenerate frame if config affects frame generation or overlay was toggled
		if (
			config.columns !== undefined ||
			config.rows !== undefined ||
			config.frameGenerator !== undefined ||
			overlayToggled
		) {
			this._generateAndRender()
		} else {
			// Just re-render with new styling
			this._render()
		}
	}

	getPlayingState(): boolean {
		return this.isPlaying
	}

	getCurrentFrame(): number {
		return this.currentFrame
	}

	getCurrentBytePosition(): number {
		const gen = this._getGeneratorMetadata()
		// First try to get byte position from generator (for manual stepping)
		if (gen?.getCurrentBytePosition) {
			return gen.getCurrentBytePosition()
		}

		// Fall back to calculating from elapsed time and speed
		if (gen?.getCurrentSpeed) {
			const bytesPerSecond = gen.getCurrentSpeed()
			const elapsedSeconds = this.currentFrame / this.config.fps
			const totalBytes = this.getTotalBytes()
			return Math.min(Math.floor(elapsedSeconds * bytesPerSecond), totalBytes)
		}
		return 0
	}

	getTotalBytes(): number {
		const gen = this._getGeneratorMetadata()
		if (gen?.capabilities?.getTotalBytes) {
			return gen.capabilities.getTotalBytes()
		}
		return 0
	}

	seekToBytePosition(bytePosition: number): void {
		const gen = this._getGeneratorMetadata()
		if (gen?.getCurrentSpeed) {
			const bytesPerSecond = gen.getCurrentSpeed()
			if (bytesPerSecond > 0) {
				const targetSeconds = bytePosition / bytesPerSecond
				const targetFrame = Math.floor(targetSeconds * this.config.fps)
				this.seekToFrame(targetFrame)
			}
		}
	}

	enablePerformanceOverlay(enabled: boolean): void {
		this.showPerformanceOverlay = enabled
		this.forceNextBlit = true
		this._generateAndRender()
	}

	destroy(): void {
		this._stopAnimation()
	}

	seekToFrame(frame: number): void {
		this.currentFrame = Math.max(0, frame)
		this.forceNextBlit = true
		this._generateAndRender()
	}

	setSpeed(bytesPerSecond: number): void {
		this._getGeneratorMetadata()?.setSpeed?.(bytesPerSecond)
	}

	advanceByte(): void {
		const gen = this._getGeneratorMetadata()
		if (gen?.advanceByte) {
			gen.advanceByte()
			this._syncFrameToBytePosition(gen)
			this.forceNextBlit = true
			this._generateAndRender()
		}
	}

	rewindByte(): void {
		const gen = this._getGeneratorMetadata()
		if (gen?.rewindByte) {
			gen.rewindByte()
			this._syncFrameToBytePosition(gen)
			this.forceNextBlit = true
			this._generateAndRender()
		}
	}

	getMaxFrames(): number {
		const gen = this._getGeneratorMetadata()
		if (gen?.capabilities?.getTotalFrames) {
			return gen.capabilities.getTotalFrames()
		}
		return 0
	}

	getCurrentTime(): number {
		return this.currentFrame / this.config.fps
	}

	getTotalTime(): number {
		const maxFrames = this.getMaxFrames()
		return maxFrames > 0 ? maxFrames / this.config.fps : 0
	}

	getCurrentBytesPerSecond(): number {
		const gen = this._getGeneratorMetadata()
		if (gen?.getCurrentSpeed) {
			return gen.getCurrentSpeed()
		}
		return 0
	}

	getGeneratorCapabilities(): GeneratorCapabilities | null {
		return this._getGeneratorMetadata()?.capabilities ?? null
	}

	private _getGeneratorMetadata(): CharacterFrameGeneratorWithMetadata | null {
		const generator = this.config.frameGenerator
		if (typeof generator === 'function') {
			return generator as CharacterFrameGeneratorWithMetadata
		}
		return null
	}

	private _startAnimation(): void {
		if (this.animationFrameId !== null) return
		this.lastFrameTime = performance.now()
		this._animate()
	}

	private _stopAnimation(): void {
		if (this.animationFrameId !== null) {
			cancelAnimationFrame(this.animationFrameId)
			this.animationFrameId = null
		}
	}

	private _syncFrameToBytePosition(gen: CharacterFrameGeneratorWithMetadata): void {
		// Sync the engine's frame counter to match the generator's current byte position
		if (gen.getCurrentBytePosition && gen.getCurrentSpeed) {
			const currentBytePos = gen.getCurrentBytePosition()
			const bytesPerSecond = gen.getCurrentSpeed()
			if (bytesPerSecond > 0) {
				this.currentFrame = Math.floor((currentBytePos / bytesPerSecond) * this.config.fps)
			}
		}
	}

	private _animate = (): void => {
		if (!this.isPlaying) {
			this.animationFrameId = null
			return
		}

		const frameInterval = 1000 / this.config.fps
		const currentTime = performance.now()
		const elapsed = currentTime - this.lastFrameTime

		// Render a frame if enough time has elapsed
		if (elapsed >= frameInterval) {
			// Track FPS: measure actual interval between frame decisions. Only worth collecting
			// when the performance overlay is visible to read it; skip the array churn otherwise.
			if (this.showPerformanceOverlay) {
				this.fpsHistory.push(elapsed)
				// Keep rolling window of last 30 frames
				if (this.fpsHistory.length > 30) {
					this.fpsHistory.shift()
				}
				// Calculate actual FPS as average of intervals
				const avgInterval = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length
				this.actualFps = 1000 / avgInterval
				this.targetFps = this.config.fps
			}

			// Skip frames if rendering fell behind, so animation tracks wall-clock time.
			// Deliberately unclamped: for a stateless generator the frame number is just a
			// time parameter, and capping it makes a heavy effect run in slow motion rather
			// than dropping frames. Generators that carry state bound their own catch-up
			// (see catchupSteps), which is where the cost of a large jump actually lives.
			const framesToAdvance = Math.max(1, Math.floor(elapsed / frameInterval))

			// Advance lastFrameTime by the interval actually consumed (not snapped to
			// currentTime), so any fractional remainder carries into the next frame instead of
			// being discarded. Discarding it quantizes the render rate to divisors of the RAF
			// refresh rate (e.g. a 24fps target rendering at ~20fps on a 60Hz display).
			// framesToAdvance is recomputed from real elapsed time on every call, so this
			// cannot accumulate unbounded drift.
			this.lastFrameTime += framesToAdvance * frameInterval

			// Check if we've reached the end (based on bytes, not frames)
			const currentBytes = this.getCurrentBytePosition()
			const totalBytes = this.getTotalBytes()
			if (totalBytes > 0 && currentBytes >= totalBytes) {
				// Stop at end of data
				this.pause()
				return
			}

			this.currentFrame += framesToAdvance
			this._generateAndRender()
		}

		this.animationFrameId = requestAnimationFrame(this._animate)
	}

	private _isFinalMode(): boolean {
		const gen = this._getGeneratorMetadata()
		return gen?.capabilities?.supportsSeek === false
	}

	private _generateAndRender(): void {
		const renderStart = performance.now()
		const generator = this.config.frameGenerator

		const viewY = this.config.viewY ?? 0
		const cellViewY = Math.floor(viewY) // Character-aligned view position

		// Request exactly the rows needed for display (no buffer)
		// Frame generators are responsible for providing content at the requested viewport position
		const requestedRows = this.config.rows

		// Check if it's a PixelFrameGenerator (has generator and converter properties)
		if ('generator' in generator && 'converter' in generator) {
			const pixelGen = generator as PixelFrameGenerator
			// Generate frame data (width/height in pixels, but we'll convert to columns/rows)
			const frameData = pixelGen.generator(this.currentFrame, this.config.columns, requestedRows)
			// Convert to ANSI screen using the bundled converter
			this.screen = pixelGen.converter(frameData, this.config.columns, requestedRows)
		} else {
			// It's a CharacterFrameGenerator - produces AnsiScreen directly
			const charGen = generator as CharacterFrameGenerator
			this.screen = charGen(this.currentFrame, this.config.columns, requestedRows)
		}

		// In final mode, resize canvas to match actual content height (ignore rows config)
		if (this._isFinalMode() && this.screen && this.screen.lines.length !== this.config.rows) {
			this.config.rows = this.screen.lines.length
			this._setupCanvas()
		}

		this.lastRenderedViewY = cellViewY

		this.renderTime = performance.now() - renderStart

		// Performance overlay is now rendered as a separate layer in _render()
		// No mutation of screen data

		this._render()
	}

	private _setupCanvas(): void {
		if (!this.canvas || !this.bitmapFont) return

		const charWidth = this.bitmapFont.width
		const charHeight = this.bitmapFont.height

		const screenCols = this.config.columns
		const screenRows = this.config.rows

		const cssWidth = screenCols * charWidth
		const cssHeight = screenRows * charHeight
		const dpr =
			typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1

		this.canvas.width = Math.max(1, Math.floor(cssWidth * dpr))
		this.canvas.height = Math.max(1, Math.floor(cssHeight * dpr))
		this.canvas.style.width = `${cssWidth}px`
		this.canvas.style.height = `${cssHeight}px`

		// Fetch the onscreen context once. Context creation attributes (alpha: false — this
		// canvas is always fully painted, so an opaque backing store saves the browser a
		// blend step) only take effect on the FIRST getContext() call for a given canvas.
		if (!this.ctx) {
			this.ctx = this.canvas.getContext('2d', { alpha: false })
		}
		// Resizing canvas.width/height resets the 2D context's transform and smoothing state,
		// so these must be re-applied every time the canvas is (re)established, not per-render.
		if (this.ctx) {
			this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
			this.ctx.imageSmoothingEnabled = false
		}

		// Invalidate dirty-cell tracking on resize
		this.previousCells = null
	}

	private _render(): void {
		if (!this.screen || !this.bitmapFont) return
		const drawStart = performance.now()
		const ctx = this.ctx
		if (!ctx) return

		const screenRows = this.screen.lines.length
		const screenCols = this.screen.columns

		const charWidth = this.bitmapFont.width
		const charHeight = this.bitmapFont.height

		const cssWidth = screenCols * charWidth

		// Create or resize offscreen canvas if needed (sized for buffered content)
		const bufferedHeight = screenRows * charHeight
		if (
			!this.offscreenCanvas ||
			this.offscreenCanvas.width !== cssWidth ||
			this.offscreenCanvas.height !== bufferedHeight
		) {
			this.offscreenCanvas = document.createElement('canvas')
			this.offscreenCanvas.width = cssWidth
			this.offscreenCanvas.height = bufferedHeight
			this.offscreenCtx = this.offscreenCanvas.getContext('2d', {
				willReadFrequently: false,
				alpha: false,
			})!
		}

		// Render to offscreen canvas with dirty-cell tracking
		const offCtx = this.offscreenCtx!
		const totalCells = screenRows * screenCols
		const prev = this.previousCells
		const canDiff = prev !== null && this.previousCellsCols === screenCols && this.previousCellsRows === screenRows

		if (!canDiff) {
			// Full redraw needed (first frame, resize, etc.)
			offCtx.fillStyle = this.config.background
			offCtx.fillRect(0, 0, cssWidth, bufferedHeight)
		}

		// Allocate or resize previous cells buffer
		if (!prev || prev.length !== totalCells) {
			this.previousCells = new Array(totalCells)
			for (let i = 0; i < totalCells; i++) {
				this.previousCells[i] = { ch: '', fg: -1, bg: -1, bold: false }
			}
		}

		// Frame generators may return short or missing lines (the type permits it), so every
		// grid position is visited and anything the generator omitted is drawn as a blank
		// cell. Two reasons: indexing by (row, column) keeps the diff aligned with the
		// previous-frame buffer, and painting the gaps clears glyphs left on the offscreen
		// canvas when a line shrinks between frames.
		const blankCell = { ch: ' ', fg: this.config.background, bg: this.config.background, bold: false }
		let dirtyCount = 0
		for (let r = 0; r < screenRows; r++) {
			const cells = this.screen.lines[r]
			const rowStart = r * screenCols
			for (let c = 0; c < screenCols; c++) {
				const cell = cells?.[c] ?? blankCell
				const cellIdx = rowStart + c
				const prevCell = this.previousCells![cellIdx]

				// Skip if cell hasn't changed (dirty-cell check)
				if (
					canDiff &&
					prevCell.ch === cell.ch &&
					prevCell.fg === cell.fg &&
					prevCell.bg === cell.bg &&
					prevCell.bold === cell.bold
				) {
					continue
				}

				dirtyCount++

				const x = c * charWidth
				const y = r * charHeight
				// Handle bold for numeric ANSI colors
				const fg = typeof cell.fg === 'number' && cell.bold && cell.fg < 8 ? cell.fg + 8 : cell.fg
				const fgColor = colorToCss(fg, '#AAAAAA')
				const bgColor = colorToCss(cell.bg, '#000000')
				const charCode = charToCp437Byte(cell.ch)
				renderGlyph(offCtx, this.bitmapFont, charCode, x, y, fgColor, bgColor)

				// Update previous cell state
				prevCell.ch = cell.ch
				prevCell.fg = cell.fg
				prevCell.bg = cell.bg
				prevCell.bold = cell.bold
			}
		}
		this.previousCellsCols = screenCols
		this.previousCellsRows = screenRows

		// Apply pixel offset for smooth scrolling (sub-character precision)
		const pixelOffsetY = this.config.pixelOffsetY ?? 0

		// In final mode, use full screen height; otherwise use config.rows
		const isFinalMode = this._isFinalMode()
		const visibleHeight = isFinalMode ? screenRows * charHeight : this.config.rows * charHeight

		// Consume the force flag: any explicit/user-triggered call (config update, seek,
		// restart, font swap, ...) sets this so those paths always paint. The steady-state
		// RAF-driven path leaves it false and relies on the dirty-cell diff instead.
		const forceBlit = this.forceNextBlit
		this.forceNextBlit = false

		// Skip the onscreen clear+blit entirely when nothing that affects the composite
		// changed: no dirty cells, the offscreen buffer wasn't fully rebuilt (!canDiff already
		// implies a fresh offscreen), and the performance overlay (redrawn every frame with
		// fresh stats, directly on ctx, outside the offscreen buffer) isn't visible.
		const shouldBlit = forceBlit || !canDiff || dirtyCount > 0 || this.showPerformanceOverlay

		if (shouldBlit) {
			if (!canDiff) {
				// Offscreen buffer was fully rebuilt (first frame, resize, font swap) — clear
				// the full onscreen region to match.
				ctx.fillStyle = this.config.background
				ctx.fillRect(0, 0, cssWidth, visibleHeight)
			} else {
				// Incremental update: only the bottom sliver of the destination that the
				// offscreen source rect can't cover (exposed when pixelOffsetY scrolls the
				// source window past the end of the buffered content) needs a background fill;
				// drawImage below overwrites everything else.
				const sliverHeight = Math.max(0, pixelOffsetY + visibleHeight - bufferedHeight)
				if (sliverHeight > 0) {
					ctx.fillStyle = this.config.background
					ctx.fillRect(0, visibleHeight - sliverHeight, cssWidth, sliverHeight)
				}
			}
			ctx.drawImage(
				this.offscreenCanvas,
				0,
				pixelOffsetY, // source Y with pixel offset (no buffer offset)
				cssWidth,
				visibleHeight, // source height
				0,
				0, // destination
				cssWidth,
				visibleHeight // destination size
			)
		}

		this.drawTime = performance.now() - drawStart
		// Store for next frame's overlay
		this.previousDrawTime = this.drawTime

		// Draw performance overlay as a separate layer (if enabled)
		if (this.showPerformanceOverlay && this.bitmapFont) {
			const stats: PerformanceStats = {
				actualFps: this.actualFps,
				targetFps: this.targetFps,
				renderTime: this.renderTime,
				drawTime: this.previousDrawTime,
				virtualColumns: this.config.virtualColumns,
				virtualRows: this.config.virtualRows,
				viewColumns: this.config.columns,
				viewRows: this.config.rows,
				viewX: this.config.viewX ?? 0,
				viewY: this.config.viewY ?? 0,
			}
			drawPerformanceOverlay(ctx, stats, this.bitmapFont)
		}
	}
}
