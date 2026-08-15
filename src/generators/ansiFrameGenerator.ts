import type { AnsiScreen } from '../ansi/types'
import { createAnsiParseSession, parseAnsiCore } from '../ansi/parser'
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
	/**
	 * Already-parsed screen for 'final' mode. When the caller has parsed the file (e.g. for
	 * dimension detection) it can hand the result over so the file is parsed exactly once per
	 * load. It MUST have been parsed with the same `columns` value passed here. Ignored in
	 * 'animated' mode, which parses progressively.
	 */
	preparsedScreen?: AnsiScreen
	bytesPerSecond?: number // Bytes per second (NOT baud). For reference: 1200 baud ≈ 120 bytes/sec, 9600 baud ≈ 960 bytes/sec
	fps?: number // Frames per second (needed to calculate bytes per frame from bytesPerSecond)
	onDimensionsChange?: (dimensions: { columns: number; rows: number }) => void // Callback for dynamic sizing
	onScrollChange?: (scroll: { viewY: number; contentRows: number }) => void // Callback for scroll position changes (fixed animated mode)
	/** @deprecated No longer consumed; cursor-code logging was removed. Accepted for compatibility. */
	debugCursorCodes?: boolean
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
		preparsedScreen,
		bytesPerSecond: initialBytesPerSecond = 960, // Default: 9600 baud = 960 bytes/sec (baud/10 conversion)
		fps = 30, // Default: 30 fps
		onDimensionsChange,
		onScrollChange,
	} = options

	// Mutable state for speed control
	let currentBytesPerSecond = initialBytesPerSecond

	// For final mode, parse once and return the same screen for all frames
	if (mode === 'final') {
		// Reuse the caller's parse when it supplied one (AnsiArt parses each file exactly once
		// per load for dimension detection and hands the screen down); otherwise parse here.
		// Fixed mode passes explicit columns; dynamic mode lets the parser size itself.
		const cachedScreen: AnsiScreen =
			preparsedScreen ??
			(columns !== undefined ? parseAnsiCore(ansiData, { columns }) : parseAnsiCore(ansiData))

		if (columns === undefined && onDimensionsChange) {
			// Dynamic mode - notify about the detected dimensions
			onDimensionsChange({
				columns: cachedScreen.columns,
				rows: cachedScreen.lines.length,
			})
		}

		// Return generator that always returns the same screen
		// For fixed mode: Return content starting at row 0, no buffering
		// AnsiArtNG will use viewY offset to compensate for engine's buffer
		const generator = ((frame: number, cols: number, requestedRows: number): AnsiScreen => {
			if (columns !== undefined) {
				// Fixed mode: return ALL content rows starting at row 0
				// No buffering - AnsiArtNG handles view offset
				const actualContent = cachedScreen.lines

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
					columns: cachedScreen.columns,
				}
			}
			return cachedScreen
		}) as CharacterFrameGeneratorWithMetadata

		// The screen never changes, so a display can render one frame and stop instead of
		// driving a frame loop forever. (Only 'final' mode is static — the animated branch
		// below and every procedural generator are time-dependent.)
		generator.isStatic = true

		// Final mode: no seek or speed control support
		generator.capabilities = {
			supportsSeek: false,
			supportsSpeedControl: false,
		}

		return generator
	}

	// Animated mode - progressive parsing via a resumable session
	// Each frame parses only the newly revealed bytes instead of re-parsing
	// from byte 0; the session resets itself when the byte position rewinds
	const session = createAnsiParseSession(ansiData, { columns })
	let lastFrame = -1
	let lastNotifiedColumns = 0
	let lastNotifiedRows = 0
	let lastNotifiedViewY = 0
	// Cache last parse result to avoid re-parsing when byte position hasn't changed
	let lastTargetByteIndex = -1
	let lastParsedScreen: AnsiScreen | null = null

	const generator = ((frame: number, _cols: number, _rows: number): AnsiScreen => {
		// Reset if frame number went backwards (restart)
		if (frame < lastFrame) {
			lastNotifiedColumns = 0
			lastNotifiedRows = 0
			lastNotifiedViewY = 0
			lastTargetByteIndex = -1
			lastParsedScreen = null
		}
		lastFrame = frame

		// Calculate elapsed time in seconds
		const elapsedSeconds = frame / fps

		// Calculate how many bytes to show based on elapsed time and network speed
		const targetByteIndex = Math.min(
			Math.floor(elapsedSeconds * currentBytesPerSecond),
			ansiData.length
		)

		// Parse incrementally — skip if byte position hasn't changed
		let screen: AnsiScreen

		// Use cached result if byte position is unchanged (common when paused or at sub-byte frame rates)
		if (targetByteIndex === lastTargetByteIndex && lastParsedScreen) {
			screen = lastParsedScreen
		} else if (columns !== undefined) {
			// Fixed mode - advance the resumable session to the target byte index
			screen = session.advanceTo(targetByteIndex)
			lastTargetByteIndex = targetByteIndex
			lastParsedScreen = screen

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
			// Dynamic mode - advance the resumable session (dynamic sizing)
			screen = session.advanceTo(targetByteIndex)
			lastTargetByteIndex = targetByteIndex
			lastParsedScreen = screen
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
	/**
	 * Already-parsed screen for 'final' mode, parsed with the same `columns` value passed
	 * here. Lets a caller that already parsed the file (for dimension detection) avoid a
	 * second parse. Ignored in 'animated' mode.
	 */
	preparsedScreen?: AnsiScreen
	bytesPerSecond?: number // Bytes per second (NOT baud). For reference: 1200 baud ≈ 120 bytes/sec, 9600 baud ≈ 960 bytes/sec
	fps?: number // Frames per second
	onDimensionsChange?: (dimensions: { columns: number; rows: number }) => void
	onScrollChange?: (scroll: { viewY: number; contentRows: number }) => void
	/** @deprecated No longer consumed; cursor-code logging was removed. Accepted for compatibility. */
	debugCursorCodes?: boolean
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
		preparsedScreen,
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
		preparsedScreen,
		bytesPerSecond,
		fps,
		onDimensionsChange,
		onScrollChange,
		debugCursorCodes,
	})
}
