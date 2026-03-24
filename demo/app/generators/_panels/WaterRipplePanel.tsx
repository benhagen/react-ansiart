import { ColorInput, NumberInput, TextInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function WaterRipplePanel({
	damping, setDamping,
	dropFrequency, setDropFrequency,
	dropStrength, setDropStrength,
	fgColor, setFgColor,
	bgColor, setBgColor,
	chars, setChars,
	seed, setSeed,
}: {
	damping: number; setDamping: (v: number) => void
	dropFrequency: number; setDropFrequency: (v: number) => void
	dropStrength: number; setDropStrength: (v: number) => void
	fgColor: string; setFgColor: (v: string) => void
	bgColor: string; setBgColor: (v: string) => void
	chars: string; setChars: (v: string) => void
	seed: number; setSeed: (v: number) => void
}) {
	return (
		<ControlGroup label="Water Ripples">
			<NumberInput label="Damping" value={damping} onChange={setDamping} min={0.9} max={0.999} step={0.005} />
			<NumberInput label="Drop Frequency" value={dropFrequency} onChange={setDropFrequency} min={1} max={60} step={1} />
			<NumberInput label="Drop Strength" value={dropStrength} onChange={setDropStrength} min={50} max={500} step={10} />
			<ColorInput label="Ripple Color" value={fgColor} onChange={setFgColor} />
			<ColorInput label="Background" value={bgColor} onChange={setBgColor} />
			<TextInput label="Characters" value={chars} onChange={setChars} />
			<NumberInput label="Seed" value={seed} onChange={setSeed} min={0} step={1} />
		</ControlGroup>
	)
}
