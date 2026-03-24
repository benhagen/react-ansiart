import { ColorInput, NumberInput, TextInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function TunnelPanel({
	speed, setSpeed,
	rotationSpeed, setRotationSpeed,
	tiles, setTiles,
	fgColor, setFgColor,
	bgColor, setBgColor,
	chars, setChars,
	aspectY, setAspectY,
}: {
	speed: number; setSpeed: (v: number) => void
	rotationSpeed: number; setRotationSpeed: (v: number) => void
	tiles: number; setTiles: (v: number) => void
	fgColor: string; setFgColor: (v: string) => void
	bgColor: string; setBgColor: (v: string) => void
	chars: string; setChars: (v: string) => void
	aspectY: number; setAspectY: (v: number) => void
}) {
	return (
		<ControlGroup label="Tunnel">
			<NumberInput label="Zoom Speed" value={speed} onChange={setSpeed} min={0.01} max={0.3} step={0.01} />
			<NumberInput label="Rotation Speed" value={rotationSpeed} onChange={setRotationSpeed} min={0} max={0.1} step={0.005} />
			<NumberInput label="Tiles" value={tiles} onChange={setTiles} min={1} max={32} step={1} />
			<ColorInput label="Foreground" value={fgColor} onChange={setFgColor} />
			<ColorInput label="Background" value={bgColor} onChange={setBgColor} />
			<TextInput label="Characters" value={chars} onChange={setChars} />
			<NumberInput label="Aspect Y" value={aspectY} onChange={setAspectY} min={1} max={4} step={0.1} />
		</ControlGroup>
	)
}
