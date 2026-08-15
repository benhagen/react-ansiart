'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { detectAnimation, parseAnsiCore } from '../ansi/parser'
import { parseSauce, type SauceMetadata } from '../utils/sauce'
import { AnsiVirtualDisplay } from './AnsiVirtualDisplay'
import { createAnsiArtFrameGenerator } from '../generators/ansiFrameGenerator'
import { SauceMetadataModal } from './SauceMetadataModal'
import { SauceOverlay } from './SauceOverlay'
import type { AnsiScreen } from '../ansi/types'
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
	const [dynamicColumns, setDynamicColumns] = useState<number>(80)
	const [dynamicRows, setDynamicRows] = useState<number>(25)
	const [sauce, setSauce] = useState<SauceMetadata | undefined>(undefined)
	const [isSauceModalOpen, setIsSauceModalOpen] = useState(false)
	const [isSauceOverlayVisible, setIsSauceOverlayVisible] = useState(false)
	const sauceOverlayTimeoutRef = useRef<number | null>(null)

	// Detect animation once per loaded file when mode is 'auto'.
	// Derived rather than state-set-from-an-effect so the resolved mode is known on the very
	// render the data arrives — otherwise the first render would build (and parse) a 'final'
	// generator that the follow-up effect immediately threw away.
	const detectedMode = useMemo<'animated' | 'final'>(() => {
		if (mode !== 'auto' || !ansiData) return 'final'
		return detectAnimation(ansiData) ? 'animated' : 'final'
	}, [mode, ansiData])

	// Derive effective mode: use detected mode if mode is 'auto', otherwise use mode prop
	const effectiveMode = useMemo<'animated' | 'final'>(() => {
		if (mode === 'auto') {
			return detectedMode
		}
		// When mode is not 'auto', it must be 'animated' or 'final'
		return mode as 'animated' | 'final'
	}, [mode, detectedMode])

	// A full parse is needed for final mode (the generator displays the finished screen) and
	// for animated mode with rows='auto' (the canvas height must be known before playback
	// starts). Animated mode with a fixed row count never needs one — that generator parses
	// progressively, frame by frame.
	const needsFullParse = effectiveMode === 'final' || rows === 'auto'

	// THE parse. Exactly one full parse per (file, columns) — its result drives dimension
	// detection AND is handed to the final-mode generator below, so a file is never parsed
	// more than once per load.
	const parseResult = useMemo<{ screen: AnsiScreen | null; error: string | null } | null>(() => {
		if (!ansiData || !needsFullParse) return null
		try {
			const effectiveColumns = columns === 'auto' ? undefined : columns
			const screen = parseAnsiCore(
				ansiData,
				effectiveColumns !== undefined ? { columns: effectiveColumns } : {}
			)
			return { screen, error: null }
		} catch (e: unknown) {
			return { screen: null, error: e instanceof Error ? e.message : String(e) }
		}
	}, [ansiData, columns, needsFullParse])

	const parsedScreen = parseResult?.screen ?? null

	// Surface parse failures (the old detection effect did this inline with a try/catch)
	useEffect(() => {
		if (parseResult?.error) {
			setError(parseResult.error)
		}
	}, [parseResult])

	// Content height detected from the single parse above. Derived (not state) so it is
	// available on the same render as the parse: previously this arrived one render late,
	// which made animated+rows='auto' build a second generator and restart the engine
	// immediately after load.
	const detectedFinalRows =
		effectiveMode === 'final' ? (rows === 'auto' ? parsedScreen?.lines.length ?? null : rows) : null
	const finalHeightForAnimated =
		effectiveMode === 'animated' && rows === 'auto' ? parsedScreen?.lines.length ?? null : null

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
		const controller = new AbortController()
		async function load() {
			setError(null)
			try {
				const res = await fetch(src, { signal: controller.signal })
				if (!res.ok) throw new Error(`Failed to fetch ${src}: ${res.status}`)
				const buf = new Uint8Array(await res.arrayBuffer())
				if (!cancelled) {
					setAnsiData(buf)
				}
			} catch (e: unknown) {
				if (cancelled) return
				if (e instanceof DOMException && e.name === 'AbortError') return
				setError(e instanceof Error ? e.message : String(e))
			}
		}
		load()
		return () => {
			cancelled = true
			controller.abort()
		}
	}, [src])

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
			setError(null)
			setAnsiData(buf)
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : String(err))
		}
	}

	// Seed the dynamic (callback-driven) canvas sizing state. Detected heights are derived
	// directly from the single parse above; only the values the animated generator grows at
	// runtime via onDimensionsChange still live in state.
	useEffect(() => {
		if (!ansiData) return

		if (columns === 'auto' && parsedScreen) {
			// Width is known from the parse (final mode, or animated with rows='auto')
			setDynamicColumns(parsedScreen.columns)
		} else if (effectiveMode === 'animated' && rows !== 'auto') {
			// Animated mode with a fixed row count: start at 80 columns and let the generator's
			// onDimensionsChange callback grow it as the animation reveals content.
			setDynamicColumns(80)
			setDynamicRows(rows)
		}
	}, [effectiveMode, ansiData, columns, rows, parsedScreen])

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

	// Create frame generator
	const frameGenerator = useMemo<CharacterFrameGenerator | null>(() => {
		if (!ansiData) return null
		// The parse failed: don't let the generator re-throw during render — the effect above
		// surfaces the error and the next render shows it.
		if (parseResult?.error) return null

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
			finalHeightForAnimated: finalHeightForAnimated ?? undefined,
			// Final mode reuses the single parse instead of parsing the file a second time.
			preparsedScreen: effectiveMode === 'final' ? parsedScreen ?? undefined : undefined,
			bytesPerSecond,
			fps,
			onDimensionsChange: handleDimensionsChange,
			debugCursorCodes,
		})

		return generator
	}, [
		ansiData,
		parseResult,
		parsedScreen,
		effectiveMode,
		columns,
		rows,
		finalHeightForAnimated,
		bytesPerSecond,
		fps,
		handleDimensionsChange,
		debugCursorCodes,
	])

	// Determine display dimensions
	const displayColumns = useMemo(() => {
		if (columns !== 'auto') {
			return columns
		}
		// Final mode: the parse already knows the natural width, so use it on the same render
		// rather than waiting for the seeding effect. Animated mode keeps using the state value,
		// which the generator's onDimensionsChange callback grows as content is revealed.
		if (effectiveMode === 'final' && parsedScreen) {
			return parsedScreen.columns
		}
		return dynamicColumns
	}, [columns, effectiveMode, parsedScreen, dynamicColumns])

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
			sauceOverlayTimeoutRef.current = window.setTimeout(() => {
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
