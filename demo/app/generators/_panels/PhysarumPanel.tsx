import { ColorInput, NumberInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function PhysarumPanel({
	agentDensity, setAgentDensity,
	sensorAngle, setSensorAngle,
	sensorDistance, setSensorDistance,
	turnSpeed, setTurnSpeed,
	evaporation, setEvaporation,
	stepsPerFrame, setStepsPerFrame,
	seed, setSeed,
	bgColor, setBgColor,
}: {
	agentDensity: number; setAgentDensity: (v: number) => void
	sensorAngle: number; setSensorAngle: (v: number) => void
	sensorDistance: number; setSensorDistance: (v: number) => void
	turnSpeed: number; setTurnSpeed: (v: number) => void
	evaporation: number; setEvaporation: (v: number) => void
	stepsPerFrame: number; setStepsPerFrame: (v: number) => void
	seed: number; setSeed: (v: number) => void
	bgColor: string; setBgColor: (v: string) => void
}) {
	return (
		<ControlGroup label="Physarum">
			<NumberInput label="Agent Density" value={agentDensity} onChange={setAgentDensity} min={0.05} max={2} step={0.05} />
			<NumberInput label="Sensor Angle" value={sensorAngle} onChange={setSensorAngle} min={0.1} max={1.2} step={0.05} />
			<NumberInput label="Sensor Distance" value={sensorDistance} onChange={setSensorDistance} min={1} max={12} step={0.5} />
			<NumberInput label="Turn Speed" value={turnSpeed} onChange={setTurnSpeed} min={0.1} max={1.5} step={0.05} />
			<NumberInput label="Evaporation" value={evaporation} onChange={setEvaporation} min={0.5} max={0.98} step={0.01} />
			<NumberInput label="Steps/Frame" value={stepsPerFrame} onChange={setStepsPerFrame} min={1} max={4} step={1} />
			<NumberInput label="Seed" value={seed} onChange={setSeed} min={0} step={1} />
			<ColorInput label="Background" value={bgColor} onChange={setBgColor} />
		</ControlGroup>
	)
}
