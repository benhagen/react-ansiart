import { ColorInput, NumberInput, ToggleInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function MunchingSquaresPanel({
	speed, setSpeed,
	size, setSize,
	invert, setInvert,
	bgColor, setBgColor,
}: {
	speed: number; setSpeed: (v: number) => void
	size: number; setSize: (v: number) => void
	invert: boolean; setInvert: (v: boolean) => void
	bgColor: string; setBgColor: (v: string) => void
}) {
	return (
		<ControlGroup label="Munching Squares">
			<NumberInput label="Speed" value={speed} onChange={setSpeed} min={0} max={8} step={0.25} />
			<NumberInput label="Size" value={size} onChange={setSize} min={8} max={128} step={8} />
			<ToggleInput label="Invert" value={invert} onChange={setInvert} />
			<ColorInput label="Background" value={bgColor} onChange={setBgColor} />
		</ControlGroup>
	)
}
