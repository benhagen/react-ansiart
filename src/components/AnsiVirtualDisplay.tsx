'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SauceMetadata } from '../utils/sauce'
import { AnsiPlayerOverlay } from './AnsiPlayerOverlay'
import { AnsiVirtualDisplayEngine } from '../engines/AnsiVirtualDisplayEngine'
import { BitmapFont } from '../font/bitmapFont'
import { loadBitmapFontFromUrl } from '../font/bitmapFontLoader'
import { getEmbeddedVgaFont } from '../font/embeddedVgaFont'
import type { DisplayFrameGenerator, GeneratorCapabilities } from '../types/types'

export type AnsiVirtualDisplayProps = {
	columns?: number // default 80
	rows?: number // default 25
	frameGenerator: DisplayFrameGenerator // Required: frame generator function
	fps?: number // default 30
	background?: string // default: '#000'. Accepts any valid CSS color (hex, rgb, rgba, hsl, named colors, etc.)
	bitmapFont?: BitmapFont // Pre-loaded font (avoids duplicate loading)
	bitmapFontUrl?: string // path to .FON or raw bitmap font file (required if bitmapFont not provided)
	/** @deprecated Use `showOverlayControls` instead */
	showControls?: boolean
	showOverlayControls?: boolean // show YouTube-style overlay controls (only for supported generators)
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
	// SAUCE metadata
	sauce?: SauceMetadata
	onSauceClick?: () => void
	// Animation control
	autoStart?: boolean // Start animation automatically (default: true, only applies to animated mode)
}

export function AnsiVirtualDisplay({
	columns = 80,
	rows = 25,
	frameGenerator,
	fps = 30,
	background = '#000',
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
	autoStart,
}: AnsiVirtualDisplayProps) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null)
	const engineRef = useRef<AnsiVirtualDisplayEngine | null>(null)
	const previousFrameGeneratorRef = useRef<DisplayFrameGenerator | null>(null)
	const [bitmapFont, setBitmapFont] = useState<BitmapFont | null>(providedBitmapFont || null)
	const [isPlaying, setIsPlaying] = useState(false) // Will be synced with engine on init
	const [isOverlayVisible, setIsOverlayVisible] = useState(false)
	const [currentBytes, setCurrentBytes] = useState(0)
	const [totalBytes, setTotalBytes] = useState(0)
	const [currentSpeed, setCurrentSpeed] = useState(960) // Default: 9600 baud = 960 bytes/sec
	const hideTimeoutRef = useRef<number | null>(null)

	// Use the provided frameGenerator directly
	// The caller (e.g. PlasmaBackgroundLayout) is responsible for handling windowing/sampling
	const effectiveFrameGenerator = useMemo<DisplayFrameGenerator>(() => {
		return frameGenerator
	}, [frameGenerator])

	// Check if generator supports overlay controls (must be early for dependencies)
	const generatorCapabilities = useMemo<GeneratorCapabilities | null>(() => {
		if ('capabilities' in frameGenerator && frameGenerator.capabilities) {
			return frameGenerator.capabilities as GeneratorCapabilities
		}
		return null
	}, [frameGenerator])

	const supportsOverlayControls =
		showOverlayControls &&
		generatorCapabilities !== null &&
		(generatorCapabilities.supportsSeek || generatorCapabilities.supportsSpeedControl)

	// Initialize engine when canvas is available
	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		if (!engineRef.current) {
			// Determine if animation should start paused
			// If autoStart is explicitly false, start paused
			// If autoStart is true or undefined, start playing (unless overlay controls are enabled, then use current behavior)
			const shouldStartPaused =
				autoStart === false ? true : autoStart === true ? false : supportsOverlayControls // If autoStart is undefined, use current behavior
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
				startPaused: shouldStartPaused,
			})
			// Initialize the ref to track the current frameGenerator
			previousFrameGeneratorRef.current = effectiveFrameGenerator
			// Sync initial playing state
			setIsPlaying(!shouldStartPaused)
			// Show overlay initially if starting paused
			if (shouldStartPaused) {
				setIsOverlayVisible(true)
			}
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

		const previousFrameGenerator = previousFrameGeneratorRef.current
		const frameGeneratorChanged = effectiveFrameGenerator !== previousFrameGenerator

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
			pixelOffsetY,
		})

		// If frameGenerator changed (new file loaded) and autoStart is true, restart and play
		// Only do this if previousFrameGenerator was not null (i.e., not the initial creation)
		if (frameGeneratorChanged && previousFrameGenerator !== null && autoStart !== false) {
			engineRef.current.restart()
			if (!engineRef.current.getPlayingState()) {
				engineRef.current.play()
				setIsPlaying(true)
			}
		}

		// Update the ref to track the current frameGenerator
		previousFrameGeneratorRef.current = effectiveFrameGenerator

		// Update overlay state after config change
		if (supportsOverlayControls) {
			const bytes = engineRef.current.getTotalBytes()
			if (bytes) setTotalBytes(bytes)
			const speed = engineRef.current.getCurrentBytesPerSecond()
			if (speed) setCurrentSpeed(speed)
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
		autoStart,
	])

	// Pass loaded font to engine
	useEffect(() => {
		if (!engineRef.current) return
		engineRef.current.setBitmapFont(bitmapFont)
	}, [bitmapFont])

	// Use provided font, load from URL, or fall back to embedded font
	useEffect(() => {
		if (providedBitmapFont) {
			setBitmapFont(providedBitmapFont)
			return
		}

		if (!bitmapFontUrl) {
			// No URL provided — use embedded VGA font
			setBitmapFont(getEmbeddedVgaFont())
			return
		}

		let cancelled = false
		async function loadFont() {
			const font = await loadBitmapFontFromUrl(bitmapFontUrl!)
			if (!cancelled) setBitmapFont(font)
		}
		loadFont()
		return () => {
			cancelled = true
		}
	}, [providedBitmapFont, bitmapFontUrl])

	const handlePlayPause = () => {
		if (!engineRef.current) return
		if (isPlaying) {
			engineRef.current.pause()
			setIsPlaying(false)
		} else {
			// If at the end, restart from beginning
			const currentBytePos = engineRef.current.getCurrentBytePosition()
			const totalByteSize = engineRef.current.getTotalBytes()
			if (totalByteSize > 0 && currentBytePos >= totalByteSize) {
				engineRef.current.restart()
			} else {
				engineRef.current.play()
			}
			setIsPlaying(true)
		}
	}

	const handleRestart = () => {
		if (!engineRef.current) return
		engineRef.current.restart()
		setCurrentBytes(0)
		setIsPlaying(true)
	}

	// Overlay control handlers
	const handleMouseMove = useCallback(() => {
		if (!showOverlayControls) return

		setIsOverlayVisible(true)

		// Clear existing timeout
		if (hideTimeoutRef.current) {
			clearTimeout(hideTimeoutRef.current)
		}

		// Only auto-hide if playing (not paused)
		if (isPlaying) {
			// Set new timeout to hide after 3 seconds
			hideTimeoutRef.current = setTimeout(() => {
				setIsOverlayVisible(false)
			}, 3000)
		}
	}, [showOverlayControls, isPlaying])

	const handleMouseLeave = useCallback(() => {
		if (!showOverlayControls) return

		// Clear timeout
		if (hideTimeoutRef.current) {
			clearTimeout(hideTimeoutRef.current)
		}
		// Only hide on mouse leave if playing (stay visible when paused)
		if (isPlaying) {
			setIsOverlayVisible(false)
		}
	}, [showOverlayControls, isPlaying])

	const handleSeek = useCallback((bytePosition: number) => {
		if (!engineRef.current) return
		engineRef.current.seekToBytePosition(bytePosition)
		setCurrentBytes(bytePosition)
	}, [])

	const handleSpeedChange = useCallback((bytesPerSecond: number) => {
		if (!engineRef.current) return
		engineRef.current.setSpeed(bytesPerSecond)
		setCurrentSpeed(bytesPerSecond)
	}, [])

	const handleAdvanceByte = useCallback(() => {
		if (!engineRef.current) return
		engineRef.current.advanceByte()
		setCurrentBytes(engineRef.current.getCurrentBytePosition())
	}, [])

	const handleRewindByte = useCallback(() => {
		if (!engineRef.current) return
		engineRef.current.rewindByte()
		setCurrentBytes(engineRef.current.getCurrentBytePosition())
	}, [])

	// Update current byte position periodically for overlay
	// Only triggers React re-render when the value actually changes
	const lastPolledBytesRef = useRef(-1)
	useEffect(() => {
		if (!supportsOverlayControls || !isPlaying) return

		const intervalId = setInterval(() => {
			if (engineRef.current) {
				const bytes = engineRef.current.getCurrentBytePosition()
				const total = engineRef.current.getTotalBytes()

				// Check if we've reached the end
				if (total > 0 && bytes >= total) {
					// Stop playback when animation completes
					engineRef.current.pause()
					setIsPlaying(false)
					setCurrentBytes(total) // Cap at total
					lastPolledBytesRef.current = total
				} else if (bytes !== lastPolledBytesRef.current) {
					// Only update state (triggering re-render) when bytes actually changed
					setCurrentBytes(bytes)
					lastPolledBytesRef.current = bytes
				}
			}
		}, 100) // Update 10 times per second

		return () => clearInterval(intervalId)
	}, [supportsOverlayControls, isPlaying])

	// Update current bytes and speed when playing state changes
	useEffect(() => {
		if (engineRef.current) {
			setCurrentBytes(engineRef.current.getCurrentBytePosition())
			const speed = engineRef.current.getCurrentBytesPerSecond()
			if (speed) setCurrentSpeed(speed)
		}
	}, [isPlaying])

	// Initialize current speed and total bytes from engine
	useEffect(() => {
		if (engineRef.current && supportsOverlayControls) {
			const speed = engineRef.current.getCurrentBytesPerSecond()
			if (speed) setCurrentSpeed(speed)

			const bytes = engineRef.current.getTotalBytes()
			if (bytes) setTotalBytes(bytes)
		}
	}, [supportsOverlayControls, frameGenerator])

	// Clean up timeout on unmount
	useEffect(() => {
		return () => {
			if (hideTimeoutRef.current) {
				clearTimeout(hideTimeoutRef.current)
			}
		}
	}, [])

	const rootStyle: React.CSSProperties = useMemo(() => {
		return {
			display: 'block',
			width: fillContainer ? '100%' : 'fit-content',
			background,
		}
	}, [fillContainer, background])

	const canvasContainerStyle: React.CSSProperties = useMemo(() => ({
		position: 'relative',
		display: 'inline-block',
		width: fillContainer ? '100%' : 'fit-content',
	}), [fillContainer])

	const controlsBarStyle: React.CSSProperties = useMemo(() => ({
		display: 'flex',
		gap: '8px',
		marginBottom: '8px',
		alignItems: 'center',
	}), [])

	const buttonStyle: React.CSSProperties = useMemo(() => ({
		padding: '6px 12px',
		color: '#AAA',
		border: '1px solid #555',
		cursor: 'pointer',
		fontSize: '14px',
		fontFamily: 'monospace',
	}), [])

	const debugOverlayStyle: React.CSSProperties = useMemo(() => ({
		position: 'absolute',
		top: 0,
		left: 0,
		background: 'rgba(0, 0, 0, 0.8)',
		color: '#0f0',
		padding: '4px 8px',
		fontSize: '10px',
		fontFamily: 'monospace',
		pointerEvents: 'none',
	}), [])

	return (
		<div>
			{/* Simple controls (only show if overlay controls are disabled) */}
			{showControls && !supportsOverlayControls && (
				<>
					<style>{`
						.ansi-simple-btn { background: #333; }
						.ansi-simple-btn:hover { background: #444 !important; }
					`}</style>
					<div style={controlsBarStyle}>
						<button
							className='ansi-simple-btn'
							onClick={handlePlayPause}
							style={buttonStyle}
						>
							{isPlaying ? '⏸ Pause' : '▶ Play'}
						</button>
						<button
							className='ansi-simple-btn'
							onClick={handleRestart}
							style={buttonStyle}
						>
							⏮ Restart
						</button>
					</div>
				</>
			)}

			{/* Canvas with overlay controls */}
			<div
				style={canvasContainerStyle}
				onMouseMove={handleMouseMove}
				onMouseLeave={handleMouseLeave}
			>
				<canvas ref={canvasRef} style={rootStyle} aria-label='ANSI Virtual Display' />

				{/* YouTube-style overlay controls */}
				{supportsOverlayControls && (
					<AnsiPlayerOverlay
						isPlaying={isPlaying}
						currentBytes={currentBytes}
						totalBytes={totalBytes}
						currentSpeed={currentSpeed}
						isVisible={isOverlayVisible}
						onPlayPause={handlePlayPause}
						onRestart={handleRestart}
						onSeek={handleSeek}
						onSpeedChange={handleSpeedChange}
						onAdvanceByte={handleAdvanceByte}
						onRewindByte={handleRewindByte}
						onMouseMove={handleMouseMove}
						sauce={sauce}
						onSauceClick={onSauceClick}
					/>
				)}
				{/* Debug info - only show when overlay is visible */}
				{supportsOverlayControls && isOverlayVisible && typeof window !== 'undefined' && (
					<div style={debugOverlayStyle}>
						Bytes: {currentBytes} / {totalBytes} | Speed: {currentSpeed} bytes/sec
					</div>
				)}
			</div>
		</div>
	)
}
