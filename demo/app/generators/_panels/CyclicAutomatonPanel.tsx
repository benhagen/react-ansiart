import { NumberInput, SelectInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function CyclicAutomatonPanel({
	states, setStates,
	threshold, setThreshold,
	neighborhood, setNeighborhood,
	saturation, setSaturation,
	lightness, setLightness,
	seed, setSeed,
}: {
	states: number; setStates: (v: number) => void
	threshold: number; setThreshold: (v: number) => void
	neighborhood: string; setNeighborhood: (v: string) => void
	saturation: number; setSaturation: (v: number) => void
	lightness: number; setLightness: (v: number) => void
	seed: number; setSeed: (v: number) => void
}) {
	return (
		<ControlGroup label="Cyclic Automaton">
			<NumberInput label="States" value={states} onChange={setStates} min={3} max={24} step={1} />
			<NumberInput label="Threshold" value={threshold} onChange={setThreshold} min={1} max={8} step={1} />
			<SelectInput
				label="Neighborhood"
				value={neighborhood}
				onChange={setNeighborhood}
				options={[
					{ value: 'moore', label: 'Moore (8)' },
					{ value: 'vonNeumann', label: 'Von Neumann (4)' },
				]}
			/>
			<NumberInput label="Saturation" value={saturation} onChange={setSaturation} min={0} max={1} step={0.05} />
			<NumberInput label="Lightness" value={lightness} onChange={setLightness} min={0} max={1} step={0.05} />
			<NumberInput label="Seed" value={seed} onChange={setSeed} min={0} step={1} />
		</ControlGroup>
	)
}
