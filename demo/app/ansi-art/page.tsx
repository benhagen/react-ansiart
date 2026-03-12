'use client'

import { useCallback, useMemo, useState } from 'react'
import { AnsiArt } from 'react-ansiart'
import { CodePreview } from '../_components/CodePreview'
import { ControlGroup } from '../_components/ControlGroup'
import { NumberInput, SelectInput, ToggleInput } from '../_components/ControlRow'
import { SixteenColorsBrowser } from '../_components/SixteenColorsBrowser'
import { generateComponentCode } from '../_lib/generateCode'
import { ANSI_ART_DEFAULTS } from '../_lib/defaults'

const LOCAL_FILES = [
	{ value: '/ansi/example.ans', label: 'example.ans (local)' },
	{ value: '/ansi/charset-test.ans', label: 'charset-test.ans (local)' },
]

export default function AnsiArtPage() {
	const [src, setSrc] = useState('/ansi/example.ans')
	const [srcLabel, setSrcLabel] = useState('example.ans')
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

	const handleBrowserSelect = useCallback((url: string, label: string) => {
		setSrc(url)
		setSrcLabel(label)
	}, [])

	const handleLocalSelect = useCallback((value: string) => {
		setSrc(value)
		const match = LOCAL_FILES.find((f) => f.value === value)
		setSrcLabel(match?.label || value)
	}, [])

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
			<div className="page-header">
				<h1>AnsiArt</h1>
				<p>Load and render ANSI art files with authentic VGA bitmap font rendering</p>
			</div>
			<div className="playground">
				<div className="playground-canvas">
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
						{src && !LOCAL_FILES.some((f) => f.value === src) && (
							<div className="browser-active-file">
								<span>{srcLabel}</span>
							</div>
						)}
						<SixteenColorsBrowser onSelectFile={handleBrowserSelect} />
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
