'use client'

import { useMemo, useState } from 'react'
import { AnsiArt } from 'react-ansiart'

const FONT_URL = '/ansi/fonts/Bm437_IBM_VGA_8x16.FON'

export default function AnsiPage() {
	const [mode, setMode] = useState<'final' | 'animated' | 'auto'>('auto')
	const [columns, setColumns] = useState<number | 'auto'>(80)
	const [rows, setRows] = useState<number | 'auto'>('auto')
	const [showOverlayControls, setShowOverlayControls] = useState(true)
	const [showPerformanceOverlay, setShowPerformanceOverlay] = useState(false)
	const [bytesPerSecond, setBytesPerSecond] = useState(960)
	const [fps, setFps] = useState(30)

	const src = useMemo(() => {
		// `example.ans` is small and good for a quick sanity check.
		return '/ansi/example.ans'
	}, [])

	return (
		<div>
			<div className='panel'>
				<h2 style={{ marginTop: 0 }}>ANSI</h2>
				<p className='muted' style={{ marginBottom: 0 }}>
					Renders an ANSI file via <code>{src}</code> and loads the bitmap font via <code>{FONT_URL}</code>.
				</p>
			</div>

			<div className='panel'>
				<h3 style={{ marginTop: 0 }}>Controls</h3>
				<div className='row'>
					<label className='muted'>
						Mode:{' '}
						<select
							value={mode}
							onChange={e => setMode(e.target.value as any)}
							style={{ marginLeft: 8 }}
						>
							<option value='auto'>auto</option>
							<option value='final'>final</option>
							<option value='animated'>animated</option>
						</select>
					</label>

					<label className='muted'>
						Columns:{' '}
						<select
							value={String(columns)}
							onChange={e => {
								const v = e.target.value
								setColumns(v === 'auto' ? 'auto' : Number(v))
							}}
							style={{ marginLeft: 8 }}
						>
							<option value='auto'>auto</option>
							<option value='80'>80</option>
							<option value='120'>120</option>
						</select>
					</label>

					<label className='muted'>
						Rows:{' '}
						<select
							value={String(rows)}
							onChange={e => {
								const v = e.target.value
								setRows(v === 'auto' ? 'auto' : Number(v))
							}}
							style={{ marginLeft: 8 }}
						>
							<option value='auto'>auto</option>
							<option value='25'>25</option>
							<option value='50'>50</option>
						</select>
					</label>
				</div>

				<div className='divider' />

				<div className='row'>
					<button className='btn' onClick={() => setShowOverlayControls(v => !v)}>
						Overlay controls: {showOverlayControls ? 'on' : 'off'}
					</button>
					<button className='btn' onClick={() => setShowPerformanceOverlay(v => !v)}>
						Performance overlay: {showPerformanceOverlay ? 'on' : 'off'}
					</button>
				</div>

				<div className='divider' />

				<div className='row'>
					<label className='muted'>
						bytes/sec:{' '}
						<input
							type='number'
							min={10}
							step={10}
							value={bytesPerSecond}
							onChange={e => setBytesPerSecond(Number(e.target.value))}
							style={{ marginLeft: 8, width: 120 }}
						/>
					</label>
					<label className='muted'>
						fps:{' '}
						<input
							type='number'
							min={1}
							step={1}
							value={fps}
							onChange={e => setFps(Number(e.target.value))}
							style={{ marginLeft: 8, width: 90 }}
						/>
					</label>
					<span className='muted' style={{ fontSize: 12 }}>
						(only used in animated mode)
					</span>
				</div>
			</div>

			<div className='panel'>
				<h3 style={{ marginTop: 0 }}>Render</h3>
				<AnsiArt
					src={src}
					mode={mode}
					columns={columns}
					rows={rows}
					bitmapFontUrl={FONT_URL}
					showOverlayControls={showOverlayControls}
					showPerformanceOverlay={showPerformanceOverlay}
					bytesPerSecond={bytesPerSecond}
					fps={fps}
					allowDrop={true}
				/>
			</div>
		</div>
	)
}





