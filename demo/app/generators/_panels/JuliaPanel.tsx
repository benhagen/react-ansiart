import { ColorInput, NumberInput, SelectInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function JuliaPanel({
	maxIter, setMaxIter,
	morphSpeed, setMorphSpeed,
	radius, setRadius,
	colorMode, setColorMode,
	fgColor, setFgColor,
	bgColor, setBgColor,
}: {
	maxIter: number; setMaxIter: (v: number) => void
	morphSpeed: number; setMorphSpeed: (v: number) => void
	radius: number; setRadius: (v: number) => void
	colorMode: string; setColorMode: (v: string) => void
	fgColor: string; setFgColor: (v: string) => void
	bgColor: string; setBgColor: (v: string) => void
}) {
	return (
		<ControlGroup label="Julia">
			<NumberInput label="Max Iterations" value={maxIter} onChange={setMaxIter} min={8} max={200} step={4} />
			<NumberInput label="Morph Speed" value={morphSpeed} onChange={setMorphSpeed} min={0} max={0.1} step={0.001} />
			<NumberInput label="Orbit Radius" value={radius} onChange={setRadius} min={0.5} max={1} step={0.005} />
			<SelectInput
				label="Color Mode"
				value={colorMode}
				onChange={setColorMode}
				options={[
					{ value: 'spectrum', label: 'Spectrum' },
					{ value: 'mono', label: 'Mono' },
				]}
			/>
			{colorMode === 'mono' && (
				<ColorInput label="FG Color" value={fgColor} onChange={setFgColor} />
			)}
			<ColorInput label="Background" value={bgColor} onChange={setBgColor} />
		</ControlGroup>
	)
}
