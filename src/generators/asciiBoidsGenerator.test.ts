import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createAsciiBoidsGenerator, generateAsciiBoidsFrame } from './asciiBoidsGenerator'
import { charToCp437Byte } from '../utils/cp437'

const COLUMNS = 60
const ROWS = 30

// Seed chosen via a small brute-force sweep that steps every intermediate frame (0..120)
// through a single instance — not a frame-0 -> frame-120 jump, which only simulates
// MAX_SIMULATION_CATCHUP (8) steps and produced a false-positive "tightening" that held
// even with all three flocking weights zeroed (round-1 review finding). Stepped frame by
// frame at seed 7 on a 60x30 grid with default weights: avg pairwise head distance goes
// ~24.63 (frame 0) -> ~18.18 (frame 120), a clear tightening. The same seed with
// sepWeight/alignWeight/cohWeight all zeroed instead drifts apart: ~24.57 -> ~26.68. The
// >8-unit gap between the two frame-120 measurements is the contrast assertion below.
const COHESION_SEED = 7

// All 8 head glyphs the octant table can emit — kept in sync with HEAD_GLYPHS in
// asciiBoidsGenerator.ts. Duplicated here (rather than exported from the module) to keep
// the generator's public surface matching its siblings (generate/create/clear only).
const HEAD_GLYPHS = ['→', '/', '↑', '\\', '←', '/', '↓', '\\']

function headPositions(screen: ReturnType<typeof generateAsciiBoidsFrame>): [number, number][] {
	const pts: [number, number][] = []
	for (let r = 0; r < screen.lines.length; r++) {
		for (let c = 0; c < screen.lines[r].length; c++) {
			if (screen.lines[r][c].bold) pts.push([c, r])
		}
	}
	return pts
}

function avgPairwiseDistance(pts: [number, number][]): number {
	let sum = 0
	let n = 0
	for (let i = 0; i < pts.length; i++) {
		for (let j = i + 1; j < pts.length; j++) {
			const dx = pts[i][0] - pts[j][0]
			const dy = pts[i][1] - pts[j][1]
			sum += Math.sqrt(dx * dx + dy * dy)
			n++
		}
	}
	return sum / n
}

describe('generateAsciiBoidsFrame', () => {
	it('returns a full rectangular screen', () => {
		const screen = generateAsciiBoidsFrame(5, COLUMNS, ROWS)
		assert.equal(screen.columns, COLUMNS)
		assert.equal(screen.lines.length, ROWS)
		for (const [index, line] of screen.lines.entries()) {
			assert.equal(line.length, COLUMNS, `row ${index} is ragged`)
			for (const cell of line) {
				assert.equal([...cell.ch].length, 1, `row ${index} has a non-single-character cell`)
			}
		}
	})

	it('every head glyph round-trips through CP437 (diagonal Unicode arrows would not)', () => {
		for (const glyph of HEAD_GLYPHS) {
			const byte = charToCp437Byte(glyph)
			assert.ok(byte >= 0 && byte <= 255, `glyph ${JSON.stringify(glyph)} mapped out of range`)
			// The bug this guards against: an unmapped glyph silently falls back to a blank
			// space (byte 32) even though the glyph itself is not a space.
			assert.notEqual(byte, 32, `glyph ${JSON.stringify(glyph)} collapsed to space via CP437 fallback`)
		}
	})

	it('is deterministic for the same (frame, dims, options)', () => {
		const options = { seed: 123, count: 50 }
		const a = generateAsciiBoidsFrame(75, COLUMNS, ROWS, options)
		const b = generateAsciiBoidsFrame(75, COLUMNS, ROWS, options)
		assert.deepEqual(a, b)
	})

	it('keeps two independent instances from interfering with each other', () => {
		const genA = createAsciiBoidsGenerator({ seed: 1 })
		const genB = createAsciiBoidsGenerator({ seed: 1 })

		// Advance A well ahead of B.
		genA(0, COLUMNS, ROWS)
		genA(40, COLUMNS, ROWS)

		// B, asked for frame 0 after A has advanced, must still reflect a fresh simulation —
		// not A's mid-flight state (which a shared/miskeyed store would leak into it).
		const bFrame0Again = genB(0, COLUMNS, ROWS)
		const freshB = createAsciiBoidsGenerator({ seed: 1 })(0, COLUMNS, ROWS)
		assert.deepEqual(bFrame0Again, freshB)
	})

	it('keeps all boid head cells within the grid across 60 simulated steps', () => {
		const gen = createAsciiBoidsGenerator({ seed: 42, count: 80 })
		for (let frame = 0; frame < 60; frame++) {
			const screen = gen(frame, COLUMNS, ROWS)
			const heads = headPositions(screen)
			assert.ok(heads.length > 0, `frame ${frame} stamped no boid heads`)
			for (const [c, r] of heads) {
				assert.ok(c >= 0 && c < COLUMNS, `frame ${frame} head col ${c} out of bounds`)
				assert.ok(r >= 0 && r < ROWS, `frame ${frame} head row ${r} out of bounds`)
			}
		}
	})

	it('flock coheres over time for default weights on a seeded run, and does not when the flocking rules are zeroed', () => {
		// Seed, frames, and measured values documented above the COHESION_SEED constant.
		// Drives every intermediate frame (matching production frame-by-frame playback)
		// rather than jumping 0 -> 120 directly: a direct jump only simulates
		// MAX_SIMULATION_CATCHUP (8) steps via the catch-up cap, which is not representative
		// and (per round-1 review) can show "tightening" that is really just the catch-up
		// cap's own artifact — it held even with the flocking rules disabled entirely.
		const withWeights = createAsciiBoidsGenerator({ seed: COHESION_SEED })
		const zeroWeights = createAsciiBoidsGenerator({
			seed: COHESION_SEED,
			sepWeight: 0,
			alignWeight: 0,
			cohWeight: 0,
		})

		let withWeightsFrame0Dist = 0
		let withWeightsScreen = withWeights(0, COLUMNS, ROWS)
		let zeroWeightsScreen = zeroWeights(0, COLUMNS, ROWS)
		withWeightsFrame0Dist = avgPairwiseDistance(headPositions(withWeightsScreen))

		for (let frame = 1; frame <= 120; frame++) {
			withWeightsScreen = withWeights(frame, COLUMNS, ROWS)
			zeroWeightsScreen = zeroWeights(frame, COLUMNS, ROWS)
		}

		const withWeightsFrame120Dist = avgPairwiseDistance(headPositions(withWeightsScreen))
		const zeroWeightsFrame120Dist = avgPairwiseDistance(headPositions(zeroWeightsScreen))

		assert.ok(
			withWeightsFrame120Dist < withWeightsFrame0Dist,
			`expected default-weight flock to tighten: frame0=${withWeightsFrame0Dist.toFixed(2)} frame120=${withWeightsFrame120Dist.toFixed(2)}`,
		)

		// Contrast: an identical-seed run with every flocking rule disabled must end
		// measurably less tight than the default-weights run, so this test fails if someone
		// zeroes out the flocking rules (the exact false-positive round-1 review caught).
		const MIN_GAP = 3
		assert.ok(
			zeroWeightsFrame120Dist - withWeightsFrame120Dist > MIN_GAP,
			`expected zero-weight flock to end measurably looser than default-weight flock: ` +
				`default=${withWeightsFrame120Dist.toFixed(2)} zero=${zeroWeightsFrame120Dist.toFixed(2)}`,
		)
	})

	it('respects the documented count clamp of [40, 120]', () => {
		// Clamping happens before the flock is seeded, so an out-of-range request and its
		// clamped equivalent draw the exact same number of RNG values during init and
		// simulation — the rendered frames should be pixel-identical, not just "close".
		const tooFew = generateAsciiBoidsFrame(30, COLUMNS, ROWS, { seed: 5, count: 1 })
		const clampedLow = generateAsciiBoidsFrame(30, COLUMNS, ROWS, { seed: 5, count: 40 })
		assert.deepEqual(tooFew, clampedLow)

		const tooMany = generateAsciiBoidsFrame(30, COLUMNS, ROWS, { seed: 5, count: 500 })
		const clampedHigh = generateAsciiBoidsFrame(30, COLUMNS, ROWS, { seed: 5, count: 120 })
		assert.deepEqual(tooMany, clampedHigh)
	})
})
