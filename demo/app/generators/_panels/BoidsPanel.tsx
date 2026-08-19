import { ColorInput, NumberInput, SelectInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function BoidsPanel({
	count, setCount,
	sepWeight, setSepWeight,
	alignWeight, setAlignWeight,
	cohWeight, setCohWeight,
	headColor, setHeadColor,
	bgColor, setBgColor,
	pointerMode, setPointerMode,
}: {
	count: number; setCount: (v: number) => void
	sepWeight: number; setSepWeight: (v: number) => void
	alignWeight: number; setAlignWeight: (v: number) => void
	cohWeight: number; setCohWeight: (v: number) => void
	headColor: string; setHeadColor: (v: string) => void
	bgColor: string; setBgColor: (v: string) => void
	pointerMode: string; setPointerMode: (v: string) => void
}) {
	return (
		<ControlGroup label="Boids">
			<NumberInput label="Count" value={count} onChange={setCount} min={40} max={120} step={1} />
			<NumberInput label="Separation" value={sepWeight} onChange={setSepWeight} min={0} max={3} step={0.1} />
			<NumberInput label="Alignment" value={alignWeight} onChange={setAlignWeight} min={0} max={3} step={0.1} />
			<NumberInput label="Cohesion" value={cohWeight} onChange={setCohWeight} min={0} max={3} step={0.1} />
			<SelectInput
				label="Pointer"
				value={pointerMode}
				onChange={setPointerMode}
				options={[
					{ value: 'flee', label: 'Flee' },
					{ value: 'attract', label: 'Attract' },
					{ value: 'none', label: 'Off' },
				]}
			/>
			<ColorInput label="Head Color" value={headColor} onChange={setHeadColor} />
			<ColorInput label="Background" value={bgColor} onChange={setBgColor} />
		</ControlGroup>
	)
}
