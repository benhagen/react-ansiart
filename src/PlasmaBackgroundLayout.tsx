import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AnsiScreen } from './ansiParser'
import { AnsiVirtualDisplay } from './AnsiVirtualDisplay'
import type { BitmapFont } from './bitmapFont'
import { loadRawBitmapFont } from './bitmapFont'
import { extractFontFromFON } from './fonExtractor'
import type { AsciiPerlinPlasmaOptions } from './generators/asciiPerlinPlasmaGenerator'
import {
	createAsciiPerlinPlasmaSampler,
	generateAsciiPerlinPlasmaFrame,
} from './generators/asciiPerlinPlasmaGenerator'

export interface PlasmaBackgroundLayoutProps {
	children: React.ReactNode
	mode?: 'fixed' | 'scrollable'
	contentClassName?: string
	contentStyle?: React.CSSProperties
	plasmaClassName?: string
	// Virtual world dimensions (in pixels) - if not provided, will be calculated from content
	virtualWidthPx?: number
	virtualHeightPx?: number
	// Plasma generation options
	chars?: string[] // Array of characters to use for ASCII rendering
	timeScale?: number // Animation speed multiplier
	octaves?: AsciiPerlinPlasmaOptions['octaves'] // Noise octave configurations
	seed?: number // Random seed for noise generation
	// Plasma colors
	fgColor?: string // Foreground color (CSS color string)
	bgColor?: string // Background color (CSS color string)
	// Performance and rendering
	showPerformanceOverlay?: boolean
	fps?: number // Frames per second (default: 30)
	bitmapFontUrl: string // URL to bitmap font file
}

export function PlasmaBackgroundLayout({
	children,
	mode = 'fixed',
	contentClassName,
	contentStyle,
	plasmaClassName,
	virtualWidthPx,
	virtualHeightPx,
	chars,
	timeScale,
	octaves,
	seed,
	fgColor,
	bgColor,
	showPerformanceOverlay = false,
	fps = 30,
	bitmapFontUrl,
}: PlasmaBackgroundLayoutProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const scrollableRef = useRef<HTMLDivElement>(null)
	const [viewportBounds, setViewportBounds] = useState({ top: 0, height: 0 })
	const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
	const [containerHeight, setContainerHeight] = useState(0)
	const [scrollTop, setScrollTop] = useState(0)
	const [maxScrollTop, setMaxScrollTop] = useState(0)
	const [isMounted, setIsMounted] = useState(false)
	const [bitmapFont, setBitmapFont] = useState<BitmapFont | null>(null)

	// Load font once and share with AnsiVirtualDisplay
	useEffect(() => {
		if (!bitmapFontUrl) {
			setBitmapFont(null)
			return
		}
		let cancelled = false
		async function loadFont() {
			try {
				const fontResult = await extractFontFromFON(bitmapFontUrl)
				if (fontResult && !cancelled) {
					const { bitmapData, width, height } = fontResult
					const bytesPerGlyph = height
					const glyphs: Uint8Array[] = []
					for (let i = 0; i < 256; i++) {
						glyphs.push(bitmapData.slice(i * bytesPerGlyph, (i + 1) * bytesPerGlyph))
					}
					setBitmapFont({ width, height, glyphs, rawBitmapData: bitmapData })
				} else if (!cancelled) {
					// Fallback to loadRawBitmapFont if extractFontFromFON fails
					const font = await loadRawBitmapFont(bitmapFontUrl, 8, 16)
					setBitmapFont(font)
				}
			} catch (e: any) {
				console.warn('Failed to load font:', e)
				if (!cancelled) setBitmapFont(null)
			}
		}
		loadFont()
		return () => {
			cancelled = true
		}
	}, [bitmapFontUrl])

	// Initialize viewport dimensions on client side after mount
	useEffect(() => {
		if (typeof window === 'undefined') return

		const updateViewportSize = () => {
			setViewportSize({
				width: window.innerWidth,
				height: window.innerHeight,
			})
		}

		updateViewportSize()
		const initialHeight = window.innerHeight
		setViewportBounds({ top: 0, height: initialHeight })
		setContainerHeight(initialHeight)
		setIsMounted(true)

		window.addEventListener('resize', updateViewportSize)
		return () => window.removeEventListener('resize', updateViewportSize)
	}, [])

	// Track viewport and container dimensions for scrollable mode
	useEffect(() => {
		if (mode !== 'scrollable' || typeof window === 'undefined' || !isMounted) {
			return
		}

		const updateBounds = () => {
			if (!containerRef.current || !scrollableRef.current || typeof window === 'undefined') {
				return
			}

			const containerRect = containerRef.current.getBoundingClientRect()
			const scrollableEl = scrollableRef.current

			// Get the actual scroll height of the content (not just visible height)
			const scrollHeight = scrollableEl.scrollHeight
			const clientHeight = scrollableEl.clientHeight
			const currentScrollTop = scrollableEl.scrollTop

			// Update container height to match full scrollable content height
			// Use scrollHeight directly (full content height, not just viewport)
			setContainerHeight(scrollHeight)

			// Track scroll position and maximum scrollable distance
			setScrollTop(currentScrollTop)
			const maxScroll = Math.max(0, scrollHeight - clientHeight)
			setMaxScrollTop(maxScroll)

			// Calculate visible viewport bounds
			const containerRect2 = containerRef.current.getBoundingClientRect()
			const visibleTop = Math.max(0, -containerRect2.top)
			const visibleBottom = Math.min(containerRect2.height, window.innerHeight - containerRect2.top)
			const visibleHeight = Math.max(0, visibleBottom - visibleTop)

			setViewportBounds({
				top: Math.max(0, containerRect2.top),
				height: Math.max(0, Math.min(visibleHeight, window.innerHeight)),
			})
		}

		updateBounds()

		const handleScroll = () => {
			const scrollableEl = scrollableRef.current
			if (!scrollableEl) {
				return
			}
			const currentScrollTop = scrollableEl.scrollTop
			setScrollTop(currentScrollTop)
			// Update bounds to sync viewport calculations
			requestAnimationFrame(() => {
				if (!containerRef.current || !scrollableRef.current || typeof window === 'undefined') return
				const containerRect = containerRef.current.getBoundingClientRect()
				const visibleTop = Math.max(0, -containerRect.top)
				const visibleBottom = Math.min(containerRect.height, window.innerHeight - containerRect.top)
				const visibleHeight = Math.max(0, visibleBottom - visibleTop)
				setViewportBounds({
					top: Math.max(0, containerRect.top),
					height: Math.max(0, Math.min(visibleHeight, window.innerHeight)),
				})
			})
		}

		// Use ResizeObserver to track container size changes
		const resizeObserver = new ResizeObserver(() => {
			updateBounds()
		})

		const scrollableEl = scrollableRef.current
		const containerEl = containerRef.current

		if (containerEl) {
			resizeObserver.observe(containerEl)
		}
		if (scrollableEl) {
			resizeObserver.observe(scrollableEl)
			// Listen to scroll events on the scrollable container
			scrollableEl.addEventListener('scroll', handleScroll, { passive: true })
		}

		if (typeof window !== 'undefined') {
			window.addEventListener('resize', updateBounds, { passive: true })
		}

		return () => {
			resizeObserver.disconnect()
			if (scrollableEl) {
				scrollableEl.removeEventListener('scroll', handleScroll)
			}
			if (typeof window !== 'undefined') {
				window.removeEventListener('resize', updateBounds)
			}
		}
	}, [mode, isMounted])

	// Memoize the plasma generation options
	const mergedOptions = useMemo(() => {
		const options: AsciiPerlinPlasmaOptions = {}

		if (chars) options.chars = chars
		if (timeScale !== undefined) options.timeScale = timeScale
		if (octaves) options.octaves = octaves
		if (seed !== undefined) options.seed = seed
		if (fgColor) options.fgColor = fgColor
		if (bgColor) options.bgColor = bgColor

		return options
	}, [chars, timeScale, octaves, seed, fgColor, bgColor])

	// Memoize the fixed mode frame generator to avoid recreating on every render
	const fixedFrameGenerator = useCallback(
		(frame: number, columns: number, rows: number) => {
			return generateAsciiPerlinPlasmaFrame(frame, columns, rows, mergedOptions)
		},
		[mergedOptions]
	)

	// Memoize the scrollable mode frame generator to avoid recreating on every render
	const scrollableFrameGenerator = useCallback(
		(frame: number, reqColumns: number, reqRows: number): AnsiScreen => {
			const sampler = createAsciiPerlinPlasmaSampler(frame, mergedOptions)
			const lines: AnsiScreen['lines'] = []

			for (let y = 0; y < reqRows; y++) {
				const line: AnsiScreen['lines'][number] = []
				for (let x = 0; x < reqColumns; x++) {
					const cell = sampler(x, y)
					line.push(cell)
				}
				lines.push(line)
			}

			return { lines, columns: reqColumns }
		},
		[mergedOptions]
	)

	// Derive virtual world in character units using font dimensions
	const cellWidthPx = bitmapFont?.width || 8 // Default fallback
	const cellHeightPx = bitmapFont?.height || 16 // Default fallback

	if (mode === 'fixed') {
		return (
			<div
				ref={containerRef}
				style={{
					position: 'relative',
					minHeight: '100vh',
					width: '100%',
				}}
			>
				{/* Fixed plasma background */}
				<div
					style={{
						position: 'fixed',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						zIndex: 0,
						pointerEvents: 'none',
					}}
				>
					{(() => {
						const columns = Math.max(1, Math.ceil(viewportSize.width / cellWidthPx))
						const rows = Math.max(1, Math.ceil(viewportSize.height / cellHeightPx))
						// Only render if font is loaded (we load it ourselves, so don't pass bitmapFontUrl)
						if (!bitmapFont) return null
						return (
							<AnsiVirtualDisplay
								columns={columns}
								rows={rows}
								fillContainer={true}
								bitmapFont={bitmapFont}
								frameGenerator={fixedFrameGenerator}
								fps={fps}
								background={bgColor || '#000'}
								showPerformanceOverlay={showPerformanceOverlay}
							/>
						)
					})()}
				</div>

				{/* Scrollable content layer */}
				<div
					ref={scrollableRef}
					className={contentClassName}
					style={{
						position: 'relative',
						zIndex: 1,
						minHeight: '100vh',
						overflowY: 'auto',
						color: 'inherit',
						...contentStyle,
					}}
				>
					{children}
				</div>
			</div>
		)
	}

	// Scrollable mode
	// Only render plasma after mount to avoid hydration mismatch
	if (!isMounted) {
		return (
			<div
				ref={containerRef}
				style={{
					position: 'relative',
					width: '100%',
					minHeight: '100vh',
				}}
			>
				<div
					ref={scrollableRef}
					className={contentClassName}
					style={{
						position: 'relative',
						zIndex: 1,
						minHeight: '100vh',
						overflowY: 'auto',
						...contentStyle,
					}}
				>
					{children}
				</div>
			</div>
		)
	}

	// Visible dimensions (what fits in the current viewport)
	// Add 1 to columns/rows to ensure we fill the entire viewport even with partial cells
	const visibleColumns = Math.max(1, Math.ceil(viewportSize.width / cellWidthPx))
	const visibleRows = Math.max(
		1,
		Math.ceil((viewportBounds.height || window.innerHeight) / cellHeightPx)
	)

	// Virtual world dimensions (can be larger than visible for scrolling)
	// Use provided virtual dimensions or calculate from content size
	const calculatedVirtualWidthPx = virtualWidthPx || Math.max(viewportSize.width, containerHeight) // Default to viewport width or container height as proxy
	const calculatedVirtualHeightPx =
		virtualHeightPx || Math.max(viewportSize.height, containerHeight) // Default to viewport height or container height

	const virtualColumns = Math.max(visibleColumns, Math.ceil(calculatedVirtualWidthPx / cellWidthPx))
	const virtualRows = Math.max(visibleRows, Math.ceil(calculatedVirtualHeightPx / cellHeightPx))

	// Viewport position within virtual world (character-aligned)
	const viewX = 0 // Horizontal scroll position (could be calculated from horizontal scroll in future)
	const viewY = Math.max(0, Math.floor(scrollTop / cellHeightPx)) // Character-aligned vertical scroll position

	// Pixel offsets for smooth scrolling (sub-character precision)
	const pixelOffsetY = scrollTop % cellHeightPx

	return (
		<div
			ref={containerRef}
			style={{
				position: 'relative',
				width: '100%',
				minHeight: '100vh',
			}}
		>
			{/* Fixed viewport-sized virtual display */}
			<div
				style={{
					position: 'fixed',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					zIndex: 0,
					pointerEvents: 'none',
				}}
			>
				{/* Only render if font is loaded (we load it ourselves, so don't pass bitmapFontUrl) */}
				{bitmapFont && (
					<AnsiVirtualDisplay
						columns={visibleColumns}
						rows={visibleRows}
						fillContainer={true}
						bitmapFont={bitmapFont}
						virtualColumns={virtualColumns}
						virtualRows={virtualRows}
						viewX={viewX}
						viewY={viewY}
						pixelOffsetY={pixelOffsetY}
						frameGenerator={scrollableFrameGenerator}
						fps={fps}
						background={bgColor || '#000'}
						showPerformanceOverlay={showPerformanceOverlay}
					/>
				)}
			</div>

			{/* Scrollable content layer */}
			<div
				ref={scrollableRef}
				className={contentClassName}
				style={{
					position: 'relative',
					zIndex: 1,
					height: '100vh',
					overflowY: 'auto',
					overflowX: 'hidden',
					color: 'inherit',
					...contentStyle,
				}}
			>
				{children}
			</div>
		</div>
	)
}
