import { ColorInput, NumberInput, TextInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function CopperBarsPanel({
	barCount, setBarCount,
	barHeight, setBarHeight,
	speed, setSpeed,
	bgColor, setBgColor,
	chars, setChars,
	seed, setSeed,
}: {
	barCount: number; setBarCount: (v: number) => void
	barHeight: number; setBarHeight: (v: number) => void
	speed: number; setSpeed: (v: number) => void
	bgColor: string; setBgColor: (v: string) => void
	chars: string; setChars: (v: string) => void
	seed: number; setSeed: (v: number) => void
}) {
	return (
		<ControlGroup label="Copper Bars">
			<NumberInput label="Bar Count" value={barCount} onChange={setBarCount} min={1} max={8} step={1} />
			<NumberInput label="Bar Height" value={barHeight} onChange={setBarHeight} min={2} max={20} step={1} />
			<NumberInput label="Speed" value={speed} onChange={setSpeed} min={0.001} max={0.2} step={0.005} />
			<ColorInput label="Background" value={bgColor} onChange={setBgColor} />
			<TextInput label="Characters" value={chars} onChange={setChars} />
			<NumberInput label="Seed" value={seed} onChange={setSeed} min={0} step={1} />
		</ControlGroup>
	)
}
