import { ColorInput, NumberInput, ToggleInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function FireworksPanel({
	launchInterval, setLaunchInterval,
	riseFrames, setRiseFrames,
	burstDuration, setBurstDuration,
	particleCount, setParticleCount,
	gravity, setGravity,
	nightSky, setNightSky,
	seed, setSeed,
	bgColor, setBgColor,
}: {
	launchInterval: number; setLaunchInterval: (v: number) => void
	riseFrames: number; setRiseFrames: (v: number) => void
	burstDuration: number; setBurstDuration: (v: number) => void
	particleCount: number; setParticleCount: (v: number) => void
	gravity: number; setGravity: (v: number) => void
	nightSky: boolean; setNightSky: (v: boolean) => void
	seed: number; setSeed: (v: number) => void
	bgColor: string; setBgColor: (v: string) => void
}) {
	return (
		<ControlGroup label="Fireworks">
			<NumberInput label="Launch Interval" value={launchInterval} onChange={setLaunchInterval} min={10} max={200} step={1} />
			<NumberInput label="Rise Frames" value={riseFrames} onChange={setRiseFrames} min={10} max={100} step={1} />
			<NumberInput label="Burst Duration" value={burstDuration} onChange={setBurstDuration} min={20} max={200} step={1} />
			<NumberInput label="Particle Count" value={particleCount} onChange={setParticleCount} min={10} max={160} step={1} />
			<NumberInput label="Gravity" value={gravity} onChange={setGravity} min={0} max={0.03} step={0.001} />
			<ToggleInput label="Night Sky" value={nightSky} onChange={setNightSky} />
			<NumberInput label="Seed" value={seed} onChange={setSeed} min={0} step={1} />
			<ColorInput label="Background" value={bgColor} onChange={setBgColor} />
		</ControlGroup>
	)
}
