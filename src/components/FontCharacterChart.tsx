'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cp437ByteToChar } from '../utils/cp437'
import { BitmapFont, loadRawBitmapFont, renderGlyph } from '../font/bitmapFont'
import { extractFontFromFON } from '../font/fonExtractor'
import { getEmbeddedVgaFont } from '../font/embeddedVgaFont'

export type FontCharacterChartProps = {
	bitmapFontUrl?: string
}

type CharacterInfo = {
	charCode: number
	character: string
	darkness: number // percentage 0-100
}

export function FontCharacterChart({ bitmapFontUrl }: FontCharacterChartProps) {
	const [bitmapFont, setBitmapFont] = useState<BitmapFont | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [sorted, setSorted] = useState(false)
	const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())

	// Load font on mount
	useEffect(() => {
		if (!bitmapFontUrl) {
			// No URL provided — use embedded VGA font
			setBitmapFont(getEmbeddedVgaFont())
			setLoading(false)
			return
		}

		let cancelled = false
		async function loadFont() {
			setLoading(true)
			setError(null)
			try {
				// Try extracting from FON file first
				const fontResult = await extractFontFromFON(bitmapFontUrl!)
				if (fontResult) {
					const { bitmapData, width, height } = fontResult
					const bytesPerGlyph = height
					const glyphs: Uint8Array[] = []
					for (let i = 0; i < 256; i++) {
						glyphs.push(bitmapData.slice(i * bytesPerGlyph, (i + 1) * bytesPerGlyph))
					}
					if (!cancelled) {
						setBitmapFont({ width, height, glyphs, rawBitmapData: bitmapData })
					}
				} else {
					// Fallback to direct loading
					const font = await loadRawBitmapFont(bitmapFontUrl!, 8, 16)
					if (!cancelled) {
						setBitmapFont(font)
					}
				}
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : 'Failed to load font')
				}
			} finally {
				if (!cancelled) {
					setLoading(false)
				}
			}
		}
		loadFont()
		return () => {
			cancelled = true
		}
	}, [bitmapFontUrl])

	// Calculate darkness percentage for a character
	function calculateDarkness(font: BitmapFont, charCode: number): number {
		const glyph = font.glyphs[charCode] || font.glyphs[0]
		let setBits = 0
		const totalBits = font.width * font.height

		for (let row = 0; row < font.height; row++) {
			const byte = glyph[row]
			// Count set bits in this byte
			for (let col = 0; col < font.width; col++) {
				const bit = 7 - col
				if (byte & (1 << bit)) {
					setBits++
				}
			}
		}

		return (setBits / totalBits) * 100
	}

	// Generate character info for printable characters (32-255)
	const characterInfo = useMemo(() => {
		if (!bitmapFont) return []

		const info: CharacterInfo[] = []
		for (let charCode = 32; charCode <= 255; charCode++) {
			const character = cp437ByteToChar(charCode)
			const darkness = calculateDarkness(bitmapFont, charCode)
			info.push({ charCode, character, darkness })
		}

		return info
	}, [bitmapFont])

	// Sort characters if needed
	const displayedCharacters = useMemo(() => {
		if (!sorted) return characterInfo
		return [...characterInfo].sort((a, b) => b.darkness - a.darkness)
	}, [characterInfo, sorted])

	// Render character to canvas
	useEffect(() => {
		if (!bitmapFont) return

		displayedCharacters.forEach(({ charCode }) => {
			const canvas = canvasRefs.current.get(charCode)
			if (!canvas) return

			const ctx = canvas.getContext('2d')
			if (!ctx) return

			// Clear canvas
			ctx.fillStyle = '#000000'
			ctx.fillRect(0, 0, canvas.width, canvas.height)

			// Render glyph
			renderGlyph(ctx, bitmapFont, charCode, 0, 0, '#FFFFFF', '#000000')
		})
	}, [bitmapFont, displayedCharacters])

	// Copy character to clipboard
	async function copyToClipboard(character: string) {
		try {
			await navigator.clipboard.writeText(character)
		} catch {
			// Clipboard API may not be available in all contexts
		}
	}

	if (loading) {
		return <div>Loading font...</div>
	}

	if (error) {
		return <div>Error: {error}</div>
	}

	if (!bitmapFont) {
		return <div>No font loaded</div>
	}

	return (
		<div style={{ padding: '20px' }}>
			<div style={{ marginBottom: '20px' }}>
				<button onClick={() => setSorted(!sorted)}>
					{sorted ? 'Show Original Order' : 'Sort by Darkness (Darkest to Lightest)'}
				</button>
			</div>
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
					gap: '10px',
				}}
			>
				{displayedCharacters.map(({ charCode, character, darkness }) => (
					<div
						key={charCode}
						onClick={() => copyToClipboard(character)}
						style={{
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							cursor: 'pointer',
							padding: '10px',
							border: '1px solid #333',
							borderRadius: '4px',
							backgroundColor: '#1a1a1a',
						}}
						title={`Click to copy: ${character}`}
					>
						<canvas
							ref={el => {
								if (el) canvasRefs.current.set(charCode, el)
							}}
							width={bitmapFont.width}
							height={bitmapFont.height}
							style={{
								imageRendering: 'pixelated',
								width: `${bitmapFont.width * 4}px`,
								height: `${bitmapFont.height * 4}px`,
							}}
						/>
						<div style={{ marginTop: '8px', fontSize: '12px', color: '#888' }}>
							{darkness.toFixed(1)}%
						</div>
					</div>
				))}
			</div>
		</div>
	)
}
