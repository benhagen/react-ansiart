import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { AnsiScreen } from '../ansi/types'
import type { CharacterFrameGenerator } from '../types/types'
import { createGeneratorStateStore } from './generatorState'
import { MAX_SIMULATION_CATCHUP, catchupSteps } from './simulationCatchup'

import { createAsciiDatamoshGenerator } from './asciiDatamoshGenerator'
import { createAsciiFireGenerator } from './asciiFireGenerator'
import { createAsciiGameOfLifeGenerator } from './asciiGameOfLifeGenerator'
import { createAsciiMatrixRainGenerator } from './asciiMatrixRainGenerator'
import { createAsciiReactionDiffusionGenerator } from './asciiReactionDiffusionGenerator'
import { createAsciiStarfieldGenerator } from './asciiStarfieldGenerator'
import { createAsciiWaterRippleGenerator } from './asciiWaterRippleGenerator'

const COLUMNS = 24
const ROWS = 12

function screenToText(screen: AnsiScreen): string {
	return screen.lines.map((line) => line.map((cell) => cell.ch).join('')).join('\n')
}

function screenToColors(screen: AnsiScreen): string {
	return screen.lines.map((line) => line.map((cell) => String(cell.fg)).join(',')).join('\n')
}

const STATEFUL_GENERATORS: Array<{
	name: string
	create: () => CharacterFrameGenerator
}> = [
	{ name: 'gameOfLife', create: () => createAsciiGameOfLifeGenerator({ seed: 7 }) },
	{ name: 'waterRipple', create: () => createAsciiWaterRippleGenerator({ seed: 7 }) },
	{ name: 'reactionDiffusion', create: () => createAsciiReactionDiffusionGenerator({ seed: 7 }) },
	{ name: 'matrixRain', create: () => createAsciiMatrixRainGenerator({ seed: 7 }) },
	{ name: 'fire', create: () => createAsciiFireGenerator({ seed: 7 }) },
	{ name: 'starfield', create: () => createAsciiStarfieldGenerator({ seed: 7 }) },
	{ name: 'datamosh', create: () => createAsciiDatamoshGenerator({ seed: 7 }) },
]

describe('createGeneratorStateStore', () => {
	it('stores and retrieves state by key', () => {
		const store = createGeneratorStateStore<number>()
		store.set('a', 1)
		assert.equal(store.get('a'), 1)
		assert.equal(store.get('missing'), undefined)
	})

	it('evicts oldest entries past the cap', () => {
		const store = createGeneratorStateStore<number>(2)
		store.set('a', 1)
		store.set('b', 2)
		store.set('c', 3)
		assert.equal(store.get('a'), undefined, 'oldest entry should be evicted')
		assert.equal(store.get('b'), 2)
		assert.equal(store.get('c'), 3)
	})

	it('clear drops everything', () => {
		const store = createGeneratorStateStore<number>()
		store.set('a', 1)
		store.clear()
		assert.equal(store.get('a'), undefined)
	})
})

describe('catchupSteps', () => {
	it('returns the gap when it is small', () => {
		assert.equal(catchupSteps(5, 2), 3)
		assert.equal(catchupSteps(0, -1), 1)
	})

	it('never returns more than the cap', () => {
		assert.equal(catchupSteps(100_000, -1), MAX_SIMULATION_CATCHUP)
		assert.equal(catchupSteps(50, 0), MAX_SIMULATION_CATCHUP)
	})

	it('returns zero when already at or ahead of the target frame', () => {
		assert.equal(catchupSteps(10, 10), 0)
		assert.equal(catchupSteps(5, 10), 0)
	})
})

describe('generator instance isolation', () => {
	// The regression: state used to live in one module-level map keyed on options, so two
	// components with matching options shared a simulation. Whichever was further behind
	// tripped the backwards-seek reset and rewound the other, every frame.
	for (const { name, create } of STATEFUL_GENERATORS) {
		it(`${name}: an instance is unaffected by another at a different frame`, () => {
			const solo = create()
			for (let frame = 0; frame <= 6; frame++) solo(frame, COLUMNS, ROWS)
			const expected = screenToText(solo(7, COLUMNS, ROWS))

			// Same sequence, but a second instance is interleaved and repeatedly rewinds.
			const shared = create()
			const interloper = create()
			for (let frame = 0; frame <= 6; frame++) {
				shared(frame, COLUMNS, ROWS)
				interloper(0, COLUMNS, ROWS)
				interloper(300, COLUMNS, ROWS)
			}
			const actual = screenToText(shared(7, COLUMNS, ROWS))

			assert.equal(actual, expected, `${name} was perturbed by a second instance`)
		})
	}

	it('two fresh instances given the same frames agree', () => {
		for (const { name, create } of STATEFUL_GENERATORS) {
			const a = create()
			const b = create()
			for (let frame = 0; frame < 4; frame++) {
				a(frame, COLUMNS, ROWS)
				b(frame, COLUMNS, ROWS)
			}
			assert.equal(
				screenToText(a(4, COLUMNS, ROWS)),
				screenToText(b(4, COLUMNS, ROWS)),
				`${name} is not deterministic across instances`
			)
		}
	})
})

describe('generator output shape', () => {
	for (const { name, create } of STATEFUL_GENERATORS) {
		it(`${name}: returns a full rectangular screen`, () => {
			const screen = create()(3, COLUMNS, ROWS)
			assert.equal(screen.columns, COLUMNS, 'columns mismatch')
			assert.equal(screen.lines.length, ROWS, 'row count mismatch')
			for (const [index, line] of screen.lines.entries()) {
				assert.equal(line.length, COLUMNS, `row ${index} is ragged`)
				for (const cell of line) {
					assert.equal([...cell.ch].length, 1, `row ${index} has a non-single-character cell`)
				}
			}
		})
	}

	it('advancing frames actually changes output', () => {
		for (const { name, create } of STATEFUL_GENERATORS) {
			const gen = create()
			const first = screenToText(gen(1, COLUMNS, ROWS)) + screenToColors(gen(1, COLUMNS, ROWS))
			let changed = false
			for (let frame = 2; frame <= 20 && !changed; frame++) {
				const next = screenToText(gen(frame, COLUMNS, ROWS)) + screenToColors(gen(frame, COLUMNS, ROWS))
				if (next !== first) changed = true
			}
			assert.ok(changed, `${name} produced identical output for 20 frames`)
		}
	})
})

describe('large frame jumps', () => {
	// A backgrounded tab pauses requestAnimationFrame, so the engine can resume thousands of
	// frames later. The engine deliberately does not cap how far it advances -- capping it
	// makes stateless effects run in slow motion -- so each stateful generator must bound its
	// own catch-up. Without that bound this jump simulates 100k generations and freezes the
	// main thread for seconds.
	for (const { name, create } of STATEFUL_GENERATORS) {
		it(`${name}: jumping 100k frames stays cheap`, () => {
			const gen = create()
			gen(0, COLUMNS, ROWS)
			const started = process.hrtime.bigint()
			gen(100_000, COLUMNS, ROWS)
			const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6
			assert.ok(elapsedMs < 250, `${name} took ${elapsedMs.toFixed(0)}ms for a 100k-frame jump`)
		})
	}
})
