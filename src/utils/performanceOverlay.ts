import type { BitmapFont } from '../font/bitmapFont'

export type PerformanceStats = {
	actualFps: number
	targetFps: number
	renderTime: number
	drawTime: number
	virtualColumns?: number
	virtualRows?: number
	viewColumns: number
	viewRows: number
	viewX: number
	viewY: number
}

/**
 * Draw performance overlay as a separate canvas layer
 * Does not mutate screen data - renders directly to canvas
 */
export function drawPerformanceOverlay(
	ctx: CanvasRenderingContext2D,
	stats: PerformanceStats,
	font: BitmapFont
): void {
	const {
		actualFps,
		targetFps,
		renderTime,
		drawTime,
		virtualColumns,
		virtualRows,
		viewColumns,
		viewRows,
		viewX,
		viewY,
	} = stats

	// Prepare overlay text
	const lines = [
		`FPS: ${actualFps.toFixed(1)} / ${targetFps}`,
		`Render: ${renderTime.toFixed(2)}ms`,
		`Draw: ${drawTime.toFixed(2)}ms`,
		`World: ${virtualColumns ?? viewColumns}x${virtualRows ?? viewRows}`,
		`View: ${viewColumns}x${viewRows} @ (${viewX},${viewY})`,
	]

	const charWidth = font.width
	const charHeight = font.height
	const padding = 8 // pixels
	const lineHeight = 14 // pixels (slightly less than charHeight for compactness)

	// Calculate overlay dimensions
	ctx.font = '12px monospace'
	const maxTextWidth = Math.max(...lines.map(line => ctx.measureText(line).width))
	const overlayWidth = maxTextWidth + padding * 2
	const overlayHeight = lines.length * lineHeight + padding * 2

	// Position in bottom right corner
	const overlayX = viewColumns * charWidth - overlayWidth - 10
	const overlayY = viewRows * charHeight - overlayHeight - 10

	// Draw semi-transparent background
	ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
	ctx.fillRect(overlayX, overlayY, overlayWidth, overlayHeight)

	// Draw border
	ctx.strokeStyle = 'rgba(85, 85, 85, 0.9)'
	ctx.lineWidth = 1
	ctx.strokeRect(overlayX, overlayY, overlayWidth, overlayHeight)

	// Draw text
	ctx.fillStyle = '#FFFFFF'
	ctx.font = '12px monospace'
	ctx.textBaseline = 'top'

	lines.forEach((line, i) => {
		ctx.fillText(line, overlayX + padding, overlayY + padding + i * lineHeight)
	})
}

