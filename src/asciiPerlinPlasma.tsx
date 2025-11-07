/**
 * ASCII Perlin Plasma Effect Component
 *
 * A configurable React component that generates a classic demoscene style flowing plasma effect
 * using Perlin noise and ASCII characters rendered on an HTML5 Canvas.
 *
 * @example
 * ```tsx
 * <AsciiPerlinPlasma
 *   charWidth={12}
 *   charHeight={16}
 *   color="#00FFFF"
 *   fpsCap={30}
 *   timeScale={0.5}
 * />
 * ```
 *
 * Performance Optimizations:
 * - HTML5 Canvas rendering (5-10x faster than DOM text manipulation)
 * - Pre-computed character lookup table (256 entries)
 * - Object pooling for row buffers to avoid GC pressure
 * - Optimized hash function for faster noise generation
 * - Cached octave configurations
 * - High-DPI canvas scaling for crisp rendering
 * - FPS capping to prevent excessive CPU usage
 * - Centralized color definition matching SCSS theme
 *
 * Features:
 * - 2D Perlin noise implementation
 * - Multiple octaves for detail
 * - Independent X/Y movement
 * - Dynamic resizing
 * - GPU-accelerated canvas rendering
 * - Fully configurable via props
 */

import React from 'react'

// Default configuration values
const DEFAULT_CHAR_WIDTH = 10
const DEFAULT_CHAR_HEIGHT = 14
const DEFAULT_CHARS = [
	'@',
	'0',
	'#',
	'2',
	'$',
	'*',
	'+',
	':',
	',',
	'.',
	' ',
	' ',
	' ',
	' ',
	' ',
	' ',
]
const DEFAULT_TIME_SCALE = 0.4
const DEFAULT_FPS_CAP = 24
const DEFAULT_COLOR = 'rgba(138, 230, 230, 1)' // retro_blue with full opacity for visibility
const DEFAULT_OCTAVES: OctaveConfig[] = [
	{
		scale: 0.02,
		amplitude: 1.0,
		timeScaleX: -1.0, // Move right
		timeScaleY: -0.5, // Move down
	},
	{
		scale: 0.04,
		amplitude: 1,
		timeScaleX: -0.5, // Move right
		timeScaleY: -0.3, // Move down
	},
]

// Character lookup will be computed per component instance based on props

interface Dimensions {
	width: number
	height: number
}

interface OctaveConfig {
	scale: number // Base frequency
	amplitude: number // Contribution strength
	timeScaleX: number // Horizontal movement speed
	timeScaleY: number // Vertical movement speed
}

export interface AsciiPerlinPlasmaProps {
	/** Width of each character in pixels */
	charWidth?: number
	/** Height of each character in pixels */
	charHeight?: number
	/** Array of characters to use for ASCII rendering */
	chars?: string[]
	/** Animation speed multiplier */
	timeScale?: number
	/** Maximum FPS to cap animation at */
	fpsCap?: number
	/** Text color (CSS color string). Default: 'rgba(138, 230, 230, 1)'. Accepts any valid CSS color (hex, rgb, rgba, hsl, named colors, etc.) */
	color?: string
	/** Noise octave configurations */
	octaves?: OctaveConfig[]
	/** Additional CSS class name */
	className?: string
	/** Vertical offset for scrolling (in pixels) */
	yOffset?: number
	/** Virtual height of the full scrollable content (in pixels) - for maintaining consistency across scroll */
	virtualHeight?: number
}

// Octave configurations will be computed per component instance based on props

// Utility functions for Perlin noise generation
function fade(t: number): number {
	// Smoothstep function for gradual transitions
	// 6t^5 - 15t^4 + 10t^3
	return t * t * t * (t * (t * 6 - 15) + 10)
}

// Pre-compute fade curve values (quintic)
const FADE_TABLE = new Float32Array(512)
for (let i = 0; i < 512; i++) {
	const t = i / 511
	FADE_TABLE[i] = t * t * t * (t * (t * 6 - 15) + 10)
}

// Optimized fade lookup
function fastFade(t: number): number {
	return FADE_TABLE[(t * 511) | 0]
}

// Improved gradient vectors (12 normalized directions)
const GRAD_VECTORS = new Float32Array([
	0.707, 0.707, -0.707, 0.707, 0.707, -0.707, -0.707, -0.707, 1, 0, -1, 0, 0, 1, 0, -1, 0.866, 0.5,
	-0.866, 0.5, 0.866, -0.5, -0.866, -0.5,
])

// Pre-computed gradients
const GRAD_TABLE = new Float32Array([
	0.707, 0.707, -0.707, 0.707, 0.707, -0.707, -0.707, -0.707, 1, 0, -1, 0, 0, 1, 0, -1,
])

// Optimized gradient function
function grad(hash: number, x: number, y: number): number {
	const h = (hash & 7) * 2 // Faster modulo with power of 2
	return GRAD_VECTORS[h] * x + GRAD_VECTORS[h + 1] * y
}

// Fast gradient function
function fastGrad(hash: number, x: number, y: number): number {
	const h = (hash & 7) << 1 // Multiply by 2 using shift
	return GRAD_TABLE[h] * x + GRAD_TABLE[h | 1] * y
}

// Faster hash function optimized for performance
function hash(x: number, y: number, seed: number): number {
	// Use a simpler, faster hash that's still good for noise
	let h = (x * 73856093) ^ (y * 19349663) ^ seed
	h = (h >>> 16) ^ h
	h *= 0x7feb352d
	h ^= h >>> 15
	h *= 0x846ca68b
	return h ^ (h >>> 16)
}

// Octave configurations are now computed per component instance based on props

export const AsciiPerlinPlasma: React.FC<AsciiPerlinPlasmaProps> = props => {
	// Extract props with defaults
	const {
		charWidth = DEFAULT_CHAR_WIDTH,
		charHeight = DEFAULT_CHAR_HEIGHT,
		chars = DEFAULT_CHARS,
		timeScale = DEFAULT_TIME_SCALE,
		fpsCap = DEFAULT_FPS_CAP,
		color = DEFAULT_COLOR,
		octaves = DEFAULT_OCTAVES,
		className,
		yOffset = 0,
		virtualHeight,
	} = props

	// Derived values
	const charCount = chars.length
	const fpsInterval = 1000 / fpsCap

	// Core rendering references
	const canvasRef = React.useRef<HTMLCanvasElement>(null)
	const dims = React.useRef<Dimensions>({ width: 0, height: 0 })
	const rafId = React.useRef<number>()
	const lastFrameTime = React.useRef(0)
	const yOffsetRef = React.useRef(yOffset)
	const virtualHeightRef = React.useRef(virtualHeight)

	// Permutation table for Perlin noise
	// Contains shuffled integers 0-255 for randomization
	const perm = React.useRef<Uint8Array>(new Uint8Array(256))

	// Pre-allocated buffers to avoid memory allocations per frame
	const rows = React.useRef<string[]>([])
	const rowBuffer = React.useRef<string[]>([])

	// Computed values based on props
	const charLookup = React.useRef<string[]>([])
	const octaveConfigs = React.useRef<
		Array<{
			scaleX: number
			scaleY: number
			timeScaleX: number
			timeScaleY: number
			amplitude: number
		}>
	>([])

	// Canvas rendering context
	const ctx = React.useRef<CanvasRenderingContext2D | null>(null)

	function noise2D(x: number, y: number): number {
		const X = Math.floor(x)
		const Y = Math.floor(y)

		x -= X
		y -= Y

		// Improved fade function (quintic)
		const u = fastFade(x)
		const v = fastFade(y)

		// Better hashing for grid coordinates
		const seed = perm.current[0]
		const A = Math.abs(hash(X, Y, seed)) % 256
		const B = Math.abs(hash(X + 1, Y, seed)) % 256
		const C = Math.abs(hash(X, Y + 1, seed)) % 256
		const D = Math.abs(hash(X + 1, Y + 1, seed)) % 256

		// Get gradients
		const g00 = fastGrad(perm.current[A], x, y)
		const g10 = fastGrad(perm.current[B], x - 1, y)
		const g01 = fastGrad(perm.current[C], x, y - 1)
		const g11 = fastGrad(perm.current[D], x - 1, y - 1)

		// Improved interpolation
		const a = g00 + u * (g10 - g00)
		const b = g01 + u * (g11 - g01)
		return a + v * (b - a)
	}

	function drawPlasma(time = 0) {
		const now = performance.now()
		// Check if enough time has elapsed since last frame
		if (now - lastFrameTime.current < fpsInterval) {
			rafId.current = requestAnimationFrame(() => drawPlasma(time))
			return
		}

		lastFrameTime.current = now

		const { width, height } = dims.current

		// Debug: Log current state
		if (time % 60 === 0) {
			// Log every ~1 second at 60fps
			console.log('[AsciiPerlinPlasma] Drawing frame:', {
				time,
				yOffset: yOffsetRef.current,
				virtualHeight: virtualHeightRef.current,
				yOffsetInChars: yOffsetRef.current / charHeight,
				canvasSize: { width, height },
			})
		}

		// Ensure buffers are the right size
		if (rows.current.length !== height) {
			rows.current.length = height
		}
		if (rowBuffer.current.length !== width) {
			rowBuffer.current.length = width
		}

		// Use pre-computed octave configurations for better performance
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				let value = 0

				// Combine multiple octaves of noise using pre-computed configs
				// Convert pixel offset to character coordinates for consistent noise sampling
				const currentCharHeight = charHeight // Use the charHeight from component props
				const yOffsetInChars = yOffsetRef.current / currentCharHeight
				const yPos = y + yOffsetInChars

				for (const octave of octaveConfigs.current) {
					value +=
						noise2D(
							(x + time * octave.timeScaleX) * octave.scaleX,
							(yPos + time * octave.timeScaleY) * octave.scaleY
						) * octave.amplitude
				}

				// Clamp value and map to character using pre-computed lookup
				const clampedValue = value < -1 ? -1 : value > 1 ? 1 : value
				const charIndex = ((clampedValue + 1) * 127.5) | 0 // Fast conversion to 0-255 range
				rowBuffer.current[x] = charLookup.current[charIndex]
			}
			rows.current[y] = rowBuffer.current.join('')
		}

		// Update display using canvas rendering
		if (ctx.current) {
			const canvas = ctx.current.canvas

			// Ensure fillStyle is set before drawing
			ctx.current.fillStyle = color

			// Clear canvas
			ctx.current.clearRect(0, 0, canvas.width, canvas.height)

			// Draw each character
			for (let y = 0; y < height; y++) {
				const row = rows.current[y]
				for (let x = 0; x < width; x++) {
					const char = row[x]
					ctx.current.fillText(char, x * charWidth, (y + 1) * charHeight)
				}
			}
		}
		rafId.current = requestAnimationFrame(() => drawPlasma(time + timeScale))
	}

	function handleResize() {
		if (!canvasRef.current) return
		const rect = canvasRef.current.getBoundingClientRect()
		const newDims = {
			width: Math.ceil(rect.width / charWidth),
			height: Math.ceil(rect.height / charHeight),
		}

		// Only update if dimensions actually changed
		if (newDims.width !== dims.current.width || newDims.height !== dims.current.height) {
			dims.current = newDims

			// Set canvas internal dimensions (not CSS dimensions)
			const canvas = canvasRef.current
			const devicePixelRatio = window.devicePixelRatio || 1

			// Set actual canvas size in pixels
			canvas.width = newDims.width * charWidth * devicePixelRatio
			canvas.height = newDims.height * charHeight * devicePixelRatio

			// Set CSS size for proper scaling
			canvas.style.width = `${newDims.width * charWidth}px`
			canvas.style.height = `${newDims.height * charHeight}px`

			// Scale context for crisp rendering and restore styles
			if (ctx.current) {
				ctx.current.scale(devicePixelRatio, devicePixelRatio)
				// Re-apply styles after canvas reset
				ctx.current.font = `${charHeight}px monospace`
				ctx.current.textBaseline = 'bottom'
				ctx.current.fillStyle = color
			}
		}
	}

	// Update yOffset and virtualHeight refs when props change
	React.useEffect(() => {
		console.log('[AsciiPerlinPlasma] Updating refs:', { yOffset, virtualHeight })
		yOffsetRef.current = yOffset
		virtualHeightRef.current = virtualHeight
	}, [yOffset, virtualHeight])

	React.useEffect(() => {
		// Initialize character lookup table based on chars prop
		charLookup.current = new Array(256)
		for (let i = 0; i < 256; i++) {
			const normalizedValue = i / 255
			charLookup.current[i] = chars[Math.floor(normalizedValue * (charCount - 0.001))]
		}

		// Initialize octave configurations based on octaves prop
		octaveConfigs.current = octaves.map(octave => ({
			scaleX: octave.scale,
			scaleY: octave.scale,
			timeScaleX: octave.timeScaleX,
			timeScaleY: octave.timeScaleY,
			amplitude: octave.amplitude,
		}))

		// Initialize canvas context
		if (canvasRef.current && !ctx.current) {
			ctx.current = canvasRef.current.getContext('2d')
			if (ctx.current) {
				// Set up canvas context for monospace text rendering
				ctx.current.font = `${charHeight}px monospace`
				ctx.current.textBaseline = 'bottom'
				ctx.current.fillStyle = color
			}
		}

		// Initialize permutation table
		for (let i = 0; i < 256; i++) perm.current[i] = i
		for (let i = 255; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1))
			;[perm.current[i], perm.current[j]] = [perm.current[j], perm.current[i]]
		}

		handleResize()

		// Use ResizeObserver to watch for container size changes
		const resizeObserver = new ResizeObserver(handleResize)
		if (canvasRef.current) {
			resizeObserver.observe(canvasRef.current)
		}

		drawPlasma()

		return () => {
			resizeObserver.disconnect()
			if (rafId.current) cancelAnimationFrame(rafId.current)
		}
	}, [charWidth, charHeight, chars, timeScale, fpsCap, color, octaves, yOffset])

	return (
		<canvas
			ref={canvasRef}
			className={className}
			style={{ display: 'block', width: '100%', height: '100%' }}
		/>
	)
}
