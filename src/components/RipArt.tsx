'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parseRip } from '../rip/parser'
import { ripToCanvas } from '../rip/toCanvas'
import { AnsiPlayerOverlay } from './AnsiPlayerOverlay'
import type { AnyRipCommand, RipState } from '../rip/types'

export type RipArtProps = {
	url?: string // URL to RIP file
	mode?: 'animated' | 'final' | 'auto' // default 'auto', 'auto' detects animation automatically
	width?: number | 'auto' // defaults to 'auto' (detect from viewport), number sets fixed width
	height?: number | 'auto' // defaults to 'auto' (detect from viewport), number sets fixed height
	background?: string
	allowDrop?: boolean // drag-and-drop support
	showOverlayControls?: boolean // YouTube-style overlay controls (only for animated mode)
	showPerformanceOverlay?: boolean
	debug?: boolean // Enable debug logging for RIP parsing
	maxCommands?: number // Stop rendering after X commands (for debugging)
	// Animation settings (only used in animated mode)
	fps?: number
	bytesPerSecond?: number // Bytes per second for animation speed
	autoStart?: boolean // Start animation automatically on file load (default: true, only applies to animated mode)
}

export function RipArt({
	url,
	mode = 'auto',
	width = 'auto',
	height = 'auto',
	background = '#000000',
	allowDrop = true,
	showOverlayControls = false,
	showPerformanceOverlay = false,
	debug = false,
	maxCommands,
	fps = 30,
	bytesPerSecond = 960,
	autoStart = true,
}: RipArtProps) {
	const [ripData, setRipData] = useState<Uint8Array | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [isDragging, setIsDragging] = useState(false)
	const [fileName, setFileName] = useState<string | null>(null)
	const [detectedWidth, setDetectedWidth] = useState<number>(640)
	const [detectedHeight, setDetectedHeight] = useState<number>(350)
	const [commands, setCommands] = useState<AnyRipCommand[]>([])
	const [initialState, setInitialState] = useState<RipState | null>(null)
	const [detectedMode, setDetectedMode] = useState<'animated' | 'final'>('final')
	const [currentFrame, setCurrentFrame] = useState(0)
	const [isPlaying, setIsPlaying] = useState(autoStart)
	const [isOverlayVisible, setIsOverlayVisible] = useState(false)
	const [currentSpeed, setCurrentSpeed] = useState(() => bytesPerSecond)
	const animationFrameRef = useRef<number | null>(null)
	const lastFrameTimeRef = useRef<number>(0)
	const currentBytePositionRef = useRef<number>(0)
	const totalBytesRef = useRef<number>(0)
	const overlayTimeoutRef = useRef<number | null>(null)
	const canvasRef = useRef<HTMLCanvasElement | null>(null)

	// Detect animation when mode is 'auto' and commands are available
	useEffect(() => {
		if (mode === 'auto' && commands.length > 0) {
			// Simple heuristic: if there are multiple viewport changes or many commands, likely animated
			const viewportCount = commands.filter((c) => c.type === 'ViewPort').length
			const isAnimated = viewportCount > 1 || commands.length > 100
			setDetectedMode(isAnimated ? 'animated' : 'final')
		} else if (mode !== 'auto') {
			setDetectedMode(mode as 'animated' | 'final')
		}
	}, [mode, commands])

	// Derive effective mode
	const effectiveMode = useMemo<'animated' | 'final'>(() => {
		if (mode === 'auto') {
			return detectedMode
		}
		return mode as 'animated' | 'final'
	}, [mode, detectedMode])

	// Load RIP file from URL
	useEffect(() => {
		if (!url) return
		const urlToFetch = url // Capture url in const for TypeScript
		let cancelled = false
		async function load() {
			setError(null)
			try {
				const res = await fetch(urlToFetch)
				if (!res.ok) throw new Error(`Failed to fetch ${urlToFetch}: ${res.status}`)
				const buf = new Uint8Array(await res.arrayBuffer())
				if (!cancelled) {
					setRipData(buf)
					setFileName(null)
					totalBytesRef.current = buf.length
				}
			} catch (e: any) {
				if (!cancelled) setError(String(e?.message || e))
			}
		}
		load()
		return () => {
			cancelled = true
		}
	}, [url])

	// Handle drag and drop
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
		if (!file) {
			console.warn('[RipArt] No file in drop event')
			return
		}
		console.log(`[RipArt] File dropped: ${file.name}, size: ${file.size} bytes`)
		try {
			const buf = new Uint8Array(await file.arrayBuffer())
			console.log(`[RipArt] File loaded: ${buf.length} bytes`)
			setRipData(buf)
			setFileName(file.name)
			totalBytesRef.current = buf.length
			setError(null) // Clear any previous errors
		} catch (err: any) {
			const errorMsg = String(err?.message || err)
			console.error(`[RipArt] Error loading file:`, errorMsg)
			setError(errorMsg)
		}
	}

	// Parse RIP file when data is available
	useEffect(() => {
		if (!ripData) return

		try {
			if (debug) console.log(`[RipArt] Parsing RIP file: ${fileName || url || 'dropped file'}, ${ripData.length} bytes`)
			const result = parseRip(ripData, debug)
			setCommands(result.commands)
			setInitialState(result.initialState ?? result.state)
			setDetectedWidth(result.width)
			setDetectedHeight(result.height)
			currentBytePositionRef.current = 0
			setCurrentFrame(0)
			// Reduced parser logging - focus on rendering
		} catch (e: any) {
			const errorMsg = String(e?.message || e)
			console.error(`[RipArt] Parse failed:`, errorMsg)
			if (debug) console.error(`[RipArt] Error details:`, e)
			setError(errorMsg)
		}
	}, [ripData, debug, fileName, url])

	// Determine display dimensions
	const displayWidth = useMemo(() => {
		if (width === 'auto') {
			return detectedWidth
		}
		return width
	}, [width, detectedWidth])

	const displayHeight = useMemo(() => {
		if (height === 'auto') {
			return detectedHeight
		}
		return height
	}, [height, detectedHeight])

	// Calculate how many commands to show based on byte position
	const getCommandsForBytePosition = useCallback(
		(bytePos: number): number => {
			// Simple approximation: assume each command takes roughly equal bytes
			// This is not perfect but works for animation
			if (totalBytesRef.current === 0) return commands.length
			const ratio = Math.min(bytePos / totalBytesRef.current, 1)
			return Math.floor(ratio * commands.length)
		},
		[commands]
	)

	// Render to canvas
	useEffect(() => {
		console.log(`[RipArt] Render effect triggered: canvas=${!!canvasRef.current}, initialState=${!!initialState}, commands=${commands.length}`)
		if (!canvasRef.current || !initialState || commands.length === 0) {
			console.log(`[RipArt] Skipping render: canvas=${!!canvasRef.current}, initialState=${!!initialState}, commands=${commands.length}`)
			return
		}

		const canvas = canvasRef.current
		console.log(`[RipArt] Rendering to canvas: ${displayWidth}x${displayHeight}, maxCommands=${maxCommands}`)
		let renderMaxCommands: number | undefined = maxCommands // Use prop if provided

		if (effectiveMode === 'animated' && renderMaxCommands === undefined) {
			// Animated mode: show commands up to current byte position (only if not overridden by prop)
			renderMaxCommands = getCommandsForBytePosition(currentBytePositionRef.current)
		}

		ripToCanvas(
			canvas,
			commands,
			displayWidth,
			displayHeight,
			initialState,
			background,
			renderMaxCommands // Use maxCommands prop for debugging
		)

		if (debug) {
			console.log(`[RipArt] Rendered to canvas: ${commands.length} commands${renderMaxCommands !== undefined ? `, showing ${renderMaxCommands}` : ''}`)
		}
	}, [commands, displayWidth, displayHeight, initialState, background, effectiveMode, currentFrame, debug, maxCommands, getCommandsForBytePosition])

	// Animation loop
	useEffect(() => {
		if (effectiveMode !== 'animated' || !isPlaying) {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current)
				animationFrameRef.current = null
			}
			return
		}

		const animate = (timestamp: number) => {
			if (lastFrameTimeRef.current === 0) {
				lastFrameTimeRef.current = timestamp
			}

			const deltaTime = (timestamp - lastFrameTimeRef.current) / 1000 // seconds
			const bytesToAdvance = Math.floor(deltaTime * currentSpeed)

			if (bytesToAdvance > 0) {
				currentBytePositionRef.current = Math.min(
					currentBytePositionRef.current + bytesToAdvance,
					totalBytesRef.current
				)
				setCurrentFrame((prev) => prev + 1)
				lastFrameTimeRef.current = timestamp
			}

			animationFrameRef.current = requestAnimationFrame(animate)
		}

		animationFrameRef.current = requestAnimationFrame(animate)
		lastFrameTimeRef.current = 0

		return () => {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current)
				animationFrameRef.current = null
			}
		}
	}, [effectiveMode, isPlaying, currentSpeed])

	// Player control functions
	const handlePlayPause = useCallback(() => {
		if (currentBytePositionRef.current >= totalBytesRef.current) {
			// Restart
			currentBytePositionRef.current = 0
			setCurrentFrame(0)
		}
		setIsPlaying((prev) => !prev)
	}, [])

	const handleRestart = useCallback(() => {
		currentBytePositionRef.current = 0
		setCurrentFrame(0)
		setIsPlaying(true)
	}, [])

	const handleSeek = useCallback((bytePosition: number) => {
		currentBytePositionRef.current = Math.max(0, Math.min(bytePosition, totalBytesRef.current))
		setCurrentFrame((prev) => prev + 1) // Trigger re-render
	}, [])

	const handleSpeedChange = useCallback((newBytesPerSecond: number) => {
		setCurrentSpeed(newBytesPerSecond)
	}, [])

	const handleAdvanceByte = useCallback(() => {
		currentBytePositionRef.current = Math.min(
			currentBytePositionRef.current + 1,
			totalBytesRef.current
		)
		setCurrentFrame((prev) => prev + 1)
	}, [])

	const handleRewindByte = useCallback(() => {
		currentBytePositionRef.current = Math.max(currentBytePositionRef.current - 1, 0)
		setCurrentFrame((prev) => prev + 1)
	}, [])

	const handleMouseMove = useCallback(() => {
		setIsOverlayVisible(true)
		if (overlayTimeoutRef.current) {
			clearTimeout(overlayTimeoutRef.current)
		}
		overlayTimeoutRef.current = window.setTimeout(() => {
			setIsOverlayVisible(false)
		}, 3000)
	}, [])

	// Clean up timeout on unmount
	useEffect(() => {
		return () => {
			if (overlayTimeoutRef.current) {
				window.clearTimeout(overlayTimeoutRef.current)
			}
		}
	}, [])

	const rootStyle: React.CSSProperties = useMemo(
		() => ({
			...(isDragging ? { outline: '2px dashed #888', outlineOffset: '-2px' } : {}),
		}),
		[isDragging]
	)

	if (error) {
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
	}

	if (!ripData) {
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
				{url ? 'Loading…' : 'Drop a .rip file here or provide a URL'}
			</div>
		)
	}

	if (!initialState || commands.length === 0) {
		return (
			<div
				style={{
					...rootStyle,
					padding: '16px',
					color: '#FFAA00',
					background: '#000',
					fontFamily: 'monospace',
				}}
				onDragEnter={onDragEnter}
				onDragOver={onDragOver}
				onDragLeave={onDragLeave}
				onDrop={onDrop}
			>
				{commands.length === 0
					? `No commands parsed from file${fileName ? `: ${fileName}` : ''}. ${debug ? 'Check console for details.' : 'Try enabling debug mode.'}`
					: 'Processing…'}
			</div>
		)
	}

	return (
		<div
			style={{
				...rootStyle,
				position: 'relative',
				display: 'inline-block',
			}}
			onDragEnter={onDragEnter}
			onDragOver={onDragOver}
			onDragLeave={onDragLeave}
			onDrop={onDrop}
			onMouseMove={effectiveMode === 'animated' && showOverlayControls ? handleMouseMove : undefined}
		>
			<canvas
				ref={canvasRef}
				width={displayWidth}
				height={displayHeight}
				style={{
					width: displayWidth,
					height: displayHeight,
					display: 'block',
					imageRendering: 'pixelated',
					WebkitImageSmoothingEnabled: 'false',
					MozImageSmoothingEnabled: 'false',
					OImageSmoothingEnabled: 'false',
				} as any}
			/>
			{effectiveMode === 'animated' && showOverlayControls && (
				<AnsiPlayerOverlay
					isPlaying={isPlaying}
					currentBytes={currentBytePositionRef.current}
					totalBytes={totalBytesRef.current}
					currentSpeed={currentSpeed}
					isVisible={isOverlayVisible}
					onPlayPause={handlePlayPause}
					onRestart={handleRestart}
					onSeek={handleSeek}
					onSpeedChange={handleSpeedChange}
					onAdvanceByte={handleAdvanceByte}
					onRewindByte={handleRewindByte}
					onMouseMove={handleMouseMove}
				/>
			)}
		</div>
	)
}

