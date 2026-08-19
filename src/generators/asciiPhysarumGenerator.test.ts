import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	createAsciiPhysarumGenerator,
	generateAsciiPhysarumFrame,
} from './asciiPhysarumGenerator'
import { createAnsiPointerInput, type AnsiPointerInput } from './pointerInput'
import { charToCp437Byte, CP437_TO_UNICODE } from '../utils/cp437'

const COLUMNS = 40
const ROWS = 16

type Screen = ReturnType<typeof generateAsciiPhysarumFrame>

function screenText(screen: Screen): string {
	return screen.lines.map((line) => line.map((cell) => cell.ch).join('')).join('\n')
}

function screenSignature(screen: Screen): string {
	return screen.lines
		.map((line) => line.map((cell) => `${cell.ch}${cell.fg}`).join(','))
		.join('|')
}

describe('generateAsciiPhysarumFrame', () => {
	it('returns a full rectangular screen', () => {
		const screen = generateAsciiPhysarumFrame(5, COLUMNS, ROWS)
		assert.equal(screen.columns, COLUMNS)
		assert.equal(screen.lines.length, ROWS)
		for (const [index, line] of screen.lines.entries()) {
			assert.equal(line.length, COLUMNS, `row ${index} is ragged`)
			for (const cell of line) {
				assert.equal([...cell.ch].length, 1, `row ${index} has a non-single-character cell`)
			}
		}
	})

	it('is deterministic for the same (frame, dims, options)', () => {
		const options = { seed: 55, agentDensity: 0.4 }
		const a = generateAsciiPhysarumFrame(9, COLUMNS, ROWS, options)
		const b = generateAsciiPhysarumFrame(9, COLUMNS, ROWS, options)
		assert.deepEqual(a, b)
	})

	it('two fresh instances replaying the same frame sequence agree exactly', () => {
		const options = { seed: 77 }
		const a = createAsciiPhysarumGenerator(options)
		const b = createAsciiPhysarumGenerator(options)
		let lastA: Screen | null = null
		let lastB: Screen | null = null
		for (let frame = 0; frame <= 40; frame++) {
			lastA = a(frame, COLUMNS, ROWS) as Screen
			lastB = b(frame, COLUMNS, ROWS) as Screen
		}
		assert.deepEqual(lastA, lastB)
	})

	it('every emitted glyph is CP437-safe at 80x25', () => {
		const gen = createAsciiPhysarumGenerator({ seed: 12 })
		for (let frame = 0; frame <= 30; frame += 5) {
			const screen = gen(frame, 80, 25) as Screen
			for (const line of screen.lines) {
				for (const cell of line) {
					const byte = charToCp437Byte(cell.ch)
					assert.equal(
						CP437_TO_UNICODE[byte],
						cell.ch,
						`character ${JSON.stringify(cell.ch)} does not round-trip through CP437`,
					)
				}
			}
		}
	})

	it('degenerate options do not throw and still produce a full screen', () => {
		const degenerate = [
			{ seed: Number.NaN, agentDensity: Number.NaN, sensorAngle: Number.POSITIVE_INFINITY },
			{ sensorDistance: -5, turnSpeed: Number.NEGATIVE_INFINITY, moveSpeed: 0 },
			{ depositAmount: Number.NaN, evaporation: 5, stepsPerFrame: -3 },
			{ chars: '', palette: [] as string[] },
			{ agentDensity: 0 },
			{ agentDensity: 100 },
		]
		for (const options of degenerate) {
			const gen = createAsciiPhysarumGenerator(options)
			for (let frame = 0; frame <= 3; frame++) {
				const screen = gen(frame, COLUMNS, ROWS) as Screen
				assert.equal(screen.lines.length, ROWS)
				for (const line of screen.lines) {
					assert.equal(line.length, COLUMNS)
					for (const cell of line) {
						assert.equal([...cell.ch].length, 1)
					}
				}
			}
		}
		// Tiny grids must also survive.
		const tiny = createAsciiPhysarumGenerator({})
		for (let frame = 0; frame <= 3; frame++) {
			const screen = tiny(frame, 2, 2) as Screen
			assert.equal(screen.lines.length, 2)
		}
	})

	it('instance isolation: a rewind on one instance leaves another unaffected', () => {
		const a = createAsciiPhysarumGenerator({ seed: 1 })
		const b = createAsciiPhysarumGenerator({ seed: 2 })

		// Interleave calls, including a rewind on `a`, and confirm `a` replays identically.
		for (let frame = 0; frame <= 5; frame++) a(frame, COLUMNS, ROWS)
		const aExpected = screenSignature(a(6, COLUMNS, ROWS) as Screen)

		for (let frame = 0; frame <= 5; frame++) {
			b(frame, COLUMNS, ROWS)
			a(0, COLUMNS, ROWS) // rewind `a`'s own timeline, interleaved with `b`
		}
		for (let frame = 1; frame <= 6; frame++) a(frame, COLUMNS, ROWS)
		const aActual = screenSignature(a(6, COLUMNS, ROWS) as Screen)
		assert.equal(aActual, aExpected)

		// Two fresh same-seed instances agree with each other.
		const c = createAsciiPhysarumGenerator({ seed: 9 })
		const d = createAsciiPhysarumGenerator({ seed: 9 })
		for (let frame = 0; frame <= 4; frame++) {
			c(frame, COLUMNS, ROWS)
			d(frame, COLUMNS, ROWS)
		}
		assert.equal(
			screenSignature(c(5, COLUMNS, ROWS) as Screen),
			screenSignature(d(5, COLUMNS, ROWS) as Screen),
		)

		// Different seeds produce different output.
		assert.notEqual(
			screenSignature(c(5, COLUMNS, ROWS) as Screen),
			screenSignature(b(5, COLUMNS, ROWS) as Screen),
		)
	})

	it('self-organizes into a live filament network at 80x25', () => {
		const gen = createAsciiPhysarumGenerator({})
		const columns = 80
		const rows = 25
		const total = columns * rows

		let previous = ''
		let current = ''
		for (let frame = 0; frame <= 150; frame++) {
			previous = current
			current = screenText(gen(frame, columns, rows) as Screen)
		}

		// Neither empty nor saturated: the trail render must resolve structure.
		const nonSpace = [...current].filter((c) => c !== ' ' && c !== '\n').length
		const nonSpaceFraction = nonSpace / total
		assert.ok(
			nonSpaceFraction > 0.05 && nonSpaceFraction < 0.85,
			`non-space fraction ${(nonSpaceFraction * 100).toFixed(1)}% is outside (5%, 85%) — ` +
				'the field is either dead or uniform fog',
		)

		// The network must keep changing frame to frame.
		let changed = 0
		for (let i = 0; i < current.length; i++) if (current[i] !== previous[i]) changed++
		assert.ok(
			changed / total > 0.01,
			`only ${((changed / total) * 100).toFixed(2)}% of cells changed between consecutive frames`,
		)
	})

	describe('pointer interactivity', () => {
		it('inactive invariance: no pointer, a never-activated pointer, and a left pointer all render identically', () => {
			const noPointer = createAsciiPhysarumGenerator({ seed: 31 })
			const neverActive = createAsciiPhysarumGenerator({ seed: 31, pointer: createAnsiPointerInput() })
			const leftPointer = createAnsiPointerInput()
			leftPointer.move(20, 8)
			leftPointer.leave() // position retained, active: false
			const left = createAsciiPhysarumGenerator({ seed: 31, pointer: leftPointer })

			for (let frame = 0; frame < 12; frame++) {
				const base = noPointer(frame, COLUMNS, ROWS) as Screen
				assert.deepEqual(neverActive(frame, COLUMNS, ROWS), base, `never-activated pointer diverged at frame ${frame}`)
				assert.deepEqual(left(frame, COLUMNS, ROWS), base, `inactive (left) pointer diverged at frame ${frame}`)
			}
		})

		it('replaying the same scripted pointer sequence on two fresh instances agrees exactly', () => {
			function scriptedRun(): Screen[] {
				const pointer = createAnsiPointerInput()
				const gen = createAsciiPhysarumGenerator({ seed: 41, pointer })
				const screens: Screen[] = []
				for (let frame = 0; frame < 40; frame++) {
					// Deterministic script: enter, drag, press (doubles the deposit), drag
					// off-grid mid-press, release, leave.
					if (frame === 4) pointer.move(8.3, 4.6)
					if (frame === 11) pointer.move(31, 12)
					if (frame === 17) pointer.down()
					if (frame === 23) pointer.move(-15, 60)
					if (frame === 29) pointer.up(25, 3)
					if (frame === 34) pointer.leave()
					screens.push(gen(frame, COLUMNS, ROWS) as Screen)
				}
				return screens
			}
			assert.deepEqual(scriptedRun(), scriptedRun())
		})

		it('far-out-of-grid and non-finite pointer positions never throw', () => {
			const farPointer = createAnsiPointerInput()
			farPointer.down(1e9, -1e9)
			const far = createAsciiPhysarumGenerator({ seed: 51, pointer: farPointer })
			for (let frame = 0; frame < 5; frame++) {
				const screen = far(frame, COLUMNS, ROWS) as Screen
				assert.equal(screen.lines.length, ROWS)
				for (const line of screen.lines) assert.equal(line.length, COLUMNS)
			}

			// A hand-rolled channel can hold non-finite coordinates (createAnsiPointerInput
			// filters them, but the option accepts any AnsiPointerInput implementation).
			const hostile: AnsiPointerInput = {
				state: { x: Number.NaN, y: Number.NEGATIVE_INFINITY, active: true, pressed: true },
				move() {},
				down() {},
				up() {},
				leave() {},
				reset() {},
			}
			const gen = createAsciiPhysarumGenerator({ seed: 51, pointer: hostile })
			for (let frame = 0; frame < 5; frame++) {
				const screen = gen(frame, COLUMNS, ROWS) as Screen
				assert.equal(screen.lines.length, ROWS)
			}
		})

		it('the swarm converges on an active pointer: the trail window around it outshines the inactive run', () => {
			// 7x5 cell window centered on the pointer cell (60, 6) at 80x25. Brightness is
			// the mean char-ramp index (0 = ' ' ... 6 = '█' in the default ramp), averaged
			// over frames 80-99 to smooth out the network's normal rewiring flicker.
			// Measured with this exact deterministic setup (default options, seed 1337):
			//   inactive mean = 1.75, active mean = 2.96.
			// The 0.7 margin below is comfortably inside that gap but still fails if the
			// pointer deposit is disconnected or stops feeding the evaporation/diffusion loop.
			const columns = 80
			const rows = 25
			const px = 60
			const py = 6
			const ramp = ' ·:░▒▓█'

			function windowBrightness(screen: Screen): number {
				let sum = 0
				let n = 0
				for (let r = py - 2; r <= py + 2; r++) {
					for (let c = px - 3; c <= px + 3; c++) {
						sum += Math.max(0, ramp.indexOf(screen.lines[r][c].ch))
						n++
					}
				}
				return sum / n
			}

			function run(active: boolean): number {
				const pointer = createAnsiPointerInput()
				const gen = createAsciiPhysarumGenerator({ seed: 1337, pointer })
				if (active) pointer.move(px + 0.5, py + 0.5)
				let sum = 0
				for (let frame = 0; frame < 100; frame++) {
					const screen = gen(frame, columns, rows) as Screen
					if (frame >= 80) sum += windowBrightness(screen)
				}
				return sum / 20
			}

			const inactiveMean = run(false)
			const activeMean = run(true)
			assert.ok(
				activeMean > inactiveMean + 0.7,
				`expected the pointer window to be clearly brighter: active=${activeMean.toFixed(2)} inactive=${inactiveMean.toFixed(2)}`,
			)
		})
	})

	it('a large frame jump stays cheap (catch-up is capped)', () => {
		const gen = createAsciiPhysarumGenerator({ seed: 7 })
		gen(0, 80, 25)
		const started = process.hrtime.bigint()
		gen(100_000, 80, 25)
		const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6
		assert.ok(elapsedMs < 250, `took ${elapsedMs.toFixed(0)}ms for a 100k-frame jump`)
	})
})
