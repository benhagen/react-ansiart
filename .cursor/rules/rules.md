# Cursor rules: react-ansiart

## What this repo is

- **Published library**: TypeScript/React library built from `src/` into `dist/`.
- **Demo app**: Next.js App Router demo under `demo/` that consumes the library via `"react-ansiart": "file:.."`.

## Where to make changes (default scope: library + demo)

- **Library source of truth**: `src/**` (components, parser, generators, utils, types).
- **Library entry/exports**: `src/index.ts`.
- **Library build config**: `tsup.config.ts`, `tsconfig.json`, root `package.json` scripts.
- **Demo app pages/layout**: `demo/app/**`.
- **Demo assets (served via fetch)**: `demo/public/**`.
- **Root public assets (if used)**: `public/**`.
- **Examples/docs**: `README.md`, `EXAMPLE_USAGE.md`, `FIRE_EXAMPLE.md`, `demo/README.md`.

## Formatting + style (hard rules)

- **Tabs only**: Always use tabs for indentation.
- **Match existing patterns**: Prefer existing naming, file structure, and API shapes.
- **Keep changes minimal**: Don’t refactor unrelated code while fixing/adding something.

## Build artifacts policy (`dist/` is versioned)

- **Never hand-edit `dist/**`\*\*.
- When library code changes:
  - Update `src/**`.
  - Rebuild with `npm run build`.
  - Commit the resulting `dist/**` changes.

## Workflows

- **Library (root)**:
  - Dev watch build: `npm run dev`
  - Production build: `npm run build`
- **Demo (Next.js)**:
  - Dev: `npm --prefix demo run dev`
  - Lint: `npm --prefix demo run lint`
  - Combined (recommended): `npm run demo:dev`

## TypeScript / correctness

- **TypeScript is strict** (root `tsconfig.json`): keep types accurate; don’t silence errors with `any` unless unavoidable.
- **Backwards compatibility**: Don’t break exported APIs unless explicitly requested.
- **External deps**: Don’t add dependencies unless clearly justified.

## Demo-specific notes

- `react-ansiart` loads `.ans` and `.FON` via `fetch()`, so demo assets should live in `demo/public/` (see `demo/README.md`).
- If demo doesn’t reflect library changes, re-install in demo (`npm --prefix demo install`) or use `npm link` (also documented in `demo/README.md`).

## When asked to do a change

- Prefer implementing in the library **and** updating the demo to exercise the change (when applicable).
- Update docs/examples when you change public props, exports, or behavior.
