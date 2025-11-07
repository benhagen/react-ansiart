'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnsiVirtualDisplayEngine } from './AnsiVirtualDisplayEngine'
import { BitmapFont, loadRawBitmapFont } from './bitmapFont'
import { extractFontFromFON } from './fonExtractor'
import { convertFrameDataToAnsi } from './frameToAnsi'
import { generatePlasmaFrame } from './plasma'
import type { DisplayFrameGenerator, PixelFrameGenerator } from './types'

export type AnsiVirtualDisplayProps = {
	columns?: number // default 80
	rows?: number // default 25
	cellWidthPx?: number // default 8
	cellHeightPx?: number // default 16
	frameGenerator?: DisplayFrameGenerator // default: plasma with default converter
	fps?: number // default 30
	background?: string // default: '#000'. Accepts any valid CSS color (hex, rgb, rgba, hsl, named colors, etc.)
	bitmapFontUrl: string // path to .FON or raw bitmap font file
	showControls?: boolean // show play/pause controls
	showPerformanceOverlay?: boolean // show performance stats overlay
	fillContainer?: boolean // fill the container width instead of fit-content
	// Virtual world sizing (defaults to visible size for backward compatibility)
	virtualColumns?: number
	virtualRows?: number
	// Viewport position within virtual world (character coords)
	viewX?: number
	viewY?: number
	// Pixel offsets for smooth scrolling (sub-character precision)
	pixelOffsetX?: number
	pixelOffsetY?: number
	onViewChange?: (view: { viewX: number; viewY: number }) => void
}

const defaultFrameGenerator: PixelFrameGenerator = {
	generator: generatePlasmaFrame,
	converter: convertFrameDataToAnsi,
}

export function AnsiVirtualDisplay({
	columns = 80,
	rows = 25,
	cellWidthPx = 8,
	cellHeightPx = 16,
	frameGenerator = defaultFrameGenerator,
	fps = 30,
	background = '#000',
	bitmapFontUrl,
	showControls = false,
	showPerformanceOverlay = false,
	fillContainer = false,
	virtualColumns,
	virtualRows,
	viewX = 0,
	viewY = 0,
	pixelOffsetX = 0,
	pixelOffsetY = 0,
	onViewChange,
}: AnsiVirtualDisplayProps) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null)
	const engineRef = useRef<AnsiVirtualDisplayEngine | null>(null)
	const [bitmapFont, setBitmapFont] = useState<BitmapFont | null>(null)
	const [isPlaying, setIsPlaying] = useState(true)

	// Use the provided frameGenerator directly
	// The caller (e.g. PlasmaBackgroundLayout) is responsible for handling windowing/sampling
	const effectiveFrameGenerator = useMemo<DisplayFrameGenerator>(() => {
		return frameGenerator
	}, [frameGenerator])

	// Initialize engine when canvas is available
	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		if (!engineRef.current) {
			engineRef.current = new AnsiVirtualDisplayEngine(canvas, {
				columns,
				rows,
				cellWidthPx,
				cellHeightPx,
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
			})
		}

		return () => {
			if (engineRef.current) {
				engineRef.current.destroy()
				engineRef.current = null
			}
		}
	}, [])

	// Update engine config when props change
	useEffect(() => {
		if (!engineRef.current) return

		engineRef.current.updateConfig({
			columns,
			rows,
			cellWidthPx,
			cellHeightPx,
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
		})
	}, [
		columns,
		rows,
		cellWidthPx,
		cellHeightPx,
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
	])

	// Pass loaded font to engine
	useEffect(() => {
		if (!engineRef.current) return
		engineRef.current.setBitmapFont(bitmapFont)
	}, [bitmapFont])

	// Load bitmap font if provided
	useEffect(() => {
		if (!bitmapFontUrl) {
			setBitmapFont(null)
			return
		}
		let cancelled = false
		async function loadFont() {
			try {
				const fontData = await extractFontFromFON(bitmapFontUrl!)

				if (fontData && fontData.length >= 4096) {
					const glyphs: Uint8Array[] = []
					for (let i = 0; i < 256; i++) {
						glyphs.push(fontData.slice(i * 16, (i + 1) * 16))
					}

					if (!cancelled) setBitmapFont({ width: 8, height: 16, glyphs, rawBitmapData: fontData })
				} else {
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

	const handlePlayPause = () => {
		if (!engineRef.current) return
		if (isPlaying) {
			engineRef.current.pause()
			setIsPlaying(false)
		} else {
			engineRef.current.play()
			setIsPlaying(true)
		}
	}

	const handleRestart = () => {
		if (!engineRef.current) return
		engineRef.current.restart()
		setIsPlaying(true)
	}

	const rootStyle: React.CSSProperties = useMemo(() => {
		return {
			display: 'block',
			width: fillContainer ? '100%' : 'fit-content',
			background,
		}
	}, [fillContainer, background])

	return (
		<div>
			{showControls && (
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
			<canvas ref={canvasRef} style={rootStyle} aria-label='ANSI Virtual Display' />
			{/* Optional: simple debug controls to pan (example - no UI change by default) */}
		</div>
	)
}
