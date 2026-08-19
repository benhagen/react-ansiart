import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createAnsiPointerInput, mapClientToCell } from './pointerInput'

describe('createAnsiPointerInput', () => {
	it('starts inactive at the origin', () => {
		const input = createAnsiPointerInput()
		assert.deepEqual(input.state, { x: 0, y: 0, active: false, pressed: false })
	})

	it('move activates and updates position without pressing', () => {
		const input = createAnsiPointerInput()
		input.move(12.5, 3.25)
		assert.deepEqual(input.state, { x: 12.5, y: 3.25, active: true, pressed: false })
	})

	it('down/up toggle pressed and may carry a position', () => {
		const input = createAnsiPointerInput()
		input.down(4, 5)
		assert.deepEqual(input.state, { x: 4, y: 5, active: true, pressed: true })
		input.move(6, 5)
		assert.equal(input.state.pressed, true, 'moving while held keeps pressed')
		input.up()
		assert.deepEqual(input.state, { x: 6, y: 5, active: true, pressed: false })
	})

	it('leave clears active and pressed but keeps the last position', () => {
		const input = createAnsiPointerInput()
		input.down(9, 2)
		input.leave()
		assert.deepEqual(input.state, { x: 9, y: 2, active: false, pressed: false })
	})

	it('reset returns to the initial state', () => {
		const input = createAnsiPointerInput()
		input.down(9, 2)
		input.reset()
		assert.deepEqual(input.state, { x: 0, y: 0, active: false, pressed: false })
	})

	it('snapshots are immutable-by-replacement: an old snapshot never changes', () => {
		const input = createAnsiPointerInput()
		input.move(1, 1)
		const snapshot = input.state
		input.move(30, 20)
		assert.deepEqual(snapshot, { x: 1, y: 1, active: true, pressed: false })
		assert.notEqual(snapshot, input.state)
	})

	it('non-finite coordinates keep the previous position', () => {
		const input = createAnsiPointerInput()
		input.move(5, 6)
		input.move(Number.NaN, Number.POSITIVE_INFINITY)
		assert.equal(input.state.x, 5)
		assert.equal(input.state.y, 6)
	})
})

describe('mapClientToCell', () => {
	const rect = { left: 100, top: 50, width: 640, height: 400 }

	it('maps corners and centers of an 80x25 grid', () => {
		assert.deepEqual(mapClientToCell(rect, 100, 50, 80, 25), { x: 0, y: 0 })
		const mid = mapClientToCell(rect, 100 + 320, 50 + 200, 80, 25)
		assert.equal(mid.x, 40)
		assert.equal(mid.y, 12.5)
		const end = mapClientToCell(rect, 100 + 640, 50 + 400, 80, 25)
		assert.equal(end.x, 80)
		assert.equal(end.y, 25)
	})

	it('applies the virtual-world viewport offset', () => {
		const cell = mapClientToCell(rect, 100 + 320, 50 + 200, 80, 25, 10, 4)
		assert.equal(cell.x, 50)
		assert.equal(cell.y, 16.5)
	})

	it('does not clamp positions outside the rectangle', () => {
		const cell = mapClientToCell(rect, 90, 40, 80, 25)
		assert.ok(cell.x < 0 && cell.y < 0)
	})

	it('degenerate rectangles and non-finite inputs map to the origin', () => {
		assert.deepEqual(mapClientToCell({ left: 0, top: 0, width: 0, height: 400 }, 5, 5, 80, 25), { x: 0, y: 0 })
		assert.deepEqual(mapClientToCell(rect, Number.NaN, 60, 80, 25), { x: 0, y: 0 })
	})
})
