import { ColorInput, NumberInput, TextInput, ToggleInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function CrtStaticPanel({
	signalStrength, setSignalStrength,
	scanlineIntensity, setScanlineIntensity,
	tearFrequency, setTearFrequency,
	rollingBarSpeed, setRollingBarSpeed,
	vhsMode, setVhsMode,
	bgColor, setBgColor,
	chars, setChars,
	seed, setSeed,
}: {
	signalStrength: number; setSignalStrength: (v: number) => void
	scanlineIntensity: number; setScanlineIntensity: (v: number) => void
	tearFrequency: number; setTearFrequency: (v: number) => void
	rollingBarSpeed: number; setRollingBarSpeed: (v: number) => void
	vhsMode: boolean; setVhsMode: (v: boolean) => void
	bgColor: string; setBgColor: (v: string) => void
	chars: string; setChars: (v: string) => void
	seed: number; setSeed: (v: number) => void
}) {
	return (
		<ControlGroup label="CRT Static">
			<NumberInput label="Signal Strength" value={signalStrength} onChange={setSignalStrength} min={0} max={1} step={0.05} />
			<NumberInput label="Scanline Intensity" value={scanlineIntensity} onChange={setScanlineIntensity} min={0} max={1} step={0.05} />
			<NumberInput label="Tear Frequency" value={tearFrequency} onChange={setTearFrequency} min={0} max={0.5} step={0.01} />
			<NumberInput label="Rolling Bar Speed" value={rollingBarSpeed} onChange={setRollingBarSpeed} min={0} max={0.1} step={0.005} />
			<ToggleInput label="VHS Mode" value={vhsMode} onChange={setVhsMode} />
			<ColorInput label="Background" value={bgColor} onChange={setBgColor} />
			<TextInput label="Characters" value={chars} onChange={setChars} />
			<NumberInput label="Seed" value={seed} onChange={setSeed} min={0} step={1} />
		</ControlGroup>
	)
}
