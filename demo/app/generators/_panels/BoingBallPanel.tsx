import { ColorInput, NumberInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function BoingBallPanel({
	scale, setScale,
	bounceSpeed, setBounceSpeed,
	driftSpeed, setDriftSpeed,
	checkerDensity, setCheckerDensity,
	ballRedColor, setBallRedColor,
	bgColor, setBgColor,
}: {
	scale: number; setScale: (v: number) => void
	bounceSpeed: number; setBounceSpeed: (v: number) => void
	driftSpeed: number; setDriftSpeed: (v: number) => void
	checkerDensity: number; setCheckerDensity: (v: number) => void
	ballRedColor: string; setBallRedColor: (v: string) => void
	bgColor: string; setBgColor: (v: string) => void
}) {
	return (
		<ControlGroup label="Boing Ball">
			<NumberInput label="Scale" value={scale} onChange={setScale} min={0.2} max={3} step={0.1} />
			<NumberInput label="Bounce Speed" value={bounceSpeed} onChange={setBounceSpeed} min={0} max={0.5} step={0.01} />
			<NumberInput label="Drift Speed" value={driftSpeed} onChange={setDriftSpeed} min={0} max={0.2} step={0.005} />
			<NumberInput label="Checker Density" value={checkerDensity} onChange={setCheckerDensity} min={2} max={32} step={1} />
			<ColorInput label="Ball Color" value={ballRedColor} onChange={setBallRedColor} />
			<ColorInput label="Background" value={bgColor} onChange={setBgColor} />
		</ControlGroup>
	)
}
