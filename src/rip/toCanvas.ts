// Convert RIP commands to canvas drawing operations

import { EGA_PALETTE_RGB } from '../utils/egaPalette'
import type { AnyRipCommand, Point, Rectangle, RipState } from './types'
import { FillStyle, LineStyle } from './types'

function cloneRipState(state: RipState): RipState {
	return {
		...state,
		cursor: { ...state.cursor },
		viewport: state.viewport ? { ...state.viewport } : null,
		textWindow: state.textWindow ? { ...state.textWindow } : null,
		palette: state.palette ? [...state.palette] : [],
	}
}

// PabloDraw-style line drawing algorithm for pixel-perfect lines
function drawLine(
	ctx: CanvasRenderingContext2D,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	maxCommands?: number
): void {
	// DEBUG: Log line drawing
	// if (maxCommands !== undefined) {
	// 	console.log(`[RIP] Drawing line: (${x1}, ${y1}) -> (${x2}, ${y2})`)
	// }

	// Ensure we're using fillRect with the current fillStyle (should be set by caller)
	// Note: ctx.fillStyle should be set by the caller before calling this function
	const lYDelta = Math.abs(y2 - y1)
	const lXDelta = Math.abs(x2 - x1)

	if (lXDelta === 0) {
		// Vertical line
		const startY = Math.min(y1, y2)
		for (let y = 0; y <= lYDelta; y++) {
			ctx.fillRect(x1, startY + y, 1, 1)
		}
	} else if (lYDelta === 0) {
		// Horizontal line
		const startX = Math.min(x1, x2)
		for (let x = 0; x <= lXDelta; x++) {
			ctx.fillRect(startX + x, y1, 1, 1)
		}
	} else if (lXDelta >= lYDelta) {
		// X-major line
		let lAdjUp: number, lAdjDown: number, lError: number, lAdvance: number
		let lWholeStep: number, lStartLength: number, lEndLength: number, lCount: number
		let lRunLength: number
		let lStep: number
		let pos: { x: number; y: number }

		lAdvance = 1
		if (y1 < y2) {
			pos = { x: x1, y: y1 }
			lStep = x1 > x2 ? -1 : 1
		} else {
			pos = { x: x2, y: y2 }
			lStep = x2 > x1 ? -1 : 1
		}

		lWholeStep = Math.floor(lXDelta / lYDelta) * lStep
		lAdjUp = lXDelta % lYDelta
		lAdjDown = lYDelta * 2
		lError = lAdjUp - lAdjDown
		lAdjUp *= 2

		lStartLength = Math.floor(lWholeStep / 2) + lStep
		lEndLength = lStartLength
		if (lAdjUp === 0 && (lWholeStep & 0x01) === 0) {
			lStartLength -= lStep
		}

		if ((lWholeStep & 0x01) !== 0) {
			lError += lYDelta
		}

		// Draw start segment
		for (let i = 0; i < Math.abs(lStartLength); i++) {
			ctx.fillRect(pos.x + i * Math.sign(lStartLength), pos.y, 1, 1)
		}
		pos.x += lStartLength
		pos.y += lAdvance

		// Draw middle segments
		for (lCount = 0; lCount < lYDelta - 1; lCount++) {
			lRunLength = lWholeStep
			if ((lError += lAdjUp) > 0) {
				lRunLength += lStep
				lError -= lAdjDown
			}
			for (let i = 0; i < Math.abs(lRunLength); i++) {
				ctx.fillRect(pos.x + i * Math.sign(lRunLength), pos.y, 1, 1)
			}
			pos.x += lRunLength
			pos.y += lAdvance
		}

		// Draw end segment
		for (let i = 0; i < Math.abs(lEndLength); i++) {
			ctx.fillRect(pos.x + i * Math.sign(lEndLength), pos.y, 1, 1)
		}
	} else {
		// Y-major line
		let lAdjUp: number, lAdjDown: number, lError: number, lAdvance: number
		let lWholeStep: number, lStartLength: number, lEndLength: number, lCount: number
		let lRunLength: number
		let pos: { x: number; y: number }

		if (y1 < y2) {
			pos = { x: x1, y: y1 }
			lAdvance = x1 > x2 ? -1 : 1
		} else {
			pos = { x: x2, y: y2 }
			lAdvance = x2 > x1 ? -1 : 1
		}

		lWholeStep = Math.floor(lYDelta / lXDelta)
		lAdjUp = lYDelta % lXDelta
		lAdjDown = lXDelta * 2
		lError = lAdjUp - lAdjDown
		lAdjUp *= 2

		lStartLength = Math.floor(lWholeStep / 2) + 1
		lEndLength = lStartLength
		if (lAdjUp === 0 && (lWholeStep & 0x01) === 0) {
			lStartLength--
		}
		if ((lWholeStep & 0x01) !== 0) {
			lError += lXDelta
		}

		// Draw start segment
		for (let i = 0; i < lStartLength; i++) {
			ctx.fillRect(pos.x, pos.y + i, 1, 1)
		}
		pos.y += lStartLength
		pos.x += lAdvance

		// Draw middle segments
		for (lCount = 0; lCount < lXDelta - 1; lCount++) {
			lRunLength = lWholeStep
			if ((lError += lAdjUp) > 0) {
				lRunLength++
				lError -= lAdjDown
			}
			for (let i = 0; i < lRunLength; i++) {
				ctx.fillRect(pos.x, pos.y + i, 1, 1)
			}
			pos.y += lRunLength
			pos.x += lAdvance
		}

		// Draw end segment
		for (let i = 0; i < lEndLength; i++) {
			ctx.fillRect(pos.x, pos.y + i, 1, 1)
		}
	}
}

// PabloDraw-style ellipse drawing algorithm
function drawEllipse(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	startAngle: number,
	endAngle: number,
	radiusx: number,
	radiusy: number
): void {
	// Normalize angles
	if (startAngle > endAngle) {
		;[startAngle, endAngle] = [endAngle, startAngle]
	}

	radiusx = Math.max(1, radiusx)
	radiusy = Math.max(1, radiusy)

	const diameterx = radiusx * 2
	const diametery = radiusy * 2
	const b1 = diametery & 1

	let stopx = 4 * (1 - diameterx) * diametery * diametery
	let stopy = 4 * (b1 + 1) * diameterx * diameterx
	let err = stopx + stopy + b1 * diameterx * diameterx

	let xoffset = radiusx
	let yoffset = 0
	const incx = 8 * diameterx * diameterx
	const incy = 8 * diametery * diametery

	const aspect = radiusx / radiusy
	const horizontal_angle = radiusx < radiusy ? 90.0 - 45.0 * aspect : 45.0 / aspect

	do {
		const e2 = 2 * err
		const angle = Math.atan((yoffset * aspect) / xoffset) * (180 / Math.PI)

		// Check if this angle is within our drawing range
		if (angle >= startAngle && angle <= endAngle) {
			symmetryPlot(ctx, x, y, xoffset, yoffset, angle <= horizontal_angle)
			if (Math.abs(angle - horizontal_angle) < 1) {
				symmetryPlot(ctx, x, y, xoffset, yoffset, !(angle <= horizontal_angle))
			}
		}

		if (e2 <= stopy) {
			yoffset++
			err += stopy += incx
		}
		if (e2 >= stopx) {
			xoffset--
			err += stopx += incy
		}
	} while (xoffset >= 0)
}

// Helper function for ellipse symmetry plotting
function symmetryPlot(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	xoffset: number,
	yoffset: number,
	horizontal: boolean
): void {
	if (horizontal) {
		ctx.fillRect(x + xoffset, y + yoffset, 1, 1)
		ctx.fillRect(x - xoffset, y + yoffset, 1, 1)
		ctx.fillRect(x + xoffset, y - yoffset, 1, 1)
		ctx.fillRect(x - xoffset, y - yoffset, 1, 1)
	} else {
		ctx.fillRect(x + yoffset, y + xoffset, 1, 1)
		ctx.fillRect(x - yoffset, y + xoffset, 1, 1)
		ctx.fillRect(x + yoffset, y - xoffset, 1, 1)
		ctx.fillRect(x - yoffset, y - xoffset, 1, 1)
	}
}

// Pixel-perfect filled polygon using scanline algorithm (matching PabloDraw)
function fillPolygon(ctx: CanvasRenderingContext2D, points: Point[]): void {
	if (points.length <= 2) return

	// Create scanline rows array (similar to PabloDraw's CreateScanRows)
	const rows: number[][] = new Array(352) // y coordinates -1 to 350

	// Process each polygon edge
	for (let i = 1; i < points.length; i++) {
		scanLine(points[i - 1], points[i], rows)
	}
	// Close the polygon by connecting last point to first
	scanLine(points[points.length - 1], points[0], rows)

	// Fill the scanlines
	for (let y = 0; y < rows.length; y++) {
		const row = rows[y]
		if (row && row.length > 0) {
			// Sort intersection points
			row.sort((a, b) => a - b)

			// Fill between pairs of intersection points
			let on = false
			let lastX = -1
			for (const x of row) {
				if (on) {
					// Fill horizontal line from lastX to current x
					const width = x - lastX + 1
					if (width > 0) {
						ctx.fillRect(lastX, y - 1, width, 1)
					}
				}
				on = !on
				lastX = x
			}
		}
	}
}

// Scan a line segment and add intersection points to scanline rows
function scanLine(start: Point, end: Point, rows: number[][]): void {
	const yDelta = Math.abs(end.y - start.y)

	// Add start point if needed
	if (start.y < end.y) {
		addScanRow(rows, start.x, start.y)
	}

	if (yDelta > 0) {
		const xDelta = start.y > end.y ? start.x - end.x : end.x - start.x
		const minX = start.y > end.y ? end.x : start.x
		let posY = Math.min(start.y, end.y)

		posY++
		for (let count = 1; count < yDelta; count++) {
			const posX = Math.round((xDelta * count) / yDelta) + minX

			if (posY >= -1 && posY <= 350) {
				addScanRow(rows, posX, posY)
			}
			posY++
		}
	}

	// Add end point if needed
	if (end.y < start.y) {
		addScanRow(rows, end.x, end.y)
	}
}

// Add an intersection point to the appropriate scanline row
function addScanRow(rows: number[][], x: number, y: number): void {
	if (y < -1 || y > 350) return

	const rowIndex = y + 1 // Offset by 1 like PabloDraw
	if (!rows[rowIndex]) {
		rows[rowIndex] = []
	}
	rows[rowIndex].push(x)
}

// Helper function to extract command details for debugging
function getCommandDetails(command: AnyRipCommand): any {
	switch (command.type) {
		case 'Color':
			return { value: command.value }
		case 'FillStyle':
			return { style: command.style, color: command.color }
		case 'LineStyle':
			return { style: command.style, pattern: command.pattern, thickness: command.thickness }
		case 'FontStyle':
			return { font: command.font }
		case 'ViewPort':
			return { rect: command.rect }
		case 'GotoXY':
		case 'Move':
			return { point: command.point }
		case 'Home':
			return {}
		case 'WriteMode':
			return { mode: command.mode }
		case 'SetPalette':
			return { palette: command.palette }
		case 'OnePalette':
			return { color: command.color, palette: command.palette }
		case 'FillPattern':
			return { pattern: command.pattern, color: command.color }
		case 'TextWindow':
			return { rect: command.rect }
		case 'Line':
			return { start: command.start, end: command.end }
		case 'Circle':
			return { center: command.center, radius: command.radius }
		case 'Oval':
			return {
				center: command.center,
				radius: command.radius,
				startAngle: command.startAngle,
				endAngle: command.endAngle,
			}
		case 'Arc':
			return {
				center: command.center,
				radius: command.radius,
				startAngle: command.startAngle,
				endAngle: command.endAngle,
			}
		case 'Polygon':
		case 'FilledPolygon':
			return { points: command.points.length }
		case 'PolyLine':
			return { points: command.points.length }
		case 'Bar':
			return { rect: command.rect }
		case 'DrawRectangle':
			return { rect: command.rect }
		case 'Bezier':
			return { points: command.points.length }
		case 'Pixel':
			return { point: command.point }
		case 'Fill':
			return { point: command.point, border: command.border }
		case 'FilledOval':
			return { center: command.center, radius: command.radius }
		case 'PieSlice':
			return {
				center: command.center,
				radius: command.radius,
				startAngle: command.startAngle,
				endAngle: command.endAngle,
			}
		case 'OvalPieSlice':
			return {
				center: command.center,
				radius: command.radius,
				startAngle: command.startAngle,
				endAngle: command.endAngle,
			}
		case 'OvalArc':
			return {
				center: command.center,
				radius: command.radius,
				startAngle: command.startAngle,
				endAngle: command.endAngle,
			}
		case 'BeginText':
		case 'EndText':
		case 'OutText':
		case 'OutTextXY':
		case 'RegionText':
			return { text: command.type }
		default:
			return { opcode: (command as any).opcode }
	}
}

// Convert RIP color index to CSS color (matching PabloDraw's direct palette indexing)
function getColor(index: number, palette?: number[]): string {
	if (palette && palette[index] !== undefined) {
		// Custom palette - use palette[index] directly as EGA palette index
		// Clamp to valid palette indices (PabloDraw style)
		const egaIndex = Math.max(0, Math.min(palette[index], EGA_PALETTE_RGB.length - 1))
		return EGA_PALETTE_RGB[egaIndex]
	}
	// Default palette - use index directly, clamped to valid range
	const egaIndex = Math.max(0, Math.min(index, EGA_PALETTE_RGB.length - 1))
	return EGA_PALETTE_RGB[egaIndex]
}

// RIPscrip 1.54 fill patterns (8x8 bitmaps per specification)
const FILL_PATTERNS: number[][] = [
	// 0: Background Fill (Empty)
	[0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
	// 1: Solid Fill
	[0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff],
	// 2: Line Fill
	[0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
	// 3: Light Slash Fill
	[0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80],
	// 4: Normal Slash Fill
	[0xe0, 0xc1, 0x83, 0x07, 0x0e, 0x1c, 0x38, 0x70],
	// 5: Light Backslash Fill (spec shows this as "Light Backslash")
	[0xf0, 0x78, 0x3c, 0x1e, 0x0f, 0x87, 0xc3, 0xe1],
	// 6: Light Backslash Fill (alternate pattern from spec)
	[0xa5, 0xd2, 0x69, 0xb4, 0x5a, 0x2d, 0x96, 0x4b],
	// 7: Light Hatch Fill
	[0xff, 0x88, 0x88, 0x88, 0xff, 0x88, 0x88, 0x88],
	// 8: Heavy Cross Hatch Fill
	[0x81, 0x42, 0x24, 0x18, 0x18, 0x24, 0x42, 0x81],
	// 9: Interleaving Line Fill
	[0xcc, 0x33, 0xcc, 0x33, 0xcc, 0x33, 0xcc, 0x33],
	// 10 (0A): Widely Spaced Dot Fill
	[0x80, 0x00, 0x08, 0x00, 0x80, 0x00, 0x08, 0x00],
	// 11 (0B): Closely Spaced Dot Fill
	[0x88, 0x00, 0x22, 0x00, 0x88, 0x00, 0x22, 0x00],
	// 12: User (will be set dynamically)
	[0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55],
]

// Create a pattern canvas for fill styles
function createFillPattern(
	ctx: CanvasRenderingContext2D,
	style: FillStyle,
	fillColor: number,
	palette: number[] | undefined,
	userPattern?: number[]
): CanvasPattern | null {
	if (style === FillStyle.Empty) {
		return null
	}

	const patternCanvas = document.createElement('canvas')
	patternCanvas.width = 8
	patternCanvas.height = 8
	const patternCtx = patternCanvas.getContext('2d')!

	// Use palette-aware color selection for all fill styles
	const fillColorStr = getColor(fillColor, palette)

	if (style === FillStyle.Solid) {
		patternCtx.fillStyle = fillColorStr
		patternCtx.fillRect(0, 0, 8, 8)
	} else if (style === FillStyle.User && userPattern) {
		// User-defined pattern
		patternCtx.fillStyle = fillColorStr
		for (let row = 0; row < 8; row++) {
			const byte = userPattern[row] || 0
			for (let col = 0; col < 8; col++) {
				const bit = 7 - col
				if (byte & (1 << bit)) {
					patternCtx.fillRect(col, row, 1, 1)
				}
			}
		}
	} else {
		// Use predefined pattern
		const pattern = FILL_PATTERNS[style] || FILL_PATTERNS[FillStyle.Solid]
		patternCtx.fillStyle = fillColorStr
		for (let row = 0; row < 8; row++) {
			const byte = pattern[row] || 0
			for (let col = 0; col < 8; col++) {
				const bit = 7 - col
				if (byte & (1 << bit)) {
					patternCtx.fillRect(col, row, 1, 1)
				}
			}
		}
	}

	return ctx.createPattern(patternCanvas, 'repeat')
}

// Convert line style to canvas dash pattern
function setLineStyle(ctx: CanvasRenderingContext2D, style: LineStyle): void {
	switch (style) {
		case LineStyle.Solid:
			ctx.setLineDash([])
			break
		case LineStyle.Dotted:
			ctx.setLineDash([2, 2])
			break
		case LineStyle.Center:
			ctx.setLineDash([8, 4, 2, 4])
			break
		case LineStyle.Dashed:
			ctx.setLineDash([8, 4])
			break
		default:
			ctx.setLineDash([])
	}
}

// Flood fill implementation using scanline algorithm (matches PabloDraw)
function floodFill(
	ctx: CanvasRenderingContext2D,
	startX: number,
	startY: number,
	fillColor: string,
	fillPattern: CanvasPattern | null,
	borderColor: string,
	width: number,
	height: number
): void {
	// Parse fill color
	const fillMatch = fillColor.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/)
	if (!fillMatch) return
	const fillR = parseInt(fillMatch[1], 16)
	const fillG = parseInt(fillMatch[2], 16)
	const fillB = parseInt(fillMatch[3], 16)

	// Parse border color (the color to stop at)
	const borderMatch = borderColor.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/)
	if (!borderMatch) return
	const borderR = parseInt(borderMatch[1], 16)
	const borderG = parseInt(borderMatch[2], 16)
	const borderB = parseInt(borderMatch[3], 16)

	// Check bounds
	if (startX < 0 || startX >= width || startY < 0 || startY >= height) return

	// Get a fresh snapshot of the canvas to read pixel colors from
	// Force a flush of any pending drawing operations
	ctx.beginPath()
	ctx.stroke()
	ctx.beginPath()
	ctx.fill()
	// Now get the image data for flood fill
	const imageData = ctx.getImageData(0, 0, width, height)

	// Get the color at the start point
	const startIdx = (startY * width + startX) * 4
	const startR = imageData.data[startIdx]
	const startG = imageData.data[startIdx + 1]
	const startB = imageData.data[startIdx + 2]

	// DEBUG: Log actual pixel color at fill point
	console.log(
		`[RIP] DEBUG Fill point (${startX}, ${startY}) actual color: rgb(${startR}, ${startG}, ${startB})`
	)
	console.log(`[RIP] DEBUG Border color: rgb(${borderR}, ${borderG}, ${borderB})`)

	// PabloDraw: only fill if start pixel is NOT the border color
	if (startR === borderR && startG === borderG && startB === borderB) {
		console.log(`[RIP] DEBUG Fill skipped: start pixel matches border color`)
		return
	}

	// Helper function: check if pixel at position is border color
	const isBorder = (x: number, y: number): boolean => {
		if (x < 0 || x >= width || y < 0 || y >= height) return true
		const idx = (y * width + x) * 4
		return (
			imageData.data[idx] === borderR &&
			imageData.data[idx + 1] === borderG &&
			imageData.data[idx + 2] === borderB
		)
	}

	// Helper function: find horizontal line segment that is NOT border color
	const findLine = (x: number, y: number): { x1: number; x2: number; y: number } | null => {
		// If starting pixel is border, can't find a line
		if (isBorder(x, y)) {
			return null
		}

		let startx = x
		let endx = x

		// Find right boundary (scan until we hit border or edge)
		for (endx = x; endx < width; endx++) {
			if (isBorder(endx, y)) break
		}
		endx-- // Back up to last non-border pixel

		// Find left boundary (scan backwards until we hit border or edge)
		for (startx = x - 1; startx >= 0; startx--) {
			if (isBorder(startx, y)) break
		}
		startx++ // Move forward to first non-border pixel

		// PabloDraw condition: skip single pixels at screen edges
		if (startx === endx && (startx === 0 || endx === width - 1)) {
			return null
		}

		return { x1: startx, x2: endx, y }
	}

	// Helper function: check if pixel was already drawn
	const alreadyDrawn = (x: number, y: number): boolean => {
		for (const li of fillLines[y]) {
			if (x >= li.x1 && x <= li.x2) return true
		}
		return false
	}

	// Helper function: fill a line segment immediately (both imageData and canvas)
	const fillLineSegment = (x1: number, x2: number, y: number): void => {
		// Update imageData so subsequent scans see the filled pixels
		for (let x = x1; x <= x2; x++) {
			const idx = (y * width + x) * 4
			imageData.data[idx] = fillR
			imageData.data[idx + 1] = fillG
			imageData.data[idx + 2] = fillB
		}
		// Draw to canvas immediately so other draw operations see the filled pixels
		// Use pattern if available, otherwise use solid color
		if (fillPattern) {
			ctx.fillStyle = fillPattern
		} else {
			ctx.fillStyle = fillColor
		}
		ctx.fillRect(x1, y, x2 - x1 + 1, 1)
	}

	// Initialize fillLines array (one array per row)
	const fillLines: Array<Array<{ x1: number; x2: number; y: number }>> = []
	for (let i = 0; i < height; i++) {
		fillLines[i] = []
	}

	// Stack of line segments to process
	const pointStack: Array<{ x1: number; x2: number; y: number; dir: number }> = []

	// Find the initial line segment
	const initialLine = findLine(startX, startY)
	if (initialLine) {
		fillLines[initialLine.y].push(initialLine)
		fillLineSegment(initialLine.x1, initialLine.x2, initialLine.y) // Fill immediately
		// Push both directions (up=1, down=-1)
		pointStack.push({ ...initialLine, dir: 1 })
		pointStack.push({ ...initialLine, dir: -1 })

		// Process stack
		while (pointStack.length > 0) {
			const fli = pointStack.pop()!
			const cury = fli.y + fli.dir

			// Check bounds
			if (cury < 0 || cury >= height) continue

			// Scan across the line segment
			for (let cx = fli.x1; cx <= fli.x2; cx++) {
				// Skip border pixels
				if (isBorder(cx, cury)) continue

				// Skip already drawn pixels
				if (alreadyDrawn(cx, cury)) continue

				// Find line segment at this position
				const li = findLine(cx, cury)
				if (li) {
					fillLines[li.y].push(li)
					fillLineSegment(li.x1, li.x2, li.y) // Fill immediately
					cx = li.x2 // Skip to end of line segment
					pointStack.push({ x1: li.x1, x2: li.x2, y: li.y, dir: fli.dir })

					// PabloDraw: non-black fills can go backwards
					if (!(fillR === 0 && fillG === 0 && fillB === 0)) {
						// If new segment extends beyond parent, check opposite direction
						if (li.x2 > fli.x2) {
							pointStack.push({ x1: fli.x2 + 1, x2: li.x2, y: li.y, dir: -fli.dir })
						}
						if (li.x1 < fli.x1) {
							pointStack.push({ x1: li.x1, x2: fli.x1 - 1, y: li.y, dir: -fli.dir })
						}
					}
				}
			}
		}
	}
}

// Check if viewport is enabled (not 0,0,0,0)
// Per RIPscrip spec: If viewport is not defined (0,0,0,0), commands are ignored
// If viewport is null (never set), allow drawing (no restriction)
// If viewport is explicitly set to 0,0,0,0, skip drawing (disabled)
function isViewportEnabled(viewport: Rectangle | null): boolean {
	if (!viewport) return true // No viewport set = no restriction
	// Viewport is disabled if explicitly set to all zeros
	return !(viewport.x === 0 && viewport.y === 0 && viewport.width === 0 && viewport.height === 0)
}

// Draw a single RIP command to canvas
function drawCommand(
	ctx: CanvasRenderingContext2D,
	command: AnyRipCommand,
	state: RipState,
	_imageData: ImageData | null, // Unused, kept for API consistency
	canvasWidth: number,
	canvasHeight: number,
	userPattern?: number[],
	maxCommands?: number
): void {
	// RIPscrip spec: Commands with "Uses Viewport: YES" should only draw if viewport is defined
	// Check viewport adherence for drawing commands
	const viewportCommands = [
		'Line',
		'Circle',
		'Oval',
		'Arc',
		'Polygon',
		'PolyLine',
		'Bar',
		'DrawRectangle',
		'Bezier',
		'Pixel',
		'Fill',
		'FilledPolygon',
		'FilledOval',
		'PieSlice',
		'OvalPieSlice',
		'OvalArc',
		'OutText',
		'OutTextXY',
		'RegionText',
		'Button',
	]

	if (viewportCommands.includes(command.type)) {
		if (!isViewportEnabled(state.viewport)) {
			// Viewport is disabled, skip drawing
			return
		}
	}

	const color = getColor(state.color, state.palette)
	const fillColor = getColor(state.fillColor, state.palette)

	// Set stroke style for traditional canvas operations
	ctx.strokeStyle = color
	ctx.lineWidth = 1
	setLineStyle(ctx, state.lineStyle)

	// Set fill style for pixel-perfect operations (drawLine, drawEllipse, etc.)
	ctx.fillStyle = color

	// Get fill pattern
	const fillPattern = createFillPattern(
		ctx,
		state.fillStyle,
		state.fillColor,
		state.palette,
		userPattern
	)

	switch (command.type) {
		case 'Line': {
			drawLine(ctx, command.start.x, command.start.y, command.end.x, command.end.y, maxCommands)
			break
		}

		case 'Circle': {
			// PabloDraw adjusts Y radius by ASPECT ratio (350/480 * 1.06 ≈ 0.772)
			const ASPECT = (350.0 / 480.0) * 1.06
			const ry = Math.round(command.radius * ASPECT)
			const rx = command.radius
			drawEllipse(ctx, command.center.x, command.center.y, 0, 360, rx, ry)
			break
		}

		case 'Oval': {
			const rx = command.radius.width
			const ry = command.radius.height
			if (command.startAngle === 0 && command.endAngle === 360) {
				// Full ellipse
				drawEllipse(ctx, command.center.x, command.center.y, 0, 360, rx, ry)
			} else {
				// Ellipse arc
				drawEllipse(
					ctx,
					command.center.x,
					command.center.y,
					command.startAngle,
					command.endAngle,
					rx,
					ry
				)
			}
			break
		}

		case 'Arc': {
			// PabloDraw adjusts Y radius by ASPECT ratio
			const ASPECT = (350.0 / 480.0) * 1.06
			const ry = Math.round(command.radius * ASPECT)
			const rx = command.radius
			drawEllipse(
				ctx,
				command.center.x,
				command.center.y,
				command.startAngle,
				command.endAngle,
				rx,
				ry
			)
			break
		}

		case 'Polygon': {
			if (command.points.length < 2) break
			console.log(`[RIP] Drawing polygon with ${command.points.length} points, color: ${color}`)
			// Draw polygon outline using pixel-perfect lines
			for (let i = 0; i < command.points.length; i++) {
				const start = command.points[i]
				const end = command.points[(i + 1) % command.points.length]
				console.log(
					`[RIP] Drawing polygon line ${i}: (${start.x}, ${start.y}) -> (${end.x}, ${end.y})`
				)
				drawLine(ctx, start.x, start.y, end.x, end.y, maxCommands)
			}
			break
		}

		case 'PolyLine': {
			if (command.points.length < 2) break
			// Draw polyline using pixel-perfect lines
			for (let i = 0; i < command.points.length - 1; i++) {
				const start = command.points[i]
				const end = command.points[i + 1]
				drawLine(ctx, start.x, start.y, end.x, end.y, maxCommands)
			}
			break
		}

		case 'Bar': {
			const fillColorStr = getColor(state.fillColor, state.palette)
			ctx.fillStyle = fillPattern || fillColorStr
			ctx.fillRect(command.rect.x, command.rect.y, command.rect.width, command.rect.height)
			if (state.color !== 0) {
				ctx.strokeRect(command.rect.x, command.rect.y, command.rect.width, command.rect.height)
			}
			break
		}

		case 'DrawRectangle': {
			ctx.strokeRect(command.rect.x, command.rect.y, command.rect.width, command.rect.height)
			break
		}

		case 'Bezier': {
			if (command.points.length < 4) break
			ctx.beginPath()
			ctx.moveTo(command.points[0].x, command.points[0].y)
			for (let i = 1; i < command.points.length; i += 3) {
				if (i + 2 < command.points.length) {
					ctx.bezierCurveTo(
						command.points[i].x,
						command.points[i].y,
						command.points[i + 1].x,
						command.points[i + 1].y,
						command.points[i + 2].x,
						command.points[i + 2].y
					)
				}
			}
			ctx.stroke()
			break
		}

		case 'Pixel': {
			ctx.fillStyle = color
			ctx.fillRect(command.point.x, command.point.y, 1, 1)
			break
		}

		case 'Fill': {
			// Check bounds first
			if (
				command.point.x < 0 ||
				command.point.x >= canvasWidth ||
				command.point.y < 0 ||
				command.point.y >= canvasHeight
			) {
				console.warn('[RIP] Fill point out of bounds, skipping:', command.point)
				break
			}

			// Convert border color index to actual color string (border is always 0-15 in RIP)
			const borderColor = getColor(command.border & 0xf, state.palette) // Mask to 0-15 range

			// DEBUG: Log fill command parameters when fill is actually applied
			console.log(
				`[RIP] DEBUG Fill applied: point=(${command.point.x}, ${command.point.y}), border=${command.border}, fillColor=${fillColor}, fillStyle=${state.fillStyle}`
			)

			// Perform flood fill - this draws directly to canvas
			floodFill(
				ctx,
				command.point.x,
				command.point.y,
				fillColor,
				fillPattern,
				borderColor,
				canvasWidth,
				canvasHeight
			)
			break
		}

		case 'FilledPolygon': {
			if (command.points.length < 3) break

			// Set fill style for pixel-perfect filling
			// Use palette-aware color selection
			const fillColorStr = getColor(state.fillColor, state.palette)
			ctx.fillStyle = fillPattern || fillColorStr

			// Use pixel-perfect scanline polygon fill
			fillPolygon(ctx, command.points)

			// Draw outline if color is not 0 (matching PabloDraw behavior)
			if (state.color !== 0) {
				for (let i = 0; i < command.points.length - 1; i++) {
					const start = command.points[i]
					const end = command.points[i + 1]
					drawLine(ctx, start.x, start.y, end.x, end.y, maxCommands)
				}
				// Close the polygon
				const first = command.points[0]
				const last = command.points[command.points.length - 1]
				drawLine(ctx, last.x, last.y, first.x, first.y, maxCommands)
			}
			break
		}

		case 'FilledOval': {
			ctx.beginPath()
			ctx.ellipse(
				command.center.x,
				command.center.y,
				command.radius.width,
				command.radius.height,
				0,
				0,
				Math.PI * 2
			)
			const fillColorStr = getColor(state.fillColor, state.palette)
			ctx.fillStyle = fillPattern || fillColorStr
			ctx.fill()
			if (state.color !== 0) {
				ctx.stroke()
			}
			break
		}

		case 'PieSlice': {
			// PabloDraw applies ASPECT ratio to convert circular pie to elliptical
			const ASPECT = 0.772
			const radiusX = command.radius
			const radiusY = Math.trunc(command.radius * ASPECT)
			const startRad = (command.startAngle * Math.PI) / 180
			const endRad = (command.endAngle * Math.PI) / 180

			ctx.beginPath()
			ctx.moveTo(command.center.x, command.center.y)
			ctx.lineTo(
				command.center.x + radiusX * Math.cos(startRad),
				command.center.y - radiusY * Math.sin(startRad)
			)
			ctx.ellipse(command.center.x, command.center.y, radiusX, radiusY, 0, startRad, endRad)
			ctx.closePath()
			const fillColorStr = getColor(state.fillColor, state.palette)
			ctx.fillStyle = fillPattern || fillColorStr
			ctx.fill()
			if (state.color !== 0) {
				ctx.stroke()
			}
			break
		}

		case 'OvalPieSlice': {
			const startRad = (command.startAngle * Math.PI) / 180
			const endRad = (command.endAngle * Math.PI) / 180

			ctx.beginPath()
			ctx.moveTo(command.center.x, command.center.y)
			ctx.lineTo(
				command.center.x + command.radius.width * Math.cos(startRad),
				command.center.y - command.radius.height * Math.sin(startRad)
			)
			ctx.ellipse(
				command.center.x,
				command.center.y,
				command.radius.width,
				command.radius.height,
				0,
				startRad,
				endRad
			)
			ctx.closePath()
			const fillColorStr = getColor(state.fillColor, state.palette)
			ctx.fillStyle = fillPattern || fillColorStr
			ctx.fill()
			if (state.color !== 0) {
				ctx.stroke()
			}
			break
		}

		case 'OvalArc': {
			const startRad = (command.startAngle * Math.PI) / 180
			const endRad = (command.endAngle * Math.PI) / 180
			ctx.beginPath()
			ctx.ellipse(
				command.center.x,
				command.center.y,
				command.radius.width,
				command.radius.height,
				0,
				startRad,
				endRad
			)
			ctx.stroke()
			break
		}

		case 'OutText': {
			ctx.fillStyle = color
			ctx.font = '12px monospace'
			ctx.textBaseline = 'top'
			ctx.fillText(command.text, state.cursor.x, state.cursor.y)
			break
		}

		case 'OutTextXY': {
			ctx.fillStyle = color
			ctx.font = '12px monospace'
			ctx.textBaseline = 'top'
			ctx.fillText(command.text, command.point.x, command.point.y)
			break
		}

		case 'RegionText': {
			ctx.fillStyle = color
			ctx.font = '12px monospace'
			ctx.textBaseline = 'top'
			ctx.fillText(command.text, command.rect.x, command.rect.y)
			break
		}

		case 'Button': {
			// Draw button rectangle
			const fillColorStr = getColor(state.fillColor, state.palette)
			ctx.fillStyle = fillPattern || fillColorStr
			ctx.fillRect(command.rect.x, command.rect.y, command.rect.width, command.rect.height)
			if (state.color !== 0) {
				ctx.strokeRect(command.rect.x, command.rect.y, command.rect.width, command.rect.height)
			}
			// Draw button text
			ctx.fillStyle = color
			ctx.font = '12px monospace'
			ctx.textAlign = 'center'
			ctx.textBaseline = 'middle'
			ctx.fillText(
				command.text,
				command.rect.x + command.rect.width / 2,
				command.rect.y + command.rect.height / 2
			)
			ctx.textAlign = 'left'
			ctx.textBaseline = 'top'
			break
		}

		// State commands don't draw anything
		case 'Color':
		case 'FillStyle':
		case 'LineStyle':
		case 'FontStyle':
		case 'ViewPort':
		case 'GotoXY':
		case 'Move':
		case 'Home':
		case 'WriteMode':
		case 'SetPalette':
		case 'OnePalette':
		case 'FillPattern':
		case 'BeginText':
		case 'EndText':
		case 'TextWindow':
		case 'ButtonStyle':
		case 'Mouse':
		case 'KillMouseFields':
		case 'EraseEOL':
		case 'EraseView':
		case 'EraseWindow':
			// EraseWindow - clears text window (no parameters, no drawing)
			break
		case 'ResetWindows':
			// ResetWindows handled in state update section above
			break
		case 'GetImage':
		case 'PutImage':
		case 'LoadIcon':
		case 'WriteIcon':
			// These commands update state but don't draw
			break

		default:
			break
	}
}

/**
 * Render RIP commands to a canvas
 */
export function ripToCanvas(
	canvas: HTMLCanvasElement,
	commands: AnyRipCommand[],
	width: number,
	height: number,
	initialState: RipState,
	background: string = '#000000',
	maxCommands?: number
): void {
	console.log(
		`[RIP] ripToCanvas called: ${commands.length} commands, maxCommands=${maxCommands}, canvas=${width}x${height}`
	)

	// DEBUG: Log canvas setup
	if (maxCommands !== undefined) {
		console.log(`[RIP] DEBUG Canvas setup: ${width}x${height}, background: ${background}`)
	}

	// Set canvas size
	canvas.width = width
	canvas.height = height

	const ctx = canvas.getContext('2d', {
		willReadFrequently: true,
		alpha: false, // Disable alpha channel for better color matching
		desynchronized: true, // Reduce latency
	})
	if (!ctx) return

	// Disable antialiasing and smoothing for pixel-perfect color matching
	ctx.imageSmoothingEnabled = false
	ctx.imageSmoothingQuality = 'low'
	// Ensure pixel-perfect rendering
	ctx.globalCompositeOperation = 'source-over'

	// Fill background
	ctx.fillStyle = background
	ctx.fillRect(0, 0, width, height)

	// Limit commands if specified
	const limitedCommands = maxCommands !== undefined ? commands.slice(0, maxCommands) : commands

	// Track state
	const state = cloneRipState(initialState)
	let userPattern: number[] | undefined = undefined

	// Performance tracking
	let fillCommandsProcessed = 0
	let fillCommandsSkipped = 0

	// Apply commands and draw
	for (let i = 0; i < limitedCommands.length; i++) {
		const command = limitedCommands[i]

		// DEBUG: Log command details and parameters
		console.log(`[RIP] Command ${i}: ${command.type} (${command.opcode})`, command, state)

		// Update state based on command
		switch (command.type) {
			case 'Color':
				console.log(`[RIP] Color command: changing from ${state.color} to ${command.value}`)
				state.color = command.value
				break
			case 'FillStyle':
				state.fillStyle = command.style
				state.fillColor = command.color
				break
			case 'LineStyle':
				state.lineStyle = command.style
				break
			case 'FontStyle':
				state.fontStyle = command.font
				break
			case 'ViewPort':
				state.viewport = command.rect
				break
			case 'GotoXY':
			case 'Move':
				state.cursor = command.point
				break
			case 'Home':
				state.cursor = { x: 0, y: 0 }
				break
			case 'WriteMode':
				state.writeMode = command.mode
				break
			case 'SetPalette':
				state.palette = [...command.palette]
				break
			case 'OnePalette':
				// Update single palette entry
				if (state.palette) {
					state.palette[command.color] = command.palette
				}
				break
			case 'FillPattern':
				// FillPattern automatically sets fillStyle to User and updates fillColor
				state.fillStyle = FillStyle.User
				state.fillColor = command.color
				userPattern = command.pattern
				break
			case 'TextWindow':
				state.textWindow = command.rect
				break
			case 'ResetWindows':
				// ResetWindows - restore default 16-color palette per RIPscrip spec
				state.palette = Array.from({ length: 16 }, (_, i) => {
					// Default RIP palette mapping to 64-color EGA palette
					// Spec: 00=0, 01=1, 02=2, 03=3, 04=4, 05=5, 06=7, 07=20(0K), 08=56(1K), 09=57(1L), 0A=58(1M), 0B=59(1N), 0C=60(1O), 0D=61(1P), 0E=62(1Q), 0F=63(1R)
					const defaultMapping = [0, 1, 2, 3, 4, 5, 7, 20, 56, 57, 58, 59, 60, 61, 62, 63]
					return defaultMapping[i] || i
				})
				// Reset viewport and text window
				state.viewport = null
				state.textWindow = null
				// Reset cursor
				state.cursor = { x: 0, y: 0 }
				// Reset colors to defaults
				state.color = 7 // Light Gray
				state.fillColor = 0 // Black
				state.fillStyle = FillStyle.Solid
				state.lineStyle = LineStyle.Solid
				break
		}

		// Draw command
		const wasFillCommand = command.type === 'Fill'
		drawCommand(ctx, command, state, null, width, height, userPattern, maxCommands)

		if (wasFillCommand) {
			// Check if this was actually processed or skipped
			// We can't easily track this from here, but we can log periodically
			fillCommandsProcessed++
			if (fillCommandsProcessed % 100 === 0) {
				console.log(`[RIP] Processed ${fillCommandsProcessed} fill commands`)
			}
		}
	}

	console.log(`[RIP] Rendering complete: ${fillCommandsProcessed} fill commands processed`)
}
