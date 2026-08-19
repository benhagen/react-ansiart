import { ColorInput, NumberInput, SelectInput, ToggleInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function WireframePanel({
	shape, setShape,
	size, setSize,
	speedX, setSpeedX,
	speedY, setSpeedY,
	speedZ, setSpeedZ,
	edgeColor, setEdgeColor,
	vertexColor, setVertexColor,
	depthShading, setDepthShading,
	bgColor, setBgColor,
}: {
	shape: string; setShape: (v: string) => void
	size: number; setSize: (v: number) => void
	speedX: number; setSpeedX: (v: number) => void
	speedY: number; setSpeedY: (v: number) => void
	speedZ: number; setSpeedZ: (v: number) => void
	edgeColor: string; setEdgeColor: (v: string) => void
	vertexColor: string; setVertexColor: (v: string) => void
	depthShading: boolean; setDepthShading: (v: boolean) => void
	bgColor: string; setBgColor: (v: string) => void
}) {
	return (
		<ControlGroup label="Wireframe">
			<SelectInput
				label="Shape"
				value={shape}
				onChange={setShape}
				options={[
					{ value: 'cube', label: 'Cube' },
					{ value: 'tetrahedron', label: 'Tetrahedron' },
					{ value: 'octahedron', label: 'Octahedron' },
					{ value: 'icosahedron', label: 'Icosahedron' },
				]}
			/>
			<NumberInput label="Size" value={size} onChange={setSize} min={0.1} max={2} step={0.05} />
			<NumberInput label="Speed X" value={speedX} onChange={setSpeedX} min={0} max={0.2} step={0.001} />
			<NumberInput label="Speed Y" value={speedY} onChange={setSpeedY} min={0} max={0.2} step={0.001} />
			<NumberInput label="Speed Z" value={speedZ} onChange={setSpeedZ} min={0} max={0.2} step={0.001} />
			<ColorInput label="Edge Color" value={edgeColor} onChange={setEdgeColor} />
			<ColorInput label="Vertex Color" value={vertexColor} onChange={setVertexColor} />
			<ToggleInput label="Depth Shading" value={depthShading} onChange={setDepthShading} />
			<ColorInput label="Background" value={bgColor} onChange={setBgColor} />
		</ControlGroup>
	)
}
