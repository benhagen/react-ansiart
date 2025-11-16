// Convert RIP commands to SVG format

import type {
	AnyRipCommand,
	RipState,
	Point,
	Rectangle,
} from './types'
import {
	FillStyle,
	LineStyle,
	WriteMode,
} from './types'

// EGA 16-color palette RGB values
const EGA_PALETTE_RGB: string[] = [
	'#000000', // 0: Black
	'#0000AA', // 1: Blue
	'#00AA00', // 2: Green
	'#00AAAA', // 3: Cyan
	'#AA0000', // 4: Red
	'#AA00AA', // 5: Magenta
	'#AA5500', // 6: Brown
	'#AAAAAA', // 7: Light Gray
	'#555555', // 8: Dark Gray
	'#5555FF', // 9: Bright Blue
	'#55FF55', // 10: Bright Green
	'#55FFFF', // 11: Bright Cyan
	'#FF5555', // 12: Bright Red
	'#FF55FF', // 13: Bright Magenta
	'#FFFF55', // 14: Yellow
	'#FFFFFF', // 15: White
]

// Convert RIP color index to SVG color
function getColor(index: number, palette?: number[]): string {
	if (palette && palette[index] !== undefined) {
		// Custom palette - convert RGB value to hex
		const rgb = palette[index]
		const r = (rgb >> 16) & 0xff
		const g = (rgb >> 8) & 0xff
		const b = rgb & 0xff
		return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
	}
	return EGA_PALETTE_RGB[index & 0xf] || EGA_PALETTE_RGB[0]
}

// Convert angle from RIP (degrees) to SVG (radians, but SVG uses degrees)
function angleToDegrees(angle: number): number {
	// RIP angles are typically in degrees, but may need conversion
	return angle
}

// Convert fill style to SVG fill attribute
function getFillStyle(style: FillStyle, fillColor: number, palette?: number[]): string {
	switch (style) {
		case FillStyle.Empty:
			return 'none'
		case FillStyle.Solid:
			return getColor(fillColor, palette)
		default:
			// For other patterns, use solid color for now
			return getColor(fillColor, palette)
	}
}

// Convert line style to SVG stroke-dasharray
function getLineStyle(style: LineStyle, pattern: number): string {
	switch (style) {
		case LineStyle.Solid:
			return 'none'
		case LineStyle.Dotted:
			return '2,2'
		case LineStyle.Center:
			return '8,4,2,4'
		case LineStyle.Dashed:
			return '8,4'
		default:
			return 'none'
	}
}

// Escape XML/SVG special characters
function escapeXml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;')
}

// Convert point to SVG coordinates string
function pointToString(p: Point): string {
	return `${p.x},${p.y}`
}

// Convert points array to SVG path or polygon points
function pointsToString(points: Point[]): string {
	return points.map(pointToString).join(' ')
}

// Generate SVG path for arc
function arcToPath(
	center: Point,
	radius: number,
	startAngle: number,
	endAngle: number
): string {
	const startRad = (startAngle * Math.PI) / 180
	const endRad = (endAngle * Math.PI) / 180
	const startX = center.x + radius * Math.cos(startRad)
	const startY = center.y - radius * Math.sin(startRad) // SVG Y is inverted
	const endX = center.x + radius * Math.cos(endRad)
	const endY = center.y - radius * Math.sin(endRad)

	const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0
	const sweep = endAngle > startAngle ? 1 : 0

	return `M ${startX},${startY} A ${radius},${radius} 0 ${largeArc},${sweep} ${endX},${endY}`
}

// Generate SVG path for ellipse arc
function ellipseArcToPath(
	center: Point,
	radius: { width: number; height: number },
	startAngle: number,
	endAngle: number
): string {
	const startRad = (startAngle * Math.PI) / 180
	const endRad = (endAngle * Math.PI) / 180
	const startX = center.x + radius.width * Math.cos(startRad)
	const startY = center.y - radius.height * Math.sin(startRad)
	const endX = center.x + radius.width * Math.cos(endRad)
	const endY = center.y - radius.height * Math.sin(endRad)

	const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0
	const sweep = endAngle > startAngle ? 1 : 0

	return `M ${startX},${startY} A ${radius.width},${radius.height} 0 ${largeArc},${sweep} ${endX},${endY}`
}

// Convert a single RIP command to SVG elements
function commandToSvg(command: AnyRipCommand, state: RipState): string {
	const color = getColor(state.color, state.palette)
	const fill = getFillStyle(state.fillStyle, state.fillColor, state.palette)
	const stroke = color
	const strokeDasharray = getLineStyle(state.lineStyle, 0)

	switch (command.type) {
		case 'Line': {
			return `<line x1="${command.start.x}" y1="${command.start.y}" x2="${command.end.x}" y2="${command.end.y}" stroke="${stroke}" stroke-dasharray="${strokeDasharray}" />`
		}

		case 'Circle': {
			return `<circle cx="${command.center.x}" cy="${command.center.y}" r="${command.radius}" fill="none" stroke="${stroke}" stroke-dasharray="${strokeDasharray}" />`
		}

		case 'Oval': {
			const rx = command.radius.width
			const ry = command.radius.height
			if (command.startAngle === 0 && command.endAngle === 360) {
				// Full ellipse
				return `<ellipse cx="${command.center.x}" cy="${command.center.y}" rx="${rx}" ry="${ry}" fill="none" stroke="${stroke}" stroke-dasharray="${strokeDasharray}" />`
			} else {
				// Ellipse arc
				const path = ellipseArcToPath(command.center, command.radius, command.startAngle, command.endAngle)
				return `<path d="${path}" fill="none" stroke="${stroke}" stroke-dasharray="${strokeDasharray}" />`
			}
		}

		case 'Arc': {
			const path = arcToPath(command.center, command.radius, command.startAngle, command.endAngle)
			return `<path d="${path}" fill="none" stroke="${stroke}" stroke-dasharray="${strokeDasharray}" />`
		}

		case 'Polygon': {
			const points = pointsToString(command.points)
			return `<polygon points="${points}" fill="none" stroke="${stroke}" stroke-dasharray="${strokeDasharray}" />`
		}

		case 'PolyLine': {
			const points = pointsToString(command.points)
			return `<polyline points="${points}" fill="none" stroke="${stroke}" stroke-dasharray="${strokeDasharray}" />`
		}

		case 'Bar': {
			return `<rect x="${command.rect.x}" y="${command.rect.y}" width="${command.rect.width}" height="${command.rect.height}" fill="${fill}" stroke="${stroke}" />`
		}

		case 'DrawRectangle': {
			return `<rect x="${command.rect.x}" y="${command.rect.y}" width="${command.rect.width}" height="${command.rect.height}" fill="none" stroke="${stroke}" stroke-dasharray="${strokeDasharray}" />`
		}

		case 'Bezier': {
			if (command.points.length < 4) return ''
			// Cubic Bezier: M start, C control1, control2, end
			let path = `M ${pointToString(command.points[0])}`
			for (let i = 1; i < command.points.length; i += 3) {
				if (i + 2 < command.points.length) {
					path += ` C ${pointToString(command.points[i])} ${pointToString(command.points[i + 1])} ${pointToString(command.points[i + 2])}`
				}
			}
			return `<path d="${path}" fill="none" stroke="${stroke}" stroke-dasharray="${strokeDasharray}" />`
		}

		case 'Pixel': {
			return `<rect x="${command.point.x}" y="${command.point.y}" width="1" height="1" fill="${color}" />`
		}

		case 'Fill': {
			// Fill is a flood fill operation - not directly representable in SVG
			// Could use a filled rectangle as approximation, but skip for now
			return ''
		}

		case 'FilledPolygon': {
			const points = pointsToString(command.points)
			return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" />`
		}

		case 'FilledOval': {
			return `<ellipse cx="${command.center.x}" cy="${command.center.y}" rx="${command.radius.width}" ry="${command.radius.height}" fill="${fill}" stroke="${stroke}" />`
		}

		case 'PieSlice': {
			const startRad = (command.startAngle * Math.PI) / 180
			const endRad = (command.endAngle * Math.PI) / 180
			const startX = command.center.x + command.radius * Math.cos(startRad)
			const startY = command.center.y - command.radius * Math.sin(startRad)
			const endX = command.center.x + command.radius * Math.cos(endRad)
			const endY = command.center.y - command.radius * Math.sin(endRad)
			const largeArc = Math.abs(command.endAngle - command.startAngle) > 180 ? 1 : 0
			const path = `M ${command.center.x},${command.center.y} L ${startX},${startY} A ${command.radius},${command.radius} 0 ${largeArc},1 ${endX},${endY} Z`
			return `<path d="${path}" fill="${fill}" stroke="${stroke}" />`
		}

		case 'OvalPieSlice': {
			const startRad = (command.startAngle * Math.PI) / 180
			const endRad = (command.endAngle * Math.PI) / 180
			const startX = command.center.x + command.radius.width * Math.cos(startRad)
			const startY = command.center.y - command.radius.height * Math.sin(startRad)
			const endX = command.center.x + command.radius.width * Math.cos(endRad)
			const endY = command.center.y - command.radius.height * Math.sin(endRad)
			const largeArc = Math.abs(command.endAngle - command.startAngle) > 180 ? 1 : 0
			const path = `M ${command.center.x},${command.center.y} L ${startX},${startY} A ${command.radius.width},${command.radius.height} 0 ${largeArc},1 ${endX},${endY} Z`
			return `<path d="${path}" fill="${fill}" stroke="${stroke}" />`
		}

		case 'OvalArc': {
			const path = ellipseArcToPath(command.center, command.radius, command.startAngle, command.endAngle)
			return `<path d="${path}" fill="none" stroke="${stroke}" stroke-dasharray="${strokeDasharray}" />`
		}

		case 'OutText': {
			const x = state.cursor.x
			const y = state.cursor.y
			return `<text x="${x}" y="${y}" fill="${color}" font-family="monospace" font-size="12">${escapeXml(command.text)}</text>`
		}

		case 'OutTextXY': {
			return `<text x="${command.point.x}" y="${command.point.y}" fill="${color}" font-family="monospace" font-size="12">${escapeXml(command.text)}</text>`
		}

		case 'RegionText': {
			return `<text x="${command.rect.x}" y="${command.rect.y + 12}" fill="${color}" font-family="monospace" font-size="12">${escapeXml(command.text)}</text>`
		}

		case 'Button': {
			// Render button as a group with rectangle and text
			return `<g data-rip-button="true">
				<rect x="${command.rect.x}" y="${command.rect.y}" width="${command.rect.width}" height="${command.rect.height}" fill="${fill}" stroke="${stroke}" />
				<text x="${command.rect.x + command.rect.width / 2}" y="${command.rect.y + command.rect.height / 2}" fill="${color}" font-family="monospace" font-size="12" text-anchor="middle" dominant-baseline="middle">${escapeXml(command.text)}</text>
			</g>`
		}

		// State commands don't generate SVG directly, but update state
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
		case 'ResetWindows':
		case 'GetImage':
		case 'PutImage':
		case 'LoadIcon':
		case 'WriteIcon':
			// These commands update state but don't generate visible SVG
			return ''

		default:
			return ''
	}
}

/**
 * Convert RIP commands to SVG string
 */
export function ripToSvg(
	commands: AnyRipCommand[],
	width: number,
	height: number,
	initialState: RipState,
	background: string = '#000000'
): string {
	const state = { ...initialState }
	const elements: string[] = []

	// Apply commands and generate SVG
	for (const command of commands) {
		// Update state based on command
		switch (command.type) {
			case 'Color':
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
				state.palette = command.palette
				break
			case 'OnePalette':
				// Update single palette entry
				if (state.palette) {
					state.palette[command.color] = command.palette
				}
				break
			case 'TextWindow':
				state.textWindow = command.rect
				break
		}

		// Generate SVG for drawing commands
		const svg = commandToSvg(command, state)
		if (svg) {
			elements.push(svg)
		}
	}

	// Build final SVG
	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background-color: ${background};">
${elements.join('\n')}
</svg>`
}

/**
 * Convert RIP commands to SVG string for a specific frame (for animation)
 */
export function ripToSvgFrame(
	commands: AnyRipCommand[],
	width: number,
	height: number,
	initialState: RipState,
	background: string = '#000000',
	maxCommands?: number
): string {
	const limitedCommands = maxCommands !== undefined ? commands.slice(0, maxCommands) : commands
	return ripToSvg(limitedCommands, width, height, initialState, background)
}

