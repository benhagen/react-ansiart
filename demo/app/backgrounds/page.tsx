'use client'

import { useMemo, useState } from 'react'
import { PlasmaBackgroundLayout } from 'react-ansiart'
import { CodePreview } from '../_components/CodePreview'
import { ControlGroup } from '../_components/ControlGroup'
import { ColorInput, NumberInput, SelectInput, ToggleInput, TextInput } from '../_components/ControlRow'
import { generateComponentCode } from '../_lib/generateCode'
import { PLASMA_BG_DEFAULTS } from '../_lib/defaults'

export default function BackgroundsPage() {
	const [mode, setMode] = useState<'fixed' | 'scrollable'>('fixed')
	const [generatorType, setGeneratorType] = useState<'plasma' | 'fire'>('plasma')
	const [fps, setFps] = useState(30)
	const [showPerformanceOverlay, setShowPerformanceOverlay] = useState(false)
	const [fgColor, setFgColor] = useState('')
	const [bgColor, setBgColor] = useState('')
	const [timeScale, setTimeScale] = useState(0.9)
	const [seed, setSeed] = useState(12345)
	const [darkenAmount, setDarkenAmount] = useState(0.5)

	const props: Record<string, unknown> = {
		mode,
		generatorType,
		fps,
		showPerformanceOverlay,
	}
	if (fgColor) props.fgColor = fgColor
	if (bgColor) props.bgColor = bgColor
	if (generatorType === 'plasma') {
		if (timeScale !== 0.9) props.timeScale = timeScale
		if (seed !== 12345) props.seed = seed
	}
	if (generatorType === 'fire') {
		if (darkenAmount !== 0.5) props.darkenAmount = darkenAmount
		if (seed !== 12345) props.seed = seed
	}

	const code = useMemo(() => {
		return generateComponentCode(
			'PlasmaBackgroundLayout',
			'react-ansiart',
			props,
			PLASMA_BG_DEFAULTS,
			'{children}'
		)
	}, [props])

	return (
		<PlasmaBackgroundLayout
			mode={mode}
			generatorType={generatorType}
			fps={fps}
			showPerformanceOverlay={showPerformanceOverlay}
			fgColor={fgColor || undefined}
			bgColor={bgColor || undefined}
			timeScale={generatorType === 'plasma' ? timeScale : undefined}
			seed={seed}
			darkenAmount={generatorType === 'fire' ? darkenAmount : undefined}
		>
			<div style={{ minHeight: '100vh', padding: '68px 20px 20px 20px' }}>
				<div className="floating-panel">
					<h2 style={{ margin: '0 0 12px 0', fontSize: 14, fontFamily: 'var(--font-mono)' }}>
						PlasmaBackgroundLayout
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
							onChange={(v) => setGeneratorType(v as 'plasma' | 'fire')}
							options={[
								{ value: 'plasma', label: 'Plasma' },
								{ value: 'fire', label: 'Fire' },
							]}
						/>
						<NumberInput label="FPS" value={fps} onChange={setFps} min={1} step={1} />
						<ToggleInput label="Perf Overlay" value={showPerformanceOverlay} onChange={setShowPerformanceOverlay} />
					</ControlGroup>

					<ControlGroup label="Colors">
						<TextInput label="FG Color" value={fgColor} onChange={setFgColor} placeholder="default" />
						<TextInput label="BG Color" value={bgColor} onChange={setBgColor} placeholder="default" />
					</ControlGroup>

					{generatorType === 'plasma' && (
						<ControlGroup label="Plasma">
							<NumberInput label="Time Scale" value={timeScale} onChange={setTimeScale} step={0.05} />
							<NumberInput label="Seed" value={seed} onChange={setSeed} step={1} />
						</ControlGroup>
					)}

					{generatorType === 'fire' && (
						<ControlGroup label="Fire">
							<NumberInput label="Darken Amount" value={darkenAmount} onChange={setDarkenAmount} min={0} step={0.05} />
							<NumberInput label="Seed" value={seed} onChange={setSeed} step={1} />
						</ControlGroup>
					)}

					<ControlGroup label="Code" defaultOpen={true}>
						<CodePreview code={code} />
					</ControlGroup>
				</div>
			</div>
		</PlasmaBackgroundLayout>
	)
}
