# CLAUDE.md — react-ansiart

## Project Overview
React component library for rendering and animating ANSI art files (.ANS, .ASC) with authentic VGA-style bitmap font rendering. Supports CP437 encoding, cursor control codes, progressive animation, and procedural frame generators (plasma, fire, sonar, datamosh, metaballs).

## Tech Stack
- **Language**: TypeScript 5 (strict mode)
- **Framework**: React 18/19 (peer dependency)
- **Bundler**: tsup (ESM only output)
- **Demo**: Next.js 14 (app router) in `demo/`
- **Runtime dependencies**: None (zero-dep library)

## Build & Dev Commands
```bash
npm run build          # Build library → dist/
npm run dev            # Watch mode
npm run demo:dev       # Run library watch + Next.js demo concurrently
```
Demo-only (from `demo/`):
```bash
npm run dev            # Next.js dev server on :3000
npm run lint           # ESLint
```
**No test suite configured.**

## Project Structure
```
src/
├── components/        # React components (AnsiArt, AnsiVirtualDisplay, AnsiPlayerOverlay, etc.)
├── engines/           # AnsiVirtualDisplayEngine (canvas rendering)
├── generators/        # Procedural frame generators (plasma, fire, sonar, datamosh, metaballs)
├── ansi/              # ANSI sequence parser, frame-to-ANSI converter
├── font/              # Bitmap font loading, rendering, .FON extraction, caching
├── utils/             # CP437 encoding, EGA palette, RGB→ANSI, SAUCE parsing
├── types/             # TypeScript type definitions
└── index.ts           # Public API exports
demo/                  # Next.js demo app
dist/                  # Built output (ESM bundle + .d.ts)
testFiles/             # Sample ANSI art files
public/                # Static assets (fonts, art files)
```

## Architecture
- **AnsiArt** — Main user-facing component. Loads files, detects animation, parses SAUCE metadata.
- **AnsiVirtualDisplay** — Canvas-based display. Manages engine lifecycle, font loading, overlays.
- **AnsiVirtualDisplayEngine** — Low-level canvas renderer with double-buffering and glyph caching.
- **Frame generators** — All implement `CharacterFrameGenerator`: `(frame, columns, rows) => AnsiScreen`
- **Font system** — Loads Windows .FON bitmap fonts (8×16 VGA), renders glyphs pixel-perfect on canvas.

## Code Conventions
- **Indentation**: Tabs
- **Components**: PascalCase, functional only (no class components)
- **Types**: PascalCase (e.g., `AnsiArtProps`, `AnsiScreen`)
- **Functions**: camelCase
- **Constants**: SCREAMING_SNAKE_CASE
- **Files**: `.tsx` for components, `.ts` for everything else
- **Strict TypeScript**: Full strict mode, explicit type annotations

## Publishing
- Registry: GitHub Packages (`@benhagen/react-ansiart`)
- CI: GitHub Actions on push to main / tag push
- Format: ESM only, React externalized
