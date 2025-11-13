'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
	AnsiScreen,
	findNextCursorMove,
	findNextRenderPoint,
	parseAnsi,
	parseAnsiIncremental,
} from './ansiParser'
import { charToCp437Byte } from './cp437'
import { BitmapFont, loadRawBitmapFont, renderGlyph } from './font/bitmapFont'
import { extractFontFromFON } from './font/fonExtractor'

export type AnsiArtProps = {
	src: string
	columns?: number // default 80
	background?: string // default '#000'
	allowDrop?: boolean // default true
	bitmapFontUrl: string // path to .FON or raw bitmap font file
	debugFont?: boolean // if true, render font glyphs to debug canvas
	animated?: boolean // if true, render progressively with animation
	frameDelay?: number // delay between frames in ms (default 16, ~60 FPS)
	bytesPerFrame?: number // bytes to process per animation frame (default 500, used in 'bytes' mode)
	linesPerFrame?: number // lines to process per animation frame (default 5, used in 'cursor' mode)
	animateBy?: 'bytes' | 'cursor' // advance by byte count or cursor movements (default 'cursor')
	showControls?: boolean // show play/pause/restart controls (default false)
	debugPerformance?: boolean // if true, show performance metrics overlay (default false)
	debugCursorCodes?: boolean // if true, log ANSI cursor control codes to console (default false)
}

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

export function AnsiArt({
	src,
	columns = 80,
	background = '#000',
	allowDrop = true,
	bitmapFontUrl,
	debugFont = false,
	animated = false,
	frameDelay = 2,
	bytesPerFrame = 500,
	linesPerFrame = 25,
	animateBy = 'cursor',
	showControls = false,
	debugPerformance = false,
	debugCursorCodes = false,
}: AnsiArtProps) {
	const [screen, setScreen] = useState<AnsiScreen | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [isDragging, setIsDragging] = useState(false)
	const [fileName, setFileName] = useState<string | null>(null)
	const [bitmapFont, setBitmapFont] = useState<BitmapFont | null>(null)
	const [rawFontData, setRawFontData] = useState<Uint8Array | null>(null)
	const [rawAnsiData, setRawAnsiData] = useState<Uint8Array | null>(null)
	const [currentByteIndex, setCurrentByteIndex] = useState(0)
	const [isPlaying, setIsPlaying] = useState(false)
	const [perfMetrics, setPerfMetrics] = useState({
		fps: 0,
		renderTimeMs: 0,
		cellsUpdated: 0,
		totalCells: 0,
		parseTimeMs: 0,
		bytesPerSecond: 0,
	})
	const canvasRef = useRef<HTMLCanvasElement | null>(null)
	const debugFontCanvasRef = useRef<HTMLCanvasElement | null>(null)
	const animationTimeoutRef = useRef<number | null>(null)
	const currentByteIndexRef = useRef(0)
	const rawAnsiDataRef = useRef<Uint8Array | null>(null)
	const isAnimatingRef = useRef(false)
	const columnsRef = useRef(columns)
	const frameDelayRef = useRef(frameDelay)
	const bytesPerFrameRef = useRef(bytesPerFrame)
	const linesPerFrameRef = useRef(linesPerFrame)
	const animateByRef = useRef(animateBy)
	const backgroundRef = useRef(background)
	const bitmapFontRef = useRef(bitmapFont)
	const debugCursorCodesRef = useRef(debugCursorCodes)
	const previousScreenRef = useRef<AnsiScreen | null>(null)
	const lastFrameTimeRef = useRef(0)
	const frameCountRef = useRef(0)
	const fpsUpdateTimeRef = useRef(0)
	const lastByteIndexRef = useRef(0)
	const lastBytesUpdateTimeRef = useRef(0)

	async function loadFromBytes(bytes: Uint8Array, name?: string) {
		setError(null)
		try {
			if (animated) {
				setRawAnsiData(bytes)
				currentByteIndexRef.current = 0
				setCurrentByteIndex(0)
				previousScreenRef.current = null
				setIsPlaying(true)
				setScreen(parseAnsi(new Uint8Array(0), columns))
				if (name) setFileName(name)
			} else {
				const parsed = parseAnsi(bytes, columns)
				setScreen(parsed)
				if (name) setFileName(name)
				setRawAnsiData(null)
				currentByteIndexRef.current = 0
				setCurrentByteIndex(0)
				setIsPlaying(false)
			}
		} catch (e: any) {
			setError(String(e?.message || e))
		}
	}

	useEffect(() => {
		if (!bitmapFontUrl) {
			setBitmapFont(null)
			return
		}
		let cancelled = false
		async function loadFont() {
			try {
				const fontResult = await extractFontFromFON(bitmapFontUrl!)
				if (fontResult) {
					const { bitmapData, width, height } = fontResult
					if (!cancelled) setRawFontData(bitmapData)
					const bytesPerGlyph = height
					const glyphs: Uint8Array[] = []
					for (let i = 0; i < 256; i++) {
						glyphs.push(bitmapData.slice(i * bytesPerGlyph, (i + 1) * bytesPerGlyph))
					}
					if (!cancelled) setBitmapFont({ width, height, glyphs, rawBitmapData: bitmapData })
				} else {
					// Fallback to loadRawBitmapFont if extractFontFromFON fails
					const font = await loadRawBitmapFont(bitmapFontUrl!, 8, 16)
					if (!cancelled) setBitmapFont(font)
				}
			} catch (e: any) {
				console.warn('Failed to load bitmap font:', e)
				if (!cancelled) setBitmapFont(null)
			}
		}
		loadFont()
		return () => {
			cancelled = true
		}
	}, [bitmapFontUrl])

	useEffect(() => {
		let cancelled = false
		async function load() {
			setError(null)
			try {
				const res = await fetch(src)
				if (!res.ok) throw new Error(`Failed to fetch ${src}: ${res.status}`)
				const buf = new Uint8Array(await res.arrayBuffer())
				if (animated) {
					if (!cancelled) {
						setRawAnsiData(buf)
						currentByteIndexRef.current = 0
						setCurrentByteIndex(0)
						previousScreenRef.current = null
						setIsPlaying(true)
						setScreen(parseAnsi(new Uint8Array(0), columns))
					}
				} else {
					const parsed = parseAnsi(buf, columns)
					if (!cancelled) {
						setScreen(parsed)
						setFileName(null)
						setRawAnsiData(null)
						currentByteIndexRef.current = 0
						setCurrentByteIndex(0)
						setIsPlaying(false)
					}
				}
			} catch (e: any) {
				if (!cancelled) setError(String(e?.message || e))
			}
		}
		load()
		return () => {
			cancelled = true
		}
	}, [src, columns, animated])

	const onDragEnter = (e: React.DragEvent) => {
		if (!allowDrop) return
		e.preventDefault()
		setIsDragging(true)
	}
	const onDragOver = (e: React.DragEvent) => {
		if (!allowDrop) return
		e.preventDefault()
		e.dataTransfer.dropEffect = 'copy'
		setIsDragging(true)
	}
	const onDragLeave = (e: React.DragEvent) => {
		if (!allowDrop) return
		e.preventDefault()
		setIsDragging(false)
	}
	const onDrop = async (e: React.DragEvent) => {
		if (!allowDrop) return
		e.preventDefault()
		setIsDragging(false)
		const file = e.dataTransfer.files?.[0]
		if (!file) return
		try {
			const buf = new Uint8Array(await file.arrayBuffer())
			await loadFromBytes(buf, file.name)
		} catch (err: any) {
			setError(String(err?.message || err))
		}
	}

	const handlePlayPause = () => {
		if (currentByteIndex >= (rawAnsiData?.length || 0)) {
			currentByteIndexRef.current = 0
			setCurrentByteIndex(0)
			setIsPlaying(true)
		} else {
			setIsPlaying(!isPlaying)
		}
	}
	const handleRestart = () => {
		currentByteIndexRef.current = 0
		setCurrentByteIndex(0)
		previousScreenRef.current = null
		isAnimatingRef.current = false
		setIsPlaying(true)
		if (rawAnsiData) setScreen(parseAnsi(new Uint8Array(0), columns))
	}

	const rootStyle: React.CSSProperties = useMemo(
		() => ({
			...(isDragging ? { outline: '2px dashed #888', outlineOffset: '-2px' } : {}),
		}),
		[isDragging]
	)

	// Render screen to canvas - only redraw changed cells
	const renderToCanvas = useCallback(
		(screenToRender: AnsiScreen, forceFullRedraw = false) => {
			const renderStart = performance.now()
			const canvas = canvasRef.current
			if (!canvas) return
			const bitmapFont = bitmapFontRef.current
			if (!bitmapFont) return // Wait for font to load

			const rows = screenToRender.lines.length
			const cols = screenToRender.columns
			const background = backgroundRef.current
			const charWidth = bitmapFont.width
			const charHeight = bitmapFont.height
			const cssWidth = cols * charWidth
			const cssHeight = rows * charHeight
			const dpr =
				typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1

			const previousScreen = previousScreenRef.current
			const needsResize =
				canvas.width !== Math.floor(cssWidth * dpr) || canvas.height !== Math.floor(cssHeight * dpr)

			// Set canvas size if needed
			if (needsResize) {
				canvas.width = Math.max(1, Math.floor(cssWidth * dpr))
				canvas.height = Math.max(1, Math.floor(cssHeight * dpr))
				canvas.style.width = `${cssWidth}px`
				canvas.style.height = `${cssHeight}px`
			}

			const ctx = canvas.getContext('2d')
			if (!ctx) return
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
			ctx.imageSmoothingEnabled = false

			// Full clear if no previous screen, resized, or forced
			if (!previousScreen || needsResize || forceFullRedraw) {
				ctx.fillStyle = background
				ctx.fillRect(0, 0, cssWidth, cssHeight)
			}

			let cellsUpdated = 0
			const totalCells = rows * cols

			// Only render changed or new cells
			for (let r = 0; r < rows; r++) {
				const cells = screenToRender.lines[r]
				const prevCells = previousScreen?.lines[r]

				// If this is a new line (didn't exist before), render all cells in it
				if (!prevCells || forceFullRedraw || needsResize) {
					for (let c = 0; c < cells.length; c++) {
						const cell = cells[c]
						cellsUpdated++
						const x = c * charWidth
						const y = r * charHeight
						// Handle bold for numeric ANSI colors
						const fg =
							typeof cell.fg === 'number' && cell.bold && cell.fg < 8 ? cell.fg + 8 : cell.fg
						const fgColor = colorToCss(fg, '#AAAAAA')
						const bgColor = colorToCss(cell.bg, '#000000')
						const charCode = charToCp437Byte(cell.ch)
						renderGlyph(ctx, bitmapFont, charCode, x, y, fgColor, bgColor)
					}
					continue
				}

				// Existing line - only render changed cells
				for (let c = 0; c < cells.length; c++) {
					const cell = cells[c]
					const prevCell = prevCells[c]

					// Skip if cell hasn't changed
					if (
						prevCell &&
						prevCell.ch === cell.ch &&
						prevCell.fg === cell.fg &&
						prevCell.bg === cell.bg &&
						prevCell.bold === cell.bold
					) {
						continue
					}

					cellsUpdated++
					const x = c * charWidth
					const y = r * charHeight
					// Handle bold for numeric ANSI colors
					const fg = typeof cell.fg === 'number' && cell.bold && cell.fg < 8 ? cell.fg + 8 : cell.fg
					const fgColor = colorToCss(fg, '#AAAAAA')
					const bgColor = colorToCss(cell.bg, '#000000')
					const charCode = charToCp437Byte(cell.ch)
					renderGlyph(ctx, bitmapFont, charCode, x, y, fgColor, bgColor)
				}
			}

			// Store for next frame comparison
			previousScreenRef.current = screenToRender

			const renderEnd = performance.now()
			const renderTimeMs = renderEnd - renderStart

			// Update performance metrics
			if (debugPerformance) {
				const now = performance.now()
				frameCountRef.current++

				// Update FPS every 500ms
				if (now - fpsUpdateTimeRef.current >= 500) {
					const fps = (frameCountRef.current / (now - fpsUpdateTimeRef.current)) * 1000
					setPerfMetrics(prev => ({
						...prev,
						fps: Math.round(fps),
						renderTimeMs: Math.round(renderTimeMs * 100) / 100,
						cellsUpdated,
						totalCells,
					}))
					frameCountRef.current = 0
					fpsUpdateTimeRef.current = now
				}
			}
		},
		[debugPerformance]
	)

	// Render screen to canvas when screen changes (non-animated)
	useEffect(() => {
		if (!screen) return
		renderToCanvas(screen, true) // Force full redraw for non-animated changes
	}, [screen, renderToCanvas])

	// Keep refs in sync with props
	useEffect(() => {
		rawAnsiDataRef.current = rawAnsiData
	}, [rawAnsiData])

	useEffect(() => {
		columnsRef.current = columns
		frameDelayRef.current = frameDelay
		bytesPerFrameRef.current = bytesPerFrame
		linesPerFrameRef.current = linesPerFrame
		animateByRef.current = animateBy
		backgroundRef.current = background
		bitmapFontRef.current = bitmapFont
		debugCursorCodesRef.current = debugCursorCodes
	}, [
		columns,
		frameDelay,
		bytesPerFrame,
		linesPerFrame,
		animateBy,
		background,
		bitmapFont,
		debugCursorCodes,
	])

	// Animation function - stored in a ref to avoid recreating it
	const animateRef = useRef<(() => void) | null>(null)

	animateRef.current = () => {
		const data = rawAnsiDataRef.current
		if (!data) {
			isAnimatingRef.current = false
			return
		}

		// Fast path: synchronous loop when frameDelay is 0
		if (frameDelayRef.current <= 0) {
			while (currentByteIndexRef.current < data.length) {
				const currentIndex = currentByteIndexRef.current
				const nextByteIndex =
					animateByRef.current === 'cursor'
						? findNextCursorMove(
								data,
								currentIndex,
								columnsRef.current * 10,
								linesPerFrameRef.current
						  )
						: findNextRenderPoint(data, currentIndex, bytesPerFrameRef.current)

				if (nextByteIndex <= currentIndex || nextByteIndex > data.length) break

				const newScreen = parseAnsiIncremental(data, columnsRef.current, nextByteIndex)
				renderToCanvas(newScreen)
				currentByteIndexRef.current = nextByteIndex
			}

			// Animation complete - update final state
			const finalScreen = parseAnsiIncremental(data, columnsRef.current, data.length)
			setScreen(finalScreen)
			setCurrentByteIndex(data.length)
			setIsPlaying(false)
			isAnimatingRef.current = false
			return
		}

		// Normal path: frame-by-frame with delay
		const currentIndex = currentByteIndexRef.current
		const parseStart = performance.now()
		const nextByteIndex =
			animateByRef.current === 'cursor'
				? findNextCursorMove(data, currentIndex, columnsRef.current * 10, linesPerFrameRef.current)
				: findNextRenderPoint(data, currentIndex, bytesPerFrameRef.current)

		if (debugPerformance) {
			console.log(
				`Animation frame: ${currentIndex} -> ${nextByteIndex} (${
					nextByteIndex - currentIndex
				} bytes)`
			)
		}

		if (nextByteIndex > currentIndex && nextByteIndex <= data.length) {
			const newScreen = parseAnsiIncremental(data, columnsRef.current, nextByteIndex)
			const parseEnd = performance.now()

			if (debugPerformance) {
				const now = performance.now()
				const bytesDelta = nextByteIndex - lastByteIndexRef.current
				const timeDelta = now - lastBytesUpdateTimeRef.current

				// Update bytes/sec every 500ms
				if (timeDelta >= 500) {
					const bytesPerSecond = Math.round((bytesDelta / timeDelta) * 1000)
					setPerfMetrics(prev => ({
						...prev,
						parseTimeMs: Math.round((parseEnd - parseStart) * 100) / 100,
						bytesPerSecond,
					}))
					lastByteIndexRef.current = nextByteIndex
					lastBytesUpdateTimeRef.current = now
				} else {
					setPerfMetrics(prev => ({
						...prev,
						parseTimeMs: Math.round((parseEnd - parseStart) * 100) / 100,
					}))
				}
			}

			// Render directly to canvas without updating React state - no re-renders!
			renderToCanvas(newScreen)
			currentByteIndexRef.current = nextByteIndex

			if (nextByteIndex >= data.length) {
				// Animation complete - update final state
				setScreen(newScreen)
				setCurrentByteIndex(nextByteIndex)
				setIsPlaying(false)
				isAnimatingRef.current = false
				return
			}

			animationTimeoutRef.current = window.setTimeout(() => {
				animateRef.current?.()
			}, frameDelayRef.current)
		} else {
			setIsPlaying(false)
			isAnimatingRef.current = false
		}
	}

	// Start/stop animation based on isPlaying state
	useEffect(() => {
		if (!animated || !isPlaying) {
			isAnimatingRef.current = false
			if (animationTimeoutRef.current) {
				clearTimeout(animationTimeoutRef.current)
				animationTimeoutRef.current = null
			}
			return
		}

		// Prevent starting multiple animations
		if (isAnimatingRef.current) {
			return
		}

		isAnimatingRef.current = true
		animateRef.current?.()

		return () => {
			isAnimatingRef.current = false
			if (animationTimeoutRef.current) {
				clearTimeout(animationTimeoutRef.current)
				animationTimeoutRef.current = null
			}
		}
	}, [animated, isPlaying])

	useEffect(() => {
		if (!debugFont || !rawFontData || !bitmapFont) return
		const canvas = debugFontCanvasRef.current
		if (!canvas) return
		const charWidth = bitmapFont.width
		const charHeight = bitmapFont.height
		const cols = 16
		const rows = 16
		const cssWidth = cols * charWidth
		const cssHeight = rows * charHeight
		const dpr =
			typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1
		canvas.width = Math.max(1, Math.floor(cssWidth * dpr))
		canvas.height = Math.max(1, Math.floor(cssHeight * dpr))
		canvas.style.width = `${cssWidth}px`
		canvas.style.height = `${cssHeight}px`
		const ctx = canvas.getContext('2d')
		if (!ctx) return
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
		ctx.imageSmoothingEnabled = false
		ctx.fillStyle = '#000000'
		ctx.fillRect(0, 0, cssWidth, cssHeight)
		ctx.fillStyle = '#FFFFFF'
		const bytesPerGlyph = charHeight
		for (let charCode = 0; charCode < 256; charCode++) {
			const charBase = charCode * bytesPerGlyph
			const col = charCode % 16
			const row = Math.floor(charCode / 16)
			const baseX = col * charWidth
			const baseY = row * charHeight
			for (let rowIdx = 0; rowIdx < charHeight; rowIdx++) {
				const byte = rawFontData[charBase + rowIdx]
				const x = baseX
				const y = baseY + rowIdx
				for (let bit = 0; bit < charWidth; bit++) {
					const bitValue = charWidth - 1 - bit
					if (byte & (1 << bitValue)) {
						ctx.fillRect(x + bit, y, 1, 1)
					}
				}
			}
		}
	}, [debugFont, rawFontData, bitmapFont])

	if (error)
		return (
			<div
				style={{
					...rootStyle,
					padding: '16px',
					color: '#FF5555',
					background: '#000',
					fontFamily: 'monospace',
				}}
				onDragEnter={onDragEnter}
				onDragOver={onDragOver}
				onDragLeave={onDragLeave}
				onDrop={onDrop}
			>
				{error}
			</div>
		)
	if (!screen)
		return (
			<div
				style={{
					...rootStyle,
					padding: '16px',
					color: '#AAA',
					background: '#000',
					fontFamily: 'monospace',
				}}
				onDragEnter={onDragEnter}
				onDragOver={onDragOver}
				onDragLeave={onDragLeave}
				onDrop={onDrop}
			>
				Loading…
			</div>
		)

	return (
		<div>
			{debugPerformance && (
				<div
					style={{
						position: 'absolute',
						top: 0,
						right: 0,
						background: 'rgba(0, 0, 0, 0.8)',
						color: '#0f0',
						padding: '8px 12px',
						fontFamily: 'monospace',
						fontSize: '11px',
						border: '1px solid #0f0',
						zIndex: 1000,
						lineHeight: '1.4',
					}}
				>
					<div>
						<strong>Performance Metrics</strong>
					</div>
					<div>FPS: {perfMetrics.fps}</div>
					<div>Render: {perfMetrics.renderTimeMs}ms</div>
					<div>Parse: {perfMetrics.parseTimeMs}ms</div>
					<div>
						Cells: {perfMetrics.cellsUpdated}/{perfMetrics.totalCells} (
						{perfMetrics.totalCells > 0
							? Math.round((perfMetrics.cellsUpdated / perfMetrics.totalCells) * 100)
							: 0}
						%)
					</div>
					<div>Bytes: {currentByteIndex}</div>
					<div>Speed: {perfMetrics.bytesPerSecond} B/s</div>
					<div>Mode: {animateBy}</div>
					{animateBy === 'bytes' ? (
						<div>BPF: {bytesPerFrame}</div>
					) : (
						<div>LPF: {linesPerFrame}</div>
					)}
					<div>Playing: {isPlaying ? 'Yes' : 'No'}</div>
				</div>
			)}
			{debugFont && rawFontData && (
				<div style={{ marginBottom: 16 }}>
					<h3 style={{ color: '#AAA', marginBottom: 8 }}>
						Font Debug - Raw Bitmap Data (256 glyphs, 16x16 grid, {rawFontData.length} bytes)
					</h3>
					<canvas
						ref={debugFontCanvasRef}
						style={{ border: '1px solid #555', display: 'block', background: '#000' }}
					/>
				</div>
			)}
			{showControls && animated && (
				<div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
					<button
						onClick={handlePlayPause}
						style={{
							padding: '6px 12px',
							background: '#333',
							color: '#AAA',
							border: '1px solid #555',
							cursor: 'pointer',
							fontSize: '14px',
							fontFamily: 'monospace',
						}}
						onMouseEnter={e => (e.currentTarget.style.background = '#444')}
						onMouseLeave={e => (e.currentTarget.style.background = '#333')}
					>
						{isPlaying ? '⏸ Pause' : '▶ Play'}
					</button>
					<button
						onClick={handleRestart}
						style={{
							padding: '6px 12px',
							background: '#333',
							color: '#AAA',
							border: '1px solid #555',
							cursor: 'pointer',
							fontSize: '14px',
							fontFamily: 'monospace',
						}}
						onMouseEnter={e => (e.currentTarget.style.background = '#444')}
						onMouseLeave={e => (e.currentTarget.style.background = '#333')}
					>
						⏮ Restart
					</button>
				</div>
			)}
			<canvas
				ref={canvasRef}
				style={rootStyle}
				aria-label={`ANSI Art Canvas${fileName ? ` - ${fileName}` : ''}`}
				onDragEnter={onDragEnter}
				onDragOver={onDragOver}
				onDragLeave={onDragLeave}
				onDrop={onDrop}
			/>
		</div>
	)
}
