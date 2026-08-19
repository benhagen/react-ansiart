import { ColorInput, NumberInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function AquariumPanel({
	fishCount, setFishCount,
	bubbleDensity, setBubbleDensity,
	seaweedDensity, setSeaweedDensity,
	swaySpeed, setSwaySpeed,
	speed, setSpeed,
	seed, setSeed,
	bgColor, setBgColor,
}: {
	fishCount: number; setFishCount: (v: number) => void
	bubbleDensity: number; setBubbleDensity: (v: number) => void
	seaweedDensity: number; setSeaweedDensity: (v: number) => void
	swaySpeed: number; setSwaySpeed: (v: number) => void
	speed: number; setSpeed: (v: number) => void
	seed: number; setSeed: (v: number) => void
	bgColor: string; setBgColor: (v: string) => void
}) {
	return (
		<ControlGroup label="Aquarium">
			<NumberInput label="Fish Count" value={fishCount} onChange={setFishCount} min={1} max={20} step={1} />
			<NumberInput label="Bubble Density" value={bubbleDensity} onChange={setBubbleDensity} min={0} max={0.5} step={0.01} />
			<NumberInput label="Seaweed Density" value={seaweedDensity} onChange={setSeaweedDensity} min={0} max={0.5} step={0.01} />
			<NumberInput label="Sway Speed" value={swaySpeed} onChange={setSwaySpeed} min={0} max={0.3} step={0.01} />
			<NumberInput label="Speed" value={speed} onChange={setSpeed} min={0} max={4} step={0.1} />
			<NumberInput label="Seed" value={seed} onChange={setSeed} min={0} step={1} />
			<ColorInput label="Background" value={bgColor} onChange={setBgColor} />
		</ControlGroup>
	)
}
