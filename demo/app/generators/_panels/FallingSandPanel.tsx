import { ColorInput, NumberInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function FallingSandPanel({
	spoutCount, setSpoutCount,
	spoutRate, setSpoutRate,
	drainOpenThreshold, setDrainOpenThreshold,
	wallColor, setWallColor,
	bgColor, setBgColor,
	seed, setSeed,
}: {
	spoutCount: number; setSpoutCount: (v: number) => void
	spoutRate: number; setSpoutRate: (v: number) => void
	drainOpenThreshold: number; setDrainOpenThreshold: (v: number) => void
	wallColor: string; setWallColor: (v: string) => void
	bgColor: string; setBgColor: (v: string) => void
	seed: number; setSeed: (v: number) => void
}) {
	return (
		<ControlGroup label="Falling Sand">
			<NumberInput label="Spout Count" value={spoutCount} onChange={setSpoutCount} min={1} max={5} step={1} />
			<NumberInput label="Spout Rate" value={spoutRate} onChange={setSpoutRate} min={0} max={1} step={0.05} />
			<NumberInput label="Drain Open At" value={drainOpenThreshold} onChange={setDrainOpenThreshold} min={0.1} max={1} step={0.05} />
			<ColorInput label="Wall Color" value={wallColor} onChange={setWallColor} />
			<ColorInput label="Background" value={bgColor} onChange={setBgColor} />
			<NumberInput label="Seed" value={seed} onChange={setSeed} min={0} step={1} />
		</ControlGroup>
	)
}
