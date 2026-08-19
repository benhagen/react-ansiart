import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	createAsciiFallingSandGenerator,
	generateAsciiFallingSandFrame,
} from './asciiFallingSandGenerator'
import { createAnsiPointerInput } from './pointerInput'

const COLUMNS = 24
const ROWS = 12

const SAND_CHARS = new Set(['░', '▒', '▓'])

type Screen = ReturnType<typeof generateAsciiFallingSandFrame>

function sandCellCount(screen: Screen): number {
	let count = 0
	for (const line of screen.lines) {
		for (const cell of line) {
			if (SAND_CHARS.has(cell.ch)) count++
		}
	}
	return count
}

function wallPositions(screen: Screen): Set<string> {
	const positions = new Set<string>()
	for (const [y, line] of screen.lines.entries()) {
		for (const [x, cell] of line.entries()) {
			if (cell.ch === '█') positions.add(`${x},${y}`)
		}
	}
	return positions
}

describe('generateAsciiFallingSandFrame', () => {
	it('returns a full rectangular screen', () => {
		const screen = generateAsciiFallingSandFrame(5, COLUMNS, ROWS)
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
		const options = { seed: 55, spoutCount: 2 }
		const a = generateAsciiFallingSandFrame(30, COLUMNS, ROWS, options)
		const b = generateAsciiFallingSandFrame(30, COLUMNS, ROWS, options)
		assert.deepEqual(a, b)
	})

	it('advancing frames actually changes output', () => {
		const gen = createAsciiFallingSandGenerator({ seed: 11 })
		const asText = (screen: Screen) => screen.lines.map((l) => l.map((c) => c.ch).join('')).join('\n')
		const first = asText(gen(1, COLUMNS, ROWS))
		let changed = false
		for (let frame = 2; frame <= 40 && !changed; frame++) {
			if (asText(gen(frame, COLUMNS, ROWS)) !== first) changed = true
		}
		assert.ok(changed, 'produced identical output for 40 frames')
	})

	it('grain count conservation: on a fresh sparse grid, count increases by exactly one emitted grain per step', () => {
		// Tall, empty grid with a single always-emitting spout and no wall interference near
		// the spout column: each step's freshly emitted grain is guaranteed to fall clear of
		// row 0 during that same step (bottom-up physics runs after emission), so row 0 is
		// always empty again by the time the next step emits. With the drain thresholds
		// pushed out of reach, the only source of grain-count change is emission, and moves
		// never change the count -- so after `n` steps, count === n exactly.
		const gen = createAsciiFallingSandGenerator({
			seed: 3,
			spoutCount: 1,
			spoutRate: 1,
			drainOpenThreshold: 2, // unreachable: fill fraction is always <= 1
			drainCloseThreshold: 1.5,
		})
		const width = 12
		const height = 20

		for (let frame = 0; frame <= 4; frame++) {
			const screen = gen(frame, width, height)
			assert.equal(sandCellCount(screen), frame + 1, `frame ${frame} grain count mismatch`)
		}
	})

	it('the drain opens above the high threshold and closes below the low threshold (anti-degeneration)', () => {
		const gen = createAsciiFallingSandGenerator({
			seed: 9,
			spoutCount: 3,
			spoutRate: 1,
			drainOpenThreshold: 0.5,
			drainCloseThreshold: 0.3,
		})
		const width = 16
		const height = 10
		const totalCells = width * height

		let maxFraction = 0
		let sawRecovery = false
		let peaked = false
		for (let frame = 0; frame <= 400; frame++) {
			const screen = gen(frame, width, height)
			const fraction = sandCellCount(screen) / totalCells
			maxFraction = Math.max(maxFraction, fraction)
			if (fraction > 0.5) peaked = true
			if (peaked && fraction < 0.3) sawRecovery = true
		}

		assert.ok(peaked, 'fill fraction never crossed the drain-open threshold')
		assert.ok(sawRecovery, 'fill fraction never recovered below the drain-close threshold once opened')
		// Never fills the whole board solid, even far past the open threshold.
		assert.ok(maxFraction < 0.9, `fill fraction reached ${maxFraction.toFixed(2)}, drain is not keeping up`)
	})

	it('grains never occupy WALL cells: wall ledges are immovable and never overwritten by sand', () => {
		const gen = createAsciiFallingSandGenerator({ seed: 21, spoutCount: 3, spoutRate: 1 })
		const initial = gen(0, COLUMNS, ROWS)
		const initialWalls = wallPositions(initial)
		assert.ok(initialWalls.size > 0, 'expected at least one wall ledge cell from seeded init')

		for (let frame = 1; frame <= 150; frame++) {
			const screen = gen(frame, COLUMNS, ROWS)
			const walls = wallPositions(screen)
			assert.equal(walls.size, initialWalls.size, `frame ${frame}: wall cell count changed`)
			for (const pos of initialWalls) {
				assert.ok(walls.has(pos), `frame ${frame}: wall cell at ${pos} was overwritten`)
			}
		}
	})

	it('instance isolation: two instances with different seeds advance independently', () => {
		const a = createAsciiFallingSandGenerator({ seed: 1 })
		const b = createAsciiFallingSandGenerator({ seed: 2 })

		const asText = (screen: Screen) => screen.lines.map((l) => l.map((c) => c.ch).join('')).join('\n')

		for (let frame = 0; frame <= 10; frame++) a(frame, COLUMNS, ROWS)
		const aExpected = asText(a(11, COLUMNS, ROWS))

		// Interleave `b` advancing (and rewinding) between `a`'s calls; `a` must be unaffected.
		for (let frame = 0; frame <= 10; frame++) {
			b(frame, COLUMNS, ROWS)
			b(0, COLUMNS, ROWS)
			b(300, COLUMNS, ROWS)
		}
		for (let frame = 1; frame <= 11; frame++) a(frame, COLUMNS, ROWS)
		assert.equal(asText(a(11, COLUMNS, ROWS)), aExpected)

		const c = createAsciiFallingSandGenerator({ seed: 9 })
		const d = createAsciiFallingSandGenerator({ seed: 9 })
		for (let frame = 0; frame <= 8; frame++) {
			c(frame, COLUMNS, ROWS)
			d(frame, COLUMNS, ROWS)
		}
		assert.equal(asText(c(9, COLUMNS, ROWS)), asText(d(9, COLUMNS, ROWS)))
	})

	it('a large frame jump stays cheap (catch-up is capped)', () => {
		const gen = createAsciiFallingSandGenerator({ seed: 7 })
		gen(0, COLUMNS, ROWS)
		const started = process.hrtime.bigint()
		gen(100_000, COLUMNS, ROWS)
		const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6
		assert.ok(elapsedMs < 250, `took ${elapsedMs.toFixed(0)}ms for a 100k-frame jump`)
	})

	describe('pointer pouring', () => {
		const WIDE = 80
		const TALL = 25

		it('inactive invariance: no pointer, a never-activated pointer, and a hovering pointer all agree', () => {
			const baseline = createAsciiFallingSandGenerator({ seed: 7 })
			const withInactive = createAsciiFallingSandGenerator({ seed: 7, pointer: createAnsiPointerInput() })

			// Hovering unpressed must also do nothing — pouring requires a press.
			const hoverPointer = createAnsiPointerInput()
			const withHover = createAsciiFallingSandGenerator({ seed: 7, pointer: hoverPointer })

			for (let frame = 0; frame <= 10; frame++) {
				hoverPointer.move(10 + frame * 3, 8)
				const expected = baseline(frame, COLUMNS, ROWS)
				assert.deepEqual(withInactive(frame, COLUMNS, ROWS), expected, `frame ${frame}: inactive pointer diverged`)
				assert.deepEqual(withHover(frame, COLUMNS, ROWS), expected, `frame ${frame}: unpressed hover diverged`)
			}
		})

		it('deterministic replay: two fresh setups driven by the same pointer script agree', () => {
			const pointerA = createAnsiPointerInput()
			const pointerB = createAnsiPointerInput()
			const genA = createAsciiFallingSandGenerator({ seed: 3, pointer: pointerA })
			const genB = createAsciiFallingSandGenerator({ seed: 3, pointer: pointerB })

			const script = (pointer: ReturnType<typeof createAnsiPointerInput>, frame: number): void => {
				if (frame === 2) pointer.down(30, 5)
				if (frame >= 3 && frame <= 12) pointer.move(30 + frame, 5)
				if (frame === 13) pointer.up()
			}

			for (let frame = 0; frame <= 15; frame++) {
				script(pointerA, frame)
				script(pointerB, frame)
				assert.deepEqual(genA(frame, WIDE, TALL), genB(frame, WIDE, TALL), `frame ${frame}: replay diverged`)
			}
		})

		it('localized response: pressing at (40, 8) pours a pile the inactive run lacks', () => {
			// spoutRate 0 silences the ambient spouts entirely, so every grain in the
			// interactive run is pointer-poured and the baseline run stays empty of sand.
			const options = { seed: 5, spoutRate: 0 }
			const baseline = createAsciiFallingSandGenerator(options)
			const pointer = createAnsiPointerInput()
			const interactive = createAsciiFallingSandGenerator({ ...options, pointer })
			pointer.down(40, 8)

			let lastBaseline: Screen | null = null
			let lastInteractive: Screen | null = null
			for (let frame = 0; frame <= 20; frame++) {
				lastBaseline = baseline(frame, WIDE, TALL)
				lastInteractive = interactive(frame, WIDE, TALL)
			}

			assert.equal(sandCellCount(lastBaseline!), 0, 'baseline should have no ambient sand at spoutRate 0')
			const poured = sandCellCount(lastInteractive!)
			assert.ok(poured >= 30, `expected at least 30 poured grains, saw ${poured}`)

			// Every grain stays in the pour column region: spawn jitter is +-2 cells around
			// x=40 and toppling only moves grains diagonally as they pile.
			for (const [y, line] of lastInteractive!.lines.entries()) {
				for (const [x, cell] of line.entries()) {
					if (SAND_CHARS.has(cell.ch)) {
						assert.ok(x >= 33 && x <= 47, `grain at (${x}, ${y}) escaped the pour region`)
						assert.ok(y >= 8, `grain at (${x}, ${y}) is above the pour row`)
					}
				}
			}
		})

		it('poured grains behave like ordinary sand: they fall from the pour row', () => {
			const options = { seed: 5, spoutRate: 0 }
			const pointer = createAnsiPointerInput()
			const gen = createAsciiFallingSandGenerator({ ...options, pointer })

			pointer.down(40, 3)
			gen(0, WIDE, TALL)
			pointer.up()

			// After the press ends, the already-poured grains keep falling on their own.
			const later = gen(6, WIDE, TALL)
			let lowestSandRow = -1
			for (const [y, line] of later.lines.entries()) {
				if (line.some((cell) => SAND_CHARS.has(cell.ch))) lowestSandRow = y
			}
			assert.ok(lowestSandRow > 3, `grains never fell below the pour row (lowest at ${lowestSandRow})`)
		})

		it('pointerPourRate is clamped and rate 0 pours nothing', () => {
			const options = { seed: 5, spoutRate: 0 }
			const pointerOff = createAnsiPointerInput()
			const genOff = createAsciiFallingSandGenerator({ ...options, pointerPourRate: 0, pointer: pointerOff })
			pointerOff.down(40, 8)
			let screen: Screen | null = null
			for (let frame = 0; frame <= 10; frame++) screen = genOff(frame, WIDE, TALL)
			assert.equal(sandCellCount(screen!), 0, 'pourRate 0 still poured grains')

			// An absurd rate is clamped to 32 grains per frame, not taken literally.
			const pointerHot = createAnsiPointerInput()
			const genHot = createAsciiFallingSandGenerator({ ...options, pointerPourRate: 1e9, pointer: pointerHot })
			pointerHot.down(40, 8)
			const first = genHot(0, WIDE, TALL)
			assert.ok(sandCellCount(first) <= 32, 'a single pour exceeded the 32-grain cap')
		})

		it('out-of-grid pointer positions do not throw, corrupt the screen, or pour sand', () => {
			const options = { seed: 9, spoutRate: 0 }
			const pointer = createAnsiPointerInput()
			const gen = createAsciiFallingSandGenerator({ ...options, pointer })

			const positions: Array<[number, number]> = [
				[-5, 8],
				[40, 1e9],
				[1e9, -1e9],
				[Number.NaN, Number.NaN], // the input itself keeps the previous coordinate
				[-1000, 12],
			]

			let screen: Screen | null = null
			for (let frame = 0; frame <= 9; frame++) {
				const [x, y] = positions[frame % positions.length]
				pointer.down(x, y)
				screen = gen(frame, WIDE, TALL)
				assert.equal(screen.lines.length, TALL)
				for (const line of screen.lines) assert.equal(line.length, WIDE)
			}
			assert.equal(sandCellCount(screen!), 0, 'an out-of-grid press poured sand')
		})
	})
})
