# react-ansiart demo (Next.js)

This is a Next.js (App Router) demo app used to **demo and debug** the local `react-ansiart` package.

## How it’s wired

- **Library dependency**: `demo/package.json` uses `"react-ansiart": "file:.."`.
- **Assets**: `react-ansiart` loads `.ans` and `.FON` via `fetch()`, so the demo serves assets from `demo/public/`.
  - ANSI: `demo/public/ansi/*.ans` → `/ansi/*.ans`
  - Font: `demo/public/ansi/fonts/Bm437_IBM_VGA_8x16.FON` → `/ansi/fonts/Bm437_IBM_VGA_8x16.FON`

## Dev workflow (recommended)

In two terminals:

1. Watch-build the library output:

```bash
cd /Users/benhagen/syncthing/development/react-ansiart
npm run dev
```

2. Run the demo app:

```bash
cd /Users/benhagen/syncthing/development/react-ansiart
npm --prefix demo run dev
```

Or run both from the repo root (after installing deps):

```bash
cd /Users/benhagen/syncthing/development/react-ansiart
npm run demo:dev
```

## If demo changes don’t reflect immediately

Depending on your npm version/config, `file:` dependencies may not always live-update exactly like a symlink.

Try one of these:

1. Re-install in the demo:

```bash
npm --prefix demo install
```

2. Use `npm link` for a true symlinked workflow:

```bash
cd /Users/benhagen/syncthing/development/react-ansiart
npm link

cd /Users/benhagen/syncthing/development/react-ansiart/demo
npm link react-ansiart
```
