import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { generateAsciiMetaballsFrame } from './asciiMetaballsGenerator'
import { createAnsiPointerInput } from './pointerInput'

const COLUMNS = 80
const ROWS = 25

const DEFAULT_CHARS = Array.from(' .,:;+=xX$&#@')

type Screen = ReturnType<typeof generateAsciiMetaballsFrame>

// Sum of char-ramp positions over a window — a monotone proxy for field brightness,
// valid because the default ramp orders chars dark -> bright.
function windowBrightness(
	screen: Screen,
	x0: number,
	x1: number,
	y0: number,
	y1: number,
): number {
	let sum = 0
	for (let y = y0; y <= y1; y++) {
		for (let x = x0; x <= x1; x++) {
			sum += Math.max(0, DEFAULT_CHARS.indexOf(screen.lines[y][x].ch))
		}
	}
	return sum
}

describe('generateAsciiMetaballsFrame', () => {
	it('returns a full rectangular screen', () => {
		const screen = generateAsciiMetaballsFrame(5, COLUMNS, ROWS)
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
		const options = { seed: 55, balls: 4 }
		const a = generateAsciiMetaballsFrame(30, COLUMNS, ROWS, options)
		const b = generateAsciiMetaballsFrame(30, COLUMNS, ROWS, options)
		assert.deepEqual(a, b)
	})

	it('inactive invariance: no pointer, a never-activated pointer, and a left pointer all agree', () => {
		const neverActivated = createAnsiPointerInput()
		const leftPointer = createAnsiPointerInput()
		leftPointer.move(10, 5)
		leftPointer.down()
		leftPointer.up()
		leftPointer.leave()

		for (let frame = 0; frame <= 10; frame++) {
			const expected = generateAsciiMetaballsFrame(frame, COLUMNS, ROWS, {})
			assert.deepEqual(
				generateAsciiMetaballsFrame(frame, COLUMNS, ROWS, { pointer: neverActivated }),
				expected,
				`frame ${frame}: never-activated pointer diverged`,
			)
			assert.deepEqual(
				generateAsciiMetaballsFrame(frame, COLUMNS, ROWS, { pointer: leftPointer }),
				expected,
				`frame ${frame}: left pointer diverged`,
			)
		}
	})

	it('deterministic replay: two fresh setups driven by the same pointer script agree', () => {
		const pointerA = createAnsiPointerInput()
		const pointerB = createAnsiPointerInput()

		const script = (pointer: ReturnType<typeof createAnsiPointerInput>, frame: number): void => {
			if (frame === 1) pointer.move(10, 5)
			if (frame >= 2 && frame <= 8) pointer.move(10 + frame * 4.5, 5 + frame * 0.75)
			if (frame === 9) pointer.leave()
		}

		for (let frame = 0; frame <= 11; frame++) {
			script(pointerA, frame)
			script(pointerB, frame)
			const a = generateAsciiMetaballsFrame(frame, COLUMNS, ROWS, { pointer: pointerA })
			const b = generateAsciiMetaballsFrame(frame, COLUMNS, ROWS, { pointer: pointerB })
			assert.deepEqual(a, b, `frame ${frame}: replay diverged`)
		}
	})

	it('localized response: an active pointer at (10, 5) brightens the field there', () => {
		const pointer = createAnsiPointerInput()
		pointer.move(10, 5)

		for (const frame of [0, 7, 23]) {
			const inactive = generateAsciiMetaballsFrame(frame, COLUMNS, ROWS, {})
			const active = generateAsciiMetaballsFrame(frame, COLUMNS, ROWS, { pointer })

			const before = windowBrightness(inactive, 7, 13, 3, 7)
			const after = windowBrightness(active, 7, 13, 3, 7)
			assert.ok(
				after > before,
				`frame ${frame}: brightness near (10, 5) did not increase (${before} -> ${after})`,
			)
			// The extra ball only ever adds field, so no cell anywhere may get darker.
			for (let y = 0; y < ROWS; y++) {
				for (let x = 0; x < COLUMNS; x++) {
					const a = DEFAULT_CHARS.indexOf(active.lines[y][x].ch)
					const i = DEFAULT_CHARS.indexOf(inactive.lines[y][x].ch)
					assert.ok(a >= i, `frame ${frame}: cell (${x}, ${y}) got darker with the pointer active`)
				}
			}
		}
	})

	it('pointerRadius controls the size of the pointer ball', () => {
		const pointer = createAnsiPointerInput()
		pointer.move(40, 12)

		const small = generateAsciiMetaballsFrame(3, COLUMNS, ROWS, { pointer, pointerRadius: 2 })
		const large = generateAsciiMetaballsFrame(3, COLUMNS, ROWS, { pointer, pointerRadius: 9 })
		const smallGlow = windowBrightness(small, 34, 46, 9, 15)
		const largeGlow = windowBrightness(large, 34, 46, 9, 15)
		assert.ok(largeGlow > smallGlow, `larger pointerRadius should glow more (${smallGlow} vs ${largeGlow})`)
	})

	it('out-of-grid pointer positions do not throw or corrupt the screen', () => {
		const pointer = createAnsiPointerInput()
		const positions: Array<[number, number]> = [
			[-5, 12],
			[40, 1e9],
			[1e9, -1e9],
			[Number.NaN, Number.NaN], // the input itself keeps the previous coordinate
			[-1000, -1000],
		]

		for (let frame = 0; frame <= 9; frame++) {
			const [x, y] = positions[frame % positions.length]
			pointer.down(x, y)
			const screen = generateAsciiMetaballsFrame(frame, COLUMNS, ROWS, { pointer })
			assert.equal(screen.lines.length, ROWS)
			for (const line of screen.lines) {
				assert.equal(line.length, COLUMNS)
				for (const cell of line) assert.equal([...cell.ch].length, 1)
			}
		}
	})
})
