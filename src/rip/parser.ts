// RIP (RIPscrip) vector graphics parser
// Based on PabloDraw's RIP format implementation

import type {
	AnyRipCommand,
	Point,
	Size,
	Rectangle,
	RipState,
	Direction,
} from './types'
import {
	FillStyle,
	LineStyle,
	FontStyle,
	WriteMode,
} from './types'
import { decodeCp437 } from '../utils/cp437'

// EGA 16-color palette (standard RIP palette)
const EGA_PALETTE: number[][] = [
	[0, 0, 0], // 0: Black
	[0, 0, 170], // 1: Blue
	[0, 170, 0], // 2: Green
	[0, 170, 170], // 3: Cyan
	[170, 0, 0], // 4: Red
	[170, 0, 170], // 5: Magenta
	[170, 85, 0], // 6: Brown
	[170, 170, 170], // 7: Light Gray
	[85, 85, 85], // 8: Dark Gray
	[85, 85, 255], // 9: Bright Blue
	[85, 255, 85], // 10: Bright Green
	[85, 255, 255], // 11: Bright Cyan
	[255, 85, 85], // 12: Bright Red
	[255, 85, 255], // 13: Bright Magenta
	[255, 255, 85], // 14: Yellow
	[255, 255, 255], // 15: White
]

// Create initial RIP state
function createInitialState(): RipState {
	return {
		color: 7, // Light Gray (default)
		fillColor: 0, // Black (default)
		fillStyle: FillStyle.Solid,
		lineStyle: LineStyle.Solid,
		fontStyle: FontStyle.Default,
		viewport: null,
		cursor: { x: 0, y: 0 },
		writeMode: WriteMode.CopyPut,
		palette: EGA_PALETTE.map((rgb) => rgb[0] << 16 | rgb[1] << 8 | rgb[2]),
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
	readRipRectangle(): Rectangle {
		const start = this.readRipPoint()
		const end = this.readRipPoint()
		return {
			x: Math.min(start.x, end.x),
			y: Math.min(start.y, end.y),
			width: Math.abs(end.x - start.x),
			height: Math.abs(end.y - start.y),
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
function parseCommand(reader: RipReader, state: RipState, debug: boolean = false): AnyRipCommand | null {
	if (reader.isEOF()) {
		if (debug) console.log('[RIP] End of file reached')
		return null
	}

	const startPos = reader.getPosition()

	// Commands start with |
	const b = reader.readRipByte()
	if (b !== 0x7c) {
		// Not a command, skip
		if (debug) console.log(`[RIP] Skipping non-command byte: 0x${b.toString(16)} (${String.fromCharCode(b)}) at position ${startPos}`)
		return null
	}

	// Read opcode (1-2 characters)
	let opcode = String.fromCharCode(reader.readRipByte())
	if (opcode === '1') {
		// Two-character opcode starting with 1
		opcode += String.fromCharCode(reader.readRipByte())
	} else if (opcode === '#') {
		// End of file marker
		if (debug) console.log('[RIP] End marker (#) found')
		return null
	}

	if (debug) console.log(`[RIP] Parsing command: |${opcode} at position ${startPos}`)

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
			const radius = reader.readRipSize()
			const startAngle = reader.readRipWord()
			const endAngle = reader.readRipWord()
			return { type: 'Oval', opcode: 'O', center, radius, startAngle, endAngle }
		}
		case 'A': {
			const center = reader.readRipPoint()
			const radius = reader.readRipWord()
			const startAngle = reader.readRipWord()
			const endAngle = reader.readRipWord()
			return { type: 'Arc', opcode: 'A', center, radius, startAngle, endAngle }
		}
		case 'P': {
			const count = reader.readRipWord()
			const points: Point[] = []
			for (let i = 0; i < count; i++) {
				points.push(reader.readRipPoint())
			}
			return { type: 'Polygon', opcode: 'P', points }
		}
		case 'PL': {
			const count = reader.readRipWord()
			const points: Point[] = []
			for (let i = 0; i < count; i++) {
				points.push(reader.readRipPoint())
			}
			return { type: 'PolyLine', opcode: 'PL', points }
		}
		case 'B': {
			const rect = reader.readRipRectangle()
			return { type: 'Bar', opcode: 'B', rect }
		}
		case 'DR': {
			const rect = reader.readRipRectangle()
			return { type: 'DrawRectangle', opcode: 'DR', rect }
		}
		case 'BE': {
			const count = reader.readRipWord()
			const points: Point[] = []
			for (let i = 0; i < count; i++) {
				points.push(reader.readRipPoint())
			}
			const segments = reader.readRipWord()
			return { type: 'Bezier', opcode: 'BE', points, segments }
		}
		case 'X':
		case 'PX': {
			const point = reader.readRipPoint()
			return { type: 'Pixel', opcode: opcode === 'X' ? 'X' : 'PX', point }
		}
		case 'F': {
			const point = reader.readRipPoint()
			const border = reader.readRipWord()
			return { type: 'Fill', opcode: 'F', point, border }
		}
		case 'FP': {
			const count = reader.readRipWord()
			const points: Point[] = []
			for (let i = 0; i < count; i++) {
				points.push(reader.readRipPoint())
			}
			return { type: 'FilledPolygon', opcode: 'FP', points }
		}
		case 'FO': {
			const center = reader.readRipPoint()
			const radius = reader.readRipSize()
			return { type: 'FilledOval', opcode: 'FO', center, radius }
		}
		case 'PS': {
			const center = reader.readRipPoint()
			const radius = reader.readRipWord()
			const startAngle = reader.readRipWord()
			const endAngle = reader.readRipWord()
			return { type: 'PieSlice', opcode: 'PS', center, radius, startAngle, endAngle }
		}
		case 'OPS': {
			const center = reader.readRipPoint()
			const radius = reader.readRipSize()
			const startAngle = reader.readRipWord()
			const endAngle = reader.readRipWord()
			return { type: 'OvalPieSlice', opcode: 'OPS', center, radius, startAngle, endAngle }
		}
		case 'OA': {
			const center = reader.readRipPoint()
			const radius = reader.readRipSize()
			const startAngle = reader.readRipWord()
			const endAngle = reader.readRipWord()
			return { type: 'OvalArc', opcode: 'OA', center, radius, startAngle, endAngle }
		}

		// State commands
		case 'c': {
			const value = reader.readRipWord()
			state.color = value
			return { type: 'Color', opcode: 'c', value }
		}
		case 'S':
		case 'FS': {
			const style = reader.readRipWord()
			const color = reader.readRipWord()
			state.fillStyle = style as FillStyle
			state.fillColor = color
			return { type: 'FillStyle', opcode: opcode === 'S' ? 'S' : 'FS', style: style as FillStyle, color }
		}
		case '=':
		case 'LS': {
			const style = reader.readRipWord()
			const pattern = reader.readRipInt()
			const thickness = reader.readRipWord()
			state.lineStyle = style as LineStyle
			return { type: 'LineStyle', opcode: opcode === '=' ? '=' : 'LS', style: style as LineStyle, pattern, thickness }
		}
		case 'FT': {
			const font = reader.readRipWord()
			const direction = reader.readRipWord()
			const characterSize = reader.readRipWord()
			reader.readRipWord() // reserved
			state.fontStyle = font as FontStyle
			return { type: 'FontStyle', opcode: 'FT', font: font as FontStyle, direction: direction as Direction, characterSize }
		}
		case 'V':
		case 'v': {
			// ViewPort - can have different formats, read rectangle if present
			const rect = reader.readRipRectangle()
			state.viewport = rect
			return { type: 'ViewPort', opcode: 'V', rect }
		}
		case 'G': {
			const point = reader.readRipPoint()
			state.cursor = point
			return { type: 'GotoXY', opcode: 'G', point }
		}
		case 'M': {
			const point = reader.readRipPoint()
			state.cursor = point
			return { type: 'Move', opcode: 'M', point }
		}
		case 'H': {
			state.cursor = { x: 0, y: 0 }
			return { type: 'Home', opcode: 'H' }
		}
		case 'WM': {
			const mode = reader.readRipWord()
			state.writeMode = mode as WriteMode
			return { type: 'WriteMode', opcode: 'WM', mode: mode as WriteMode }
		}
		case 'Q':
		case 'SP': {
			const palette: number[] = []
			for (let i = 0; i < 16; i++) {
				palette.push(reader.readRipWord())
			}
			state.palette = palette
			return { type: 'SetPalette', opcode: opcode === 'Q' ? 'Q' : 'SP', palette }
		}
		case 'OP': {
			const color = reader.readRipWord()
			const palette = reader.readRipWord()
			return { type: 'OnePalette', opcode: 'OP', color, palette }
		}
		case 'FPAT': {
			const pattern: number[] = []
			for (let i = 0; i < 8; i++) {
				pattern.push(reader.readRipWord())
			}
			const color = reader.readRipWord()
			return { type: 'FillPattern', opcode: 'FPAT', pattern, color }
		}

		// Text commands
		case 'BT': {
			const rect = reader.readRipRectangle()
			const flags = reader.readRipWord()
			return { type: 'BeginText', opcode: 'BT', rect, flags }
		}
		case 'ET': {
			return { type: 'EndText', opcode: 'ET' }
		}
		case 'OT': {
			const text = reader.readRipString()
			return { type: 'OutText', opcode: 'OT', text }
		}
		case 'OTX': {
			const point = reader.readRipPoint()
			const text = reader.readRipString()
			return { type: 'OutTextXY', opcode: 'OTX', point, text }
		}
		case 'RT': {
			const rect = reader.readRipRectangle()
			const text = reader.readRipString()
			return { type: 'RegionText', opcode: 'RT', rect, text }
		}
		case 'TW': {
			const rect = reader.readRipRectangle()
			state.textWindow = rect
			return { type: 'TextWindow', opcode: 'TW', rect }
		}

		// Interactive commands
		case 'BU': {
			const rect = reader.readRipRectangle()
			const hotKey = reader.readRipWord()
			const flags = reader.readRipNumber()
			reader.readRipNumber() // reserved
			const text = reader.readRipString()
			return { type: 'Button', opcode: 'BU', rect, hotKey, flags, text }
		}
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
			return { type: 'ButtonStyle', opcode: 'BS' }
		}
		case 'MO': {
			const enabled = reader.readRipWord() !== 0
			return { type: 'Mouse', opcode: 'MO', enabled }
		}
		case 'KM': {
			return { type: 'KillMouseFields', opcode: 'KM' }
		}

		// Erase commands
		case 'EE': {
			return { type: 'EraseEOL', opcode: 'EE' }
		}
		case 'EV': {
			return { type: 'EraseView', opcode: 'EV' }
		}
		case 'EW': {
			const rect = reader.readRipRectangle()
			return { type: 'EraseWindow', opcode: 'EW', rect }
		}
		case 'RW': {
			return { type: 'ResetWindows', opcode: 'RW' }
		}

		// Image commands
		case 'GI': {
			const rect = reader.readRipRectangle()
			const id = reader.readRipNumber()
			return { type: 'GetImage', opcode: 'GI', rect, id }
		}
		case 'PI': {
			const point = reader.readRipPoint()
			const writeMode = reader.readRipWord()
			const id = reader.readRipNumber()
			return { type: 'PutImage', opcode: 'PI', point, writeMode: writeMode as WriteMode, id }
		}
		case 'LI': {
			const point = reader.readRipPoint()
			const id = reader.readRipWord()
			const flags = reader.readRipNumber()
			const filename = reader.readRipString()
			return { type: 'LoadIcon', opcode: 'LI', point, id, flags, filename }
		}
		case 'WI': {
			const point = reader.readRipPoint()
			const id = reader.readRipWord()
			return { type: 'WriteIcon', opcode: 'WI', point, id }
		}

		default:
			// Unknown opcode, skip it
			console.warn(`[RIP] Unknown opcode: |${opcode} at position ${startPos}`)
			return null
	}
}

/**
 * Parse a RIP file and return commands and metadata
 */
export function parseRip(data: Uint8Array, debug: boolean = false): {
	commands: AnyRipCommand[]
	width: number
	height: number
	state: RipState
} {
	if (debug) console.log(`[RIP] Starting parse of ${data.length} bytes`)

	const reader = new RipReader(data)
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
			if (debug) console.log(`[RIP] Skipping initial byte: 0x${peek.toString(16)} (${String.fromCharCode(peek)})`)
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

	if (debug) {
		console.log(`[RIP] Parse complete: ${commandCount} commands parsed, ${errorCount} errors`)
		console.log(`[RIP] Detected dimensions: ${width}x${height}`)
		console.log(`[RIP] Command breakdown:`, {
			drawing: commands.filter(c => ['Line', 'Circle', 'Oval', 'Arc', 'Polygon', 'PolyLine', 'Bar', 'DrawRectangle', 'Bezier', 'Pixel', 'Fill', 'FilledPolygon', 'FilledOval', 'PieSlice', 'OvalPieSlice', 'OvalArc'].includes(c.type)).length,
			state: commands.filter(c => ['Color', 'FillStyle', 'LineStyle', 'FontStyle', 'ViewPort', 'GotoXY', 'Move', 'Home', 'WriteMode', 'SetPalette', 'OnePalette', 'FillPattern'].includes(c.type)).length,
			text: commands.filter(c => ['BeginText', 'EndText', 'OutText', 'OutTextXY', 'RegionText', 'TextWindow'].includes(c.type)).length,
			other: commands.filter(c => !['Line', 'Circle', 'Oval', 'Arc', 'Polygon', 'PolyLine', 'Bar', 'DrawRectangle', 'Bezier', 'Pixel', 'Fill', 'FilledPolygon', 'FilledOval', 'PieSlice', 'OvalPieSlice', 'OvalArc', 'Color', 'FillStyle', 'LineStyle', 'FontStyle', 'ViewPort', 'GotoXY', 'Move', 'Home', 'WriteMode', 'SetPalette', 'OnePalette', 'FillPattern', 'BeginText', 'EndText', 'OutText', 'OutTextXY', 'RegionText', 'TextWindow'].includes(c.type)).length,
		})
	}

	return {
		commands,
		width,
		height,
		state,
	}
}

