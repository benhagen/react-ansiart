---
name: react-ansiart-publish
description: Guides publishing and releasing the react-ansiart npm package to GitHub Packages. Use when versioning, tagging, or running the publish workflow.
---

# react-ansiart Publish

## How Publishing Works

- **Trigger**: Push a tag matching `v*` (e.g. `v0.2.0`). See `.github/workflows/publish-npm.yml`.
- **Registry**: GitHub Packages. The workflow sets the package name to `@<owner>/react-ansiart` for publish.
- **Local package.json**: Keeps `"name": "react-ansiart"` for local and file: usage; the workflow overwrites name only during the publish step.

## Release Steps

1. **Bump version** in root `package.json` (`"version": "x.y.z"`).
2. **Rebuild**: `npm run build`. Commit any `dist/` changes.
3. **Tag**: `git tag vx.y.z` (match the version in package.json).
4. **Push tag**: `git push origin vx.y.z`. This triggers the workflow.
5. The workflow runs `npm ci`, `npm run build`, then publishes to GitHub Packages with `--access restricted`.

## Workflow Details

- Uses `secrets.GITHUB_TOKEN` for auth (no extra secrets needed for same-org publish).
- Scope is set from the repo owner: `@${{ github.repository_owner }}/react-ansiart`.
- Consumers install with: `npm install @<owner>/react-ansiart` and may need `.npmrc` with `registry` for that scope.

## Before Tagging

- Ensure README and docs reflect new behavior or props.
- Ensure `dist/` is up to date and committed if source changed.
