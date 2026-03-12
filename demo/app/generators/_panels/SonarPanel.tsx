import { ControlGroup } from '../../_components/ControlGroup'
import { ColorInput, NumberInput, TextInput } from '../../_components/ControlRow'

export function SonarPanel({
	frequency, setFrequency,
	intensity, setIntensity,
	fgColor, setFgColor,
	bgColor, setBgColor,
	dotChar, setDotChar,
	speed, setSpeed,
	bandWidth, setBandWidth,
	decay, setDecay,
	baseAlpha, setBaseAlpha,
	alphaSteps, setAlphaSteps,
	centerX, setCenterX,
	centerY, setCenterY,
	aspectY, setAspectY,
	maxRings, setMaxRings,
}: {
	frequency: number; setFrequency: (v: number) => void
	intensity: number; setIntensity: (v: number) => void
	fgColor: string; setFgColor: (v: string) => void
	bgColor: string; setBgColor: (v: string) => void
	dotChar: string; setDotChar: (v: string) => void
	speed: number; setSpeed: (v: number) => void
	bandWidth: number; setBandWidth: (v: number) => void
	decay: number; setDecay: (v: number) => void
	baseAlpha: number; setBaseAlpha: (v: number) => void
	alphaSteps: number; setAlphaSteps: (v: number) => void
	centerX: string; setCenterX: (v: string) => void
	centerY: string; setCenterY: (v: string) => void
	aspectY: number; setAspectY: (v: number) => void
	maxRings: number; setMaxRings: (v: number) => void
}) {
	return (
		<ControlGroup label="Sonar Options">
			<NumberInput label="Frequency" value={frequency} onChange={setFrequency} min={0.05} step={0.05} />
			<NumberInput label="Intensity" value={intensity} onChange={setIntensity} min={0} step={0.1} />
			<ColorInput label="FG Color" value={fgColor} onChange={setFgColor} />
			<ColorInput label="BG Color" value={bgColor} onChange={setBgColor} />
			<TextInput label="Dot Char" value={dotChar} onChange={setDotChar} width={40} />
			<NumberInput label="Speed" value={speed} onChange={setSpeed} step={1} />
			<NumberInput label="Band Width" value={bandWidth} onChange={setBandWidth} step={0.05} />
			<NumberInput label="Decay" value={decay} onChange={setDecay} min={0} step={0.05} />
			<NumberInput label="Base Alpha" value={baseAlpha} onChange={setBaseAlpha} min={0} max={1} step={0.01} />
			<NumberInput label="Alpha Steps" value={alphaSteps} onChange={setAlphaSteps} min={2} step={1} />
			<TextInput label="Center X" value={centerX} onChange={setCenterX} placeholder="auto" width={80} />
			<TextInput label="Center Y" value={centerY} onChange={setCenterY} placeholder="auto" width={80} />
			<NumberInput label="Aspect Y" value={aspectY} onChange={setAspectY} step={0.1} />
			<NumberInput label="Max Rings" value={maxRings} onChange={setMaxRings} min={1} step={1} />
		</ControlGroup>
	)
}
