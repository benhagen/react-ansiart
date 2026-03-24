'use client'

import { useMemo, useState } from 'react'
import {
	PlasmaBackgroundLayout,
	generateAsciiPerlinPlasmaFrame,
	generateAsciiFireFrame,
	generateAsciiSonarFrame,
	generateAsciiDatamoshFrame,
	generateAsciiMetaballsFrame,
	generateAsciiMatrixRainFrame,
	generateAsciiStarfieldFrame,
	generateAsciiTunnelFrame,
	generateAsciiGameOfLifeFrame,
	generateAsciiWaterRippleFrame,
	generateAsciiMandelbrotFrame,
} from 'react-ansiart'
import { CodePreview } from '../_components/CodePreview'
import { ControlGroup } from '../_components/ControlGroup'
import { ColorInput, NumberInput, SelectInput, ToggleInput } from '../_components/ControlRow'

type GeneratorType = 'plasma' | 'fire' | 'sonar' | 'datamosh' | 'metaballs' | 'matrix' | 'starfield' | 'tunnel' | 'gameOfLife' | 'waterRipple' | 'mandelbrot'

const GENERATOR_OPTIONS = [
	{ value: 'plasma', label: 'Plasma' },
	{ value: 'fire', label: 'Fire' },
	{ value: 'sonar', label: 'Sonar' },
	{ value: 'datamosh', label: 'Datamosh' },
	{ value: 'metaballs', label: 'Metaballs' },
	{ value: 'matrix', label: 'Matrix Rain' },
	{ value: 'starfield', label: 'Starfield' },
	{ value: 'tunnel', label: 'Tunnel' },
	{ value: 'gameOfLife', label: 'Game of Life' },
	{ value: 'waterRipple', label: 'Water Ripples' },
	{ value: 'mandelbrot', label: 'Mandelbrot' },
]

export default function BackgroundsPage() {
	const [mode, setMode] = useState<'fixed' | 'scrollable'>('fixed')
	const [generatorType, setGeneratorType] = useState<GeneratorType>('plasma')
	const [fps, setFps] = useState(30)
	const [showPerformanceOverlay, setShowPerformanceOverlay] = useState(false)
	const [fgColor, setFgColor] = useState('#55ffff')
	const [bgColor, setBgColor] = useState('#000000')
	const [seed, setSeed] = useState(12345)

	const frameGenerator = useMemo(() => {
		const opts = { fgColor, bgColor, seed }
		switch (generatorType) {
			case 'fire':
				return (f: number, c: number, r: number) => generateAsciiFireFrame(f, c, r, { bgColor, seed })
			case 'sonar':
				return (f: number, c: number, r: number) => generateAsciiSonarFrame(f, c, r, { fgColor, bgColor })
			case 'datamosh':
				return (f: number, c: number, r: number) => generateAsciiDatamoshFrame(f, c, r, { bgColor, seed })
			case 'metaballs':
				return (f: number, c: number, r: number) => generateAsciiMetaballsFrame(f, c, r, { fgColor, bgColor, seed })
			case 'matrix':
				return (f: number, c: number, r: number) => generateAsciiMatrixRainFrame(f, c, r, { trailColor: fgColor, bgColor, seed })
			case 'starfield':
				return (f: number, c: number, r: number) => generateAsciiStarfieldFrame(f, c, r, { fgColor, bgColor, seed })
			case 'tunnel':
				return (f: number, c: number, r: number) => generateAsciiTunnelFrame(f, c, r, { fgColor, bgColor })
			case 'gameOfLife':
				return (f: number, c: number, r: number) => generateAsciiGameOfLifeFrame(f, c, r, { fgColor, bgColor, seed })
			case 'waterRipple':
				return (f: number, c: number, r: number) => generateAsciiWaterRippleFrame(f, c, r, { fgColor, bgColor, seed })
			case 'mandelbrot':
				return (f: number, c: number, r: number) => generateAsciiMandelbrotFrame(f, c, r, { bgColor })
			default:
				return (f: number, c: number, r: number) => generateAsciiPerlinPlasmaFrame(f, c, r, { fgColor, bgColor, seed })
		}
	}, [generatorType, fgColor, bgColor, seed])

	const code = useMemo(() => {
		const lines = [
			`import { GeneratorBackgroundLayout, ${GENERATOR_OPTIONS.find(o => o.value === generatorType)?.label.replace(/\s/g, '') || 'generateAsciiPerlinPlasmaFrame'} } from 'react-ansiart'`,
			``,
			`<GeneratorBackgroundLayout`,
			`  mode="${mode}"`,
			`  frameGenerator={myGenerator}`,
			`  fps={${fps}}`,
			`>`,
			`  {children}`,
			`</GeneratorBackgroundLayout>`,
		]
		return lines.join('\n')
	}, [mode, fps, generatorType])

	return (
		<PlasmaBackgroundLayout
			mode={mode}
			frameGenerator={frameGenerator}
			fps={fps}
			showPerformanceOverlay={showPerformanceOverlay}
			bgColor={bgColor || undefined}
		>
			<div style={{ minHeight: '100vh', padding: '68px 20px 20px 20px' }}>
				<div className="floating-panel">
					<h2 style={{ margin: '0 0 12px 0', fontSize: 14, fontFamily: 'var(--font-mono)' }}>
						Generator Background
					</h2>

					<ControlGroup label="Layout">
						<SelectInput
							label="Mode"
							value={mode}
							onChange={(v) => setMode(v as 'fixed' | 'scrollable')}
							options={[
								{ value: 'fixed', label: 'Fixed' },
								{ value: 'scrollable', label: 'Scrollable' },
							]}
						/>
						<SelectInput
							label="Generator"
							value={generatorType}
							onChange={(v) => setGeneratorType(v as GeneratorType)}
							options={GENERATOR_OPTIONS}
						/>
						<NumberInput label="FPS" value={fps} onChange={setFps} min={1} step={1} />
						<ToggleInput label="Perf Overlay" value={showPerformanceOverlay} onChange={setShowPerformanceOverlay} />
					</ControlGroup>

					<ControlGroup label="Colors">
						<ColorInput label="FG Color" value={fgColor} onChange={setFgColor} />
						<ColorInput label="BG Color" value={bgColor} onChange={setBgColor} />
						<NumberInput label="Seed" value={seed} onChange={setSeed} step={1} />
					</ControlGroup>

					<ControlGroup label="Code" defaultOpen={true}>
						<CodePreview code={code} />
					</ControlGroup>
				</div>
			</div>
		</PlasmaBackgroundLayout>
	)
}
