// RIP (RIPscrip) vector graphics parser
// Based on PabloDraw's RIP format implementation

import { decodeCp437 } from '../utils/cp437'
import type { AnyRipCommand, Direction, Point, Rectangle, RipState, Size } from './types'
import { FillStyle, FontStyle, LineStyle, WriteMode } from './types'

const DEFAULT_RIP_PALETTE = [0, 1, 2, 3, 4, 5, 7, 20, 56, 57, 58, 59, 60, 61, 62, 63]

function cloneRipState(state: RipState): RipState {
	return {
		...state,
		cursor: { ...state.cursor },
		viewport: state.viewport ? { ...state.viewport } : null,
		textWindow: state.textWindow ? { ...state.textWindow } : null,
		palette: state.palette ? [...state.palette] : [],
	}
}

// Create initial RIP state
function createInitialState(): RipState {
	// Default 16-color RIP palette mapping to 64-color EGA palette per RIPscrip spec
	// Spec: 00=0, 01=1, 02=2, 03=3, 04=4, 05=5, 06=7, 07=20(0K), 08=56(1K), 09=57(1L), 0A=58(1M), 0B=59(1N), 0C=60(1O), 0D=61(1P), 0E=62(1Q), 0F=63(1R)
	return {
		color: 7, // Light Gray (default)
		fillColor: 0, // Black (default)
		fillStyle: FillStyle.Solid,
		lineStyle: LineStyle.Solid,
		fontStyle: FontStyle.Default,
		viewport: null,
		cursor: { x: 0, y: 0 },
		writeMode: WriteMode.CopyPut,
		palette: [...DEFAULT_RIP_PALETTE],
		textWindow: null,
	}
}

// Binary reader for RIP format
class RipReader {
	private data: Uint8Array
	private position: number

	constructor(data: Uint8Array) {
		this.data = data
		this.position = 0
	}

	isEOF(): boolean {
		return this.position >= this.data.length
	}

	peek(): number {
		if (this.isEOF()) return -1
		return this.data[this.position]
	}

	readByte(): number {
		if (this.isEOF()) throw new Error('Unexpected end of file')
		return this.data[this.position++]
	}

	// Read RIP byte with backslash line continuation handling
	readRipByte(): number {
		let b = this.readByte()
		if (b === 0x5c) {
			// Backslash - line continuation
			b = this.readByte()
			// Skip newlines after backslash
			while (b === 0x0a || b === 0x0d) {
				if (this.isEOF()) break
				b = this.readByte()
			}
		}
		return b
	}

	// Read base-36 number (0-9, A-Z)
	readRipNumber(): number {
		const b = this.readRipByte()
		if (b >= 0x30 && b <= 0x39) {
			// 0-9
			return b - 0x30
		}
		if (b >= 0x41 && b <= 0x5a) {
			// A-Z
			return b - 0x37 // 0x41 - 0x37 = 10
		}
		return 0
	}

	// Read RIP word (2 base-36 digits: 0-1295)
	readRipWord(): number {
		return this.readRipNumber() * 36 + this.readRipNumber()
	}

	// Read RIP int (4 base-36 digits: 0-1679615)
	readRipInt(): number {
		return this.readRipWord() * 1296 + this.readRipWord()
	}

	// Read RIP point (2 words: x, y)
	readRipPoint(): Point {
		return {
			x: this.readRipWord(),
			y: this.readRipWord(),
		}
	}

	// Read RIP size (2 words: width, height)
	readRipSize(): Size {
		return {
			width: this.readRipWord(),
			height: this.readRipWord(),
		}
	}

	// Read RIP rectangle (2 points: start, end)
	// Note: RIP rectangles use inclusive coordinates (both endpoints included)
	readRipRectangle(): Rectangle {
		const start = this.readRipPoint()
		const end = this.readRipPoint()
		return {
			x: Math.min(start.x, end.x),
			y: Math.min(start.y, end.y),
			width: Math.abs(end.x - start.x) + 1, // +1 because coordinates are inclusive
			height: Math.abs(end.y - start.y) + 1, // +1 because coordinates are inclusive
		}
	}

	// Read RIP string (until |, CR, LF, or EOF)
	readRipString(): string {
		const bytes: number[] = []
		while (!this.isEOF()) {
			const next = this.peek()
			if (next === -1 || next === 0x0d || next === 0x0a || next === 0x7c) {
				// |, CR, or LF
				break
			}
			bytes.push(this.readRipByte())
		}
		// Skip newlines after string
		while (!this.isEOF()) {
			const b = this.peek()
			if (b === 0x0d || b === 0x0a) {
				this.readByte()
			} else {
				break
			}
		}
		return decodeCp437(new Uint8Array(bytes))
	}

	getPosition(): number {
		return this.position
	}

	setPosition(pos: number): void {
		this.position = pos
	}
}

// Parse a single RIP command
function parseCommand(
	reader: RipReader,
	state: RipState,
	debug: boolean = false
): AnyRipCommand | null {
	if (reader.isEOF()) {
		if (debug) console.log('[RIP] End of file reached')
		return null
	}

	const startPos = reader.getPosition()

	// Commands start with |
	const b = reader.readRipByte()
	if (b !== 0x7c) {
		// Not a command, skip
		// Only log in debug mode, and skip common whitespace silently
		const isCommonWhitespace = b === 0x20 || b === 0x09 || b === 0x0a || b === 0x0d
		if (debug && !isCommonWhitespace) {
			console.log(
				`[RIP] Skipping non-command byte: 0x${b.toString(16)} (${String.fromCharCode(
					b
				)}) at position ${startPos}`
			)
		}
		return null
	}

	// Read opcode (1-2 characters)
	let opcode = String.fromCharCode(reader.readRipByte())
	if (opcode === '1') {
		// Two-character opcode starting with 1
		// Valid second characters: K, B, T, E, t, C, P, I, W
		const nextByte = reader.readRipByte()
		const nextChar = String.fromCharCode(nextByte)
		if ('KBTEtCPIW'.includes(nextChar)) {
			opcode += nextChar
		} else {
			// Invalid two-character opcode, treat as unknown single-character '1'
			if (debug)
				console.log(`[RIP] Invalid two-char opcode: 1${nextChar} (0x${nextByte.toString(16)})`)
			// Don't consume the next byte - it might be part of the next command
			reader.setPosition(reader.getPosition() - 1)
		}
	} else if (opcode === '#') {
		// End of file marker
		if (debug) console.log('[RIP] End marker (#) found')
		return null
	}

	// Parse command based on opcode
	switch (opcode) {
		// Drawing commands
		case 'L': {
			const start = reader.readRipPoint()
			const end = reader.readRipPoint()
			return { type: 'Line', opcode: 'L', start, end }
		}
		case 'C': {
			const center = reader.readRipPoint()
			const radius = reader.readRipWord()
			return { type: 'Circle', opcode: 'C', center, radius }
		}
		case 'O': {
			const center = reader.readRipPoint()
			const startAngle = reader.readRipWord()
			const endAngle = reader.readRipWord()
			const radius = reader.readRipSize()
			return { type: 'Oval', opcode: 'O', center, radius, startAngle, endAngle }
		}
		case 'A': {
			const center = reader.readRipPoint()
			const startAngle = reader.readRipWord()
			const endAngle = reader.readRipWord()
			const radius = reader.readRipWord()
			return { type: 'Arc', opcode: 'A', center, radius, startAngle, endAngle }
		}
		case 'P': {
			const count = reader.readRipWord()
			// RIPscrip spec: 2-512 points allowed
			if (count < 2 || count > 512) {
				if (debug) console.log(`[RIP] Polygon point count out of range: ${count} (must be 2-512)`)
				return null
			}
			const points: Point[] = []
			for (let i = 0; i < count; i++) {
				points.push(reader.readRipPoint())
			}
			return { type: 'Polygon', opcode: 'P', points }
		}
		case 'l':
		case 'PL': {
			const count = reader.readRipWord()
			// RIPscrip spec: 2-512 points allowed
			if (count < 2 || count > 512) {
				if (debug) console.log(`[RIP] PolyLine point count out of range: ${count} (must be 2-512)`)
				return null
			}
			const points: Point[] = []
			for (let i = 0; i < count; i++) {
				points.push(reader.readRipPoint())
			}
			return { type: 'PolyLine', opcode: 'l', points }
		}
		case 'B': {
			const rect = reader.readRipRectangle()
			return { type: 'Bar', opcode: 'B', rect }
		}
		case 'R':
		case 'DR': {
			const rect = reader.readRipRectangle()
			return { type: 'DrawRectangle', opcode: 'R', rect }
		}
		case 'Z':
		case 'BE': {
			// Bezier always reads exactly 4 points, no count
			const points: Point[] = []
			for (let i = 0; i < 4; i++) {
				points.push(reader.readRipPoint())
			}
			const segments = reader.readRipWord()
			return { type: 'Bezier', opcode: 'Z', points, segments }
		}
		case 'X': {
			const point = reader.readRipPoint()
			return { type: 'Pixel', opcode: 'X', point }
		}
		case 'F': {
			const point = reader.readRipPoint()
			const border = reader.readRipWord()
			return { type: 'Fill', opcode: 'F', point, border }
		}
		case 'p':
		case 'FP': {
			const count = reader.readRipWord()
			// RIPscrip spec: 2-512 points allowed
			if (count < 2 || count > 512) {
				if (debug)
					console.log(`[RIP] FilledPolygon point count out of range: ${count} (must be 2-512)`)
				return null
			}
			const points: Point[] = []
			for (let i = 0; i < count; i++) {
				points.push(reader.readRipPoint())
			}
			return { type: 'FilledPolygon', opcode: 'p', points }
		}
		case 'o':
		case 'FO': {
			const center = reader.readRipPoint()
			const radius = reader.readRipSize()
			return { type: 'FilledOval', opcode: 'o', center, radius }
		}
		case 'I':
		case 'PS': {
			const center = reader.readRipPoint()
			const startAngle = reader.readRipWord()
			const endAngle = reader.readRipWord()
			const radius = reader.readRipWord()
			return { type: 'PieSlice', opcode: 'I', center, radius, startAngle, endAngle }
		}
		case 'i':
		case 'OPS': {
			const center = reader.readRipPoint()
			const startAngle = reader.readRipWord()
			const endAngle = reader.readRipWord()
			const radius = reader.readRipSize()
			return { type: 'OvalPieSlice', opcode: 'i', center, radius, startAngle, endAngle }
		}
		case 'V':
		case 'OA': {
			const center = reader.readRipPoint()
			const startAngle = reader.readRipWord()
			const endAngle = reader.readRipWord()
			const radius = reader.readRipSize()
			return { type: 'OvalArc', opcode: 'V', center, radius, startAngle, endAngle }
		}

		// State commands
		case 'c': {
			const value = reader.readRipWord()
			state.color = value % 16 // PabloDraw: color = (byte)(c % 16)
			return { type: 'Color', opcode: 'c', value: value % 16 }
		}
		case 'S':
		case 'FS': {
			const style = reader.readRipWord()
			const color = reader.readRipWord()
			state.fillStyle = style as FillStyle
			state.fillColor = color % 16 // PabloDraw: fillcolor = (byte)(color % 16)
			return { type: 'FillStyle', opcode: 'S', style: style as FillStyle, color: color % 16 }
		}
		case '=':
		case 'LS': {
			const style = reader.readRipWord()
			const pattern = reader.readRipInt()
			const thickness = reader.readRipWord()
			state.lineStyle = style as LineStyle
			return { type: 'LineStyle', opcode: '=', style: style as LineStyle, pattern, thickness }
		}
		case 'Y':
		case 'FT': {
			const font = reader.readRipWord()
			const direction = reader.readRipWord()
			const characterSize = reader.readRipWord()
			reader.readRipWord() // reserved
			state.fontStyle = font as FontStyle
			return {
				type: 'FontStyle',
				opcode: 'Y',
				font: font as FontStyle,
				direction: direction as Direction,
				characterSize,
			}
		}
		case 'v': {
			// ViewPort - RIPscrip spec: !|v <x0> <y0> <x1> <y1>
			// (x0,y0) = upper-left, (x1,y1) = lower-right (inclusive)
			const x0 = reader.readRipWord()
			const y0 = reader.readRipWord()
			const x1 = reader.readRipWord()
			const y1 = reader.readRipWord()

			// If all parameters are zero, viewport is disabled
			if (x0 === 0 && y0 === 0 && x1 === 0 && y1 === 0) {
				state.viewport = null
				return { type: 'ViewPort', opcode: 'v', rect: { x: 0, y: 0, width: 0, height: 0 } }
			}

			// Ensure x0 < x1 and y0 < y1 (spec requirement)
			const minX = Math.min(x0, x1)
			const maxX = Math.max(x0, x1)
			const minY = Math.min(y0, y1)
			const maxY = Math.max(y0, y1)

			// Width and height are inclusive (x1-x0+1, y1-y0+1)
			const rect = {
				x: minX,
				y: minY,
				width: maxX - minX + 1,
				height: maxY - minY + 1,
			}
			state.viewport = rect
			return { type: 'ViewPort', opcode: 'v', rect }
		}
		case 'g':
		case 'G': {
			const point = reader.readRipPoint()
			state.cursor = point
			return { type: 'GotoXY', opcode: 'g', point }
		}
		case 'm': {
			const point = reader.readRipPoint()
			state.cursor = point
			return { type: 'Move', opcode: 'm', point }
		}
		case 'H': {
			state.cursor = { x: 0, y: 0 }
			return { type: 'Home', opcode: 'H' }
		}
		case 'W':
		case 'WM': {
			const mode = reader.readRipWord()
			state.writeMode = mode as WriteMode
			return { type: 'WriteMode', opcode: 'W', mode: mode as WriteMode }
		}
		case 'Q':
		case 'SP': {
			const palette: number[] = []
			for (let i = 0; i < 16; i++) {
				const raw = reader.readRipWord()
				const egaIndex = Math.max(0, Math.min(raw, 63))
				palette.push(egaIndex)
			}
			// Store palette copies separately for parser state and command replay
			state.palette = [...palette]
			return { type: 'SetPalette', opcode: 'Q', palette: [...palette] }
		}
		case 'a':
		case 'OP': {
			const color = reader.readRipWord()
			const paletteValue = reader.readRipWord()
			// Color is palette slot index (0-15), palette is EGA color index (0-63)
			const colorIndex = color % 16
			const egaIndex = Math.max(0, Math.min(paletteValue, 63))
			// Update state palette for subsequent commands during parsing
			if (state.palette) {
				state.palette[colorIndex] = egaIndex
			}
			return { type: 'OnePalette', opcode: 'a', color: colorIndex, palette: egaIndex }
		}
		case 's':
		case 'FPAT': {
			const pattern: number[] = []
			for (let i = 0; i < 8; i++) {
				pattern.push(reader.readRipWord())
			}
			const color = reader.readRipWord()
			// FillPattern automatically sets fillStyle to User and updates fillColor
			state.fillStyle = FillStyle.User
			state.fillColor = color % 16 // PabloDraw: fillcolor = (byte)(color % 16)
			return { type: 'FillPattern', opcode: 's', pattern, color: color % 16 }
		}

		// Text commands
		case '1T':
		case 'BT': {
			const rect = reader.readRipRectangle()
			const flags = reader.readRipWord()
			return { type: 'BeginText', opcode: '1T', rect, flags }
		}
		case '1E':
		case 'ET': {
			return { type: 'EndText', opcode: '1E' }
		}
		case 'T':
		case 'OT': {
			const text = reader.readRipString()
			return { type: 'OutText', opcode: 'T', text }
		}
		case '@':
		case 'OTX': {
			const point = reader.readRipPoint()
			const text = reader.readRipString()
			return { type: 'OutTextXY', opcode: '@', point, text }
		}
		case '1t':
		case 'RT': {
			const rect = reader.readRipRectangle()
			const text = reader.readRipString()
			return { type: 'RegionText', opcode: '1t', rect, text }
		}
		case 'w':
		case 'TW': {
			// TextWindow - RIPscrip spec: !|w <x0> <y0> <x1> <y1> <wrap> <size>
			const x0 = reader.readRipWord()
			const y0 = reader.readRipWord()
			const x1 = reader.readRipWord()
			const y1 = reader.readRipWord()
			const wrap = reader.readRipNumber() // 1 digit: 0 or 1
			const size = reader.readRipNumber() // 1 digit: 0-4

			const rect = {
				x: Math.min(x0, x1),
				y: Math.min(y0, y1),
				width: Math.abs(x1 - x0) + 1,
				height: Math.abs(y1 - y0) + 1,
			}
			state.textWindow = rect
			return { type: 'TextWindow', opcode: 'w', rect, wrap, size }
		}

		// Interactive commands
		case 'U':
		case 'BU': {
			const rect = reader.readRipRectangle()
			const hotKey = reader.readRipWord()
			const flags = reader.readRipNumber()
			reader.readRipNumber() // reserved
			const text = reader.readRipString()
			return { type: 'Button', opcode: 'U', rect, hotKey, flags, text }
		}
		case '1B':
		case 'BS': {
			// ButtonStyle has many fields, read them all
			reader.readRipWord()
			reader.readRipWord()
			reader.readRipWord()
			reader.readRipInt()
			reader.readRipWord()
			reader.readRipWord()
			reader.readRipWord()
			reader.readRipWord()
			reader.readRipWord()
			reader.readRipWord()
			reader.readRipWord()
			reader.readRipWord()
			reader.readRipWord()
			reader.readRipWord()
			reader.readRipWord()
			return { type: 'ButtonStyle', opcode: '1B' }
		}
		case 'M':
		case 'MO': {
			const enabled = reader.readRipWord() !== 0
			return { type: 'Mouse', opcode: 'M', enabled }
		}
		case '1K':
		case 'KM': {
			return { type: 'KillMouseFields', opcode: '1K' }
		}

		// Erase commands
		case '>':
		case 'EE': {
			return { type: 'EraseEOL', opcode: '>' }
		}
		case 'E':
		case 'EV': {
			return { type: 'EraseView', opcode: 'E' }
		}
		case 'e':
		case 'EW': {
			// EraseWindow - RIPscrip spec: !|e (no parameters)
			// Clears Text Window to current background color
			return { type: 'EraseWindow', opcode: 'e' }
		}
		case '*':
		case 'RW': {
			return { type: 'ResetWindows', opcode: '*' }
		}

		// Image commands
		case '1C':
		case 'GI': {
			const rect = reader.readRipRectangle()
			const id = reader.readRipNumber()
			return { type: 'GetImage', opcode: '1C', rect, id }
		}
		case '1P':
		case 'PI': {
			const point = reader.readRipPoint()
			const writeMode = reader.readRipWord()
			const id = reader.readRipNumber()
			return { type: 'PutImage', opcode: '1P', point, writeMode: writeMode as WriteMode, id }
		}
		case '1I':
		case 'LI': {
			const point = reader.readRipPoint()
			const id = reader.readRipWord()
			const flags = reader.readRipNumber()
			const filename = reader.readRipString()
			return { type: 'LoadIcon', opcode: '1I', point, id, flags, filename }
		}
		case '1W':
		case 'WI': {
			const point = reader.readRipPoint()
			const id = reader.readRipWord()
			return { type: 'WriteIcon', opcode: '1W', point, id }
		}

		default:
			// Unknown opcode, skip it
			if (debug) console.log(`[RIP] Unknown opcode: |${opcode} at position ${startPos}`)
			return null
	}
}

/**
 * Parse a RIP file and return commands and metadata
 */
export function parseRip(
	data: Uint8Array,
	debug: boolean = false
): {
	commands: AnyRipCommand[]
	width: number
	height: number
	state: RipState
	initialState: RipState
	finalState: RipState
} {
	if (debug) console.log(`[RIP] Starting parse of ${data.length} bytes`)

	const reader = new RipReader(data)
	const initialState = createInitialState()
	const state = createInitialState()
	const commands: AnyRipCommand[] = []
	let width = 640 // Default EGA width
	let height = 350 // Default EGA height
	let commandCount = 0
	let errorCount = 0

	try {
		// Skip any initial non-command bytes (like '!' comments or headers)
		while (!reader.isEOF()) {
			const peek = reader.peek()
			if (peek === 0x7c) {
				// Found command marker
				break
			}
			if (peek === -1) break
			// Skip this byte
			reader.readByte()
			// Don't log initial skip - it's normal for RIP files to have headers
		}

		while (!reader.isEOF()) {
			try {
				const command = parseCommand(reader, state, debug)
				if (!command) {
					// End of file or invalid command
					// Check if we should continue looking for more commands
					// Skip to next potential command marker
					let foundNext = false
					while (!reader.isEOF()) {
						const peek = reader.peek()
						if (peek === 0x7c) {
							foundNext = true
							break
						}
						if (peek === -1) break
						// Skip non-command bytes
						reader.readByte()
					}
					if (!foundNext) {
						// No more commands found
						break
					}
					// Continue to parse next command
					continue
				}
				commands.push(command)
				commandCount++

				// Track viewport to determine canvas size
				if (command.type === 'ViewPort') {
					width = Math.max(width, command.rect.x + command.rect.width)
					height = Math.max(height, command.rect.y + command.rect.height)
					if (debug) console.log(`[RIP] ViewPort detected: ${width}x${height}`)
				}
			} catch (e: any) {
				errorCount++
				const pos = reader.getPosition()
				console.error(`[RIP] Error parsing command at position ${pos}:`, e?.message || e)
				if (debug) {
					console.error(`[RIP] Error details:`, e)
					// Try to continue parsing
					try {
						// Skip to next command marker
						while (!reader.isEOF()) {
							const b = reader.readRipByte()
							if (b === 0x7c) {
								// Found next command marker, try to continue
								reader.setPosition(reader.getPosition() - 1) // Back up one byte
								break
							}
						}
					} catch (skipError) {
						// Can't recover, break
						console.error('[RIP] Cannot recover from parse error, stopping')
						break
					}
				} else {
					// In non-debug mode, break on first error
					break
				}
			}
		}
	} catch (e: any) {
		// End of file or parse error
		console.error('[RIP] Fatal parse error:', e?.message || e)
		if (debug) console.error('[RIP] Fatal error details:', e)
	}

	if (debug && errorCount > 0) {
		console.log(`[RIP] Parse complete: ${commandCount} commands parsed, ${errorCount} errors`)
	}

	const finalState = cloneRipState(state)
	const initialStateClone = cloneRipState(initialState)

	return {
		commands,
		width,
		height,
		state: initialStateClone,
		initialState: initialStateClone,
		finalState,
	}
}
