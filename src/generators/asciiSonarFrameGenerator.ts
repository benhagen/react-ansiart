import type { AnsiScreen } from '../ansi/types'

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
// Use numeric comparison instead of string key allocation
let lastDistFieldKey: { columns: number; rows: number; centerX: number; centerY: number; aspectY: number } | null = null
let lastDistField: Float32Array | null = null

function getDistanceField(
	columns: number,
	rows: number,
	centerX: number,
	centerY: number,
	aspectY: number
): Float32Array {
	// Fast numeric comparison instead of string key construction
	if (
		lastDistFieldKey &&
		lastDistFieldKey.columns === columns &&
		lastDistFieldKey.rows === rows &&
		Math.abs(lastDistFieldKey.centerX - centerX) < 0.001 &&
		Math.abs(lastDistFieldKey.centerY - centerY) < 0.001 &&
		Math.abs(lastDistFieldKey.aspectY - aspectY) < 0.001 &&
		lastDistField
	) {
		return lastDistField
	}

	const field = new Float32Array(columns * rows)
	let i = 0
	for (let y = 0; y < rows; y++) {
		const dy = (y - centerY) * aspectY
		for (let x = 0; x < columns; x++) {
			const dx = x - centerX
			field[i++] = Math.sqrt(dx * dx + dy * dy)
		}
	}
	lastDistFieldKey = { columns, rows, centerX, centerY, aspectY }
	lastDistField = field
	return field
}

function resolveAndValidate(options: AsciiSonarOptions) {
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

	return {
		fgColor,
		bgColor,
		dotChar,
		aspectY,
		safeFps: fps > 0 ? fps : DEFAULTS.fps,
		safeFrequency: frequency > 0 ? frequency : DEFAULTS.frequency,
		safeSpeed: speed > 0 ? speed : DEFAULTS.speed,
		safeBandWidth: bandWidth > 0 ? bandWidth : DEFAULTS.bandWidth,
		safeDecay: decay >= 0 ? decay : DEFAULTS.decay,
		safeIntensity: Math.max(0, intensity),
		safeBaseAlpha: clamp01(baseAlpha),
		steps: Math.max(2, Math.floor(alphaSteps)),
		ringCap: Math.max(1, Math.floor(maxRings)),
	}
}

function computeRings(tSeconds: number, params: ReturnType<typeof resolveAndValidate>) {
	const period = 1 / params.safeFrequency
	const kMax = Math.floor(tSeconds / period)

	const rings: Array<{ radius: number; amp: number }> = []
	for (let k = kMax; k >= 0 && rings.length < params.ringCap; k--) {
		const age = tSeconds - k * period
		if (age < 0) continue
		const radius = age * params.safeSpeed
		const amp = Math.exp(-age * params.safeDecay)
		rings.push({ radius, amp })
	}
	return rings
}

export function generateAsciiSonarFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiSonarOptions = {}
): AnsiScreen {
	const params = resolveAndValidate(options)
	const { fgColor, bgColor, dotChar, aspectY, safeFps, safeIntensity, safeBaseAlpha, steps, safeBandWidth } = params

	const centerX = options.centerX ?? (columns - 1) / 2
	const centerY = options.centerY ?? (rows - 1) / 2

	const rgb = parseColorToRgb(fgColor, { r: 255, g: 255, b: 255 })
	const rgbaTable = makeRgbaTable(rgb, steps)

	const tSeconds = frame / safeFps
	const rings = computeRings(tSeconds, params)
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
	const params = resolveAndValidate(options)
	const { fgColor, bgColor, dotChar, aspectY, safeFps, safeIntensity, safeBaseAlpha, steps, safeBandWidth } = params

	const centerX = options.centerX ?? 0
	const centerY = options.centerY ?? 0

	const rgb = parseColorToRgb(fgColor, { r: 255, g: 255, b: 255 })
	const rgbaTable = makeRgbaTable(rgb, steps)

	const tSeconds = frame / safeFps
	const rings = computeRings(tSeconds, params)
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
