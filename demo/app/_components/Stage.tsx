'use client'

/**
 * Stage — shared presentation wrapper for every viewer page.
 *
 * Centers a canvas-rendering child in a dark stage area and provides a slim
 * control strip: integer/fit scaling (pixelated), a CSS-only CRT overlay and a
 * Fullscreen API toggle. Scale + CRT preferences persist in localStorage so
 * they carry across pages.
 *
 * Height is driven by the `--stage-height` CSS custom property (see globals.css)
 * rather than by the content, which keeps the fit calculation from feeding back
 * into layout. Pages can override it:
 *   <Stage style={{ ['--stage-height' as string]: 'calc(100vh - 160px)' }}>
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'

export type StageScale = 1 | 2 | 'fit'

export type StageProps = {
	children: React.ReactNode
	/** Extra controls rendered at the left of the stage toolbar (optional). */
	actions?: React.ReactNode
	/** Upper bound for the "Fit" scale factor. Default 4. */
	maxFitScale?: number
	/** localStorage key for the persisted { scale, crt } prefs. */
	storageKey?: string
	className?: string
	style?: React.CSSProperties
}

const DEFAULT_STORAGE_KEY = 'ansiart-demo:stage'
/** Breathing room so a scrollbar appearing can't oscillate the fit scale. */
const FIT_MARGIN = 4

type StagePrefs = { scale: StageScale; crt: boolean }

function readPrefs(key: string): StagePrefs | null {
	if (typeof window === 'undefined') return null
	try {
		const raw = window.localStorage.getItem(key)
		if (!raw) return null
		const parsed = JSON.parse(raw) as Partial<StagePrefs>
		const scale: StageScale =
			parsed.scale === 1 || parsed.scale === 2 || parsed.scale === 'fit' ? parsed.scale : 'fit'
		return { scale, crt: parsed.crt === true }
	} catch {
		return null
	}
}

function writePrefs(key: string, prefs: StagePrefs): void {
	if (typeof window === 'undefined') return
	try {
		window.localStorage.setItem(key, JSON.stringify(prefs))
	} catch {
		/* storage unavailable (private mode / quota) — prefs simply don't persist */
	}
}

export function Stage({
	children,
	actions,
	maxFitScale = 4,
	storageKey = DEFAULT_STORAGE_KEY,
	className,
	style,
}: StageProps) {
	const stageRef = useRef<HTMLDivElement | null>(null)
	const viewportRef = useRef<HTMLDivElement | null>(null)
	const contentRef = useRef<HTMLDivElement | null>(null)

	// SSR-safe defaults; real prefs are applied after mount to avoid hydration mismatch.
	const [scale, setScale] = useState<StageScale>('fit')
	const [crt, setCrt] = useState(false)
	const [isFullscreen, setIsFullscreen] = useState(false)
	const [canFullscreen, setCanFullscreen] = useState(true)

	const [contentSize, setContentSize] = useState({ width: 0, height: 0 })
	const [available, setAvailable] = useState({ width: 0, height: 0 })

	// ─── prefs ───────────────────────────────────────────────────────────────
	useEffect(() => {
		const prefs = readPrefs(storageKey)
		if (prefs) {
			setScale(prefs.scale)
			setCrt(prefs.crt)
		}
	}, [storageKey])

	const applyScale = useCallback(
		(next: StageScale) => {
			setScale(next)
			writePrefs(storageKey, { scale: next, crt })
		},
		[crt, storageKey]
	)

	const toggleCrt = useCallback(() => {
		const next = !crt
		setCrt(next)
		writePrefs(storageKey, { scale, crt: next })
	}, [crt, scale, storageKey])

	// ─── measurement ─────────────────────────────────────────────────────────
	// offsetWidth/Height report the *layout* box, which CSS transforms do not
	// affect — so measuring the scaled element still yields its natural size.
	useEffect(() => {
		const el = contentRef.current
		if (!el || typeof ResizeObserver === 'undefined') return
		const measure = () => {
			setContentSize((prev) =>
				prev.width === el.offsetWidth && prev.height === el.offsetHeight
					? prev
					: { width: el.offsetWidth, height: el.offsetHeight }
			)
		}
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [])

	useEffect(() => {
		const el = viewportRef.current
		if (!el || typeof ResizeObserver === 'undefined') return
		const measure = () => {
			const w = el.clientWidth
			const h = el.clientHeight
			setAvailable((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }))
		}
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [])

	// ─── fullscreen ──────────────────────────────────────────────────────────
	useEffect(() => {
		const el = stageRef.current
		if (el && typeof el.requestFullscreen !== 'function') setCanFullscreen(false)
		const onChange = () => setIsFullscreen(document.fullscreenElement === stageRef.current)
		document.addEventListener('fullscreenchange', onChange)
		return () => document.removeEventListener('fullscreenchange', onChange)
	}, [])

	const toggleFullscreen = useCallback(() => {
		const el = stageRef.current
		if (!el) return
		if (document.fullscreenElement === el) {
			void document.exitFullscreen?.()?.catch?.(() => undefined)
			return
		}
		if (typeof el.requestFullscreen !== 'function') return // graceful no-op
		void el.requestFullscreen().catch(() => undefined)
	}, [])

	// ─── scale factor ────────────────────────────────────────────────────────
	let factor = 1
	if (scale === 'fit') {
		if (contentSize.width > 0 && contentSize.height > 0 && available.width > 0) {
			const fitW = (available.width - FIT_MARGIN) / contentSize.width
			const fitH =
				available.height > 0 ? (available.height - FIT_MARGIN) / contentSize.height : Infinity
			factor = Math.max(0.1, Math.min(fitW, fitH, maxFitScale))
		}
	} else {
		factor = scale
	}

	const framed = contentSize.width > 0 && contentSize.height > 0
	const frameStyle: React.CSSProperties = framed
		? { width: contentSize.width * factor, height: contentSize.height * factor }
		: {}

	return (
		<div
			ref={stageRef}
			className={className ? `stage ${className}` : 'stage'}
			style={style}
			data-crt={crt ? 'on' : 'off'}
		>
			<div className="stage-toolbar">
				{actions ? <div className="stage-toolbar-actions">{actions}</div> : null}
				<div className="stage-toolbar-right">
					<div className="stage-seg" role="group" aria-label="Zoom">
						<button
							type="button"
							className={scale === 1 ? 'stage-seg-btn active' : 'stage-seg-btn'}
							aria-pressed={scale === 1}
							onClick={() => applyScale(1)}
						>
							1&times;
						</button>
						<button
							type="button"
							className={scale === 2 ? 'stage-seg-btn active' : 'stage-seg-btn'}
							aria-pressed={scale === 2}
							onClick={() => applyScale(2)}
						>
							2&times;
						</button>
						<button
							type="button"
							className={scale === 'fit' ? 'stage-seg-btn active' : 'stage-seg-btn'}
							aria-pressed={scale === 'fit'}
							onClick={() => applyScale('fit')}
						>
							Fit
						</button>
					</div>
					<button
						type="button"
						className={crt ? 'stage-btn active' : 'stage-btn'}
						aria-pressed={crt}
						onClick={toggleCrt}
						title="Toggle CRT overlay"
					>
						CRT
					</button>
					<button
						type="button"
						className="stage-btn"
						onClick={toggleFullscreen}
						disabled={!canFullscreen}
						title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
						aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
					>
						{isFullscreen ? '⤡' : '⤢'}
					</button>
				</div>
			</div>

			<div className="stage-viewport" ref={viewportRef}>
				<div className="stage-frame" style={frameStyle}>
					<div
						className="stage-scaler"
						ref={contentRef}
						style={{ transform: `scale(${factor})`, transformOrigin: 'top left' }}
					>
						{children}
					</div>
					{crt ? <div className="stage-crt" aria-hidden="true" /> : null}
				</div>
			</div>
		</div>
	)
}

export default Stage
