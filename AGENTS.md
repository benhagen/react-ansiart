# AGENTS.md — react-ansiart

`react-ansiart` is a zero-dependency React library that renders ANSI art (`.ANS`, `.ASC`)
and procedural demoscene effects as CP437 character grids drawn on a `<canvas>` with an
embedded IBM VGA 8x16 bitmap font. Two things live here: a **component layer** (React,
canvas, browser-only) and a **headless layer** (ANSI parser, 35 procedural frame
generators, post effects, CP437/color utilities) that is pure TypeScript and runs
anywhere Node runs. Anything that produces pixels is in the first layer; anything that
produces an `AnsiScreen` is in the second, and the second is where nearly all the code is.

## Commands

Run from the repo root:

```bash
npm run typecheck      # tsc --noEmit && tsc --noEmit -p tsconfig.test.json
npm test               # node --import tsx --test 'src/**/*.test.ts'  (314 tests, 58 suites)
npm run lint           # eslint src/
npm run build          # tsup -> dist/ (ESM only, per-module entry points)
npm run dev            # tsup --watch
npm run demo:dev       # library watch + Next.js demo concurrently (demo on :3000)
```

Demo typecheck (the demo has its own tsconfig and is not covered by root `typecheck`):

```bash
cd demo && npx tsc --noEmit
```

Node version: CI pins Node 22; `package.json` declares no `engines` field. `npm test`
passes a glob string to `node --test`, which requires **Node >= 21**. Tests are
`*.test.ts` files colocated next to their subject in `src/`; `tsup` excludes them from
the build. There is no test runner config file and no coverage setup.

Before any commit: `npm run typecheck && npm test && npm run lint`. `prepublishOnly`
runs typecheck + test + build, so a broken tree cannot publish.

## Install (consumers)

```bash
npm install react-ansiart      # public npm, package name is unscoped
```

ESM only, React 18/19 as a peer dependency, no runtime dependencies. Root import
(`react-ansiart`) plus per-module subpaths (`react-ansiart/generators/plasma`,
`react-ansiart/ansi/parser`, `react-ansiart/utils/cp437`, ...) declared in the `exports`
map. CDN consumption via `https://esm.sh/react-ansiart` works because the package is
plain ESM with no bundler-specific resolution.

## Architecture

```
src/components/   React layer. AnsiArt (fetch + SAUCE + animation detect),
                  AnsiVirtualDisplay (canvas host, font loading, overlays),
                  AnsiPlayerOverlay, PlasmaBackgroundLayout, FontCharacterChart.
src/engines/      AnsiVirtualDisplayEngine — canvas renderer, double buffering,
                  glyph cache, rAF loop, IntersectionObserver pause.
src/generators/   35 procedural frame generators + ansiPostEffects (screen-space
                  transforms) + generatorState/simulationCatchup (stateful sim support).
src/ansi/         parser.ts (resumable ANSI/CP437 parse session), frameToAnsi,
                  shapeAsciiConverter.
src/font/         .FON extraction, raw bitmap font loading, glyph render, font cache,
                  embeddedVgaFont (built-in IBM VGA 8x16, no external file needed).
src/utils/        cp437, rgbToAnsi, egaPalette, sauce, performanceOverlay.
src/types/types.ts  Generator contracts and capability metadata.
src/index.ts      The public surface. If it is not re-exported here, it is internal.
```

## The three usage patterns

**1. Render an ANSI file.**

```tsx
'use client'
import { AnsiArt } from 'react-ansiart'

<AnsiArt src="/art/example.ans" mode="auto" columns={80} rows="auto" sauceOverlay />
```

`mode` is `'final' | 'animated' | 'auto'` (default `'final'`); `columns`/`rows` accept a
number or `'auto'`. Animated playback is driven by `bytesPerSecond` (bytes, not baud:
9600 baud ≈ 960 bytes/sec), not by `fps`.

**2. Drive the display with a generator.**

```tsx
'use client'
import { AnsiVirtualDisplay, generateAsciiCopperBarsFrame } from 'react-ansiart'

const gen = (frame: number, columns: number, rows: number) =>
	generateAsciiCopperBarsFrame(frame, columns, rows, { barCount: 4 })

<AnsiVirtualDisplay columns={80} rows={25} fps={30} frameGenerator={gen} />
```

**3. Compose post effects onto any generator.**

```ts
import { composeAnsiEffects, createLensEffect, createScanlineEffect } from 'react-ansiart'

const composed = composeAnsiEffects(gen, createLensEffect({ radius: 6 }), createScanlineEffect({}))
```

`composeAnsiEffects(generator, ...effects)` is variadic and also accepts arrays of
effects. It returns a `CharacterFrameGeneratorWithMetadata` with the same
`(frame, columns, rows) => AnsiScreen` shape, forwarding the source generator's
`capabilities` / seek / speed methods, and dropping `isStatic` whenever the chain is
non-empty (a wrapped generator animates).

## SSR / Next.js

Components need a client boundary — they touch `canvas`, `IntersectionObserver`, and
`fetch`. The source files carry `'use client'` and the per-component build entries
(`dist/components/AnsiArt.js`) preserve the directive, but the **root barrel and its
shared chunks do not**. Import components from a file that has its own `'use client'`
at the top (this is what every demo page does), or import the component subpath.

Generators, post effects, the ANSI parser, SAUCE parsing, and every `src/utils` module
are headless: no DOM, no canvas, no timers. They run in Node, in tests, and in a server
component without ceremony. This is why generator work is verifiable without a browser.

## Generator contract

```ts
type CharacterFrameGenerator = (frame: number, columns: number, rows: number) => AnsiScreen

type AnsiCell = {
	ch: string                 // single character; must be CP437-representable
	fg: number | string        // ANSI index 0-15, or a CSS color string
	bg: number | string
	bold: boolean
}

type AnsiScreen = { lines: AnsiCell[][]; columns: number; sauce?: SauceMetadata }
```

The exported `generateAsciiXFrame` functions take a 4th `options` argument; you bind it
with a closure or with `createAsciiXGenerator(options)` to reach the 3-arg contract.

Optional metadata on `CharacterFrameGeneratorWithMetadata`:

- `isStatic?: boolean` — set **only** when the screen never changes (e.g. a fully parsed
  file in `final` mode). Time-dependent procedural generators must not set it, however
  stateless they are; the consumer stops the frame loop when it sees this.
- `capabilities?: GeneratorCapabilities` — `{ supportsSeek, supportsSpeedControl,
  getTotalFrames?, getTotalBytes? }`. Presence is what enables the player overlay.
- Optional transport hooks: `setSpeed`, `seekToFrame`, `getCurrentSpeed`, `advanceByte`,
  `rewindByte`, `getCurrentBytePosition`, `clearManualBytePosition`.

**Determinism is part of the contract.** Output must be a pure function of
`(frame, columns, rows, options)` plus explicitly seeded state. Same inputs, same screen,
every time and in every process. Tests rely on this; so does seeking.

**Pointer interactivity** goes through the injectable channel in
`src/generators/pointerInput.ts`, never through DOM access or a widened signature: an
interactive generator takes `pointer?: AnsiPointerInput` in its options, samples
`pointer.state` once per generate call, and must be byte-identical to its non-interactive
self while the pointer is absent or inactive (tests assert this). Determinism then means:
same frame sequence + same pointer-state sequence, same output — tests drive the channel
programmatically. `AnsiVirtualDisplay` feeds the channel via its `pointerInput` prop
(cell coordinates, viewport-offset); `onCellPointer` exposes raw cell-space events.

## How to add a generator

1. **File**: `src/generators/asciiYourEffectGenerator.ts`. Tabs, strict TS.
2. **Options**: `export interface AsciiYourEffectOptions` with every field optional and a
   `/** ... Default: X */` doc comment per field. Module-level `DEFAULT_*` constants in
   `SCREAMING_SNAKE_CASE`. Resolve and clamp in one place — copy the
   `resolveOptions(options): Required<AsciiYourEffectOptions>` pattern from
   `asciiBoidsGenerator.ts` / `asciiDatamoshGenerator.ts`, or `resolveAndValidate()` from
   `asciiMoireGenerator.ts` / `asciiSonarFrameGenerator.ts`. Non-finite and out-of-range
   input must fall back, never propagate as `NaN` into a char index.
3. **Exports**: `generateAsciiYourEffectFrame(frame, columns, rows, options?)` always;
   `createAsciiYourEffectSampler(frame, options?) => (x, y) => AnsiCell` if it can back a
   `PlasmaBackgroundLayout`; `createAsciiYourEffectGenerator(options?)` **and**
   `clearYourEffectState()` if it is stateful.
4. **Exemplars to copy**:
   - *stateless* → `src/generators/asciiCopperBarsGenerator.ts` (seeded LCG for phases,
     memoized char lookup via `buildCharLookup`, precomputed per-row tables, sampler).
   - *stateful* → `src/generators/asciiCyclicAutomatonGenerator.ts` (a
     `createGeneratorStateStore<S>()` per instance plus a module-level `sharedStore` for
     the bare `generate...Frame` entry point; `catchupSteps(frame, state.lastFrame)` for
     forward simulation; reset when `frame < state.lastFrame`; ping-pong buffer rebinding
     instead of copying grids).
   - Read `src/generators/generatorState.ts` and `src/generators/simulationCatchup.ts`
     before writing any stateful generator — the doc comments explain why per-instance
     stores exist and why catch-up is capped.
5. **Test**: `src/generators/asciiYourEffectGenerator.test.ts`, `node:test` + `node:assert`.
   Cover determinism (two calls at the same frame are identical), dimension correctness,
   CP437 safety of every emitted glyph, and degenerate options.
6. **Register** in all of:
   - `src/index.ts` — value exports and `export type` for the options interface.
   - `tsup.config.ts` — an entry under `// Generators`, e.g.
     `'generators/yourEffect': 'src/generators/asciiYourEffectGenerator.ts'`.
   - `README.md` — an entry under `### Built-in Generators`.
   - `demo/app/_lib/defaults.ts` — `YOUR_EFFECT_DEFAULTS`.
   - `demo/app/_lib/generateCode.ts` — the generator name/type map entry.
   - `demo/app/generators/_panels/YourEffectPanel.tsx` — the control panel.
   - `demo/app/generators/page.tsx` — `GeneratorType` union, the selector list, the
     `clear...State()` reset call, the frame-generator branch, the defaults object, and
     the panel render branch.

## Hard rules

Each of these is a bug that already happened. They are not style preferences.

1. **CP437-safe characters only.** Any `ch` that has no CP437 byte renders as a space.
   Verify with `charToCp437Byte(c)` from `src/utils/cp437.ts` and round-trip through
   `CP437_TO_UNICODE`. Safe: `■` (0xFE), `♦` (0x04), `↑↓→←` (0x18-0x1B), `·` (0xFA),
   `░▒▓█▄▀`, `○` (0x09). **Not** safe: `▪`, `★`, `◆`, `●`, `↖↗↘↙` — all collapse to 0x20.
2. **No `Math.random()`, no `Date.now()`, no `performance.now()` in generators.** Use a
   seeded LCG (`state = (Math.imul(state, 1664525) + 1013904223) >>> 0`) or a coordinate
   hash. Output is a pure function of the frame number.
3. **`Float64Array`, never `Float32Array`, for values that feed char-ramp or color
   thresholds.** Float32 truncation flips threshold comparisons and produces visible
   banding. See the comments in `asciiBumpMappingGenerator.ts` and
   `asciiAuroraBorealisGenerator.ts`.
4. **Never build an `rgb()` string per cell.** Precompute a color table indexed by state
   or quantized level (`getHueTable` in `asciiCyclicAutomatonGenerator.ts`), or use a
   bounded cache keyed on packed RGB + a quantized level (`ansiPostEffects.ts`, capped at
   4096 entries, stop-insert when full).
5. **No `JSON.stringify` for cache keys.** Concatenate fields with a delimiter in a fixed
   order: `` `${columns}:${rows}:${seed}:${states}` ``. Property-order and shape ambiguity
   have produced silent cache misses (and thus per-frame reinitialization).
6. **Hoist frame-invariants out of the per-cell loop.** Anything that depends only on the
   row, only on the dimensions, or only on the options belongs in a precomputed table.
7. **Aspect correction: cells are ~2x taller than wide.** Going from a row index to world
   units, multiply by `CELL_ASPECT = 2` (`worldH = rows * CELL_ASPECT`); coming back,
   divide. Skipping this makes circles into ellipses and biases every velocity.
8. **Features must resolve at 80x25.** Ring widths, tile sizes, band heights, and glyph
   features need to be several cells across. A one-cell-wide feature is invisible at the
   default size, and vertical features need roughly double the size of horizontal ones
   because of rule 7.
9. **Post effects must never mutate their input screen.** Parser-produced screens share
   row arrays with retained parser state. Effects build into buffers they own (reused
   across frames) and may pass through *references* to unmodified input cells. The
   consequence: an effect's output is valid only until that same instance is called
   again, and one effect instance must not appear twice in a chain or be shared across
   two live composed generators. Full contract in the header of `ansiPostEffects.ts`.
10. **Simulation catch-up is capped at `MAX_SIMULATION_CATCHUP = 8` steps.** A
    backgrounded tab or a seek produces an unbounded frame gap; the cap keeps it off the
    main thread. Design simulations to tolerate discontinuous jumps rather than assuming
    every frame steps exactly once.
11. **Verify visual changes by rendering.** Dump the screen to ASCII in a `tsx` one-liner
    (`screen.lines.map(l => l.map(c => c.ch).join('')).join('\n')`) or screenshot the
    demo. Code review alone has repeatedly missed defects that are obvious the moment the
    frame is printed.

## Release

```bash
# 1. bump "version" in package.json, then:
npm install --package-lock-only
git commit -am "Release vX.Y.Z"
git tag vX.Y.Z
git push && git push origin vX.Y.Z
```

`.github/workflows/publish-npm.yml` runs typecheck/test/lint/build on every push and PR.
On a `v*` tag it additionally verifies the tag matches `package.json` version and
publishes to npm via **Trusted Publisher (OIDC)** — no token, no secret, provenance
generated automatically. Do not publish by hand.
