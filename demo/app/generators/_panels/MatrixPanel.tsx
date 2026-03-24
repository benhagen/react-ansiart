import { ColorInput, NumberInput, TextInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function MatrixPanel({
	speed, setSpeed,
	density, setDensity,
	trailLength, setTrailLength,
	headColor, setHeadColor,
	trailColor, setTrailColor,
	bgColor, setBgColor,
	chars, setChars,
	seed, setSeed,
}: {
	speed: number; setSpeed: (v: number) => void
	density: number; setDensity: (v: number) => void
	trailLength: number; setTrailLength: (v: number) => void
	headColor: string; setHeadColor: (v: string) => void
	trailColor: string; setTrailColor: (v: string) => void
	bgColor: string; setBgColor: (v: string) => void
	chars: string; setChars: (v: string) => void
	seed: number; setSeed: (v: number) => void
}) {
	return (
		<ControlGroup label="Matrix Rain">
			<NumberInput label="Speed" value={speed} onChange={setSpeed} min={0.1} max={3} step={0.1} />
			<NumberInput label="Density" value={density} onChange={setDensity} min={0.1} max={1} step={0.05} />
			<NumberInput label="Trail Length" value={trailLength} onChange={setTrailLength} min={3} max={50} step={1} />
			<ColorInput label="Head Color" value={headColor} onChange={setHeadColor} />
			<ColorInput label="Trail Color" value={trailColor} onChange={setTrailColor} />
			<ColorInput label="Background" value={bgColor} onChange={setBgColor} />
			<TextInput label="Characters" value={chars} onChange={setChars} />
			<NumberInput label="Seed" value={seed} onChange={setSeed} min={0} step={1} />
		</ControlGroup>
	)
}
