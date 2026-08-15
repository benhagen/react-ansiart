import { ColorInput, NumberInput, TextInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function AuroraBorealisPanel({
	curtainCount, setCurtainCount,
	speed, setSpeed,
	intensity, setIntensity,
	bgColor, setBgColor,
	chars, setChars,
	seed, setSeed,
}: {
	curtainCount: number; setCurtainCount: (v: number) => void
	speed: number; setSpeed: (v: number) => void
	intensity: number; setIntensity: (v: number) => void
	bgColor: string; setBgColor: (v: string) => void
	chars: string; setChars: (v: string) => void
	seed: number; setSeed: (v: number) => void
}) {
	return (
		<ControlGroup label="Aurora Borealis">
			<NumberInput label="Curtains" value={curtainCount} onChange={setCurtainCount} min={1} max={6} step={1} />
			<NumberInput label="Speed" value={speed} onChange={setSpeed} min={0.001} max={0.1} step={0.005} />
			<NumberInput label="Intensity" value={intensity} onChange={setIntensity} min={0.1} max={3} step={0.1} />
			<ColorInput label="Background" value={bgColor} onChange={setBgColor} />
			<TextInput label="Characters" value={chars} onChange={setChars} />
			<NumberInput label="Seed" value={seed} onChange={setSeed} min={0} step={1} />
		</ControlGroup>
	)
}
