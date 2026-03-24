import { ColorInput, NumberInput, ToggleInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function GameOfLifePanel({
	density, setDensity,
	fgColor, setFgColor,
	bgColor, setBgColor,
	seed, setSeed,
	autoSeed, setAutoSeed,
	autoSeedThreshold, setAutoSeedThreshold,
}: {
	density: number; setDensity: (v: number) => void
	fgColor: string; setFgColor: (v: string) => void
	bgColor: string; setBgColor: (v: string) => void
	seed: number; setSeed: (v: number) => void
	autoSeed: boolean; setAutoSeed: (v: boolean) => void
	autoSeedThreshold: number; setAutoSeedThreshold: (v: number) => void
}) {
	return (
		<ControlGroup label="Game of Life">
			<NumberInput label="Initial Density" value={density} onChange={setDensity} min={0.05} max={0.8} step={0.05} />
			<ColorInput label="Cell Color" value={fgColor} onChange={setFgColor} />
			<ColorInput label="Background" value={bgColor} onChange={setBgColor} />
			<NumberInput label="Seed" value={seed} onChange={setSeed} min={0} step={1} />
			<ToggleInput label="Auto Seed" value={autoSeed} onChange={setAutoSeed} />
			<NumberInput label="Seed Threshold" value={autoSeedThreshold} onChange={setAutoSeedThreshold} min={0.01} max={0.2} step={0.01} />
		</ControlGroup>
	)
}
