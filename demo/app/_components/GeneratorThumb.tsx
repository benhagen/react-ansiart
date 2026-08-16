'use client'

/**
 * GeneratorThumb — a small LIVE preview tile for a frame generator.
 *
 * Renders a low-fps AnsiVirtualDisplay at small cell dimensions and CSS-scales
 * it (pixelated) down to a tile. The library's IntersectionObserver support
 * pauses the engine while the tile is offscreen, so a grid of ~27 of these only
 * animates what's visible — no extra bookkeeping here.
 *
 * The component is memoized: pass a *stable* `generator` reference (useMemo /
 * module-level constant) or every parent render will re-init the engine.
 */

import React, { memo, useMemo } from 'react'
import { AnsiVirtualDisplay, type CharacterFrameGenerator } from 'react-ansiart'

/** Embedded VGA font cell metrics — AnsiVirtualDisplay's default font is 8×16. */
const CELL_W = 8
const CELL_H = 16

export type GeneratorThumbProps = {
	generator: CharacterFrameGenerator
	label: string
	selected?: boolean
	onClick?: () => void
	columns?: number
	rows?: number
	fps?: number
	/** Tile display width in CSS px. Default 200. */
	width?: number
	/** Optional tile display height. Omitted → derived from the cell aspect ratio. */
	height?: number
}

function GeneratorThumbImpl({
	generator,
	label,
	selected = false,
	onClick,
	columns = 40,
	rows = 12,
	fps = 8,
	width = 200,
	height,
}: GeneratorThumbProps) {
	const naturalWidth = columns * CELL_W
	const naturalHeight = rows * CELL_H

	const scale = height
		? Math.min(width / naturalWidth, height / naturalHeight)
		: width / naturalWidth
	const displayHeight = height ?? Math.round(naturalHeight * scale)

	// Keep the generator identity stable for the display; re-init only if it changes.
	const frameGenerator = useMemo(() => generator, [generator])

	return (
		<button
			type="button"
			className={selected ? 'gen-thumb selected' : 'gen-thumb'}
			onClick={onClick}
			aria-pressed={selected}
			title={label}
		>
			<span
				className="gen-thumb-screen"
				style={{ width, height: displayHeight }}
				aria-hidden="true"
			>
				<span
					className="gen-thumb-scaler"
					style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
				>
					<AnsiVirtualDisplay
						columns={columns}
						rows={rows}
						fps={fps}
						frameGenerator={frameGenerator}
						background="#000"
					/>
				</span>
			</span>
			<span className="gen-thumb-label">{label}</span>
		</button>
	)
}

export const GeneratorThumb = memo(GeneratorThumbImpl)

export default GeneratorThumb
