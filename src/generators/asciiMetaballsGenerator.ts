import type { AnsiScreen } from '../ansi/types'
import { buildCharLookup } from './charLookup'
import type { AnsiPointerInput } from './pointerInput'

export interface AsciiMetaballsOptions {
	/** Random seed. Default: 1337 */
	seed?: number
	/** Foreground color (CSS). Default: '#55FFFF' */
	fgColor?: string
	/** Background color (CSS). Default: '#000000' */
	bgColor?: string
	/** Characters to use for shading (dark -> bright). Default: ' .,:;+=xX$&#@' */
	chars?: string[]
	/** Number of metaballs. Default: 6 */
	balls?: number
	/** Animation speed multiplier (frame -> time). Default: 0.085 */
	speed?: number
	/** Minimum metaball radius (cells). Default: 2.5 */
	radiusMin?: number
	/** Maximum metaball radius (cells). Default: 9.5 */
	radiusMax?: number
	/** Normalization intensity (k) used in `1 - exp(-k * F)`. Default: 0.55 */
	intensity?: number
	/** Vertical aspect scale (text cells are taller than wide). Default: 2 */
	aspectY?: number
	/**
	 * Pointer input channel from the host display; sampled via `pointer.state`.
	 * While the pointer is active, one extra metaball rides the cursor. Absent or
	 * inactive, the field is exactly the original ball set.
	 */
	pointer?: AnsiPointerInput
	/** Radius (cells) of the pointer-riding metaball. Default: 6 (midpoint of radiusMin/radiusMax defaults) */
	pointerRadius?: number
}

// Everything except the pointer channel resolves to a concrete value; the pointer stays
// optional and is read separately, keeping the generator itself stateless.
type ResolvedMetaballsOptions = Required<Omit<AsciiMetaballsOptions, 'pointer'>>

const DEFAULTS: Required<
	Pick<
		AsciiMetaballsOptions,
		| 'seed'
		| 'fgColor'
		| 'bgColor'
		| 'balls'
		| 'speed'
		| 'radiusMin'
		| 'radiusMax'
		| 'intensity'
		| 'aspectY'
		| 'pointerRadius'
	>
> & { chars: string[] } = {
	seed: 1337,
	fgColor: '#55FFFF',
	bgColor: '#000000',
	chars: Array.from(' .,:;+=xX$&#@'),
	balls: 6,
	speed: 0.085,
	radiusMin: 2.5,
	radiusMax: 9.5,
	intensity: 0.55,
	aspectY: 2,
	pointerRadius: 6,
}


function clampInt(v: number, min: number, max: number): number {
	if (!Number.isFinite(v)) return min
	const n = Math.floor(v)
	return n < min ? min : n > max ? max : n
}

function hash32(x: number): number {
	// xorshift-ish hash
	let h = x >>> 0
	h ^= h >>> 16
	h = Math.imul(h, 0x7feb352d)
	h ^= h >>> 15
	h = Math.imul(h, 0x846ca68b)
	h ^= h >>> 16
	return h >>> 0
}

function rand01(seed: number, salt: number): number {
	return hash32(seed ^ salt) / 0xffffffff
}

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t
}

type BallParams = {
	baseX: number
	baseY: number
	orbitX: number
	orbitY: number
	phase: number
	freq: number
	radius: number
}

function buildBalls(
	columns: number,
	rows: number,
	options: ResolvedMetaballsOptions
): BallParams[] {
	const n = clampInt(options.balls, 1, 48)
	const balls: BallParams[] = new Array(n)
	const seed = options.seed

	for (let i = 0; i < n; i++) {
		const s = i * 9973
		const baseX = rand01(seed, s + 11) * (columns - 1)
		const baseY = rand01(seed, s + 23) * (rows - 1)
		const orbitX = lerp(columns * 0.06, columns * 0.35, rand01(seed, s + 31))
		const orbitY = lerp(rows * 0.06, rows * 0.35, rand01(seed, s + 37))
		const phase = rand01(seed, s + 41) * Math.PI * 2
		const freq = lerp(0.6, 1.8, rand01(seed, s + 53))
		const radius = lerp(options.radiusMin, options.radiusMax, rand01(seed, s + 59))

		balls[i] = { baseX, baseY, orbitX, orbitY, phase, freq, radius }
	}

	return balls
}

// Cache for buildBalls results to avoid per-frame allocation
let lastBallsCacheKey = ''
let lastBallsResult: BallParams[] | null = null

function getCachedBalls(columns: number, rows: number, opts: ResolvedMetaballsOptions): BallParams[] {
	const key = `${columns}:${rows}:${opts.seed}:${opts.balls}:${opts.radiusMin}:${opts.radiusMax}`
	if (key === lastBallsCacheKey && lastBallsResult) return lastBallsResult
	lastBallsResult = buildBalls(columns, rows, opts)
	lastBallsCacheKey = key
	return lastBallsResult
}

function resolveOptions(options: AsciiMetaballsOptions): ResolvedMetaballsOptions {
	return {
		seed: Number.isFinite(options.seed as number) ? (options.seed as number) : DEFAULTS.seed,
		fgColor: (options.fgColor ?? DEFAULTS.fgColor).toString(),
		bgColor: (options.bgColor ?? DEFAULTS.bgColor).toString(),
		chars: options.chars?.length ? options.chars : DEFAULTS.chars,
		balls: clampInt(options.balls ?? DEFAULTS.balls, 1, 48),
		speed: Number.isFinite(options.speed as number) ? (options.speed as number) : DEFAULTS.speed,
		radiusMin: Number.isFinite(options.radiusMin as number)
			? (options.radiusMin as number)
			: DEFAULTS.radiusMin,
		radiusMax: Number.isFinite(options.radiusMax as number)
			? (options.radiusMax as number)
			: DEFAULTS.radiusMax,
		intensity: Number.isFinite(options.intensity as number)
			? (options.intensity as number)
			: DEFAULTS.intensity,
		aspectY: Number.isFinite(options.aspectY as number)
			? (options.aspectY as number)
			: DEFAULTS.aspectY,
		pointerRadius: Number.isFinite(options.pointerRadius as number)
			? (options.pointerRadius as number)
			: DEFAULTS.pointerRadius,
	}
}

type BallFrameState = {
	bx: number
	by: number
	radius2: number
}

// Reused per-frame ball position buffer — avoids recomputing cos/sin per cell.
// bx/by/radius2 are invariant across all cells in a frame (depend only on
// ball params + time), so they're hoisted here once per frame instead of
// being recomputed inside the per-cell hot loop.
let ballFrameBuf: BallFrameState[] = []

function computeBallFrame(balls: BallParams[], time: number): BallFrameState[] {
	if (ballFrameBuf.length !== balls.length) {
		ballFrameBuf = new Array(balls.length)
		for (let i = 0; i < balls.length; i++) {
			ballFrameBuf[i] = { bx: 0, by: 0, radius2: 0 }
		}
	}
	for (let i = 0; i < balls.length; i++) {
		const b = balls[i]
		const state = ballFrameBuf[i]
		state.bx = b.baseX + Math.cos(time * b.freq + b.phase) * b.orbitX
		state.by = b.baseY + Math.sin(time * (b.freq * 0.9) + b.phase) * b.orbitY
		state.radius2 = b.radius * b.radius
	}
	return ballFrameBuf
}

// Preallocated scratch for the pointer-riding extra ball. The slot object and the
// extended array are module-level and reused every frame (rebuilt only when the ball
// count changes), so an active pointer adds zero per-frame allocation — mirroring how
// ballFrameBuf is reused. Like ballFrameBuf, the extended array is only valid until the
// next generate call, which is fine: it is consumed within the same call.
const pointerBallSlot: BallFrameState = { bx: 0, by: 0, radius2: 0 }
let pointerFrameBuf: BallFrameState[] = []

function withPointerBall(
	ballFrame: BallFrameState[],
	px: number,
	py: number,
	radius: number
): BallFrameState[] {
	if (pointerFrameBuf.length !== ballFrame.length + 1) {
		pointerFrameBuf = new Array<BallFrameState>(ballFrame.length + 1)
	}
	for (let i = 0; i < ballFrame.length; i++) pointerFrameBuf[i] = ballFrame[i]
	// Pointer coords are fractional cells, the same space ball centers live in; computeCell
	// applies the aspectY vertical correction to dy uniformly for every ball, pointer ball
	// included. No clamping: an off-grid pointer just puts the ball off-screen, where the
	// 1/d^2 field falls off naturally (a drag past the edge fades out instead of pinning).
	pointerBallSlot.bx = px
	pointerBallSlot.by = py
	pointerBallSlot.radius2 = radius * radius
	pointerFrameBuf[ballFrame.length] = pointerBallSlot
	return pointerFrameBuf
}

// Memoized char lookup — rebuilt only when the chars array reference changes.
let lastChars: string[] | null = null
let lastCharLookup: string[] | null = null

function getCharLookup(chars: string[]): string[] {
	if (lastChars === chars && lastCharLookup) return lastCharLookup
	lastCharLookup = buildCharLookup(chars)
	lastChars = chars
	return lastCharLookup
}

function computeCell(
	x: number,
	y: number,
	options: ResolvedMetaballsOptions,
	ballFrame: BallFrameState[],
	charLookup: string[]
) {
	const aspectY = options.aspectY > 0 ? options.aspectY : DEFAULTS.aspectY

	let field = 0
	const eps = 0.65

	for (let i = 0; i < ballFrame.length; i++) {
		const s = ballFrame[i]

		const dx = x - s.bx
		const dy = (y - s.by) * aspectY
		const d2 = dx * dx + dy * dy + eps
		field += s.radius2 / d2
	}

	const k = options.intensity >= 0 ? options.intensity : DEFAULTS.intensity
	const v01 = 1 - Math.exp(-k * field)
	const idx = clampInt(v01 * 255, 0, 255)

	const ch = charLookup[idx]
	const fg = options.fgColor

	// When the field is tiny, prefer a blank (helps contrast).
	// Still keep fg valid for stable glyph caching.
	if (idx < 10) {
		return { ch: ' ', fg, bg: options.bgColor, bold: false }
	}

	return { ch, fg, bg: options.bgColor, bold: false }
}

export function generateAsciiMetaballsFrame(
	frame: number,
	columns: number,
	rows: number,
	options: AsciiMetaballsOptions = {}
): AnsiScreen {
	const opts = resolveOptions(options)
	const time = frame * opts.speed

	const balls = getCachedBalls(columns, rows, opts)
	let ballFrame = computeBallFrame(balls, time)

	// Sample the pointer channel once per generate call. The generator stays stateless:
	// the pointer ball is a pure function of the sampled state, evaluated alongside the
	// seeded balls for this frame only. Inactive or absent, the field is exactly the
	// original ball set (this branch is the whole cost).
	const pointerState = options.pointer ? options.pointer.state : undefined
	if (
		pointerState &&
		pointerState.active &&
		Number.isFinite(pointerState.x) &&
		Number.isFinite(pointerState.y)
	) {
		ballFrame = withPointerBall(ballFrame, pointerState.x, pointerState.y, opts.pointerRadius)
	}

	// Character lookup table (0..255), memoized across frames
	const chars = opts.chars.length ? opts.chars : DEFAULTS.chars
	const charLookup = getCharLookup(chars)

	const lines: AnsiScreen['lines'] = []
	for (let y = 0; y < rows; y++) {
		const line: AnsiScreen['lines'][number] = []
		for (let x = 0; x < columns; x++) {
			line.push(computeCell(x, y, opts, ballFrame, charLookup))
		}
		lines.push(line)
	}

	return { lines, columns }
}

export function createAsciiMetaballsSampler(frame: number, options: AsciiMetaballsOptions = {}) {
	const opts = resolveOptions(options)
	const time = frame * opts.speed

	// Use a default virtual size for ball parameterization in sampler mode.
	// Callers can pass different columns/rows by just sampling different coords.
	const virtualColumns = 200
	const virtualRows = 120
	const balls = buildBalls(virtualColumns, virtualRows, opts)
	const ballFrame = computeBallFrame(balls, time)

	const chars = opts.chars.length ? opts.chars : DEFAULTS.chars
	const charLookup = getCharLookup(chars)

	return (x: number, y: number) => {
		return computeCell(x, y, opts, ballFrame, charLookup)
	}
}



