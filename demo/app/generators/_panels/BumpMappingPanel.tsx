import { ColorInput, NumberInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function BumpMappingPanel({
	noiseScale, setNoiseScale,
	orbitSpeed, setOrbitSpeed,
	lightHeight, setLightHeight,
	bumpStrength, setBumpStrength,
	specularPower, setSpecularPower,
	bgColor, setBgColor,
}: {
	noiseScale: number; setNoiseScale: (v: number) => void
	orbitSpeed: number; setOrbitSpeed: (v: number) => void
	lightHeight: number; setLightHeight: (v: number) => void
	bumpStrength: number; setBumpStrength: (v: number) => void
	specularPower: number; setSpecularPower: (v: number) => void
	bgColor: string; setBgColor: (v: string) => void
}) {
	return (
		<ControlGroup label="Bump Mapping">
			<NumberInput label="Noise Scale" value={noiseScale} onChange={setNoiseScale} min={0.02} max={0.5} step={0.01} />
			<NumberInput label="Orbit Speed" value={orbitSpeed} onChange={setOrbitSpeed} min={0} max={0.3} step={0.01} />
			<NumberInput label="Light Height" value={lightHeight} onChange={setLightHeight} min={1} max={20} step={0.5} />
			<NumberInput label="Bump Strength" value={bumpStrength} onChange={setBumpStrength} min={0} max={20} step={0.5} />
			<NumberInput label="Specular Power" value={specularPower} onChange={setSpecularPower} min={1} max={64} step={1} />
			<ColorInput label="Background" value={bgColor} onChange={setBgColor} />
		</ControlGroup>
	)
}
