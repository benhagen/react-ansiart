import type { AnsiScreen } from '../ansi/parser'
import { parseAnsiCore } from '../ansi/parser'
import type { CharacterFrameGeneratorWithMetadata } from '../types/types'

/**
 * Utility to create an empty row with default attributes
 */
function createEmptyRow(columns: number): AnsiScreen['lines'][0] {
	return Array(columns)
		.fill(null)
		.map(() => ({
			ch: ' ',
			fg: 7,
			bg: 0,
			bold: false,
		}))
}

export type AnsiFrameGeneratorOptions = {
	ansiData: Uint8Array
	mode: 'animated' | 'final'
	columns?: number // Fixed column width (for fixed mode, undefined for dynamic)
	rows?: number // Display rows (for calculating scroll position in fixed animated mode, undefined for auto)
	finalHeightForCanvas?: number // Final height for canvas sizing in animated mode with rows='auto'
	bytesPerSecond?: number // Bytes per second (NOT baud). For reference: 1200 baud ≈ 120 bytes/sec, 9600 baud ≈ 960 bytes/sec
	fps?: number // Frames per second (needed to calculate bytes per frame from bytesPerSecond)
	onDimensionsChange?: (dimensions: { columns: number; rows: number }) => void // Callback for dynamic sizing
	onScrollChange?: (scroll: { viewY: number; contentRows: number }) => void // Callback for scroll position changes (fixed animated mode)
	debugCursorCodes?: boolean // if true, log ANSI cursor control codes to console (default false)
}

/**
 * Create a frame generator for ANSI art files
 * Supports both animated (progressive) and final (complete) modes
 * Supports both fixed and dynamic column sizing
 */
export function createAnsiFrameGenerator(
	options: AnsiFrameGeneratorOptions
): CharacterFrameGeneratorWithMetadata {
	const {
		ansiData,
		mode,
		columns,
		rows: displayRows,
		finalHeightForCanvas,
		bytesPerSecond: initialBytesPerSecond = 960, // Default: 9600 baud = 960 bytes/sec (baud/10 conversion)
		fps = 30, // Default: 30 fps
		onDimensionsChange,
		onScrollChange,
		debugCursorCodes = false,
	} = options

	// Mutable state for speed control
	let currentBytesPerSecond = initialBytesPerSecond

	// For final mode, parse once and return the same screen for all frames
	if (mode === 'final') {
		let cachedScreen: AnsiScreen | null = null

		if (columns !== undefined) {
			// Fixed mode - use parseAnsiCore with fixed columns
			cachedScreen = parseAnsiCore(ansiData, { columns })
		} else {
			// Dynamic mode - use parseAnsiCore with dynamic sizing
			cachedScreen = parseAnsiCore(ansiData)
			// Notify about dimensions
			if (onDimensionsChange) {
				onDimensionsChange({
					columns: cachedScreen.columns,
					rows: cachedScreen.lines.length,
				})
			}
		}

		// Return generator that always returns the same screen
		// For fixed mode: Return content starting at row 0, no buffering
		// AnsiArtNG will use viewY offset to compensate for engine's buffer
		const generator = ((frame: number, cols: number, requestedRows: number): AnsiScreen => {
			if (columns !== undefined) {
				// Fixed mode: return ALL content rows starting at row 0
				// No buffering - AnsiArtNG handles view offset
				const actualContent = cachedScreen!.lines

				// Return ALL content rows starting at row 0
				const paddedLines: AnsiScreen['lines'] = []

				// ALL content rows starting at row 0 (no top buffer)
				for (let i = 0; i < actualContent.length; i++) {
					paddedLines.push(actualContent[i])
				}

				// Pad to requestedRows if needed (engine requests bufferedRows)
				while (paddedLines.length < requestedRows) {
					paddedLines.push(createEmptyRow(columns))
				}

				return {
					lines: paddedLines,
					columns: cachedScreen!.columns,
				}
			}
			return cachedScreen!
		}) as CharacterFrameGeneratorWithMetadata

		// Final mode: no seek or speed control support
		generator.capabilities = {
			supportsSeek: false,
			supportsSpeedControl: false,
		}

		return generator
	}

	// Animated mode - progressive parsing
	let lastFrame = -1
	let lastNotifiedColumns = 0
	let lastNotifiedRows = 0
	let lastNotifiedViewY = 0

	const generator = ((frame: number, cols: number, rows: number): AnsiScreen => {
		// Reset if frame number went backwards (restart)
		if (frame < lastFrame) {
			lastNotifiedColumns = 0
			lastNotifiedRows = 0
			lastNotifiedViewY = 0
		}
		lastFrame = frame

		// Calculate elapsed time in seconds
		const elapsedSeconds = frame / fps

		// Calculate how many bytes to show based on elapsed time and network speed
		const targetByteIndex = Math.min(
			Math.floor(elapsedSeconds * currentBytesPerSecond),
			ansiData.length
		)

		// Parse incrementally
		let screen: AnsiScreen
		if (columns !== undefined) {
			// Fixed mode - use parseAnsiCore with fixed columns and incremental parsing
			screen = parseAnsiCore(ansiData, { columns, maxByteIndex: targetByteIndex })

			// For fixed mode animation with fixed rows, calculate scroll position and window content
			// Scroll to keep the bottom of the content visible when it exceeds display rows
			// If displayRows is undefined (auto mode), show all content without scrolling
			if (displayRows !== undefined) {
				const contentRows = screen.lines.length
				const viewY = Math.max(0, contentRows - displayRows)

				// Only notify if viewY changed (for tracking/debugging)
				if (onScrollChange && viewY !== lastNotifiedViewY) {
					onScrollChange({
						viewY,
						contentRows,
					})
					lastNotifiedViewY = viewY
				}

				// Window the content to show the correct portion
				// Extract the visible window from the full content
				const windowStart = viewY
				const windowEnd = Math.min(windowStart + displayRows, contentRows)
				const windowedLines = screen.lines.slice(windowStart, windowEnd)

				// Start with windowed content
				screen.lines = [...windowedLines]

				// Pad to match engine's requested rows (buffered rows)
				while (screen.lines.length < displayRows) {
					screen.lines.push(createEmptyRow(columns))
				}
			} else if (displayRows === undefined && finalHeightForCanvas !== undefined) {
				// Auto rows mode: show all content, pad to finalHeightForCanvas for canvas sizing
				while (screen.lines.length < finalHeightForCanvas) {
					screen.lines.push(createEmptyRow(columns))
				}
			}
		} else {
			// Dynamic mode - use parseAnsiCore with dynamic sizing and incremental parsing
			screen = parseAnsiCore(ansiData, { maxByteIndex: targetByteIndex })
			// Check if dimensions have changed and notify
			if (onDimensionsChange) {
				const currentColumns = screen.columns
				const currentRows = screen.lines.length
				if (currentColumns !== lastNotifiedColumns || currentRows !== lastNotifiedRows) {
					onDimensionsChange({
						columns: currentColumns,
						rows: currentRows,
					})
					lastNotifiedColumns = currentColumns
					lastNotifiedRows = currentRows
				}
			}
		}

		return screen
	}) as CharacterFrameGeneratorWithMetadata

	// Animated mode: add capabilities and control methods
	generator.capabilities = {
		supportsSeek: true,
		supportsSpeedControl: true,
		getTotalBytes: () => ansiData.length,
		getTotalFrames: () => Math.ceil((ansiData.length / currentBytesPerSecond) * fps),
	}

	generator.setSpeed = (bytesPerSecond: number) => {
		currentBytesPerSecond = bytesPerSecond
	}

	generator.getCurrentSpeed = () => {
		return currentBytesPerSecond
	}

	// Note: seekToFrame is handled by the engine calling the generator with the desired frame number
	// No special action needed in the generator itself for seeking

	return generator
}

export type AnsiArtFrameGeneratorOptions = {
	ansiData: Uint8Array
	mode: 'animated' | 'final'
	columns?: number // undefined for auto mode
	rows?: number // undefined for auto mode
	finalHeightForAnimated?: number // Final height for animated mode with rows='auto'
	bytesPerSecond?: number // Bytes per second (NOT baud). For reference: 1200 baud ≈ 120 bytes/sec, 9600 baud ≈ 960 bytes/sec
	fps?: number // Frames per second
	onDimensionsChange?: (dimensions: { columns: number; rows: number }) => void
	onScrollChange?: (scroll: { viewY: number; contentRows: number }) => void
	debugCursorCodes?: boolean // if true, log ANSI cursor control codes to console (default false)
}

/**
 * Create a frame generator for AnsiArt component
 * Handles the logic for determining effective columns and rows based on auto/fixed settings
 */
export function createAnsiArtFrameGenerator(
	options: AnsiArtFrameGeneratorOptions
): CharacterFrameGeneratorWithMetadata | null {
	const {
		ansiData,
		mode,
		columns,
		rows,
		finalHeightForAnimated,
		bytesPerSecond = 960, // Default: 9600 baud = 960 bytes/sec
		fps = 30,
		onDimensionsChange,
		onScrollChange,
		debugCursorCodes = false,
	} = options

	return createAnsiFrameGenerator({
		ansiData,
		mode,
		columns,
		rows,
		finalHeightForCanvas: finalHeightForAnimated,
		bytesPerSecond,
		fps,
		onDimensionsChange,
		onScrollChange,
		debugCursorCodes,
	})
}
