import { ColorInput, NumberInput, SelectInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function RotozoomerPanel({
	rotationSpeed, setRotationSpeed,
	zoomSpeed, setZoomSpeed,
	baseZoom, setBaseZoom,
	pattern, setPattern,
	bgColor, setBgColor,
}: {
	rotationSpeed: number; setRotationSpeed: (v: number) => void
	zoomSpeed: number; setZoomSpeed: (v: number) => void
	baseZoom: number; setBaseZoom: (v: number) => void
	pattern: string; setPattern: (v: string) => void
	bgColor: string; setBgColor: (v: string) => void
}) {
	return (
		<ControlGroup label="Rotozoomer">
			<NumberInput label="Rotation Speed" value={rotationSpeed} onChange={setRotationSpeed} min={-0.2} max={0.2} step={0.005} />
			<NumberInput label="Zoom Speed" value={zoomSpeed} onChange={setZoomSpeed} min={-0.2} max={0.2} step={0.005} />
			<NumberInput label="Base Zoom" value={baseZoom} onChange={setBaseZoom} min={0.1} max={3} step={0.05} />
			<SelectInput
				label="Pattern"
				value={pattern}
				onChange={setPattern}
				options={[
					{ value: 'checker', label: 'Checker' },
					{ value: 'xor', label: 'XOR' },
				]}
			/>
			<ColorInput label="Background" value={bgColor} onChange={setBgColor} />
		</ControlGroup>
	)
}
