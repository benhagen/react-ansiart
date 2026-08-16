'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnsiArt } from 'react-ansiart'
import { CodePreview } from '../_components/CodePreview'
import { ControlGroup } from '../_components/ControlGroup'
import { NumberInput, SelectInput, ToggleInput } from '../_components/ControlRow'
import { SixteenColorsBrowser } from '../_components/SixteenColorsBrowser'
import { Stage } from '../_components/Stage'
import { generateComponentCode } from '../_lib/generateCode'
import { ANSI_ART_DEFAULTS } from '../_lib/defaults'

const LOCAL_FILES = [
	{ value: '/ansi/krl_valentine.ans', label: 'krl_valentine.ans (local)' },
	{ value: '/ansi/cn2acid_animation.ans', label: 'cn2acid_animation.ans (local, animated)' },
	{ value: '/ansi/example.ans', label: 'example.ans (local)' },
	{ value: '/ansi/charset-test.ans', label: 'charset-test.ans (local)' },
]

type BrowserLoadStatus = 'idle' | 'loading' | 'error'

function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false
	const tag = target.tagName
	return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export default function AnsiArtPage() {
	const [src, setSrc] = useState('/ansi/krl_valentine.ans')
	const [srcLabel, setSrcLabel] = useState('krl_valentine.ans')
	const [mode, setMode] = useState<'final' | 'animated' | 'auto'>('auto')
	const [columns, setColumns] = useState<number | 'auto'>(80)
	const [rows, setRows] = useState<number | 'auto'>('auto')
	const [showOverlayControls, setShowOverlayControls] = useState(true)
	const [showPerformanceOverlay, setShowPerformanceOverlay] = useState(false)
	const [sauceOverlay, setSauceOverlay] = useState(false)
	const [bytesPerSecond, setBytesPerSecond] = useState(960)
	const [fps, setFps] = useState(30)
	const [autoStart, setAutoStart] = useState(true)
	const [allowDrop, setAllowDrop] = useState(true)

	// Status for files selected from the 16colo.rs browser: we pre-check the download ourselves
	// (rather than letting AnsiArt's internal fetch fail visibly) so a bad proxy response shows a
	// friendly inline message instead of AnsiArt's raw error text, and so `src` only ever changes
	// once the file is confirmed reachable.
	const [browserStatus, setBrowserStatus] = useState<BrowserLoadStatus>('idle')
	const [browserStatusLabel, setBrowserStatusLabel] = useState('')
	const [browserStatusError, setBrowserStatusError] = useState('')
	const browserAbortRef = useRef<AbortController | null>(null)

	// Whether the 16colo.rs browser is currently showing a pack's file grid (as opposed to the
	// pack search list). SixteenColorsBrowser doesn't expose this via props, so it's inferred from
	// its rendered DOM through a MutationObserver — the file grid carries a stable `.browser-file-grid`
	// class regardless of which pack is open.
	const [packOpen, setPackOpen] = useState(false)
	const browserSectionRef = useRef<HTMLDivElement | null>(null)

	const handleBrowserSelect = useCallback((url: string, label: string) => {
		browserAbortRef.current?.abort()
		const controller = new AbortController()
		browserAbortRef.current = controller
		setBrowserStatus('loading')
		setBrowserStatusLabel(label)
		setBrowserStatusError('')

		fetch(url, { signal: controller.signal })
			.then(async (res) => {
				if (!res.ok) throw new Error(`Server responded ${res.status}`)
				// Fully consume the body so the response is cached before AnsiArt fetches the same
				// URL a moment later (the proxy route sends a 24h Cache-Control header).
				await res.arrayBuffer()
				if (controller.signal.aborted) return
				setSrc(url)
				setSrcLabel(label)
				setBrowserStatus('idle')
			})
			.catch((e: unknown) => {
				if (controller.signal.aborted) return
				setBrowserStatus('error')
				setBrowserStatusError(e instanceof Error ? e.message : 'Failed to load file')
			})
	}, [])

	useEffect(() => {
		return () => browserAbortRef.current?.abort()
	}, [])

	const handleLocalSelect = useCallback((value: string) => {
		browserAbortRef.current?.abort()
		setBrowserStatus('idle')
		setSrc(value)
		const match = LOCAL_FILES.find((f) => f.value === value)
		setSrcLabel(match?.label || value)
	}, [])

	useEffect(() => {
		const container = browserSectionRef.current
		if (!container) return
		const check = () => setPackOpen(!!container.querySelector('.browser-file-grid'))
		check()
		const observer = new MutationObserver(check)
		observer.observe(container, { childList: true, subtree: true })
		return () => observer.disconnect()
	}, [])

	// ←/→ (and j/k) step through the open pack's artworks. Ignored while the user is typing in the
	// search box, a number field, or any other editable control, and only wired up while a pack's
	// file grid is actually showing.
	useEffect(() => {
		if (!packOpen) return

		function handleKeyDown(e: KeyboardEvent) {
			if (isTypingTarget(e.target)) return
			const isNext = e.key === 'ArrowRight' || e.key === 'j' || e.key === 'J'
			const isPrev = e.key === 'ArrowLeft' || e.key === 'k' || e.key === 'K'
			if (!isNext && !isPrev) return

			const container = browserSectionRef.current
			if (!container) return
			// <details> keeps its children in the DOM even while collapsed, so the file grid is
			// still queryable and packOpen stays true — without this check, arrows would silently
			// swap artwork (and block page scroll) while the "Browse 16colo.rs" panel is closed.
			const details = container.closest('details')
			if (!details || !details.open) return
			const items = Array.from(container.querySelectorAll<HTMLButtonElement>('.browser-file-item'))
			if (items.length === 0) return

			e.preventDefault()

			// Match the currently displayed file against the grid by filename: the proxy URL encodes
			// it as `?file=`, and SixteenColorsBrowser sets each button's title to the same filename.
			let currentIndex = -1
			try {
				const currentFile = new URL(src, window.location.origin).searchParams.get('file')
				if (currentFile) currentIndex = items.findIndex((btn) => btn.title === currentFile)
			} catch {
				// src isn't a proxy URL (e.g. a local file) — treat as "nothing selected yet"
			}

			const nextIndex =
				currentIndex === -1
					? isNext
						? 0
						: items.length - 1
					: isNext
					? (currentIndex + 1) % items.length
					: (currentIndex - 1 + items.length) % items.length

			items[nextIndex].click()
		}

		document.addEventListener('keydown', handleKeyDown)
		return () => document.removeEventListener('keydown', handleKeyDown)
	}, [packOpen, src])

	const code = useMemo(() => {
		return generateComponentCode(
			'AnsiArt',
			'react-ansiart',
			{ src, mode, columns, rows, showOverlayControls, showPerformanceOverlay, sauceOverlay, bytesPerSecond, fps, autoStart, allowDrop },
			ANSI_ART_DEFAULTS
		)
	}, [src, mode, columns, rows, showOverlayControls, showPerformanceOverlay, sauceOverlay, bytesPerSecond, fps, autoStart, allowDrop])

	return (
		<>
			{/* `.playground-canvas canvas { max-width: 100% }` (globals.css) assumes the canvas is a
			    direct, definitely-sized descendant of `.playground-canvas`. Inside Stage, the canvas
			    instead sits under an absolutely-positioned, shrink-to-fit `.stage-scaler`; that 100%
			    resolves against an indeterminate containing-block width and computes to 0, which wins
			    over the canvas's own inline `width` (max-width clamps width even though the inline
			    style has higher specificity for `width` itself) — collapsing the art to nothing while
			    height renders fine (the inline `height` beats the class's plain `height: auto`).
			    Override with higher specificity here rather than touching the shared stylesheet. */}
			<style>{`
				.playground-canvas .stage canvas {
					max-width: none;
				}
			`}</style>
			<div className="page-header">
				<h1>AnsiArt</h1>
				<p>Load and render ANSI art files with authentic VGA bitmap font rendering</p>
			</div>
			<div className="playground">
				<div className="playground-canvas">
					<Stage style={{ width: '100%' }} storageKey="ansiart-demo:stage:ansi-art">
						<AnsiArt
							key={src}
							src={src}
							mode={mode}
							columns={columns}
							rows={rows}
							showOverlayControls={showOverlayControls}
							showPerformanceOverlay={showPerformanceOverlay}
							sauceOverlay={sauceOverlay}
							bytesPerSecond={bytesPerSecond}
							fps={fps}
							autoStart={autoStart}
							allowDrop={allowDrop}
						/>
					</Stage>
				</div>
				<div className="controls-panel">
					<ControlGroup label="Local Files">
						<SelectInput
							label="File"
							value={LOCAL_FILES.some((f) => f.value === src) ? src : ''}
							onChange={handleLocalSelect}
							options={[
								{ value: '', label: '—' },
								...LOCAL_FILES,
							]}
						/>
					</ControlGroup>

					<ControlGroup label="Browse 16colo.rs" defaultOpen={true}>
						<div ref={browserSectionRef}>
							<div aria-live="polite">
								{browserStatus === 'loading' && (
									<div className="browser-loading">Downloading {browserStatusLabel}…</div>
								)}
								{browserStatus === 'error' && (
									<div className="browser-error">
										Couldn&rsquo;t load {browserStatusLabel}: {browserStatusError}
									</div>
								)}
								{browserStatus === 'idle' && src && !LOCAL_FILES.some((f) => f.value === src) && (
									<div className="browser-active-file">
										<span>{srcLabel}</span>
									</div>
								)}
							</div>
							<SixteenColorsBrowser onSelectFile={handleBrowserSelect} />
							{packOpen && (
								<div className="muted" style={{ fontSize: 11, textAlign: 'center', marginTop: 6 }}>
									&larr;/&rarr; or j/k to browse
								</div>
							)}
						</div>
					</ControlGroup>

					<ControlGroup label="Display">
						<SelectInput
							label="Mode"
							value={mode}
							onChange={(v) => setMode(v as 'final' | 'animated' | 'auto')}
							options={[
								{ value: 'auto', label: 'Auto' },
								{ value: 'final', label: 'Final' },
								{ value: 'animated', label: 'Animated' },
							]}
						/>
						<SelectInput
							label="Columns"
							value={String(columns)}
							onChange={(v) => setColumns(v === 'auto' ? 'auto' : Number(v))}
							options={[
								{ value: 'auto', label: 'Auto' },
								{ value: '80', label: '80' },
								{ value: '120', label: '120' },
							]}
						/>
						<SelectInput
							label="Rows"
							value={String(rows)}
							onChange={(v) => setRows(v === 'auto' ? 'auto' : Number(v))}
							options={[
								{ value: 'auto', label: 'Auto' },
								{ value: '25', label: '25' },
								{ value: '50', label: '50' },
							]}
						/>
					</ControlGroup>

					<ControlGroup label="Animation">
						<NumberInput label="Bytes/sec" value={bytesPerSecond} onChange={setBytesPerSecond} min={10} step={10} />
						<NumberInput label="FPS" value={fps} onChange={setFps} min={1} step={1} />
						<ToggleInput label="Auto Start" value={autoStart} onChange={setAutoStart} />
					</ControlGroup>

					<ControlGroup label="Overlays">
						<ToggleInput label="Player Controls" value={showOverlayControls} onChange={setShowOverlayControls} />
						<ToggleInput label="Performance" value={showPerformanceOverlay} onChange={setShowPerformanceOverlay} />
						<ToggleInput label="SAUCE Metadata" value={sauceOverlay} onChange={setSauceOverlay} />
						<ToggleInput label="Allow Drop" value={allowDrop} onChange={setAllowDrop} />
					</ControlGroup>

					<ControlGroup label="Code" defaultOpen={false}>
						<CodePreview code={code} />
					</ControlGroup>
				</div>
			</div>
		</>
	)
}
