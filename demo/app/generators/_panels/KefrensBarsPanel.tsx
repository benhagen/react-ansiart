import { ColorInput, NumberInput, TextInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function KefrensBarsPanel({
	barWidth, setBarWidth,
	hueSpeed, setHueSpeed,
	hueRowStep, setHueRowStep,
	bgColor, setBgColor,
	chars, setChars,
}: {
	barWidth: number; setBarWidth: (v: number) => void
	hueSpeed: number; setHueSpeed: (v: number) => void
	hueRowStep: number; setHueRowStep: (v: number) => void
	bgColor: string; setBgColor: (v: string) => void
	chars: string; setChars: (v: string) => void
}) {
	return (
		<ControlGroup label="Kefrens Bars">
			<NumberInput label="Bar Width" value={barWidth} onChange={setBarWidth} min={1} max={20} step={1} />
			<NumberInput label="Hue Speed" value={hueSpeed} onChange={setHueSpeed} min={0} max={1} step={0.05} />
			<NumberInput label="Hue Row Step" value={hueRowStep} onChange={setHueRowStep} min={0} max={2} step={0.05} />
			<ColorInput label="Background" value={bgColor} onChange={setBgColor} />
			<TextInput label="Shade Ramp" value={chars} onChange={setChars} />
		</ControlGroup>
	)
}
