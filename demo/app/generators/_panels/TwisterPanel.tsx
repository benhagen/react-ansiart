import { ColorInput, NumberInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function TwisterPanel({
	rotationSpeed, setRotationSpeed,
	waveFreq, setWaveFreq,
	waveSpeed, setWaveSpeed,
	waveDepth, setWaveDepth,
	bgColor, setBgColor,
}: {
	rotationSpeed: number; setRotationSpeed: (v: number) => void
	waveFreq: number; setWaveFreq: (v: number) => void
	waveSpeed: number; setWaveSpeed: (v: number) => void
	waveDepth: number; setWaveDepth: (v: number) => void
	bgColor: string; setBgColor: (v: string) => void
}) {
	return (
		<ControlGroup label="Twister">
			<NumberInput label="Rotation Speed" value={rotationSpeed} onChange={setRotationSpeed} min={-0.3} max={0.3} step={0.01} />
			<NumberInput label="Wave Frequency" value={waveFreq} onChange={setWaveFreq} min={0} max={1} step={0.01} />
			<NumberInput label="Wave Speed" value={waveSpeed} onChange={setWaveSpeed} min={-0.2} max={0.2} step={0.01} />
			<NumberInput label="Wave Depth" value={waveDepth} onChange={setWaveDepth} min={0} max={2} step={0.05} />
			<ColorInput label="Background" value={bgColor} onChange={setBgColor} />
		</ControlGroup>
	)
}
