import { ColorInput, NumberInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function SandpilePanel({
	grainsPerStep, setGrainsPerStep,
	stepsPerFrame, setStepsPerFrame,
	maxToppleSweeps, setMaxToppleSweeps,
	dropX, setDropX,
	dropY, setDropY,
	bgColor, setBgColor,
}: {
	grainsPerStep: number; setGrainsPerStep: (v: number) => void
	stepsPerFrame: number; setStepsPerFrame: (v: number) => void
	maxToppleSweeps: number; setMaxToppleSweeps: (v: number) => void
	dropX: number; setDropX: (v: number) => void
	dropY: number; setDropY: (v: number) => void
	bgColor: string; setBgColor: (v: string) => void
}) {
	return (
		<ControlGroup label="Sandpile">
			<NumberInput label="Grains/Step" value={grainsPerStep} onChange={setGrainsPerStep} min={1} max={64} step={1} />
			<NumberInput label="Steps/Frame" value={stepsPerFrame} onChange={setStepsPerFrame} min={1} max={4} step={1} />
			<NumberInput label="Max Topple Sweeps" value={maxToppleSweeps} onChange={setMaxToppleSweeps} min={1} max={96} step={1} />
			<NumberInput label="Drop X" value={dropX} onChange={setDropX} min={0} max={1} step={0.05} />
			<NumberInput label="Drop Y" value={dropY} onChange={setDropY} min={0} max={1} step={0.05} />
			<ColorInput label="Background" value={bgColor} onChange={setBgColor} />
		</ControlGroup>
	)
}
