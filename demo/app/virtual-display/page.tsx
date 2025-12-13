'use client'

import { useEffect, useMemo, useState } from 'react'
import {
	AnsiVirtualDisplay,
	clearFireState,
	generateAsciiFireFrame,
	generateAsciiPerlinPlasmaFrame,
	generateAsciiSonarFrame,
} from 'react-ansiart'

const FONT_URL = '/ansi/fonts/Bm437_IBM_VGA_8x16.FON'

type GeneratorType = 'perlinPlasma' | 'fire' | 'sonar'

export default function VirtualDisplayPage() {
	const [generatorType, setGeneratorType] = useState<GeneratorType>('perlinPlasma')
	const [columns, setColumns] = useState(80)
	const [rows, setRows] = useState(25)
	const [fps, setFps] = useState(30)
	const [showPerformanceOverlay, setShowPerformanceOverlay] = useState(false)
	const [sonarFrequency, setSonarFrequency] = useState(0.9)
	const [sonarIntensity, setSonarIntensity] = useState(1.0)

	useEffect(() => {
		clearFireState()
	}, [generatorType])

	const frameGenerator = useMemo(() => {
		if (generatorType === 'fire') {
			return (frame: number, cols: number, r: number) => {
				return generateAsciiFireFrame(frame, cols, r, {
					bgColor: '#000000',
					darkenAmount: 0.6,
					seed: 1337,
				})
			}
		}

		if (generatorType === 'sonar') {
			return (frame: number, cols: number, r: number) => {
				return generateAsciiSonarFrame(frame, cols, r, {
					fps,
					fgColor: '#ffffff',
					bgColor: '#000000',
					dotChar: '.',
					frequency: sonarFrequency,
					intensity: sonarIntensity,
					speed: 14,
					bandWidth: 1.25,
					decay: 0.75,
					baseAlpha: 0.03,
					alphaSteps: 32,
					aspectY: 2,
				})
			}
		}

		return (frame: number, cols: number, r: number) => {
			return generateAsciiPerlinPlasmaFrame(frame, cols, r, {
				fgColor: '#55FFFF',
				bgColor: '#000000',
				timeScale: 0.55,
				seed: 1337,
			})
		}
	}, [generatorType, fps, sonarFrequency, sonarIntensity])

	return (
		<div>
			<div className='panel'>
				<h2 style={{ marginTop: 0 }}>Virtual Display</h2>
				<p className='muted' style={{ marginBottom: 0 }}>
					Procedural animation using{' '}
					<code>
						{generatorType === 'fire'
							? 'generateAsciiFireFrame'
							: generatorType === 'sonar'
							? 'generateAsciiSonarFrame'
							: 'generateAsciiPerlinPlasmaFrame'}
					</code>
					.
				</p>
			</div>

			<div className='panel'>
				<h3 style={{ marginTop: 0 }}>Controls</h3>
				<div className='row'>
					<label className='muted'>
						Generator:{' '}
						<select
							value={generatorType}
							onChange={e => setGeneratorType(e.target.value as GeneratorType)}
							style={{ marginLeft: 8 }}
						>
							<option value='perlinPlasma'>Perlin plasma</option>
							<option value='fire'>Fire</option>
							<option value='sonar'>Sonar</option>
						</select>
					</label>
					{generatorType === 'sonar' && (
						<>
							<label className='muted'>
								Frequency (Hz):{' '}
								<input
									type='number'
									min={0.05}
									step={0.05}
									value={sonarFrequency}
									onChange={e => setSonarFrequency(Number(e.target.value))}
									style={{ marginLeft: 8, width: 110 }}
								/>
							</label>
							<label className='muted'>
								Intensity:{' '}
								<input
									type='number'
									min={0}
									step={0.1}
									value={sonarIntensity}
									onChange={e => setSonarIntensity(Number(e.target.value))}
									style={{ marginLeft: 8, width: 110 }}
								/>
							</label>
						</>
					)}
					<label className='muted'>
						Columns:{' '}
						<input
							type='number'
							min={10}
							step={1}
							value={columns}
							onChange={e => setColumns(Number(e.target.value))}
							style={{ marginLeft: 8, width: 90 }}
						/>
					</label>
					<label className='muted'>
						Rows:{' '}
						<input
							type='number'
							min={10}
							step={1}
							value={rows}
							onChange={e => setRows(Number(e.target.value))}
							style={{ marginLeft: 8, width: 90 }}
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
					<button className='btn' onClick={() => setShowPerformanceOverlay(v => !v)}>
						Performance overlay: {showPerformanceOverlay ? 'on' : 'off'}
					</button>
				</div>
			</div>

			<div className='panel'>
				<h3 style={{ marginTop: 0 }}>Render</h3>
				<AnsiVirtualDisplay
					columns={columns}
					rows={rows}
					fps={fps}
					frameGenerator={frameGenerator}
					bitmapFontUrl={FONT_URL}
					showPerformanceOverlay={showPerformanceOverlay}
				/>
			</div>
		</div>
	)
}
