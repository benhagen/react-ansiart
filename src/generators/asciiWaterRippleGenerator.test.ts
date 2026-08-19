import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	createAsciiWaterRippleGenerator,
	generateAsciiWaterRippleFrame,
} from './asciiWaterRippleGenerator'
import { createAnsiPointerInput } from './pointerInput'

const COLUMNS = 80
const ROWS = 25

type Screen = ReturnType<typeof generateAsciiWaterRippleFrame>

function cellKey(cell: Screen['lines'][number][number]): string {
	return `${cell.ch}|${cell.fg}|${cell.bg}|${cell.bold}`
}

// Positions where two same-sized screens differ in any cell field.
function diffPositions(a: Screen, b: Screen): Array<{ x: number; y: number }> {
	const diffs: Array<{ x: number; y: number }> = []
	for (let y = 0; y < a.lines.length; y++) {
		for (let x = 0; x < a.lines[y].length; x++) {
			if (cellKey(a.lines[y][x]) !== cellKey(b.lines[y][x])) diffs.push({ x, y })
		}
	}
	return diffs
}

describe('generateAsciiWaterRippleFrame', () => {
	it('returns a full rectangular screen', () => {
		const screen = generateAsciiWaterRippleFrame(5, COLUMNS, ROWS)
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
		const options = { seed: 55 }
		const a = generateAsciiWaterRippleFrame(30, COLUMNS, ROWS, options)
		const b = generateAsciiWaterRippleFrame(30, COLUMNS, ROWS, options)
		assert.deepEqual(a, b)
	})

	it('inactive invariance: no pointer, a never-activated pointer, and a left pointer all agree', () => {
		const baseline = createAsciiWaterRippleGenerator({ seed: 7 })

		const neverActivated = createAnsiPointerInput()
		const withInactive = createAsciiWaterRippleGenerator({ seed: 7, pointer: neverActivated })

		// A pointer that saw activity but left before the run starts is inactive too.
		const leftPointer = createAnsiPointerInput()
		leftPointer.move(10, 5)
		leftPointer.down()
		leftPointer.up()
		leftPointer.leave()
		const withLeft = createAsciiWaterRippleGenerator({ seed: 7, pointer: leftPointer })

		for (let frame = 0; frame <= 10; frame++) {
			const expected = baseline(frame, COLUMNS, ROWS)
			assert.deepEqual(withInactive(frame, COLUMNS, ROWS), expected, `frame ${frame}: never-activated pointer diverged`)
			assert.deepEqual(withLeft(frame, COLUMNS, ROWS), expected, `frame ${frame}: left pointer diverged`)
		}
	})

	it('deterministic replay: two fresh setups driven by the same pointer script agree', () => {
		const pointerA = createAnsiPointerInput()
		const pointerB = createAnsiPointerInput()
		const genA = createAsciiWaterRippleGenerator({ seed: 3, pointer: pointerA })
		const genB = createAsciiWaterRippleGenerator({ seed: 3, pointer: pointerB })

		const script = (pointer: ReturnType<typeof createAnsiPointerInput>, frame: number): void => {
			if (frame === 2) pointer.move(20, 10)
			if (frame === 4) pointer.down(22, 10)
			if (frame >= 5 && frame <= 9) pointer.move(22 + (frame - 4) * 2, 10 + (frame - 4))
			if (frame === 10) pointer.up()
			if (frame === 12) pointer.leave()
		}

		for (let frame = 0; frame <= 14; frame++) {
			script(pointerA, frame)
			script(pointerB, frame)
			const a = genA(frame, COLUMNS, ROWS)
			const b = genB(frame, COLUMNS, ROWS)
			assert.deepEqual(a, b, `frame ${frame}: replay diverged`)
		}
	})

	it('localized response: pressing at (40, 12) disturbs cells near (40, 12) and only there', () => {
		const baseline = createAsciiWaterRippleGenerator({ seed: 5555 })
		const pointer = createAnsiPointerInput()
		const interactive = createAsciiWaterRippleGenerator({ seed: 5555, pointer })
		pointer.down(40, 12)

		let lastBaseline: Screen | null = null
		let lastInteractive: Screen | null = null
		for (let frame = 0; frame <= 5; frame++) {
			lastBaseline = baseline(frame, COLUMNS, ROWS)
			lastInteractive = interactive(frame, COLUMNS, ROWS)
		}

		// Ambient drops are identical in both runs (the pointer never touches their RNG),
		// so every difference is pointer-caused.
		const diffs = diffPositions(lastInteractive!, lastBaseline!)
		assert.ok(diffs.length > 0, 'pressing the pointer changed nothing')
		const near = diffs.filter((p) => Math.max(Math.abs(p.x - 40), Math.abs(p.y - 12)) <= 4)
		assert.ok(near.length > 0, 'no disturbance within 4 cells of the press')
		// The wave front moves at most one cell per step; after 6 steps nothing pointer-caused
		// can be further out than ~7 cells (plus rounding).
		for (const p of diffs) {
			const dist = Math.max(Math.abs(p.x - 40), Math.abs(p.y - 12))
			assert.ok(dist <= 8, `pointer disturbance leaked to (${p.x}, ${p.y}), ${dist} cells from the press`)
		}
	})

	it('hover wake: moving an unpressed pointer across the surface leaves a trail', () => {
		const baseline = createAsciiWaterRippleGenerator({ seed: 21 })
		const pointer = createAnsiPointerInput()
		const interactive = createAsciiWaterRippleGenerator({ seed: 21, pointer })

		let lastBaseline: Screen | null = null
		let lastInteractive: Screen | null = null
		for (let frame = 0; frame <= 9; frame++) {
			pointer.move(10 + frame * 3, 12)
			lastBaseline = baseline(frame, COLUMNS, ROWS)
			lastInteractive = interactive(frame, COLUMNS, ROWS)
		}

		const diffs = diffPositions(lastInteractive!, lastBaseline!)
		assert.ok(diffs.length > 0, 'a moving hover left no wake')
		// The trail spans the dragged range, not just one spot.
		const xs = diffs.map((p) => p.x)
		assert.ok(Math.max(...xs) - Math.min(...xs) >= 10, 'wake did not follow the drag')
	})

	it('out-of-grid pointer positions do not throw, corrupt the screen, or inject drops', () => {
		const baseline = createAsciiWaterRippleGenerator({ seed: 9 })
		const pointer = createAnsiPointerInput()
		const interactive = createAsciiWaterRippleGenerator({ seed: 9, pointer })

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
			const screen = interactive(frame, COLUMNS, ROWS)
			assert.equal(screen.lines.length, ROWS)
			for (const line of screen.lines) assert.equal(line.length, COLUMNS)
			// Every scripted position rounds outside the grid, so no drop ever lands and the
			// run must match the pointerless baseline exactly.
			assert.deepEqual(screen, baseline(frame, COLUMNS, ROWS), `frame ${frame}: out-of-grid press altered the simulation`)
		}
	})
})
