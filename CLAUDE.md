# CLAUDE.md — react-ansiart

**See `AGENTS.md` for the full agent guide** — commands, the generator contract, the
add-a-generator recipe, and the complete hard-rules list. This file is the short version.

## Project Overview
Zero-dependency React library for rendering and animating ANSI art files (.ANS, .ASC) with
authentic VGA-style bitmap font rendering, plus 35 procedural demoscene frame generators and
a composable post-effect layer. CP437 encoding, cursor control codes, progressive
byte-rate animation, SAUCE metadata.

## Tech Stack
- **Language**: TypeScript 5 (strict mode)
- **Framework**: React 18/19 (peer dependency)
- **Bundler**: tsup (ESM only, per-module entry points in `tsup.config.ts`)
- **Tests**: `node --test` via `tsx` — 171 tests / 31 suites, colocated `*.test.ts` in `src/`
- **Demo**: Next.js 16 (app router) in `demo/`
- **Runtime dependencies**: None

## Build & Dev Commands
```bash
npm run typecheck      # tsc --noEmit + tsconfig.test.json
npm test               # node --import tsx --test 'src/**/*.test.ts'  (needs Node >= 21)
npm run lint           # eslint src/
npm run build          # Build library → dist/
npm run dev            # Watch mode
npm run demo:dev       # Library watch + Next.js demo on :3000
cd demo && npx tsc --noEmit    # Demo typecheck (not covered by root typecheck)
```
Run typecheck + test + lint before every commit.

## Project Structure
```
src/
├── components/        # AnsiArt, AnsiVirtualDisplay, AnsiPlayerOverlay, PlasmaBackgroundLayout, FontCharacterChart
├── engines/           # AnsiVirtualDisplayEngine (canvas rendering)
├── generators/        # 35 frame generators + ansiTransitions + ansiPostEffects + generatorState + simulationCatchup
├── ansi/              # Resumable ANSI parser, frameToAnsi, shapeAsciiConverter
├── font/              # Bitmap font loading, rendering, .FON extraction, caching, embedded VGA font
├── utils/             # CP437 encoding, EGA palette, RGB→ANSI, SAUCE parsing, perf overlay
├── types/             # TypeScript type definitions
└── index.ts           # Public API exports (nothing outside this file is public)
demo/                  # Next.js demo app
dist/                  # Built output (gitignored; published from CI)
testFiles/, public/    # Sample ANSI art files, static assets
```

## Architecture
- **AnsiArt** — Main user-facing component. Loads files, detects animation, parses SAUCE.
- **AnsiVirtualDisplay** — Canvas host. Engine lifecycle, font loading, overlays, viewport pause.
- **AnsiVirtualDisplayEngine** — Canvas renderer with double-buffering and glyph caching.
- **Frame generators** — All satisfy `CharacterFrameGenerator`: `(frame, columns, rows) => AnsiScreen`.
  Exported `generateAsciiXFrame` takes a 4th `options` arg; bind it via closure or `createAsciiXGenerator`.
- **ansiPostEffects** — `composeAnsiEffects(gen, ...effects)` wraps a generator with screen-space
  transforms (lens, scanline, VHS tracking) and preserves the same call signature and capabilities.
- **generatorState / simulationCatchup** — Per-instance bounded state stores for stateful
  simulations, plus `catchupSteps()` capping forward simulation at 8 steps.
- **Resumable parser session** — `createAnsiParseSession(bytes)` retains parser state so animated
  playback parses only newly revealed bytes; seeking backward resets and re-parses.
- **Font system** — Embedded IBM VGA 8x16 font (no external file needed); also loads Windows .FON.
- **Headless boundary** — components need a client boundary (`'use client'`); generators, post
  effects, parser, and utils are DOM-free and run in Node.

## Code Conventions
- **Indentation**: Tabs
- **Components**: PascalCase, functional only (no class components)
- **Types**: PascalCase (e.g., `AnsiArtProps`, `AnsiScreen`)
- **Functions**: camelCase
- **Constants**: SCREAMING_SNAKE_CASE
- **Files**: `.tsx` for components, `.ts` for everything else
- **Strict TypeScript**: Full strict mode, explicit type annotations

## Hard Rules (the five that bite most; full list in AGENTS.md)
1. **CP437-safe characters only.** Verify with `charToCp437Byte()`; unmapped glyphs render as
   spaces. `■ ♦ ↑↓→← · ░▒▓█▄▀ ○` are safe; `▪ ★ ◆ ● ↖↗↘↙` are not.
2. **Generators are deterministic.** No `Math.random()`, no `Date.now()` — seeded LCG only,
   pure function of `(frame, columns, rows, options)`.
3. **Post effects must never mutate the input screen.** Parser rows alias retained state; build
   into effect-owned reused buffers, and never share an effect instance across two live chains.
4. **No per-cell `rgb()` string building and no `JSON.stringify` cache keys.** Precomputed color
   tables or bounded packed-key caches; delimited field concatenation for keys.
5. **Verify visual changes by rendering** — ASCII-dump the screen or screenshot the demo. Code
   review alone has missed visual defects here repeatedly.

Also: `Float64Array` (never `Float32Array`) for values feeding char/color thresholds; multiply
row indices by `CELL_ASPECT = 2` when converting to world units; features must resolve at 80x25.

## Publishing
- Registry: public npm, package name `react-ansiart` (unscoped), ESM only, React externalized.
- Release: bump `version`, `npm install --package-lock-only`, commit, `git tag vX.Y.Z`, push tag.
- CI (`.github/workflows/publish-npm.yml`) typechecks/tests/lints/builds on every push and PR;
  a `v*` tag verifies tag-vs-version and publishes via npm Trusted Publisher (OIDC, with
  provenance). Never publish by hand.
