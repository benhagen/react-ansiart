'use client'

import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SauceMetadata } from '../utils/sauce'
import { AnsiVirtualDisplayEngine } from '../engines/AnsiVirtualDisplayEngine'
import { BitmapFont } from '../font/bitmapFont'
import { getEmbeddedVgaFont } from '../font/embeddedVgaFont'
import type {
	CharacterFrameGeneratorWithMetadata,
	DisplayFrameGenerator,
	GeneratorCapabilities,
} from '../types/types'
import { mapClientToCell, type AnsiPointerInput } from '../generators/pointerInput'

/** A pointer event translated into character-cell coordinates. */
export type AnsiCellPointerEvent = {
	type: 'move' | 'down' | 'up' | 'leave'
	/** Horizontal position in fractional cell coordinates (virtual-world space). */
	x: number
	/** Vertical position in fractional cell coordinates (virtual-world space). */
	y: number
	/** `PointerEvent.buttons` bitmask at the time of the event. */
	buttons: number
}

// Playback transport UI. Gated behind `showOverlayControls` (default false) *and* a generator
// that reports seek/speed capabilities, so the common cases — static art, procedural background
// generators — can never mount it. Loading it lazily keeps it out of their bundles entirely.
const AnsiPlayerOverlay = lazy(() =>
	import('./AnsiPlayerOverlay').then(m => ({ default: m.AnsiPlayerOverlay }))
)

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
	/** @deprecated Never invoked; the engine owns view state. Accepted for compatibility. */
	onViewChange?: (view: { viewX: number; viewY: number }) => void
	// SAUCE metadata
	sauce?: SauceMetadata
	onSauceClick?: () => void
	// Animation control
	autoStart?: boolean // Start animation automatically (default: true, only applies to animated mode)
	/**
	 * Pointer input channel for interactive generators. When set, the display feeds pointer
	 * moves/presses/leaves into it in cell coordinates (offset by viewX/viewY for windowed
	 * virtual worlds); pass the same object to a generator's `pointer` option to react to it.
	 */
	pointerInput?: AnsiPointerInput
	/** Raw cell-space pointer events, for app-level interactivity beyond `pointerInput`. */
	onCellPointer?: (event: AnsiCellPointerEvent) => void
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
	sauce,
	onSauceClick,
	autoStart,
	pointerInput,
	onCellPointer,
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
	// Tracks whether the engine is currently paused because the canvas scrolled out of
	// the viewport (as opposed to an explicit user/app pause). Only visibility-pauses are
	// ever auto-resumed; explicit pauses must never be overridden by re-entering the viewport.
	const pausedByVisibilityRef = useRef(false)
	const isPlayingRef = useRef(isPlaying)
	useEffect(() => {
		isPlayingRef.current = isPlaying
	}, [isPlaying])
	// Latest intersection state, kept outside React state so other effects/handlers can read it
	// synchronously. Defaults to true (visible) so environments without IntersectionObserver
	// (SSR / older browsers) — where this is never updated — behave as "always visible".
	const isIntersectingRef = useRef(true)

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

	// A static generator (a fully-parsed ANSI file in 'final' mode) returns the same screen for
	// every frame. Running the engine's frame loop for it burns a tick at the target fps forever
	// and can never produce a new pixel, so the display renders exactly one frame and stays
	// paused. Note this is *not* the same as "no capabilities": procedural generators (plasma,
	// fire, ...) also expose no seek/speed control but their output changes with the frame number.
	const isStaticGenerator = useMemo<boolean>(() => {
		if (typeof frameGenerator !== 'function') return false
		return (frameGenerator as CharacterFrameGeneratorWithMetadata).isStatic === true
	}, [frameGenerator])

	// Initialize engine when canvas is available
	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		if (!engineRef.current) {
			// Determine if animation should start paused
			// A static generator has nothing to play, so it always starts paused regardless of
			// autoStart — the engine constructor still renders frame 0 (see below), which is all
			// a static image ever needs.
			// If autoStart is explicitly false, start paused
			// If autoStart is true or undefined, start playing (unless overlay controls are enabled, then use current behavior)
			const shouldStartPaused = isStaticGenerator
				? true
				: autoStart === false
				? true
				: autoStart === true
				? false
				: supportsOverlayControls // If autoStart is undefined, use current behavior
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
			// Show overlay initially if starting paused — but not for a static image, which
			// isn't paused in any user-meaningful sense and has no transport to offer.
			if (shouldStartPaused && !isStaticGenerator) {
				setIsOverlayVisible(true)
			}
		}

		return () => {
			if (engineRef.current) {
				engineRef.current.destroy()
				engineRef.current = null
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once: prop changes are applied by the updateConfig effect below
	}, [])

	// Pause the engine while the canvas is scrolled out of the viewport, and resume it when
	// it comes back — but only if visibility is what paused it (never override an explicit
	// user/app pause, and never let a stale visibility-resume fire after a later explicit pause).
	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return
		if (typeof IntersectionObserver === 'undefined') return // SSR / unsupported environments: no-op

		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[entries.length - 1]
				if (!entry || !engineRef.current) return

				isIntersectingRef.current = entry.isIntersecting

				if (entry.isIntersecting) {
					if (pausedByVisibilityRef.current) {
						pausedByVisibilityRef.current = false
						engineRef.current.play()
						setIsPlaying(true)
					}
				} else if (isPlayingRef.current) {
					pausedByVisibilityRef.current = true
					engineRef.current.pause()
					setIsPlaying(false)
				}
			},
			{ threshold: 0, rootMargin: '200px' }
		)
		observer.observe(canvas)

		return () => {
			observer.disconnect()
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

		// If frameGenerator changed (new file loaded) and autoStart is true, restart and play.
		// Only do this if previousFrameGenerator was not null (i.e., not the initial creation).
		// engine.restart() unconditionally starts the engine playing, so when the canvas is
		// currently offscreen we immediately re-pause it (marking it as paused-by-visibility so
		// it resumes automatically on next entry) instead of letting a newly-swapped generator
		// burn CPU while invisible — otherwise a playlist advancing below the fold would defeat
		// the whole point of the visibility pause.
		if (frameGeneratorChanged && previousFrameGenerator !== null) {
			if (isStaticGenerator) {
				// Swapped to a static image: updateConfig() above already regenerated and
				// painted the new screen, so all that's left is to stop the frame loop if the
				// previous (animated) generator had it running. Never auto-resumed: a still
				// image has nothing to resume to.
				pausedByVisibilityRef.current = false
				engineRef.current.pause()
				setIsPlaying(false)
			} else if (autoStart !== false) {
				engineRef.current.restart()
				if (isIntersectingRef.current) {
					setIsPlaying(true)
					pausedByVisibilityRef.current = false
				} else {
					engineRef.current.pause()
					setIsPlaying(false)
					pausedByVisibilityRef.current = true
				}
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
		isStaticGenerator,
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
			// Imported on demand: the .FON parser and font cache are only reachable via
			// `bitmapFontUrl`, so consumers on the embedded font never download them.
			const { loadBitmapFontFromUrl } = await import('../font/bitmapFontLoader')
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
		// Explicit user action always wins over visibility-driven pause/resume tracking.
		pausedByVisibilityRef.current = false
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
		pausedByVisibilityRef.current = false
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
			hideTimeoutRef.current = window.setTimeout(() => {
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

	// ─── Cell-space pointer interactivity ─────────────────────────────────────
	// Translates canvas pointer events into fractional cell coordinates (virtual-world
	// space) and forwards them to the injectable pointerInput channel and/or the raw
	// onCellPointer callback. Handlers are only attached when either consumer exists.
	const isPointerInteractive = pointerInput !== undefined || onCellPointer !== undefined

	const dispatchCellPointer = useCallback(
		(type: AnsiCellPointerEvent['type'], e: React.PointerEvent<HTMLCanvasElement>) => {
			const canvas = canvasRef.current
			if (!canvas) return
			const rect = canvas.getBoundingClientRect()
			const cell = mapClientToCell(rect, e.clientX, e.clientY, columns, rows, viewX, viewY)

			if (pointerInput) {
				if (type === 'move') pointerInput.move(cell.x, cell.y)
				else if (type === 'down') pointerInput.down(cell.x, cell.y)
				else if (type === 'up') pointerInput.up(cell.x, cell.y)
				else pointerInput.leave()
			}
			if (onCellPointer) onCellPointer({ type, x: cell.x, y: cell.y, buttons: e.buttons })
		},
		[columns, rows, viewX, viewY, pointerInput, onCellPointer]
	)

	const handleCellPointerMove = useCallback(
		(e: React.PointerEvent<HTMLCanvasElement>) => dispatchCellPointer('move', e),
		[dispatchCellPointer]
	)
	const handleCellPointerDown = useCallback(
		(e: React.PointerEvent<HTMLCanvasElement>) => {
			// Capture so drags keep reporting cell positions until release, even when the
			// pointer leaves the canvas mid-drag.
			e.currentTarget.setPointerCapture?.(e.pointerId)
			dispatchCellPointer('down', e)
		},
		[dispatchCellPointer]
	)
	const handleCellPointerUp = useCallback(
		(e: React.PointerEvent<HTMLCanvasElement>) => dispatchCellPointer('up', e),
		[dispatchCellPointer]
	)
	const handleCellPointerLeave = useCallback(
		(e: React.PointerEvent<HTMLCanvasElement>) => dispatchCellPointer('leave', e),
		[dispatchCellPointer]
	)

	// When the component unmounts (or interactivity is switched off), leave the channel in
	// a clean inactive state instead of a stale "active" one.
	useEffect(() => {
		if (!pointerInput) return
		return () => {
			pointerInput.leave()
		}
	}, [pointerInput])

	const rootStyle: React.CSSProperties = useMemo(() => {
		return {
			display: 'block',
			width: fillContainer ? '100%' : 'fit-content',
			background,
			// Without this, touch drags scroll the page instead of driving the generator.
			...(isPointerInteractive ? { touchAction: 'none' as const } : null),
		}
	}, [fillContainer, background, isPointerInteractive])

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
			{/* Simple controls (only show if overlay controls are disabled, and never for a
			    static image — there is no playback to control, and starting the frame loop for
			    an unchanging screen only burns CPU) */}
			{showControls && !supportsOverlayControls && !isStaticGenerator && (
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
				<canvas
					ref={canvasRef}
					style={rootStyle}
					aria-label='ANSI Virtual Display'
					{...(isPointerInteractive
						? {
							onPointerMove: handleCellPointerMove,
							onPointerDown: handleCellPointerDown,
							onPointerUp: handleCellPointerUp,
							onPointerLeave: handleCellPointerLeave,
							onPointerCancel: handleCellPointerLeave,
						}
						: null)}
				/>

				{/* YouTube-style overlay controls */}
				{supportsOverlayControls && (
					<Suspense fallback={null}>
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
					</Suspense>
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
