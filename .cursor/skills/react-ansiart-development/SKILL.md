---
name: react-ansiart-development
description: Guides development in the react-ansiart codebase: library layout, build and demo workflows, adding components or generators, and export conventions. Use when editing src/, adding features, fixing bugs, or working on the demo app.
---

# react-ansiart Development

## What This Repo Is

- **Library**: TypeScript/React library built from `src/` to `dist/` (tsup). Consumed as `react-ansiart`.
- **Demo**: Next.js App Router app in `demo/` that uses the library via `"react-ansiart": "file:.."`.

## Where Things Live

| Area | Path |
|------|------|
| Library source | `src/**` (components, ansi/, font/, generators/, types/, utils/) |
| Library entry & exports | `src/index.ts` |
| Build config | `tsup.config.ts`, `tsconfig.json`, root `package.json` |
| Demo app | `demo/app/**` (pages, layout) |
| Demo static assets | `demo/public/**` (ANSI files, fonts; served via fetch) |
| Docs/examples | `README.md`, `EXAMPLE_USAGE.md`, `FIRE_EXAMPLE.md`, `demo/README.md` |

**Do not hand-edit `dist/`.** Rebuild with `npm run build` and commit `dist/` changes when library code changes.

## Hard Rules

- **Tabs only** for indentation (no spaces).
- **Match existing patterns**: naming, file layout, API shapes.
- **Minimal changes**: don’t refactor unrelated code when fixing or adding something.
- **TypeScript**: keep types accurate; avoid `any` unless necessary.
- **Backwards compatibility**: don’t break exported APIs unless explicitly requested.
- **Dependencies**: don’t add new deps without clear justification.

## Workflows

**Library (root):**
- Watch build: `npm run dev`
- Production build: `npm run build`

**Demo:**
- Run demo: `npm --prefix demo run dev`
- Lint demo: `npm --prefix demo run lint`
- **Recommended**: `npm run demo:dev` (runs lib watch + demo together)

If the demo doesn’t pick up library changes, run `npm --prefix demo install` (or use `npm link` as in `demo/README.md`).

## Default Scope for Changes

- Prefer implementing in the **library** and updating the **demo** to exercise the change when applicable.
- Update README/docs when you change public props, exports, or behavior.

## Adding a New Component

1. Create the component under `src/components/ComponentName.tsx`.
2. Export the component and its props type from `src/index.ts`:
   - `export { ComponentName } from './components/ComponentName'`
   - `export type { ComponentNameProps } from './components/ComponentName'`
3. Add a demo page under `demo/app/your-page/page.tsx` and link from the demo home/layout if appropriate.

## Adding a New Frame Generator

Generators live in `src/generators/`. Two patterns:

**Character-based** (output is `AnsiScreen`): implement `CharacterFrameGenerator` from `src/types/types.ts`:
- Signature: `(frame: number, columns: number, rows: number) => AnsiScreen`
- For overlay controls (seek, speed), implement `CharacterFrameGeneratorWithMetadata` and attach `capabilities` (e.g. `supportsSeek`, `getTotalFrames`).

**Pixel-based** (output is RGB pixels): implement `FrameGenerator` + `FrameConverter`:
- `FrameGenerator`: `(frame, width, height) => FrameData` where `FrameData` has `width`, `height`, `pixels` (Uint8Array RGB).
- Use or provide a `FrameConverter` to turn `FrameData` into `AnsiScreen` for the display engine.

Then:
1. Export the generator and its options type from `src/index.ts` (see existing `generators/` exports).
2. Optionally add a demo route in `demo/app/` that uses the new generator (e.g. via `AnsiVirtualDisplay` with a custom `frameGenerator`).

## Key Types (src/types/types.ts)

- `FrameData`, `FrameGenerator`, `FrameConverter`, `CharacterFrameGenerator`, `PixelFrameGenerator`, `DisplayFrameGenerator`
- `GeneratorCapabilities`, `CharacterFrameGeneratorWithMetadata` (for overlay controls)
- `ViewportConfig`, `RGBAColor`, `PaletteMode`

Use these when adding or wiring generators.

## Demo Assets

ANSI and .FON files are loaded via `fetch()`, so they must be in `demo/public/` (e.g. `demo/public/ansi/`, `demo/public/fonts/`). See `demo/README.md` for details.
