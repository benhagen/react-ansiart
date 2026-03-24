import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AnsiScreen } from '../ansi/types'
import type { CharacterFrameGenerator, DisplayFrameGenerator } from '../types/types'
import { AnsiVirtualDisplay } from './AnsiVirtualDisplay'
import type { BitmapFont } from '../font/bitmapFont'
import { loadBitmapFontFromUrl } from '../font/bitmapFontLoader'
import { getEmbeddedVgaFont } from '../font/embeddedVgaFont'
import type { AsciiPerlinPlasmaOptions } from '../generators/asciiPerlinPlasmaGenerator'
import {
	createAsciiPerlinPlasmaSampler,
	generateAsciiPerlinPlasmaFrame,
} from '../generators/asciiPerlinPlasmaGenerator'
import type { AsciiFireOptions } from '../generators/asciiFireGenerator'

export interface PlasmaBackgroundLayoutProps {
	children: React.ReactNode
	mode?: 'fixed' | 'scrollable'
	contentClassName?: string
	contentStyle?: React.CSSProperties
	plasmaClassName?: string
	// Generator: pass a custom frame generator directly (overrides generatorType)
	frameGenerator?: DisplayFrameGenerator
	// Generator selection (built-in shortcut, ignored when frameGenerator is provided)
	generatorType?: 'plasma' | 'fire' // Type of generator to use (default: 'plasma')
	// Virtual world dimensions (in pixels) - if not provided, will be calculated from content
	virtualWidthPx?: number
	virtualHeightPx?: number
	// Plasma generation options (used when generatorType === 'plasma')
	chars?: string[] // Array of characters to use for ASCII rendering
	timeScale?: number // Animation speed multiplier (plasma only)
	octaves?: AsciiPerlinPlasmaOptions['octaves'] // Noise octave configurations (plasma only)
	seed?: number // Random seed for noise generation
	// Fire generation options (used when generatorType === 'fire')
	darkenAmount?: number // Constant value to subtract each frame (fire only)
	sparkRange?: [number, number] // Min/max palette indices for bottom row sparks (fire only)
	// Colors
	fgColor?: string // Foreground color (CSS color string, plasma only)
	bgColor?: string // Background color (CSS color string)
	// Performance and rendering
	showPerformanceOverlay?: boolean
	fps?: number // Frames per second (default: 30)
	bitmapFontUrl?: string // URL to bitmap font file
}

export function PlasmaBackgroundLayout({
	children,
	mode = 'fixed',
	contentClassName,
	contentStyle,
	plasmaClassName,
	frameGenerator: externalFrameGenerator,
	generatorType = 'plasma',
	virtualWidthPx,
	virtualHeightPx,
	chars,
	timeScale,
	octaves,
	seed,
	darkenAmount,
	sparkRange,
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

	// Lazy-loaded fire generator module
	const fireModuleRef = useRef<typeof import('../generators/asciiFireGenerator') | null>(null)
	const [fireModuleLoaded, setFireModuleLoaded] = useState(false)

	useEffect(() => {
		if (generatorType !== 'fire') return
		let cancelled = false
		import('../generators/asciiFireGenerator').then(mod => {
			if (!cancelled) {
				fireModuleRef.current = mod
				setFireModuleLoaded(true)
			}
		})
		return () => { cancelled = true }
	}, [generatorType])

	// Load font once and share with AnsiVirtualDisplay
	useEffect(() => {
		if (!bitmapFontUrl) {
			// No URL provided — use embedded VGA font
			setBitmapFont(getEmbeddedVgaFont())
			return
		}

		let cancelled = false
		async function loadFont() {
			try {
				const font = await loadBitmapFontFromUrl(bitmapFontUrl!)
				if (!cancelled) {
					setBitmapFont(font)
				}
			} catch {
				// Font loading failed - setBitmapFont remains null
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

		let rafId: number | null = null
		let lastScrollHeight = 0
		let checkInterval: ReturnType<typeof setInterval> | null = null

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

			// Only update container height if it actually changed to avoid unnecessary re-renders
			if (scrollHeight !== lastScrollHeight) {
				setContainerHeight(scrollHeight)
				lastScrollHeight = scrollHeight
			}

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

		// Batched update function using requestAnimationFrame
		const scheduleUpdate = () => {
			if (rafId !== null) {
				return // Already scheduled
			}
			rafId = requestAnimationFrame(() => {
				rafId = null
				updateBounds()
			})
		}

		updateBounds()
		lastScrollHeight = scrollableRef.current?.scrollHeight || 0

		const handleScroll = () => {
			const scrollableEl = scrollableRef.current
			if (!scrollableEl) {
				return
			}
			const currentScrollTop = scrollableEl.scrollTop
			setScrollTop(currentScrollTop)
			// Update bounds to sync viewport calculations
			scheduleUpdate()
		}

		// Use ResizeObserver to track container size changes
		const resizeObserver = new ResizeObserver(() => {
			scheduleUpdate()
		})

		// Use MutationObserver to detect content changes (additions/removals)
		const mutationObserver = new MutationObserver(() => {
			scheduleUpdate()
		})

		const scrollableEl = scrollableRef.current
		const containerEl = containerRef.current

		if (containerEl) {
			resizeObserver.observe(containerEl)
		}
		if (scrollableEl) {
			resizeObserver.observe(scrollableEl)
			// Observe content changes in the scrollable element
			mutationObserver.observe(scrollableEl, {
				childList: true,
				subtree: true,
				attributes: false,
				characterData: false,
			})
			// Listen to scroll events on the scrollable container
			scrollableEl.addEventListener('scroll', handleScroll, { passive: true })
		}

		if (typeof window !== 'undefined') {
			window.addEventListener('resize', scheduleUpdate, { passive: true })
		}

		// Periodic check as fallback to catch any missed scrollHeight changes
		// Check every 500ms to catch cases where ResizeObserver/MutationObserver miss changes
		checkInterval = setInterval(() => {
			if (scrollableEl) {
				const currentScrollHeight = scrollableEl.scrollHeight
				if (currentScrollHeight !== lastScrollHeight) {
					scheduleUpdate()
				}
			}
		}, 500)

		return () => {
			if (rafId !== null) {
				cancelAnimationFrame(rafId)
			}
			if (checkInterval !== null) {
				clearInterval(checkInterval)
			}
			resizeObserver.disconnect()
			mutationObserver.disconnect()
			if (scrollableEl) {
				scrollableEl.removeEventListener('scroll', handleScroll)
			}
			if (typeof window !== 'undefined') {
				window.removeEventListener('resize', scheduleUpdate)
			}
		}
	}, [mode, isMounted])

	// Memoize the plasma generation options
	const mergedPlasmaOptions = useMemo(() => {
		const options: AsciiPerlinPlasmaOptions = {}

		if (chars) options.chars = chars
		if (timeScale !== undefined) options.timeScale = timeScale
		if (octaves) options.octaves = octaves
		if (seed !== undefined) options.seed = seed
		if (fgColor) options.fgColor = fgColor
		if (bgColor) options.bgColor = bgColor

		return options
	}, [chars, timeScale, octaves, seed, fgColor, bgColor])

	// Memoize the fire generation options
	const mergedFireOptions = useMemo(() => {
		const options: AsciiFireOptions = {}

		if (chars) options.chars = chars
		if (darkenAmount !== undefined) options.darkenAmount = darkenAmount
		if (sparkRange) options.sparkRange = sparkRange
		if (seed !== undefined) options.seed = seed
		if (bgColor) options.bgColor = bgColor

		return options
	}, [chars, darkenAmount, sparkRange, seed, bgColor])

	// Memoize the fixed mode frame generator to avoid recreating on every render
	const fixedFrameGenerator: DisplayFrameGenerator = useMemo(() => {
		if (externalFrameGenerator) return externalFrameGenerator
		if (generatorType === 'fire' && fireModuleRef.current) {
			const fireMod = fireModuleRef.current
			return (frame: number, columns: number, rows: number) =>
				fireMod.generateAsciiFireFrame(frame, columns, rows, mergedFireOptions)
		}
		return (frame: number, columns: number, rows: number) =>
			generateAsciiPerlinPlasmaFrame(frame, columns, rows, mergedPlasmaOptions)
	}, [externalFrameGenerator, generatorType, mergedPlasmaOptions, mergedFireOptions, fireModuleLoaded])

	// Store current view position in a ref so the generator can access it
	const viewYRef = useRef(0)

	// Store virtual rows in a ref so it can be accessed in the generator without causing re-creation
	const virtualRowsRef = useRef(0)

	// Store virtual columns in a ref for fire generator
	const virtualColumnsRef = useRef(0)

	// Create the scrollable mode frame generator
	// For fire, pass worldHeight and worldWidth for positioning and sizing
	const scrollableFrameGenerator: DisplayFrameGenerator = useMemo(() => {
		// External generator: use directly (no sampler-based virtual world scrolling)
		if (externalFrameGenerator) return externalFrameGenerator

		if (generatorType === 'fire' && fireModuleRef.current) {
			const fireMod = fireModuleRef.current
			return (frame: number, reqColumns: number, reqRows: number): AnsiScreen => {
				const fireOptionsWithDimensions = {
					...mergedFireOptions,
					worldHeight: virtualRowsRef.current,
					worldWidth: virtualColumnsRef.current,
				}

				const sampler = fireMod.createAsciiFireSampler(frame, fireOptionsWithDimensions)
				const lines: AnsiScreen['lines'] = []
				const currentViewY = viewYRef.current
				const rowsToRender = reqRows + 1

				for (let y = 0; y < rowsToRender; y++) {
					const line: AnsiScreen['lines'][number] = []
					for (let x = 0; x < reqColumns; x++) {
						line.push(sampler(x, currentViewY + y))
					}
					lines.push(line)
				}

				return { lines, columns: reqColumns }
			}
		}

		return (frame: number, reqColumns: number, reqRows: number): AnsiScreen => {
			const sampler = createAsciiPerlinPlasmaSampler(frame, mergedPlasmaOptions)
			const lines: AnsiScreen['lines'] = []
			const currentViewY = viewYRef.current
			const rowsToRender = reqRows + 1

			for (let y = 0; y < rowsToRender; y++) {
				const line: AnsiScreen['lines'][number] = []
				for (let x = 0; x < reqColumns; x++) {
					line.push(sampler(x, currentViewY + y))
				}
				lines.push(line)
			}

			return { lines, columns: reqColumns }
		}
	}, [externalFrameGenerator, generatorType, mergedFireOptions, mergedPlasmaOptions, fireModuleLoaded])

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
				{/* Fixed background */}
				<div
					className={plasmaClassName}
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
		virtualHeightPx || containerHeight // Use full scrollable content height for proper fire positioning

	const virtualColumns = Math.max(visibleColumns, Math.ceil(calculatedVirtualWidthPx / cellWidthPx))
	const virtualRows = Math.max(visibleRows, Math.ceil(calculatedVirtualHeightPx / cellHeightPx))

	// Viewport position within virtual world (character-aligned)
	const viewX = 0 // Horizontal scroll position (could be calculated from horizontal scroll in future)
	const viewY = Math.max(0, Math.floor(scrollTop / cellHeightPx)) // Character-aligned vertical scroll position

	// Update refs so generator can access current view position and virtual dimensions
	viewYRef.current = viewY
	virtualRowsRef.current = virtualRows
	virtualColumnsRef.current = virtualColumns

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
				className={plasmaClassName}
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

/** Alias for PlasmaBackgroundLayout — supports any generator via frameGenerator prop */
export const GeneratorBackgroundLayout = PlasmaBackgroundLayout
export type GeneratorBackgroundLayoutProps = PlasmaBackgroundLayoutProps
