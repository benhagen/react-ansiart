import type { AnsiScreen } from '../ansi/parser'

export interface AsciiSonarOptions {
	/** Pulses per second. Default: 0.9 */
	frequency?: number
	/** Overall ripple strength. Default: 1.0 */
	intensity?: number
	/** Frames per second used to convert frame->seconds. Default: 30 */
	fps?: number
	/** Foreground base color (RGB); alpha is applied per-cell. Default: '#ffffff' */
	fgColor?: string
	/** Background color for all cells. Default: '#000000' */
	bgColor?: string
	/** Dot character to draw everywhere. Default: '.' */
	dotChar?: string
	/** Ring expansion speed in character-cells per second. Default: 14 */
	speed?: number
	/** Ring band width in character-cells (gaussian sigma-ish). Default: 1.25 */
	bandWidth?: number
	/** Exponential decay per second applied to older rings. Default: 0.75 */
	decay?: number
	/** Minimum alpha added everywhere (ambient). Default: 0.03 */
	baseAlpha?: number
	/** Quantize alpha into N steps to avoid exploding glyph cache. Default: 32 */
	alphaSteps?: number
	/** Center X in cell coordinates (0..columns-1). Default: (columns-1)/2 */
	centerX?: number
	/** Center Y in cell coordinates (0..rows-1). Default: (rows-1)/2 */
	centerY?: number
	/** Vertical aspect scale (text cells are taller than wide). Default: 2 */
	aspectY?: number
	/** Maximum number of active rings to sum (performance cap). Default: 24 */
	maxRings?: number
}

const DEFAULTS: Required<
	Pick<
		AsciiSonarOptions,
		| 'frequency'
		| 'intensity'
		| 'fps'
		| 'fgColor'
		| 'bgColor'
		| 'dotChar'
		| 'speed'
		| 'bandWidth'
		| 'decay'
		| 'baseAlpha'
		| 'alphaSteps'
		| 'aspectY'
		| 'maxRings'
	>
> = {
	frequency: 0.9,
	intensity: 1.0,
	fps: 30,
	fgColor: '#ffffff',
	bgColor: '#000000',
	dotChar: '.',
	speed: 14,
	bandWidth: 1.25,
	decay: 0.75,
	baseAlpha: 0.03,
	alphaSteps: 32,
	aspectY: 2,
	maxRings: 24,
}

function clamp(v: number, min: number, max: number): number {
	return v < min ? min : v > max ? max : v
}

function clamp01(v: number): number {
	return clamp(v, 0, 1)
}

type RGB = { r: number; g: number; b: number }

function parseColorToRgb(color: string, fallback: RGB): RGB {
	const c = color.trim().toLowerCase()

	// #rgb / #rrggbb
	if (c.startsWith('#')) {
		const hex = c.slice(1)
		if (hex.length === 3) {
			const r = parseInt(hex[0] + hex[0], 16)
			const g = parseInt(hex[1] + hex[1], 16)
			const b = parseInt(hex[2] + hex[2], 16)
			if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return { r, g, b }
		}
		if (hex.length === 6) {
			const r = parseInt(hex.slice(0, 2), 16)
			const g = parseInt(hex.slice(2, 4), 16)
			const b = parseInt(hex.slice(4, 6), 16)
			if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return { r, g, b }
		}
		return fallback
	}

	// rgb(...) / rgba(...)
	const m = c.match(/^rgba?\((.*)\)$/)
	if (m) {
		const parts = m[1]
			.split(',')
			.map(s => s.trim())
			.filter(Boolean)
		if (parts.length >= 3) {
			const r = Number(parts[0])
			const g = Number(parts[1])
			const b = Number(parts[2])
			if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
				return {
					r: clamp(Math.round(r), 0, 255),
					g: clamp(Math.round(g), 0, 255),
					b: clamp(Math.round(b), 0, 255),
				}
			}
		}
		return fallback
	}

	return fallback
}

function makeRgbaTable(rgb: RGB, steps: number): string[] {
	const s = Math.max(2, Math.floor(steps))
	const table = new Array(s)
	for (let i = 0; i < s; i++) {
		const a = i / (s - 1)
		table[i] = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a.toFixed(3)})`
	}
	return table
}

function gaussianBand(distMinusRadius: number, invSigma: number): number {
	// exp(-((d)/sigma)^2)
	const t = distMinusRadius * invSigma
	return Math.exp(-(t * t))
}

// Cache distance fields to avoid per-frame sqrt cost
const distanceFieldCache = new Map<string, Float32Array>()

function getDistanceField(
	columns: number,
	rows: number,
	centerX: number,
	centerY: number,
	aspectY: number
): Float32Array {
	const key = `${columns}:${rows}:${centerX.toFixed(3)}:${centerY.toFixed(3)}:${aspectY.toFixed(3)}`
	const existing = distanceFieldCache.get(key)
	if (existing) return existing

	const field = new Float32Array(columns * rows)
	let i = 0
	for (let y = 0; y < rows; y++) {
		const dy = (y - centerY) * aspectY
		for (let x = 0; x < columns; x++) {
			const dx = x - centerX
			field[i++] = Math.sqrt(dx * dx + dy * dy)
		}
	}
	distanceFieldCache.set(key, field)
	return field
}

export function generateAsciiSonarFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiSonarOptions = {}
): AnsiScreen {
	const frequency = options.frequency ?? DEFAULTS.frequency
	const intensity = options.intensity ?? DEFAULTS.intensity
	const fps = options.fps ?? DEFAULTS.fps
	const fgColor = options.fgColor ?? DEFAULTS.fgColor
	const bgColor = options.bgColor ?? DEFAULTS.bgColor
	const dotChar = options.dotChar ?? DEFAULTS.dotChar
	const speed = options.speed ?? DEFAULTS.speed
	const bandWidth = options.bandWidth ?? DEFAULTS.bandWidth
	const decay = options.decay ?? DEFAULTS.decay
	const baseAlpha = options.baseAlpha ?? DEFAULTS.baseAlpha
	const alphaSteps = options.alphaSteps ?? DEFAULTS.alphaSteps
	const aspectY = options.aspectY ?? DEFAULTS.aspectY
	const maxRings = options.maxRings ?? DEFAULTS.maxRings

	const safeFps = fps > 0 ? fps : DEFAULTS.fps
	const safeFrequency = frequency > 0 ? frequency : DEFAULTS.frequency
	const safeSpeed = speed > 0 ? speed : DEFAULTS.speed
	const safeBandWidth = bandWidth > 0 ? bandWidth : DEFAULTS.bandWidth
	const safeDecay = decay >= 0 ? decay : DEFAULTS.decay
	const safeIntensity = Math.max(0, intensity)
	const safeBaseAlpha = clamp01(baseAlpha)
	const steps = Math.max(2, Math.floor(alphaSteps))
	const ringCap = Math.max(1, Math.floor(maxRings))

	const centerX = options.centerX ?? (columns - 1) / 2
	const centerY = options.centerY ?? (rows - 1) / 2

	const rgb = parseColorToRgb(fgColor, { r: 255, g: 255, b: 255 })
	const rgbaTable = makeRgbaTable(rgb, steps)

	const tSeconds = frame / safeFps
	const period = 1 / safeFrequency
	const kMax = Math.floor(tSeconds / period)

	// Precompute active rings (newest first)
	// Each ring: radius, amplitude
	const rings: Array<{ radius: number; amp: number }> = []
	for (let k = kMax; k >= 0 && rings.length < ringCap; k--) {
		const age = tSeconds - k * period
		if (age < 0) continue
		const radius = age * safeSpeed
		const amp = Math.exp(-age * safeDecay)
		rings.push({ radius, amp })
	}

	const invSigma = 1 / safeBandWidth
	const distField = getDistanceField(columns, rows, centerX, centerY, aspectY)

	const lines: AnsiScreen['lines'] = []
	let idx = 0

	for (let y = 0; y < rows; y++) {
		const line: AnsiScreen['lines'][number] = []
		for (let x = 0; x < columns; x++) {
			const dist = distField[idx++]

			let sum = 0
			for (let r = 0; r < rings.length; r++) {
				const ring = rings[r]
				sum += gaussianBand(dist - ring.radius, invSigma) * ring.amp
			}

			const alpha = clamp01(safeBaseAlpha + safeIntensity * sum)
			const aIndex = Math.max(0, Math.min(steps - 1, Math.round(alpha * (steps - 1))))
			line.push({ ch: dotChar, fg: rgbaTable[aIndex], bg: bgColor, bold: false })
		}
		lines.push(line)
	}

	return { lines, columns }
}

export function createAsciiSonarSampler(frame: number, options: AsciiSonarOptions = {}) {
	const frequency = options.frequency ?? DEFAULTS.frequency
	const intensity = options.intensity ?? DEFAULTS.intensity
	const fps = options.fps ?? DEFAULTS.fps
	const fgColor = options.fgColor ?? DEFAULTS.fgColor
	const bgColor = options.bgColor ?? DEFAULTS.bgColor
	const dotChar = options.dotChar ?? DEFAULTS.dotChar
	const speed = options.speed ?? DEFAULTS.speed
	const bandWidth = options.bandWidth ?? DEFAULTS.bandWidth
	const decay = options.decay ?? DEFAULTS.decay
	const baseAlpha = options.baseAlpha ?? DEFAULTS.baseAlpha
	const alphaSteps = options.alphaSteps ?? DEFAULTS.alphaSteps
	const aspectY = options.aspectY ?? DEFAULTS.aspectY
	const maxRings = options.maxRings ?? DEFAULTS.maxRings

	const safeFps = fps > 0 ? fps : DEFAULTS.fps
	const safeFrequency = frequency > 0 ? frequency : DEFAULTS.frequency
	const safeSpeed = speed > 0 ? speed : DEFAULTS.speed
	const safeBandWidth = bandWidth > 0 ? bandWidth : DEFAULTS.bandWidth
	const safeDecay = decay >= 0 ? decay : DEFAULTS.decay
	const safeIntensity = Math.max(0, intensity)
	const safeBaseAlpha = clamp01(baseAlpha)
	const steps = Math.max(2, Math.floor(alphaSteps))
	const ringCap = Math.max(1, Math.floor(maxRings))

	const centerX = options.centerX ?? 0
	const centerY = options.centerY ?? 0

	const rgb = parseColorToRgb(fgColor, { r: 255, g: 255, b: 255 })
	const rgbaTable = makeRgbaTable(rgb, steps)

	const tSeconds = frame / safeFps
	const period = 1 / safeFrequency
	const kMax = Math.floor(tSeconds / period)

	const rings: Array<{ radius: number; amp: number }> = []
	for (let k = kMax; k >= 0 && rings.length < ringCap; k--) {
		const age = tSeconds - k * period
		if (age < 0) continue
		const radius = age * safeSpeed
		const amp = Math.exp(-age * safeDecay)
		rings.push({ radius, amp })
	}

	const invSigma = 1 / safeBandWidth

	return (x: number, y: number) => {
		const dx = x - centerX
		const dy = (y - centerY) * aspectY
		const dist = Math.sqrt(dx * dx + dy * dy)

		let sum = 0
		for (let r = 0; r < rings.length; r++) {
			const ring = rings[r]
			sum += gaussianBand(dist - ring.radius, invSigma) * ring.amp
		}

		const alpha = clamp01(safeBaseAlpha + safeIntensity * sum)
		const aIndex = Math.max(0, Math.min(steps - 1, Math.round(alpha * (steps - 1))))
		return { ch: dotChar, fg: rgbaTable[aIndex], bg: bgColor, bold: false }
	}
}
