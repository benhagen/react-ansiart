import { AnsiScreen } from '../ansi/parser'
import { charToCp437Byte } from '../utils/cp437'
import { BitmapFont, renderGlyph } from '../font/bitmapFont'
import type { CharacterFrameGenerator, DisplayFrameGenerator, PixelFrameGenerator } from '../types/types'
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
	private lastRenderedViewY: number = -1

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
		const generator = this.config.frameGenerator as any
		if (generator && typeof generator.clearManualBytePosition === 'function') {
			// Sync frame counter before clearing manual position
			this._syncFrameToBytePosition(generator)
			generator.clearManualBytePosition()
			// Immediately render the current frame to show the correct position
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
		const generator = this.config.frameGenerator as any
		if (generator && typeof generator.clearManualBytePosition === 'function') {
			generator.clearManualBytePosition()
		}
		this._generateAndRender()
		if (this.isPlaying) {
			this._startAnimation()
		}
	}

	setBitmapFont(font: BitmapFont | null): void {
		this.bitmapFont = font
		this._setupCanvas()
		this._render()
	}

	updateConfig(config: Partial<DisplayConfig>): void {
		const needsCanvasResize = config.columns !== undefined || config.rows !== undefined

		const overlayToggled =
			config.showPerformanceOverlay !== undefined &&
			config.showPerformanceOverlay !== this.showPerformanceOverlay

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
		// First try to get byte position from generator (for manual stepping)
		const generator = this.config.frameGenerator as any
		if (generator && typeof generator.getCurrentBytePosition === 'function') {
			return generator.getCurrentBytePosition()
		}

		// Fall back to calculating from elapsed time and speed
		if (generator && typeof generator.getCurrentSpeed === 'function') {
			const bytesPerSecond = generator.getCurrentSpeed()
			const elapsedSeconds = this.currentFrame / this.config.fps
			const totalBytes = this.getTotalBytes()
			return Math.min(Math.floor(elapsedSeconds * bytesPerSecond), totalBytes)
		}
		return 0
	}

	getTotalBytes(): number {
		const generator = this.config.frameGenerator as any
		if (
			generator &&
			generator.capabilities &&
			typeof generator.capabilities.getTotalBytes === 'function'
		) {
			return generator.capabilities.getTotalBytes()
		}
		return 0
	}

	seekToBytePosition(bytePosition: number): void {
		// Convert byte position to frame number based on current speed
		const generator = this.config.frameGenerator as any
		if (generator && typeof generator.getCurrentSpeed === 'function') {
			const bytesPerSecond = generator.getCurrentSpeed()
			if (bytesPerSecond > 0) {
				const targetSeconds = bytePosition / bytesPerSecond
				const targetFrame = Math.floor(targetSeconds * this.config.fps)
				this.seekToFrame(targetFrame)
			}
		}
	}

	enablePerformanceOverlay(enabled: boolean): void {
		this.showPerformanceOverlay = enabled
		this._generateAndRender()
	}

	destroy(): void {
		this._stopAnimation()
	}

	seekToFrame(frame: number): void {
		this.currentFrame = Math.max(0, frame)
		this._generateAndRender()
	}

	setSpeed(bytesPerSecond: number): void {
		const generator = this.config.frameGenerator as any
		if (generator && typeof generator.setSpeed === 'function') {
			generator.setSpeed(bytesPerSecond)
		}
	}

	advanceByte(): void {
		const generator = this.config.frameGenerator as any
		if (generator && typeof generator.advanceByte === 'function') {
			generator.advanceByte()
			// Update the frame counter to match the new byte position
			this._syncFrameToBytePosition(generator)
			this._generateAndRender()
		}
	}

	rewindByte(): void {
		const generator = this.config.frameGenerator as any
		if (generator && typeof generator.rewindByte === 'function') {
			generator.rewindByte()
			// Update the frame counter to match the new byte position
			this._syncFrameToBytePosition(generator)
			this._generateAndRender()
		}
	}

	getMaxFrames(): number {
		const generator = this.config.frameGenerator as any
		if (
			generator &&
			generator.capabilities &&
			typeof generator.capabilities.getTotalFrames === 'function'
		) {
			return generator.capabilities.getTotalFrames()
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
		const generator = this.config.frameGenerator as any
		if (generator && typeof generator.getCurrentSpeed === 'function') {
			return generator.getCurrentSpeed()
		}
		return 0
	}

	getGeneratorCapabilities(): any {
		const generator = this.config.frameGenerator as any
		return generator?.capabilities || null
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

	private _syncFrameToBytePosition(generator: any): void {
		// Sync the engine's frame counter to match the generator's current byte position
		if (
			generator &&
			typeof generator.getCurrentBytePosition === 'function' &&
			typeof generator.getCurrentSpeed === 'function'
		) {
			const currentBytePos = generator.getCurrentBytePosition()
			const bytesPerSecond = generator.getCurrentSpeed()
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
			// Track FPS: measure actual interval between frame decisions
			this.fpsHistory.push(elapsed)
			// Keep rolling window of last 30 frames
			if (this.fpsHistory.length > 30) {
				this.fpsHistory.shift()
			}
			// Calculate actual FPS as average of intervals
			const avgInterval = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length
			this.actualFps = 1000 / avgInterval
			this.targetFps = this.config.fps

			// Update lastFrameTime: sync to current time to align with RAF timing
			// For FPS that divide evenly into 60Hz (15, 20, 30, 60), this ensures we stay locked
			// to the actual refresh rate rather than accumulating drift
			// For other FPS, we still sync but maintain the target interval
			this.lastFrameTime = currentTime

			// Check if we've reached the end (based on bytes, not frames)
			const currentBytes = this.getCurrentBytePosition()
			const totalBytes = this.getTotalBytes()
			if (totalBytes > 0 && currentBytes >= totalBytes) {
				// Stop at end of data
				this.pause()
				return
			}

			this.currentFrame++
			this._generateAndRender()
		}

		this.animationFrameId = requestAnimationFrame(this._animate)
	}

	private _isFinalMode(): boolean {
		// Final mode generators have capabilities.supportsSeek === false
		const generator = this.config.frameGenerator as any
		return generator && generator.capabilities && generator.capabilities.supportsSeek === false
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
	}

	private _render(): void {
		if (!this.screen || !this.bitmapFont) return
		const drawStart = performance.now()
		const ctx = this.canvas.getContext('2d')
		if (!ctx) return

		const screenRows = this.screen.lines.length
		const screenCols = this.screen.columns

		const charWidth = this.bitmapFont.width
		const charHeight = this.bitmapFont.height

		const cssWidth = screenCols * charWidth
		const cssHeight = screenRows * charHeight
		const dpr =
			typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1

		ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
		ctx.imageSmoothingEnabled = false

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

		// Render to offscreen canvas (happens whenever screen changes from _generateAndRender)
		const offCtx = this.offscreenCtx!
		offCtx.fillStyle = this.config.background
		offCtx.fillRect(0, 0, cssWidth, bufferedHeight)

		for (let r = 0; r < screenRows; r++) {
			const cells = this.screen.lines[r]
			if (!cells) continue
			for (let c = 0; c < cells.length; c++) {
				const cell = cells[c]
				const x = c * charWidth
				const y = r * charHeight
				// Handle bold for numeric ANSI colors
				const fg = typeof cell.fg === 'number' && cell.bold && cell.fg < 8 ? cell.fg + 8 : cell.fg
				const fgColor = colorToCss(fg, '#AAAAAA')
				const bgColor = colorToCss(cell.bg, '#000000')
				const charCode = charToCp437Byte(cell.ch)
				renderGlyph(offCtx, this.bitmapFont, charCode, x, y, fgColor, bgColor)
			}
		}

		// Apply pixel offset for smooth scrolling (sub-character precision)
		const pixelOffsetY = this.config.pixelOffsetY ?? 0

		// In final mode, use full screen height; otherwise use config.rows
		const isFinalMode = this._isFinalMode()
		const visibleHeight = isFinalMode ? screenRows * charHeight : this.config.rows * charHeight

		ctx.fillStyle = this.config.background
		ctx.fillRect(0, 0, cssWidth, visibleHeight)
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
