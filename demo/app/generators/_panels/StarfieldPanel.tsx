import { ColorInput, NumberInput, TextInput, ToggleInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function StarfieldPanel({
	stars, setStars,
	speed, setSpeed,
	fgColor, setFgColor,
	bgColor, setBgColor,
	chars, setChars,
	seed, setSeed,
	streaks, setStreaks,
}: {
	stars: number; setStars: (v: number) => void
	speed: number; setSpeed: (v: number) => void
	fgColor: string; setFgColor: (v: string) => void
	bgColor: string; setBgColor: (v: string) => void
	chars: string; setChars: (v: string) => void
	seed: number; setSeed: (v: number) => void
	streaks: boolean; setStreaks: (v: boolean) => void
}) {
	return (
		<ControlGroup label="Starfield">
			<NumberInput label="Stars" value={stars} onChange={setStars} min={10} max={1000} step={10} />
			<NumberInput label="Speed" value={speed} onChange={setSpeed} min={0.005} max={0.1} step={0.005} />
			<ColorInput label="Star Color" value={fgColor} onChange={setFgColor} />
			<ColorInput label="Background" value={bgColor} onChange={setBgColor} />
			<TextInput label="Characters" value={chars} onChange={setChars} />
			<NumberInput label="Seed" value={seed} onChange={setSeed} min={0} step={1} />
			<ToggleInput label="Streaks" value={streaks} onChange={setStreaks} />
		</ControlGroup>
	)
}
