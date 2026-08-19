import { ColorInput, NumberInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function ShadebobsPanel({
	bobCount, setBobCount,
	bobSize, setBobSize,
	trailDecay, setTrailDecay,
	speed, setSpeed,
	seed, setSeed,
	bgColor, setBgColor,
}: {
	bobCount: number; setBobCount: (v: number) => void
	bobSize: number; setBobSize: (v: number) => void
	trailDecay: number; setTrailDecay: (v: number) => void
	speed: number; setSpeed: (v: number) => void
	seed: number; setSeed: (v: number) => void
	bgColor: string; setBgColor: (v: string) => void
}) {
	return (
		<ControlGroup label="Shadebobs">
			<NumberInput label="Bob Count" value={bobCount} onChange={setBobCount} min={1} max={16} step={1} />
			<NumberInput label="Bob Size" value={bobSize} onChange={setBobSize} min={2} max={12} step={0.5} />
			<NumberInput label="Trail Decay" value={trailDecay} onChange={setTrailDecay} min={0.5} max={0.995} step={0.005} />
			<NumberInput label="Speed" value={speed} onChange={setSpeed} min={0} max={4} step={0.1} />
			<NumberInput label="Seed" value={seed} onChange={setSeed} min={0} step={1} />
			<ColorInput label="Background" value={bgColor} onChange={setBgColor} />
		</ControlGroup>
	)
}
