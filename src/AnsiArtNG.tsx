'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parseAnsiDynamic } from './ansiParser'
import { AnsiVirtualDisplay } from './AnsiVirtualDisplay'
import { createAnsiArtFrameGenerator } from './generators/ansiFrameGenerator'
import type { CharacterFrameGenerator } from './types'

export type AnsiArtNGProps = {
	src: string // URL to ANSI file
	mode?: 'animated' | 'final' // default 'final'
	viewscreen?: 'fixed' | 'dynamic' // default 'fixed'
	columns?: number // required for fixed mode, ignored for dynamic
	rows?: number // optional for fixed mode, defaults to 25, ignored for dynamic
	background?: string
	bitmapFontUrl: string
	showControls?: boolean // Simple play/pause controls (deprecated in favor of showOverlayControls)
	showOverlayControls?: boolean // YouTube-style overlay controls (only for animated mode with supported generators)
	showPerformanceOverlay?: boolean
	// Animation settings (only used in animated mode)
	fps?: number
	bytesPerSecond?: number // Bytes per second (NOT baud). For reference: 1200 baud ≈ 120 bytes/sec, 9600 baud ≈ 960 bytes/sec
	allowDrop?: boolean // drag-and-drop support
	debugCursorCodes?: boolean // if true, log ANSI cursor control codes to console (default false)
}

export function AnsiArtNG({
	src,
	mode = 'final',
	viewscreen = 'fixed',
	columns,
	rows = 25,
	background = '#000',
	bitmapFontUrl,
	showControls = false,
	showOverlayControls = false,
	showPerformanceOverlay = false,
	fps = 30,
	bytesPerSecond = 960, // Default: 9600 baud (960 bytes/sec after conversion from baud/10)
	allowDrop = true,
	debugCursorCodes = false,
}: AnsiArtNGProps) {
	const [ansiData, setAnsiData] = useState<Uint8Array | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [isDragging, setIsDragging] = useState(false)
	const [fileName, setFileName] = useState<string | null>(null)
	const [dynamicColumns, setDynamicColumns] = useState<number>(80)
	const [dynamicRows, setDynamicRows] = useState<number>(25)
	const [scrollViewY, setScrollViewY] = useState<number>(0)
	const [virtualRows, setVirtualRows] = useState<number>(25)
	const frameGeneratorRef = useRef<CharacterFrameGenerator | null>(null)

	// Load ANSI file from URL
	useEffect(() => {
		let cancelled = false
		async function load() {
			setError(null)
			// Reset scroll state when loading new file
			setScrollViewY(0)
			setVirtualRows(rows)
			try {
				const res = await fetch(src)
				if (!res.ok) throw new Error(`Failed to fetch ${src}: ${res.status}`)
				const buf = new Uint8Array(await res.arrayBuffer())
				if (!cancelled) {
					setAnsiData(buf)
					setFileName(null)
				}
			} catch (e: any) {
				if (!cancelled) setError(String(e?.message || e))
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
			setAnsiData(buf)
			setFileName(file.name)
		} catch (err: any) {
			setError(String(err?.message || err))
		}
	}

	// For dynamic final mode, detect dimensions once
	useEffect(() => {
		if (viewscreen === 'dynamic' && mode === 'final' && ansiData) {
			try {
				const screen = parseAnsiDynamic(ansiData)
				setDynamicColumns(screen.columns)
				setDynamicRows(screen.lines.length)
			} catch (e: any) {
				setError(String(e?.message || e))
			}
		} else if (viewscreen === 'dynamic' && mode === 'animated') {
			// Reset to initial size for animated mode
			setDynamicColumns(80)
			setDynamicRows(25)
		}
	}, [viewscreen, mode, ansiData])

	// Handle dimension changes for dynamic animated mode
	const handleDimensionsChange = useCallback(
		(dimensions: { columns: number; rows: number }) => {
			if (viewscreen === 'dynamic' && mode === 'animated') {
				setDynamicColumns(dimensions.columns)
				setDynamicRows(dimensions.rows)
			}
		},
		[viewscreen, mode]
	)

	// Handle scroll changes for fixed animated mode
	const handleScrollChange = useCallback(
		(scroll: { viewY: number; contentRows: number }) => {
			if (viewscreen === 'fixed' && mode === 'animated') {
				const newVirtualRows = Math.max(rows, scroll.contentRows)
				setScrollViewY(scroll.viewY)
				setVirtualRows(newVirtualRows)
			}
		},
		[viewscreen, mode, rows]
	)

	// Create frame generator
	const frameGenerator = useMemo<CharacterFrameGenerator | null>(() => {
		if (!ansiData) return null

		// Validate fixed mode has columns
		if (viewscreen === 'fixed' && !columns) {
			setError('columns is required when viewscreen is "fixed"')
			return null
		}

		const generator = createAnsiArtFrameGenerator({
			ansiData,
			mode,
			viewscreen,
			columns,
			rows,
			dynamicColumns,
			bytesPerSecond,
			fps,
			onDimensionsChange: handleDimensionsChange,
			onScrollChange: handleScrollChange,
			debugCursorCodes,
		})

		frameGeneratorRef.current = generator
		return generator
	}, [
		ansiData,
		mode,
		viewscreen,
		columns,
		rows,
		dynamicColumns,
		bytesPerSecond,
		fps,
		handleDimensionsChange,
		handleScrollChange,
		debugCursorCodes,
	])

	// Determine display dimensions
	const displayColumns = useMemo(() => {
		if (viewscreen === 'fixed') {
			return columns!
		} else {
			// Dynamic mode
			if (mode === 'final') {
				return dynamicColumns
			} else {
				// Animated mode - start small, grow as needed
				return dynamicColumns
			}
		}
	}, [viewscreen, mode, columns, dynamicColumns])

	const displayRows = useMemo(() => {
		if (viewscreen === 'fixed') {
			return rows
		} else {
			// Dynamic mode
			if (mode === 'final') {
				return dynamicRows
			} else {
				// Animated mode - start small, grow as needed
				return dynamicRows
			}
		}
	}, [viewscreen, mode, rows, dynamicRows])

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
			style={rootStyle}
			onDragEnter={onDragEnter}
			onDragOver={onDragOver}
			onDragLeave={onDragLeave}
			onDrop={onDrop}
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
			/>
		</div>
	)
}
