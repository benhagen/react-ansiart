'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnsiScreen, findNextRenderPoint, parseAnsi, parseAnsiIncremental } from './ansiParser'
import { BitmapFont, loadRawBitmapFont, renderGlyph } from './bitmapFont'
import { charToCp437Byte } from './cp437'
import { extractFontFromFON } from './fonExtractor'

//https://int10h.org/oldschool-pc-fonts/fontlist/font?ibm_vga_8x16#-

export type AnsiArtProps = {
	src: string
	columns?: number // default 80
	fontSizePx?: number // default 16
	fontFamily?: string // override
	background?: string // default '#000'
	allowDrop?: boolean // default true
	yScale?: number // emulate VGA 8x16 cell aspect (default ~1.2)
	renderMode?: 'dom' | 'canvas' // default 'dom'
	cellWidthPx?: number // canvas mode cell width (default 8)
	cellHeightPx?: number // canvas mode cell height (default 16)
	bitmapFontUrl?: string // optional path to .FON or raw bitmap font file
	debugFont?: boolean // if true, render font glyphs to debug canvas
	animated?: boolean // if true, render progressively with animation
	frameDelay?: number // delay between frames in ms (default 50, ~20 FPS)
	animationSpeed?: number // speed multiplier (default 1.0, applied to frameDelay)
	showControls?: boolean // show play/pause/restart controls (default false)
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

type Run = { text: string; fg: number; bg: number; bold: boolean }

function compressLine(cells: AnsiScreen['lines'][number]): Run[] {
	if (cells.length === 0) return []
	const runs: Run[] = []
	let current: Run | null = null
	for (let i = 0; i < cells.length; i++) {
		const cell = cells[i]
		if (!current) {
			current = { text: cell.ch, fg: cell.fg, bg: cell.bg, bold: cell.bold }
			continue
		}
		if (cell.fg === current.fg && cell.bg === current.bg && cell.bold === current.bold) {
			current.text += cell.ch
		} else {
			runs.push(current)
			current = { text: cell.ch, fg: cell.fg, bg: cell.bg, bold: cell.bold }
		}
	}
	if (current) runs.push(current)
	return runs
}

export function AnsiArt({
	src,
	columns = 80,
	fontSizePx = 16,
	fontFamily,
	background = '#000',
	allowDrop = true,
	yScale = 1.2,
	renderMode = 'dom',
	cellWidthPx = 8,
	cellHeightPx = 16,
	bitmapFontUrl,
	debugFont = false,
	animated = false,
	frameDelay = 50,
	animationSpeed = 1.0,
	showControls = false,
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
	const canvasRef = useRef<HTMLCanvasElement | null>(null)
	const debugFontCanvasRef = useRef<HTMLCanvasElement | null>(null)
	const animationTimeoutRef = useRef<number | null>(null)

	async function loadFromBytes(bytes: Uint8Array, name?: string) {
		setError(null)
		try {
			if (animated && renderMode === 'canvas') {
				// Store raw data for progressive rendering
				setRawAnsiData(bytes)
				setCurrentByteIndex(0)
				setIsPlaying(true)
				setScreen(parseAnsi(new Uint8Array(0), columns)) // Start with empty screen
				if (name) setFileName(name)
			} else {
				// Parse and render immediately
				const parsed = parseAnsi(bytes, columns)
				setScreen(parsed)
				if (name) setFileName(name)
				setRawAnsiData(null)
				setCurrentByteIndex(0)
				setIsPlaying(false)
			}
		} catch (e: any) {
			setError(String(e?.message || e))
		}
	}

	// Load bitmap font if provided
	useEffect(() => {
		if (!bitmapFontUrl) {
			setBitmapFont(null)
			return
		}
		let cancelled = false
		async function loadFont() {
			try {
				// Try to extract from .FON first
				const fontData = await extractFontFromFON(bitmapFontUrl!)

				if (fontData && fontData.length >= 4096) {
					// Store raw bitmap data for debugging
					if (!cancelled) setRawFontData(fontData)

					// Use extracted data as raw bitmap
					const glyphs: Uint8Array[] = []
					for (let i = 0; i < 256; i++) {
						glyphs.push(fontData.slice(i * 16, (i + 1) * 16))
					}

					if (!cancelled) setBitmapFont({ width: 8, height: 16, glyphs, rawBitmapData: fontData })
				} else {
					// Fallback: try loading as raw bitmap
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

				if (animated && renderMode === 'canvas') {
					// Store raw data for progressive rendering
					if (!cancelled) {
						setRawAnsiData(buf)
						setCurrentByteIndex(0)
						setIsPlaying(true)
						setScreen(parseAnsi(new Uint8Array(0), columns)) // Start with empty screen
					}
				} else {
					// Parse and render immediately
					const parsed = parseAnsi(buf, columns)
					if (!cancelled) {
						setScreen(parsed)
						setFileName(null)
						setRawAnsiData(null)
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
	}, [src, columns, animated, renderMode])

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

	// Animation control handlers
	const handlePlayPause = () => {
		if (currentByteIndex >= (rawAnsiData?.length || 0)) {
			// Restart if at end
			setCurrentByteIndex(0)
			setIsPlaying(true)
		} else {
			setIsPlaying(!isPlaying)
		}
	}

	const handleRestart = () => {
		setCurrentByteIndex(0)
		setIsPlaying(true)
		if (rawAnsiData) {
			setScreen(parseAnsi(new Uint8Array(0), columns))
		}
	}

	const baseRootStyle: React.CSSProperties = useMemo(() => {
		return {
			fontFamily: fontFamily || "'Flexi_IBM_VGA_True_437', 'dos437', 'PerfectDOSVGA437Win', 'PerfectDOSVGA437', 'IBM VGA 8x16', 'Cascadia Mono', 'Menlo', monospace",
			fontSize: '16px',
			lineHeight: '16px',
			letterSpacing: 0,
			whiteSpace: 'pre' as const,
			background: '#000',
			color: '#aaa',
			margin: 0,
			padding: 0,
			display: 'block',
			WebkitFontSmoothing: 'none',
			MozOsxFontSmoothing: 'grayscale',
			width: 'fit-content',
			fontVariantLigatures: 'none',
			fontFeatureSettings: "'liga' 0, 'clig' 0",
			textRendering: 'geometricPrecision',
		} as React.CSSProperties
	}, [fontFamily])

	const rootStyle: React.CSSProperties = useMemo(() => {
		const css: React.CSSProperties = {
			...baseRootStyle,
			width: `${columns}ch`,
			background,
			fontSize: `${fontSizePx}px`,
			// DOM mode uses transform to emulate cell aspect
			...(renderMode === 'dom'
				? { transform: `scaleY(${yScale})`, transformOrigin: 'top left' }
				: {}),
			// Add dragOver outline when dragging
			...(isDragging ? {
				outline: '2px dashed #888',
				outlineOffset: '-2px',
			} : {}),
		}
		return css
	}, [baseRootStyle, columns, fontSizePx, background, yScale, renderMode, isDragging])

	// Canvas rendering
	useEffect(() => {
		if (renderMode !== 'canvas') return
		if (!screen) return
		const canvas = canvasRef.current
		if (!canvas) return
		const rows = screen.lines.length
		const cols = screen.columns

		// Use bitmap font dimensions if available, otherwise use cellWidthPx/cellHeightPx
		const charWidth = bitmapFont ? bitmapFont.width : cellWidthPx
		const charHeight = bitmapFont ? bitmapFont.height : cellHeightPx

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
		ctx.fillStyle = background
		ctx.fillRect(0, 0, cssWidth, cssHeight)

		if (bitmapFont) {
			// Use bitmap font rendering for pixel-perfect display (no scaling)
			for (let r = 0; r < rows; r++) {
				const cells = screen.lines[r]
				for (let c = 0; c < cells.length; c++) {
					const cell = cells[c]
					const x = c * charWidth
					const y = r * charHeight
					const fgIdx = cell.bold && cell.fg < 8 ? cell.fg + 8 : cell.fg
					const fgColor = DOS_COLORS[fgIdx] ?? '#AAAAAA'
					const bgColor = DOS_COLORS[cell.bg] ?? '#000000'
					// Convert Unicode character back to CP437 byte for bitmap font
					const charCode = charToCp437Byte(cell.ch)
					renderGlyph(ctx, bitmapFont, charCode, x, y, fgColor, bgColor)
				}
			}
		} else {
			// Fallback to text rendering
			ctx.textBaseline = 'top'
			ctx.textAlign = 'left'
			const fontStack =
				fontFamily ??
				"'Flexi_IBM_VGA_True_437', 'dos437', 'PerfectDOSVGA437Win'. 'PerfectDOSVGA437','IBM VGA 8x16','Cascadia Mono','Menlo',monospace"
			ctx.font = `${cellHeightPx}px ${fontStack}`

			for (let r = 0; r < rows; r++) {
				const runs = compressLine(screen.lines[r])
				let x = 0
				for (const run of runs) {
					// background
					ctx.fillStyle = DOS_COLORS[run.bg] ?? '#000000'
					const w = run.text.length * cellWidthPx
					const y = r * cellHeightPx
					ctx.fillRect(x, y, w, cellHeightPx)
					// foreground
					const fgIdx = run.bold && run.fg < 8 ? run.fg + 8 : run.fg
					ctx.fillStyle = DOS_COLORS[fgIdx] ?? '#AAAAAA'
					ctx.fillText(run.text, x, y)
					x += w
				}
			}
		}
	}, [screen, renderMode, cellWidthPx, cellHeightPx, background, fontFamily, bitmapFont])

	// Animation loop: progressively parse and render ANSI data
	useEffect(() => {
		if (!animated || renderMode !== 'canvas' || !rawAnsiData || !isPlaying) {
			// Clean up any pending timeout
			if (animationTimeoutRef.current) {
				clearTimeout(animationTimeoutRef.current)
				animationTimeoutRef.current = null
			}
			return
		}

		const animate = () => {
			setCurrentByteIndex(prevIndex => {
				if (!rawAnsiData) return prevIndex

				// Find next render point
				const nextByteIndex = findNextRenderPoint(rawAnsiData, prevIndex, 50)

				if (nextByteIndex > prevIndex && nextByteIndex <= rawAnsiData.length) {
					// Parse up to the next render point
					const newScreen = parseAnsiIncremental(rawAnsiData, columns, nextByteIndex)
					setScreen(newScreen)

					// Check if we're done
					if (nextByteIndex >= rawAnsiData.length) {
						setIsPlaying(false)
						return rawAnsiData.length
					}

					// Schedule next frame
					const delay = Math.max(1, Math.floor(frameDelay / animationSpeed))
					animationTimeoutRef.current = window.setTimeout(animate, delay)

					return nextByteIndex
				} else {
					// No progress - animation complete
					setIsPlaying(false)
					return prevIndex
				}
			})
		}

		// Start animation immediately
		animate()

		return () => {
			if (animationTimeoutRef.current) {
				clearTimeout(animationTimeoutRef.current)
				animationTimeoutRef.current = null
			}
		}
	}, [animated, renderMode, rawAnsiData, isPlaying, columns, frameDelay, animationSpeed])

	// Debug: render raw bitmap data from FON file to canvas
	useEffect(() => {
		if (!debugFont || !rawFontData) return
		const canvas = debugFontCanvasRef.current
		if (!canvas) return

		// Raw bitmap is 4096 bytes: 256 characters × 16 rows each
		// Display as 16×16 grid of characters, each 8×16 pixels
		const charWidth = 8
		const charHeight = 16
		const cols = 16 // 16 columns
		const rows = 16 // 16 rows (256 total characters)

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

		// Fill background
		ctx.fillStyle = '#000000'
		ctx.fillRect(0, 0, cssWidth, cssHeight)

		// Render raw bitmap data directly
		// Each character is 16 consecutive bytes (one per row)
		ctx.fillStyle = '#FFFFFF'
		for (let charCode = 0; charCode < 256; charCode++) {
			const charBase = charCode * 16
			const col = charCode % 16
			const row = Math.floor(charCode / 16)
			const baseX = col * charWidth
			const baseY = row * charHeight

			// Render each row of this character
			for (let rowIdx = 0; rowIdx < 16; rowIdx++) {
				const byte = rawFontData[charBase + rowIdx]
				const x = baseX
				const y = baseY + rowIdx

				// Draw pixels MSB first (bit 7 = leftmost, bit 0 = rightmost)
				for (let bit = 0; bit < 8; bit++) {
					const bitValue = 7 - bit // MSB first
					if (byte & (1 << bitValue)) {
						ctx.fillRect(x + bit, y, 1, 1)
					}
				}
			}
		}
	}, [debugFont, rawFontData])

	if (error)
		return (
			<div
				style={rootStyle}
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
				style={rootStyle}
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
			{debugFont && rawFontData && (
				<div style={{ marginBottom: 16 }}>
					<h3 style={{ color: '#AAA', marginBottom: 8 }}>
						Font Debug - Raw Bitmap Data (256 glyphs, 16x16 grid, {rawFontData.length} bytes)
					</h3>
					<canvas
						ref={debugFontCanvasRef}
						style={{
							border: '1px solid #555',
							display: 'block',
							background: '#000',
						}}
					/>
				</div>
			)}
			{showControls && animated && renderMode === 'canvas' && (
				<div
					style={{
						display: 'flex',
						gap: '8px',
						marginBottom: '8px',
						alignItems: 'center',
					}}
				>
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
						onMouseEnter={e => {
							e.currentTarget.style.background = '#444'
						}}
						onMouseLeave={e => {
							e.currentTarget.style.background = '#333'
						}}
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
						onMouseEnter={e => {
							e.currentTarget.style.background = '#444'
						}}
						onMouseLeave={e => {
							e.currentTarget.style.background = '#333'
						}}
					>
						⏮ Restart
					</button>
				</div>
			)}
			{renderMode === 'canvas' ? (
				<canvas
					ref={canvasRef}
					style={rootStyle}
					aria-label={`ANSI Art Canvas${fileName ? ` - ${fileName}` : ''}`}
					onDragEnter={onDragEnter}
					onDragOver={onDragOver}
					onDragLeave={onDragLeave}
					onDrop={onDrop}
				/>
			) : (
				<pre
					style={rootStyle}
					aria-label={`ANSI Art${fileName ? ` - ${fileName}` : ''}`}
					onDragEnter={onDragEnter}
					onDragOver={onDragOver}
					onDragLeave={onDragLeave}
					onDrop={onDrop}
				>
					{screen.lines.map((cells, rowIdx) => (
						<div key={rowIdx} style={{ display: 'flex', height: `${fontSizePx}px` }}>
							{cells.map((cell, colIdx) => {
								const fgIdx = cell.bold && cell.fg < 8 ? cell.fg + 8 : cell.fg
								return (
									<span
										key={colIdx}
										style={{
											display: 'inline-block',
											textAlign: 'center',
											width: `${fontSizePx * 0.6}px`,
											height: `${fontSizePx}px`,
											color: DOS_COLORS[fgIdx] ?? '#AAAAAA',
											backgroundColor: DOS_COLORS[cell.bg] ?? '#000000',
											fontWeight: 'normal',
											overflow: 'hidden',
											flexShrink: 0,
										}}
									>
										{cell.ch}
									</span>
								)
							})}
						</div>
					))}
				</pre>
			)}
		</div>
	)
}
