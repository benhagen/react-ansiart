#!/usr/bin/env node
// Guards the library's tree-shaking guarantees.
//
// Both leaks this script was written for shared one failure mode: a static import
// added to a component for a feature that only renders conditionally. Nothing in
// tsc, eslint, or the test suite notices — the cost only shows up in a consumer's
// bundle. So measure it directly: bundle a handful of representative imports the
// way a real app would, and fail if the entry chunk grows past its budget.

import { build } from 'esbuild'
import { gzipSync } from 'node:zlib'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BUDGETS = join(ROOT, 'bundle-budgets.json')
const DIST = join(ROOT, 'dist')
const UPDATE = process.argv.includes('--update')

if (!readdirSync(ROOT).includes('dist')) {
	console.error('dist/ not found — run `npm run build` first.')
	process.exit(1)
}

const config = JSON.parse(readFileSync(BUDGETS, 'utf8'))
const tmp = mkdtempSync(join(tmpdir(), 'ansiart-size-'))

/**
 * Bundle one consumer scenario and return the gzipped size of its entry chunk.
 *
 * Only the entry is measured. Code splitting is on, so anything reached through a
 * dynamic import lands in a sibling chunk and is deliberately not counted — that
 * is the whole point of deferring it.
 */
async function measure(scenario) {
	// Rewrite the bare specifier to the built output, so the budget reflects what
	// is actually published rather than what src/ happens to look like.
	const source = scenario.import.replace(/'react-ansiart'/g, JSON.stringify(join(DIST, 'index.js')))
	const entry = join(tmp, 'entry.js')
	// The import alone would be elided as unused; reference the bindings so the
	// bundler keeps exactly what a real consumer would retain.
	const names = [...scenario.import.matchAll(/\{([^}]*)\}/g)]
		.flatMap(m => m[1].split(','))
		.map(s => s.trim())
		.filter(Boolean)
	writeFileSync(entry, `${source}\nglobalThis.__keep = [${names.join(', ')}]\n`)

	const outdir = join(tmp, 'out')
	rmSync(outdir, { recursive: true, force: true })
	await build({
		entryPoints: [entry],
		bundle: true,
		format: 'esm',
		minify: true,
		splitting: true,
		outdir,
		external: ['react'],
		logLevel: 'error',
	})
	return gzipSync(readFileSync(join(outdir, 'entry.js')), { level: 9 }).length
}

const results = []
for (const scenario of config.scenarios) {
	results.push({ ...scenario, actual: await measure(scenario) })
}
rmSync(tmp, { recursive: true, force: true })

const failures = results.filter(r => r.actual > r.maxGzip)

const width = Math.max(...results.map(r => r.name.length))
console.log('\nBundle size (gzipped entry chunk)\n')
for (const r of results) {
	const delta = r.actual - r.maxGzip
	const status = r.actual > r.maxGzip ? 'FAIL' : 'ok'
	console.log(
		`  ${status.padEnd(5)} ${r.name.padEnd(width)}  ${String(r.actual).padStart(6)} B` +
			`  / ${String(r.maxGzip).padStart(6)} B budget` +
			`  (${delta >= 0 ? '+' : ''}${delta})`
	)
}

if (UPDATE) {
	// ~4% headroom so routine toolchain drift does not fail CI; a real regression
	// is far larger than that, because it means a whole module got pulled back in.
	for (const r of config.scenarios) {
		const measured = results.find(x => x.name === r.name).actual
		r.maxGzip = Math.ceil((measured * 1.04) / 10) * 10
	}
	writeFileSync(BUDGETS, JSON.stringify(config, null, '\t') + '\n')
	console.log('\nBudgets re-baselined in bundle-budgets.json')
	process.exit(0)
}

if (failures.length > 0) {
	console.error(
		`\n${failures.length} bundle(s) over budget. A jump usually means a module ` +
			'became statically reachable that used to be lazy or shaken out.\n' +
			'If the growth is intentional, re-baseline with `npm run size -- --update`.\n'
	)
	process.exit(1)
}

console.log('\nAll bundles within budget.\n')
