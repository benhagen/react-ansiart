'use client'

import { useState } from 'react'
import { RipArt } from 'react-ansiart'

export default function RipPage() {
	const [mode, setMode] = useState<'auto' | 'final' | 'animated'>('auto')
	const [showOverlayControls, setShowOverlayControls] = useState(true)
	const [showPerformanceOverlay, setShowPerformanceOverlay] = useState(false)
	const [bytesPerSecond, setBytesPerSecond] = useState(960)
	const [fps, setFps] = useState(30)

	const url = '/rip/DG-NEO1.RIP'

	return (
		<div>
			<div className='panel'>
				<h2 style={{ marginTop: 0 }}>RIP</h2>
				<p className='muted' style={{ marginBottom: 0 }}>
					Renders a RIPscrip file via <code>{url}</code>.
				</p>
			</div>

			<div className='panel'>
				<h3 style={{ marginTop: 0 }}>Controls</h3>
				<div className='row'>
					<label className='muted'>
						Mode:{' '}
						<select value={mode} onChange={e => setMode(e.target.value as any)} style={{ marginLeft: 8 }}>
							<option value='auto'>auto</option>
							<option value='final'>final</option>
							<option value='animated'>animated</option>
						</select>
					</label>
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
				<RipArt
					url={url}
					mode={mode}
					width='auto'
					height='auto'
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


