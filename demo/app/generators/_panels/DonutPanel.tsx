import { ColorInput, NumberInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function DonutPanel({
	speedA, setSpeedA,
	speedB, setSpeedB,
	size, setSize,
	tubeRatio, setTubeRatio,
	baseColor, setBaseColor,
	bgColor, setBgColor,
}: {
	speedA: number; setSpeedA: (v: number) => void
	speedB: number; setSpeedB: (v: number) => void
	size: number; setSize: (v: number) => void
	tubeRatio: number; setTubeRatio: (v: number) => void
	baseColor: string; setBaseColor: (v: string) => void
	bgColor: string; setBgColor: (v: string) => void
}) {
	return (
		<ControlGroup label="Donut">
			<NumberInput label="Speed A" value={speedA} onChange={setSpeedA} min={0} max={0.3} step={0.005} />
			<NumberInput label="Speed B" value={speedB} onChange={setSpeedB} min={0} max={0.3} step={0.005} />
			<NumberInput label="Size" value={size} onChange={setSize} min={0.1} max={1.5} step={0.05} />
			<NumberInput label="Tube Ratio" value={tubeRatio} onChange={setTubeRatio} min={0.15} max={0.9} step={0.05} />
			<ColorInput label="Base Color" value={baseColor} onChange={setBaseColor} />
			<ColorInput label="Background" value={bgColor} onChange={setBgColor} />
		</ControlGroup>
	)
}
