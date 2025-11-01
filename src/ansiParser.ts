import { cp437ByteToChar } from './cp437'

export type AnsiCell = {
	ch: string
	fg: number // 0-15
	bg: number // 0-15
	bold: boolean
}

export type AnsiScreen = {
	lines: AnsiCell[][]
	columns: number
}

type Cursor = { row: number; col: number }

function createCell(fg: number, bg: number, bold: boolean): AnsiCell {
	return { ch: ' ', fg, bg, bold }
}

function ensureRow(
	lines: AnsiCell[][],
	row: number,
	columns: number,
	fg: number,
	bg: number,
	bold: boolean
) {
	while (lines.length <= row) {
		const newLine: AnsiCell[] = []
		// Initialize new lines with default attributes (not current attributes)
		for (let c = 0; c < columns; c++) newLine.push(createCell(7, 0, false))
		lines.push(newLine)
	}
}

function clearLine(
	line: AnsiCell[],
	from: number,
	to: number,
	fg: number,
	bg: number,
	bold: boolean
) {
	const start = Math.max(0, from)
	const end = Math.min(line.length - 1, to)
	for (let c = start; c <= end; c++) {
		line[c] = createCell(fg, bg, bold)
	}
}

function isSauceTrailer(bytes: Uint8Array): boolean {
	if (bytes.length < 128) return false
	// SAUCE header is 5 bytes: 'SAUCE' at offset length-128
	const off = bytes.length - 128
	return (
		bytes[off] === 0x53 && // S
		bytes[off + 1] === 0x41 && // A
		bytes[off + 2] === 0x55 && // U
		bytes[off + 3] === 0x43 && // C
		bytes[off + 4] === 0x45 // E
	)
}

export function parseAnsi(bytesInput: Uint8Array, columns = 80): AnsiScreen {
	let bytes = bytesInput
	if (isSauceTrailer(bytes)) {
		bytes = bytes.slice(0, bytes.length - 128)
	}

	const lines: AnsiCell[][] = []
	const cur: Cursor = { row: 0, col: 0 }
	const savedCur: Cursor = { row: 0, col: 0 }
	let fg = 7
	let bg = 0
	let bold = false

	const ESC = 0x1b

	let i = 0
	let state: 'normal' | 'esc' | 'csi' = 'normal'
	let csiParams = ''

	const writeChar = (ch: string) => {
		if (ch === '') return
		if (ch === '\n') {
			cur.row += 1
			cur.col = 0
			return
		}
		if (ch === '\r') {
			cur.col = 0
			return
		}
		if (cur.col < 0) cur.col = 0
		// Don't write beyond column boundary - ANSI art is precisely positioned
		if (cur.col >= columns) {
			return
		}
		ensureRow(lines, cur.row, columns, fg, bg, bold)
		lines[cur.row][cur.col] = { ch, fg, bg, bold }
		cur.col += 1
	}

	const applySGR = (params: number[]) => {
		if (params.length === 0) params = [0]
		// ANSI base colors (30-37) order: black, red, green, yellow, blue, magenta, cyan, white
		// Map to DOS palette indices order: 0:black, 1:blue, 2:green, 3:cyan, 4:red, 5:magenta, 6:brown, 7:light gray
		const ANSI_TO_DOS: number[] = [0, 4, 2, 6, 1, 5, 3, 7]
		for (const p of params) {
			if (p === 0) {
				fg = 7
				bg = 0
				bold = false
				continue
			}
			if (p === 1) {
				bold = true
				continue
			}
			if (p === 22) {
				bold = false
				continue
			}
			if (p === 39) {
				fg = 7
				continue
			}
			if (p === 49) {
				bg = 0
				continue
			}
			if (p >= 30 && p <= 37) {
				fg = ANSI_TO_DOS[p - 30]
				continue
			}
			if (p >= 40 && p <= 47) {
				bg = ANSI_TO_DOS[p - 40]
				continue
			}
			if (p >= 90 && p <= 97) {
				fg = 8 + ANSI_TO_DOS[p - 90]
				continue
			}
			if (p >= 100 && p <= 107) {
				bg = 8 + ANSI_TO_DOS[p - 100]
				continue
			}
		}
	}

	while (i < bytes.length) {
		const b = bytes[i++]
		if (b === 0x1a) break // soft EOF

		switch (state) {
			case 'normal': {
				if (b === ESC) {
					state = 'esc'
					break
				}
				writeChar(cp437ByteToChar(b))
				break
			}
			case 'esc': {
				if (b === 0x5b) {
					// CSI
					state = 'csi'
					csiParams = ''
					break
				}
				// Unrecognized ESC sequence; ignore
				state = 'normal'
				break
			}
			case 'csi': {
				const ch = String.fromCharCode(b)
				if ((b >= 0x30 && b <= 0x3f) || ch === ' ' || ch === '?') {
					csiParams += ch
					break
				}
				// Final byte
				const params = csiParams.trim().length
					? csiParams.split(';').map(x => (x === '' ? NaN : parseInt(x, 10)))
					: []
				const get = (idx: number, def: number) =>
					Number.isNaN(params[idx]) || params[idx] === undefined ? def : params[idx]
				if (ch === 's') {
					// Save cursor position
					savedCur.row = cur.row
					savedCur.col = cur.col
				} else if (ch === 'u') {
					// Restore cursor position
					cur.row = savedCur.row
					cur.col = savedCur.col
					ensureRow(lines, cur.row, columns, fg, bg, bold)
				} else if (ch === 'm') {
					applySGR(params.filter(p => !Number.isNaN(p)))
				} else if (ch === 'H' || ch === 'f') {
					const r = Math.max(1, get(0, 1)) - 1
					const c = Math.max(1, get(1, 1)) - 1
					cur.row = r
					cur.col = Math.max(0, Math.min(columns - 1, c))
					ensureRow(lines, cur.row, columns, fg, bg, bold)
				} else if (ch === 'A') {
					const n = Math.max(1, get(0, 1))
					cur.row = Math.max(0, cur.row - n)
				} else if (ch === 'B') {
					const n = Math.max(1, get(0, 1))
					cur.row = cur.row + n
					ensureRow(lines, cur.row, columns, fg, bg, bold)
				} else if (ch === 'C') {
					const n = Math.max(1, get(0, 1))
					cur.col = Math.min(columns - 1, cur.col + n)
				} else if (ch === 'D') {
					const n = Math.max(1, get(0, 1))
					cur.col = Math.max(0, cur.col - n)
				} else if (ch === 'G') {
					const c = Math.max(1, get(0, 1)) - 1
					cur.col = Math.max(0, Math.min(columns - 1, c))
				} else if (ch === 'K') {
					const mode = get(0, 0)
					ensureRow(lines, cur.row, columns, fg, bg, bold)
					if (mode === 0) {
						clearLine(lines[cur.row], cur.col, columns - 1, fg, bg, bold)
					} else if (mode === 1) {
						clearLine(lines[cur.row], 0, cur.col, fg, bg, bold)
					} else if (mode === 2) {
						clearLine(lines[cur.row], 0, columns - 1, fg, bg, bold)
					}
				} else if (ch === 'J') {
					const mode = get(0, 0)
					if (mode === 2) {
						// clear entire display and reset cursor
						lines.length = 0
						cur.row = 0
						cur.col = 0
					} else if (mode === 0 || mode === 1) {
						// approximate: clear current line segment and subsequent (or previous)
						ensureRow(lines, cur.row, columns, fg, bg, bold)
						if (mode === 0) {
							clearLine(lines[cur.row], cur.col, columns - 1, fg, bg, bold)
							for (let r = cur.row + 1; r < lines.length; r++)
								clearLine(lines[r], 0, columns - 1, fg, bg, bold)
						} else {
							for (let r = 0; r < cur.row; r++) clearLine(lines[r], 0, columns - 1, fg, bg, bold)
							clearLine(lines[cur.row], 0, cur.col, fg, bg, bold)
						}
					}
				}
				state = 'normal'
				csiParams = ''
				break
			}
		}
	}

	// Ensure at least one line exists for rendering simplicity
	if (lines.length === 0) {
		const newLine: AnsiCell[] = []
		for (let c = 0; c < columns; c++) newLine.push(createCell(7, 0, false))
		lines.push(newLine)
	}

	// Ensure all lines are exactly `columns` wide - ANSI art relies on implicit
	// black/default background for unwritten cells at line ends
	for (let r = 0; r < lines.length; r++) {
		const line = lines[r]
		if (!line) {
			// Shouldn't happen, but create a full empty line if missing
			lines[r] = []
			for (let c = 0; c < columns; c++) lines[r].push(createCell(7, 0, false))
		} else {
			// Pad existing line to full width
			while (line.length < columns) {
				line.push(createCell(7, 0, false))
			}
		}
	}

	return { lines, columns }
}

/**
 * Parse ANSI incrementally up to a specific byte index
 * Used for progressive/animated rendering
 */
export function parseAnsiIncremental(
	bytesInput: Uint8Array,
	columns: number,
	maxByteIndex: number
): AnsiScreen {
	let bytes = bytesInput
	if (isSauceTrailer(bytes)) {
		bytes = bytes.slice(0, bytes.length - 128)
	}

	// Cap maxByteIndex to actual length
	const stopAt = Math.min(maxByteIndex, bytes.length)

	const lines: AnsiCell[][] = []
	const cur: Cursor = { row: 0, col: 0 }
	const savedCur: Cursor = { row: 0, col: 0 }
	let fg = 7
	let bg = 0
	let bold = false

	const ESC = 0x1b

	let i = 0
	let state: 'normal' | 'esc' | 'csi' = 'normal'
	let csiParams = ''

	const writeChar = (ch: string) => {
		if (ch === '') return
		if (ch === '\n') {
			cur.row += 1
			cur.col = 0
			return
		}
		if (ch === '\r') {
			cur.col = 0
			return
		}
		if (cur.col < 0) cur.col = 0
		if (cur.col >= columns) {
			return
		}
		ensureRow(lines, cur.row, columns, fg, bg, bold)
		lines[cur.row][cur.col] = { ch, fg, bg, bold }
		cur.col += 1
	}

	const applySGR = (params: number[]) => {
		if (params.length === 0) params = [0]
		const ANSI_TO_DOS: number[] = [0, 4, 2, 6, 1, 5, 3, 7]
		for (const p of params) {
			if (p === 0) {
				fg = 7
				bg = 0
				bold = false
				continue
			}
			if (p === 1) {
				bold = true
				continue
			}
			if (p === 22) {
				bold = false
				continue
			}
			if (p === 39) {
				fg = 7
				continue
			}
			if (p === 49) {
				bg = 0
				continue
			}
			if (p >= 30 && p <= 37) {
				fg = ANSI_TO_DOS[p - 30]
				continue
			}
			if (p >= 40 && p <= 47) {
				bg = ANSI_TO_DOS[p - 40]
				continue
			}
			if (p >= 90 && p <= 97) {
				fg = 8 + ANSI_TO_DOS[p - 90]
				continue
			}
			if (p >= 100 && p <= 107) {
				bg = 8 + ANSI_TO_DOS[p - 100]
				continue
			}
		}
	}

	while (i < stopAt) {
		const b = bytes[i++]
		if (b === 0x1a) break // soft EOF

		switch (state) {
			case 'normal': {
				if (b === ESC) {
					state = 'esc'
					break
				}
				writeChar(cp437ByteToChar(b))
				break
			}
			case 'esc': {
				if (b === 0x5b) {
					// CSI
					state = 'csi'
					csiParams = ''
					break
				}
				// Unrecognized ESC sequence; ignore
				state = 'normal'
				break
			}
			case 'csi': {
				const ch = String.fromCharCode(b)
				if ((b >= 0x30 && b <= 0x3f) || ch === ' ' || ch === '?') {
					csiParams += ch
					break
				}
				// Final byte
				const params = csiParams.trim().length
					? csiParams.split(';').map(x => (x === '' ? NaN : parseInt(x, 10)))
					: []
				const get = (idx: number, def: number) =>
					Number.isNaN(params[idx]) || params[idx] === undefined ? def : params[idx]
				if (ch === 's') {
					savedCur.row = cur.row
					savedCur.col = cur.col
				} else if (ch === 'u') {
					cur.row = savedCur.row
					cur.col = savedCur.col
					ensureRow(lines, cur.row, columns, fg, bg, bold)
				} else if (ch === 'm') {
					applySGR(params.filter(p => !Number.isNaN(p)))
				} else if (ch === 'H' || ch === 'f') {
					const r = Math.max(1, get(0, 1)) - 1
					const c = Math.max(1, get(1, 1)) - 1
					cur.row = r
					cur.col = Math.max(0, Math.min(columns - 1, c))
					ensureRow(lines, cur.row, columns, fg, bg, bold)
				} else if (ch === 'A') {
					const n = Math.max(1, get(0, 1))
					cur.row = Math.max(0, cur.row - n)
				} else if (ch === 'B') {
					const n = Math.max(1, get(0, 1))
					cur.row = cur.row + n
					ensureRow(lines, cur.row, columns, fg, bg, bold)
				} else if (ch === 'C') {
					const n = Math.max(1, get(0, 1))
					cur.col = Math.min(columns - 1, cur.col + n)
				} else if (ch === 'D') {
					const n = Math.max(1, get(0, 1))
					cur.col = Math.max(0, cur.col - n)
				} else if (ch === 'G') {
					const c = Math.max(1, get(0, 1)) - 1
					cur.col = Math.max(0, Math.min(columns - 1, c))
				} else if (ch === 'K') {
					const mode = get(0, 0)
					ensureRow(lines, cur.row, columns, fg, bg, bold)
					if (mode === 0) {
						clearLine(lines[cur.row], cur.col, columns - 1, fg, bg, bold)
					} else if (mode === 1) {
						clearLine(lines[cur.row], 0, cur.col, fg, bg, bold)
					} else if (mode === 2) {
						clearLine(lines[cur.row], 0, columns - 1, fg, bg, bold)
					}
				} else if (ch === 'J') {
					const mode = get(0, 0)
					if (mode === 2) {
						lines.length = 0
						cur.row = 0
						cur.col = 0
					} else if (mode === 0 || mode === 1) {
						ensureRow(lines, cur.row, columns, fg, bg, bold)
						if (mode === 0) {
							clearLine(lines[cur.row], cur.col, columns - 1, fg, bg, bold)
							for (let r = cur.row + 1; r < lines.length; r++)
								clearLine(lines[r], 0, columns - 1, fg, bg, bold)
						} else {
							for (let r = 0; r < cur.row; r++) clearLine(lines[r], 0, columns - 1, fg, bg, bold)
							clearLine(lines[cur.row], 0, cur.col, fg, bg, bold)
						}
					}
				}
				state = 'normal'
				csiParams = ''
				break
			}
		}
	}

	// Ensure at least one line exists
	if (lines.length === 0) {
		const newLine: AnsiCell[] = []
		for (let c = 0; c < columns; c++) newLine.push(createCell(7, 0, false))
		lines.push(newLine)
	}

	// Ensure all lines are exactly `columns` wide
	for (let r = 0; r < lines.length; r++) {
		const line = lines[r]
		if (!line) {
			lines[r] = []
			for (let c = 0; c < columns; c++) lines[r].push(createCell(7, 0, false))
		} else {
			while (line.length < columns) {
				line.push(createCell(7, 0, false))
			}
		}
	}

	return { lines, columns }
}

/**
 * Find the next render point after a given byte index
 * Render points are:
 * - After complete escape sequences (CSI commands)
 * - After single ESC sequences
 * - After newlines/carriage returns
 * - After batches of normal characters (every N chars)
 */
export function findNextRenderPoint(
	bytes: Uint8Array,
	startIndex: number,
	batchSize: number = 50
): number {
	if (startIndex >= bytes.length) return bytes.length

	let i = startIndex
	const ESC = 0x1b
	let state: 'normal' | 'esc' | 'csi' = 'normal'
	let normalCharCount = 0

	while (i < bytes.length) {
		const b = bytes[i++]
		if (b === 0x1a) return i // soft EOF

		switch (state) {
			case 'normal': {
				if (b === ESC) {
					// If we've accumulated normal chars, render before this escape
					if (normalCharCount > 0) return i - 1
					state = 'esc'
					break
				}
				if (b === 0x0a || b === 0x0d) {
					// Newline or carriage return - render point
					return i
				}
				normalCharCount++
				// Batch normal characters
				if (normalCharCount >= batchSize) {
					return i
				}
				break
			}
			case 'esc': {
				if (b === 0x5b) {
					// CSI - continue reading params
					state = 'csi'
					break
				}
				// Single ESC sequence complete - render point
				return i
			}
			case 'csi': {
				const ch = String.fromCharCode(b)
				if ((b >= 0x30 && b <= 0x3f) || ch === ' ' || ch === '?') {
					// Parameter bytes - continue
					break
				}
				// CSI command complete - render point
				return i
			}
		}
	}

	return bytes.length
}
