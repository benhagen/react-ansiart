import { ColorInput, NumberInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function MoirePanel({
	ringWidth, setRingWidth,
	speed1, setSpeed1,
	speed2, setSpeed2,
	paletteSpeed, setPaletteSpeed,
	bgColor, setBgColor,
}: {
	ringWidth: number; setRingWidth: (v: number) => void
	speed1: number; setSpeed1: (v: number) => void
	speed2: number; setSpeed2: (v: number) => void
	paletteSpeed: number; setPaletteSpeed: (v: number) => void
	bgColor: string; setBgColor: (v: string) => void
}) {
	return (
		<ControlGroup label="Moire">
			<NumberInput label="Ring Width" value={ringWidth} onChange={setRingWidth} min={0.5} max={12} step={0.25} />
			<NumberInput label="Speed 1" value={speed1} onChange={setSpeed1} min={-0.1} max={0.1} step={0.005} />
			<NumberInput label="Speed 2" value={speed2} onChange={setSpeed2} min={-0.1} max={0.1} step={0.005} />
			<NumberInput label="Palette Speed" value={paletteSpeed} onChange={setPaletteSpeed} min={0} max={0.1} step={0.005} />
			<ColorInput label="Background" value={bgColor} onChange={setBgColor} />
		</ControlGroup>
	)
}
