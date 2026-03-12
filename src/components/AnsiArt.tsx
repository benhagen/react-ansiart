'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { detectAnimation, parseAnsiCore } from '../ansi/parser'
import { parseSauce, type SauceMetadata } from '../utils/sauce'
import { AnsiVirtualDisplay } from './AnsiVirtualDisplay'
import { createAnsiArtFrameGenerator } from '../generators/ansiFrameGenerator'
import { SauceMetadataModal } from './SauceMetadataModal'
import { SauceOverlay } from './SauceOverlay'
import type { CharacterFrameGenerator } from '../types/types'

export type AnsiArtProps = {
	src: string // URL to ANSI file
	mode?: 'animated' | 'final' | 'auto' // default 'final', 'auto' detects animation automatically
	columns?: number | 'auto' // defaults to 80, 'auto' detects natural width
	rows?: number | 'auto' // defaults to 'auto', 'auto' displays full height, number restricts to that height
	background?: string
	bitmapFontUrl?: string
	/** @deprecated Use `showOverlayControls` instead */
	showControls?: boolean
	showOverlayControls?: boolean // YouTube-style overlay controls (only for animated mode with supported generators)
	showPerformanceOverlay?: boolean
	sauceOverlay?: boolean // Show SAUCE metadata overlay when available
	// Animation settings (only used in animated mode)
	fps?: number
	bytesPerSecond?: number // Bytes per second (NOT baud). For reference: 1200 baud ≈ 120 bytes/sec, 9600 baud ≈ 960 bytes/sec
	autoStart?: boolean // Start animation automatically on file load (default: true, only applies to animated mode)
	allowDrop?: boolean // drag-and-drop support
	debugCursorCodes?: boolean // if true, log ANSI cursor control codes to console (default false)
}

export function AnsiArt({
	src,
	mode = 'final',
	columns = 80,
	rows = 'auto',
	background = '#000',
	bitmapFontUrl,
	showControls = false,
	showOverlayControls = false,
	showPerformanceOverlay = false,
	sauceOverlay = false,
	fps = 30,
	bytesPerSecond = 960, // Default: 9600 baud (960 bytes/sec after conversion from baud/10)
	autoStart = true,
	allowDrop = true,
	debugCursorCodes = false,
}: AnsiArtProps) {
	const [ansiData, setAnsiData] = useState<Uint8Array | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [isDragging, setIsDragging] = useState(false)
	const [fileName, setFileName] = useState<string | null>(null)
	const [dynamicColumns, setDynamicColumns] = useState<number>(80)
	const [dynamicRows, setDynamicRows] = useState<number>(25)
	const [detectedFinalRows, setDetectedFinalRows] = useState<number | null>(null) // Detected content height for final mode
	const [finalHeightForAnimated, setFinalHeightForAnimated] = useState<number | null>(null) // Final height for animated mode with rows='auto'
	const [scrollViewY, setScrollViewY] = useState<number>(0)
	const [virtualRows, setVirtualRows] = useState<number>(25)
	const [sauce, setSauce] = useState<SauceMetadata | undefined>(undefined)
	const [isSauceModalOpen, setIsSauceModalOpen] = useState(false)
	const [isSauceOverlayVisible, setIsSauceOverlayVisible] = useState(false)
	const [detectedMode, setDetectedMode] = useState<'animated' | 'final'>('final')
	const sauceOverlayTimeoutRef = useRef<number | null>(null)

	// Detect animation when mode is 'auto' and ansiData is available
	useEffect(() => {
		if (mode === 'auto' && ansiData) {
			const isAnimated = detectAnimation(ansiData)
			setDetectedMode(isAnimated ? 'animated' : 'final')
		} else if (mode !== 'auto') {
			// Reset detected mode when mode is not 'auto'
			setDetectedMode('final')
		}
	}, [mode, ansiData])

	// Derive effective mode: use detected mode if mode is 'auto', otherwise use mode prop
	const effectiveMode = useMemo<'animated' | 'final'>(() => {
		if (mode === 'auto') {
			return detectedMode
		}
		// When mode is not 'auto', it must be 'animated' or 'final'
		return mode as 'animated' | 'final'
	}, [mode, detectedMode])

	// Parse SAUCE metadata when ansiData changes
	useEffect(() => {
		if (ansiData && sauceOverlay) {
			const parsedSauce = parseSauce(ansiData)
			if (parsedSauce) {
				setSauce(parsedSauce)
			}
		} else if (!sauceOverlay) {
			setSauce(undefined)
		}
	}, [ansiData, sauceOverlay])

	// Load ANSI file from URL
	useEffect(() => {
		let cancelled = false
		async function load() {
			setError(null)
			// Reset scroll state when loading new file
			setScrollViewY(0)
			setVirtualRows(typeof rows === 'number' ? rows : 25)
			setDetectedFinalRows(null) // Reset detected height for new file
			setFinalHeightForAnimated(null) // Reset final height for animated mode
			try {
				const res = await fetch(src)
				if (!res.ok) throw new Error(`Failed to fetch ${src}: ${res.status}`)
				const buf = new Uint8Array(await res.arrayBuffer())
				if (!cancelled) {
					setAnsiData(buf)
					setFileName(null)
				}
			} catch (e: unknown) {
				if (!cancelled) setError(e instanceof Error ? e.message : String(e))
			}
		}
		load()
		return () => {
			cancelled = true
		}
	}, [src, rows])

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
		if (!file) return
		try {
			const buf = new Uint8Array(await file.arrayBuffer())
			setDetectedFinalRows(null) // Reset detected height for new file
			setFinalHeightForAnimated(null) // Reset final height for animated mode
			setAnsiData(buf)
			setFileName(file.name)
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : String(err))
		}
	}

	// Detect dimensions for final mode and animated mode with rows='auto'
	useEffect(() => {
		if (!ansiData) return

		try {
			if (effectiveMode === 'final') {
				// Final mode: detect dimensions based on columns and rows settings
				if (columns === 'auto' || rows === 'auto') {
					// Need to detect dimensions
					const effectiveColumns = columns === 'auto' ? undefined : columns
					const screen = parseAnsiCore(
						ansiData,
						effectiveColumns !== undefined ? { columns: effectiveColumns } : {}
					)

					if (columns === 'auto') {
						setDynamicColumns(screen.columns)
					}
					if (rows === 'auto') {
						setDetectedFinalRows(screen.lines.length)
					} else if (typeof rows === 'number') {
						setDetectedFinalRows(rows)
					}
				} else {
					// Both columns and rows are numbers
					setDetectedFinalRows(rows)
				}
			} else if (effectiveMode === 'animated' && rows === 'auto') {
				// Animated mode with rows='auto': detect final height upfront
				const effectiveColumns = columns === 'auto' ? undefined : columns
				const screen = parseAnsiCore(
					ansiData,
					effectiveColumns !== undefined ? { columns: effectiveColumns } : {}
				)
				setFinalHeightForAnimated(screen.lines.length)

				if (columns === 'auto') {
					setDynamicColumns(screen.columns)
				}
			} else if (effectiveMode === 'animated' && columns === 'auto') {
				// Animated mode with columns='auto' but rows is a number: start at 80, will grow
				setDynamicColumns(80)
				setDynamicRows(typeof rows === 'number' ? rows : 25)
			} else {
				// Animated mode with both columns and rows as numbers: reset dynamic state
				setDynamicColumns(80)
				setDynamicRows(typeof rows === 'number' ? rows : 25)
			}
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : String(e))
		}
	}, [effectiveMode, ansiData, columns, rows])

	// Handle dimension changes for auto mode
	const handleDimensionsChange = useCallback(
		(dimensions: { columns: number; rows: number }) => {
			if (effectiveMode === 'animated' && (columns === 'auto' || rows === 'auto')) {
				if (columns === 'auto') {
					setDynamicColumns(dimensions.columns)
				}
				if (rows === 'auto') {
					// For animated mode with rows='auto', we already have finalHeightForAnimated
					// but we can update dynamicRows for display purposes
					setDynamicRows(dimensions.rows)
				}
			}
		},
		[effectiveMode, columns, rows]
	)

	// Handle scroll changes for fixed animated mode (when both columns and rows are numbers)
	const handleScrollChange = useCallback(
		(scroll: { viewY: number; contentRows: number }) => {
			if (effectiveMode === 'animated' && typeof columns === 'number' && typeof rows === 'number') {
				const newVirtualRows = Math.max(rows, scroll.contentRows)
				setScrollViewY(scroll.viewY)
				setVirtualRows(newVirtualRows)
			}
		},
		[effectiveMode, columns, rows]
	)

	// Create frame generator
	const frameGenerator = useMemo<CharacterFrameGenerator | null>(() => {
		if (!ansiData) return null

		// Determine effective columns and rows values
		const effectiveColumns = columns === 'auto' ? undefined : columns
		// For animated mode with rows='auto', pass undefined to generator (no scrolling)
		// For final mode or animated with numeric rows, pass the number
		const effectiveRows =
			rows === 'auto' && effectiveMode === 'animated'
				? undefined
				: typeof rows === 'number'
				? rows
				: undefined

		const generator = createAnsiArtFrameGenerator({
			ansiData,
			mode: effectiveMode,
			columns: effectiveColumns,
			rows: effectiveRows,
			finalHeightForAnimated:
				effectiveMode === 'animated' && rows === 'auto'
					? finalHeightForAnimated ?? undefined
					: undefined,
			bytesPerSecond,
			fps,
			onDimensionsChange: handleDimensionsChange,
			onScrollChange: handleScrollChange,
			debugCursorCodes,
		})

		return generator
	}, [
		ansiData,
		effectiveMode,
		columns,
		rows,
		finalHeightForAnimated,
		bytesPerSecond,
		fps,
		handleDimensionsChange,
		handleScrollChange,
		debugCursorCodes,
	])

	// Determine display dimensions
	const displayColumns = useMemo(() => {
		if (columns === 'auto') {
			return dynamicColumns
		} else {
			return columns
		}
	}, [columns, dynamicColumns])

	const displayRows = useMemo(() => {
		if (effectiveMode === 'final') {
			// In final mode: if rows='auto', use detected height; otherwise use specified number
			if (rows === 'auto') {
				return detectedFinalRows ?? 25
			} else {
				return rows
			}
		} else {
			// Animated mode
			if (rows === 'auto') {
				// Use final height if detected, otherwise use dynamic rows
				return finalHeightForAnimated ?? dynamicRows
			} else {
				return rows
			}
		}
	}, [effectiveMode, rows, detectedFinalRows, finalHeightForAnimated, dynamicRows])

	const rootStyle: React.CSSProperties = useMemo(
		() => ({
			...(isDragging ? { outline: '2px dashed #888', outlineOffset: '-2px' } : {}),
		}),
		[isDragging]
	)

	// Handle sauce button click
	const handleSauceClick = useCallback(() => {
		if (sauce) {
			setIsSauceModalOpen(true)
		}
	}, [sauce])

	// Handle mouse events for standalone sauce overlay
	const handleSauceMouseMove = useCallback(() => {
		if (!showOverlayControls && sauceOverlay && sauce) {
			setIsSauceOverlayVisible(true)
			// Clear existing timeout
			if (sauceOverlayTimeoutRef.current) {
				clearTimeout(sauceOverlayTimeoutRef.current)
			}
			// Hide after 3 seconds
			sauceOverlayTimeoutRef.current = setTimeout(() => {
				setIsSauceOverlayVisible(false)
			}, 3000)
		}
	}, [showOverlayControls, sauceOverlay, sauce])

	const handleSauceMouseLeave = useCallback(() => {
		if (!showOverlayControls && sauceOverlay && sauce) {
			// Clear timeout
			if (sauceOverlayTimeoutRef.current) {
				clearTimeout(sauceOverlayTimeoutRef.current)
			}
			setIsSauceOverlayVisible(false)
		}
	}, [showOverlayControls, sauceOverlay, sauce])

	// Clean up timeout on unmount
	useEffect(() => {
		return () => {
			if (sauceOverlayTimeoutRef.current) {
				clearTimeout(sauceOverlayTimeoutRef.current)
			}
		}
	}, [])

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

	if (!ansiData || !frameGenerator) {
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
	}

	return (
		<div
			style={{
				...rootStyle,
				position: 'relative',
			}}
			onDragEnter={onDragEnter}
			onDragOver={onDragOver}
			onDragLeave={onDragLeave}
			onDrop={onDrop}
			onMouseMove={handleSauceMouseMove}
			onMouseLeave={handleSauceMouseLeave}
		>
			<AnsiVirtualDisplay
				columns={displayColumns}
				rows={displayRows}
				frameGenerator={frameGenerator}
				fps={fps}
				background={background}
				bitmapFontUrl={bitmapFontUrl}
				showControls={showControls}
				showOverlayControls={showOverlayControls}
				showPerformanceOverlay={showPerformanceOverlay}
				autoStart={effectiveMode === 'animated' ? autoStart : undefined}
				sauce={showOverlayControls && sauceOverlay ? sauce : undefined}
				onSauceClick={showOverlayControls && sauceOverlay ? handleSauceClick : undefined}
			/>
			{/* Standalone sauce overlay (when player controls are disabled) */}
			{!showOverlayControls && sauceOverlay && sauce && (
				<SauceOverlay isVisible={isSauceOverlayVisible} onClick={handleSauceClick} />
			)}
			{/* Sauce metadata modal */}
			{sauce && (
				<SauceMetadataModal
					sauce={sauce}
					isOpen={isSauceModalOpen}
					onClose={() => setIsSauceModalOpen(false)}
				/>
			)}
		</div>
	)
}
