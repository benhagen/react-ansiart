import { ControlGroup } from '../../_components/ControlGroup'
import { ColorInput, NumberInput, TextInput } from '../../_components/ControlRow'

export function MetaballsPanel({
	seed, setSeed,
	balls, setBalls,
	speed, setSpeed,
	radiusMin, setRadiusMin,
	radiusMax, setRadiusMax,
	intensity, setIntensity,
	aspectY, setAspectY,
	fgColor, setFgColor,
	bgColor, setBgColor,
	chars, setChars,
}: {
	seed: number; setSeed: (v: number) => void
	balls: number; setBalls: (v: number) => void
	speed: number; setSpeed: (v: number) => void
	radiusMin: number; setRadiusMin: (v: number) => void
	radiusMax: number; setRadiusMax: (v: number) => void
	intensity: number; setIntensity: (v: number) => void
	aspectY: number; setAspectY: (v: number) => void
	fgColor: string; setFgColor: (v: string) => void
	bgColor: string; setBgColor: (v: string) => void
	chars: string; setChars: (v: string) => void
}) {
	return (
		<ControlGroup label="Metaballs Options">
			<NumberInput label="Seed" value={seed} onChange={setSeed} step={1} />
			<NumberInput label="Balls" value={balls} onChange={setBalls} min={1} step={1} />
			<NumberInput label="Speed" value={speed} onChange={setSpeed} step={0.005} />
			<NumberInput label="Radius Min" value={radiusMin} onChange={setRadiusMin} step={0.5} />
			<NumberInput label="Radius Max" value={radiusMax} onChange={setRadiusMax} step={0.5} />
			<NumberInput label="Intensity" value={intensity} onChange={setIntensity} min={0} step={0.05} />
			<NumberInput label="Aspect Y" value={aspectY} onChange={setAspectY} step={0.1} />
			<ColorInput label="FG Color" value={fgColor} onChange={setFgColor} />
			<ColorInput label="BG Color" value={bgColor} onChange={setBgColor} />
			<TextInput label="Chars" value={chars} onChange={setChars} width={200} />
		</ControlGroup>
	)
}
