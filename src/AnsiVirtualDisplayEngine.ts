import { AnsiScreen } from './ansiParser'
import { BitmapFont, renderGlyph } from './bitmapFont'
import { charToCp437Byte } from './cp437'
import type { CharacterFrameGenerator, DisplayFrameGenerator, PixelFrameGenerator } from './types'

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
	cellWidthPx: number
	cellHeightPx: number
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
	private bufferRows: number = 2 // Extra rows to render above/below for smooth scrolling

	constructor(canvas: HTMLCanvasElement, config: DisplayConfig) {
		this.canvas = canvas
		this.config = { ...config }
		this.showPerformanceOverlay = config.showPerformanceOverlay ?? false
		this.targetFps = config.fps
		this._setupCanvas()
		if (this.isPlaying) {
			this._startAnimation()
		}
		this._generateAndRender()
	}

	play(): void {
		if (this.isPlaying) return
		this.isPlaying = true
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
		const needsCanvasResize =
			config.columns !== undefined ||
			config.rows !== undefined ||
			config.cellWidthPx !== undefined ||
			config.cellHeightPx !== undefined

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

	enablePerformanceOverlay(enabled: boolean): void {
		this.showPerformanceOverlay = enabled
		this._generateAndRender()
	}

	destroy(): void {
		this._stopAnimation()
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

			this.currentFrame++
			this._generateAndRender()
		}

		this.animationFrameId = requestAnimationFrame(this._animate)
	}

	private _generateAndRender(): void {
		const renderStart = performance.now()
		const generator = this.config.frameGenerator

		const viewY = this.config.viewY ?? 0
		const cellViewY = Math.floor(viewY) // Character-aligned view position

		// Always regenerate for animation - buffer lets us smooth scroll between regenerations
		// Calculate buffered region: render extra rows above and below
		const bufferedRows = this.config.rows + this.bufferRows * 2
		const bufferedViewY = Math.max(0, cellViewY - this.bufferRows)

		// Check if it's a PixelFrameGenerator (has generator and converter properties)
		if ('generator' in generator && 'converter' in generator) {
			const pixelGen = generator as PixelFrameGenerator
			// Generate frame data (width/height in pixels, but we'll convert to columns/rows)
			const frameData = pixelGen.generator(this.currentFrame, this.config.columns, bufferedRows)
			// Convert to ANSI screen using the bundled converter
			this.screen = pixelGen.converter(frameData, this.config.columns, bufferedRows)
		} else {
			// It's a CharacterFrameGenerator - produces AnsiScreen directly
			const charGen = generator as CharacterFrameGenerator
			this.screen = charGen(this.currentFrame, this.config.columns, bufferedRows)
		}

		this.lastRenderedViewY = cellViewY

		this.renderTime = performance.now() - renderStart

		// Add performance overlay if enabled
		if (this.showPerformanceOverlay && this.screen) {
			this._addPerformanceOverlay(this.screen)
		}

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

		// Calculate pixel offset within the buffer for smooth scrolling
		const pixelOffsetY = this.config.pixelOffsetY ?? 0
		const bufferPixelOffset = this.bufferRows * charHeight + pixelOffsetY

		// Copy visible portion of offscreen canvas to main canvas with pixel offset
		const visibleHeight = this.config.rows * charHeight
		ctx.fillStyle = this.config.background
		ctx.fillRect(0, 0, cssWidth, visibleHeight)
		ctx.drawImage(
			this.offscreenCanvas,
			0,
			bufferPixelOffset, // source Y with pixel offset
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
	}

	private _addPerformanceOverlay(screen: AnsiScreen): void {
		const screenRows = screen.lines.length
		const screenCols = screen.columns

		// Calculate overlay dimensions
		const lines = [
			`FPS: ${this.actualFps.toFixed(1)} / ${this.targetFps}`,
			`Render: ${this.renderTime.toFixed(2)}ms`,
			`Draw: ${this.previousDrawTime.toFixed(2)}ms`,
			`World: ${this.config.virtualColumns ?? screenCols}x${this.config.virtualRows ?? screenRows}`,
			`View: ${screenCols}x${screenRows} @ (${this.config.viewX ?? 0},${this.config.viewY ?? 0})`,
		]
		const maxLineLength = Math.max(...lines.map(l => l.length))
		const overlayRows = lines.length + 2 // Add 2 for padding rows
		const overlayCols = maxLineLength + 2 // Add 2 for padding columns

		// Calculate visible region (excluding buffer rows)
		const visibleRows = this.config.rows
		const visibleStartRow = this.bufferRows // Buffer rows at top
		const visibleEndRow = visibleStartRow + visibleRows

		// Check if visible region is large enough
		if (visibleRows < overlayRows || screenCols < overlayCols) {
			return
		}

		// Position in bottom right corner of VISIBLE area (accounting for buffer)
		const startRow = visibleEndRow - overlayRows
		const startCol = screenCols - overlayCols

		// Overwrite cells with performance stats
		for (let r = 0; r < overlayRows; r++) {
			const rowIndex = startRow + r

			// Ensure row exists
			if (!screen.lines[rowIndex]) {
				screen.lines[rowIndex] = []
			}

			// Write characters with ANSI styling (dark background, bright foreground)
			for (let c = 0; c < overlayCols; c++) {
				const colIndex = startCol + c
				let ch: string
				let fg: number
				let bg: number

				// Determine if this is a border/padding cell or content cell
				const isTopRow = r === 0
				const isBottomRow = r === overlayRows - 1
				const isLeftCol = c === 0
				const isRightCol = c === overlayCols - 1
				const isBorder = isTopRow || isBottomRow || isLeftCol || isRightCol

				if (isBorder) {
					// Border cells: black square
					ch = '█'
					fg = 0 // black
					bg = 0 // black
				} else {
					// Content cells: text with padding
					const lineIndex = r - 1 // Offset by 1 for top padding
					const charIndex = c - 1 // Offset by 1 for left padding
					const line = lines[lineIndex]
					ch = charIndex < line.length ? line[charIndex] : ' '
					fg = 15 // white
					bg = 0 // black
				}

				// Ensure column exists
				while (screen.lines[rowIndex].length <= colIndex) {
					screen.lines[rowIndex].push({ ch: ' ', fg: 7, bg: 0, bold: false })
				}

				// Set performance overlay cell
				screen.lines[rowIndex][colIndex] = {
					ch,
					fg,
					bg,
					bold: false,
				}
			}
		}
	}
}
