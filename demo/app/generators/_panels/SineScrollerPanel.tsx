import { ColorInput, NumberInput, TextInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function SineScrollerPanel({
	text, setText,
	speed, setSpeed,
	amplitude, setAmplitude,
	waveSpeed, setWaveSpeed,
	fgColor, setFgColor,
	bgColor, setBgColor,
}: {
	text: string; setText: (v: string) => void
	speed: number; setSpeed: (v: number) => void
	amplitude: number; setAmplitude: (v: number) => void
	waveSpeed: number; setWaveSpeed: (v: number) => void
	fgColor: string; setFgColor: (v: string) => void
	bgColor: string; setBgColor: (v: string) => void
}) {
	return (
		<ControlGroup label="Sine Scroller">
			<TextInput label="Message" value={text} onChange={setText} width={280} />
			<NumberInput label="Speed" value={speed} onChange={setSpeed} min={0} max={6} step={0.1} />
			<NumberInput label="Amplitude" value={amplitude} onChange={setAmplitude} min={0} max={10} step={0.5} />
			<NumberInput label="Wave Speed" value={waveSpeed} onChange={setWaveSpeed} min={0} max={0.3} step={0.01} />
			<TextInput label="Fixed Color" value={fgColor} onChange={setFgColor} placeholder="rainbow" width={80} />
			<ColorInput label="Background" value={bgColor} onChange={setBgColor} />
		</ControlGroup>
	)
}
