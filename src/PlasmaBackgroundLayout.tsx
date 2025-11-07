import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AnsiScreen } from './ansiParser'
import { AnsiVirtualDisplay } from './AnsiVirtualDisplay'
import type { AsciiPerlinPlasmaProps } from './asciiPerlinPlasma'
import {
	createAsciiPerlinPlasmaSampler,
	generateAsciiPerlinPlasmaFrame,
} from './generators/asciiPerlinPlasmaGenerator'

export interface PlasmaBackgroundLayoutProps extends Omit<AsciiPerlinPlasmaProps, 'className'> {
	children: React.ReactNode
	mode?: 'fixed' | 'scrollable'
	contentClassName?: string
	contentStyle?: React.CSSProperties
	plasmaClassName?: string
	// Virtual world dimensions (in pixels) - if not provided, will be calculated from content
	virtualWidthPx?: number
	virtualHeightPx?: number
	// Plasma colors (overrides color from AsciiPerlinPlasmaProps for clearer API)
	fgColor?: string // Foreground color (CSS color string)
	bgColor?: string // Background color (CSS color string)
	// Performance and rendering
	showPerformanceOverlay?: boolean
	fps?: number // Frames per second (default: 30)
	bitmapFontUrl?: string // URL to bitmap font file (default: IBM VGA 8x16)
}

export function PlasmaBackgroundLayout({
	children,
	mode = 'fixed',
	contentClassName,
	contentStyle,
	plasmaClassName,
	virtualWidthPx,
	virtualHeightPx,
	fgColor,
	bgColor,
	showPerformanceOverlay = false,
	fps = 30,
	bitmapFontUrl = '/ansi/fonts/Bm437_IBM_VGA_8x16.FON',
	...plasmaProps
}: PlasmaBackgroundLayoutProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const scrollableRef = useRef<HTMLDivElement>(null)
	const [viewportBounds, setViewportBounds] = useState({ top: 0, height: 0 })
	const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
	const [containerHeight, setContainerHeight] = useState(0)
	const [scrollTop, setScrollTop] = useState(0)
	const [maxScrollTop, setMaxScrollTop] = useState(0)
	const [isMounted, setIsMounted] = useState(false)

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

	// Memoize plasmaProps to prevent recreation on every render
	const memoizedPlasmaProps = useMemo(
		() => plasmaProps,
		[
			plasmaProps.charWidth,
			plasmaProps.charHeight,
			plasmaProps.chars,
			plasmaProps.timeScale,
			plasmaProps.fpsCap,
			plasmaProps.color,
			plasmaProps.octaves,
			plasmaProps.yOffset,
			plasmaProps.virtualHeight,
		]
	)

	// Memoize the merged options with explicit fgColor/bgColor taking precedence
	const mergedOptions = useMemo(() => {
		// Extract color from plasmaProps as it's not used by the generator
		const { color, ...restPlasmaProps } = memoizedPlasmaProps

		// If fgColor is not explicitly provided but color is, use color as fgColor
		const finalFgColor = fgColor || color

		const options = {
			...restPlasmaProps,
			...(finalFgColor && { fgColor: finalFgColor }),
			...(bgColor && { bgColor }),
		}

		return options
	}, [memoizedPlasmaProps, fgColor, bgColor])

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
						const columns = Math.max(1, Math.ceil(viewportSize.width / 8))
						const rows = Math.max(1, Math.ceil(viewportSize.height / 16))
						const actualCellWidth = viewportSize.width / columns
						const actualCellHeight = viewportSize.height / rows
						return (
							<AnsiVirtualDisplay
								columns={columns}
								rows={rows}
								cellWidthPx={actualCellWidth}
								cellHeightPx={actualCellHeight}
								fillContainer={true}
								bitmapFontUrl={bitmapFontUrl}
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

	// Derive virtual world in character units using AnsiVirtualDisplay cell dimensions
	const cellHeightPx = 16 // default to 16 to match AnsiVirtualDisplay default
	const cellWidthPx = 8 // default to 8

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
				{(() => {
					const actualCellWidth = viewportSize.width / visibleColumns
					const actualCellHeight = viewportBounds.height / visibleRows
					return (
						<AnsiVirtualDisplay
							columns={visibleColumns}
							rows={visibleRows}
							cellWidthPx={actualCellWidth}
							cellHeightPx={actualCellHeight}
							fillContainer={true}
							bitmapFontUrl={bitmapFontUrl}
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
