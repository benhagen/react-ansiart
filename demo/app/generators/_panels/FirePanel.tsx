import { ControlGroup } from '../../_components/ControlGroup'
import { ColorInput, NumberInput, TextInput } from '../../_components/ControlRow'

export function FirePanel({
	chars,
	setChars,
	darkenAmount,
	setDarkenAmount,
	sparkMin,
	setSparkMin,
	sparkMax,
	setSparkMax,
	bgColor,
	setBgColor,
	seed,
	setSeed,
}: {
	chars: string
	setChars: (v: string) => void
	darkenAmount: number
	setDarkenAmount: (v: number) => void
	sparkMin: number
	setSparkMin: (v: number) => void
	sparkMax: number
	setSparkMax: (v: number) => void
	bgColor: string
	setBgColor: (v: string) => void
	seed: number
	setSeed: (v: number) => void
}) {
	return (
		<ControlGroup label="Fire Options">
			<TextInput label="Chars" value={chars} onChange={setChars} width={200} />
			<NumberInput label="Darken Amount" value={darkenAmount} onChange={setDarkenAmount} min={0} step={0.05} />
			<NumberInput label="Spark Min" value={sparkMin} onChange={setSparkMin} min={0} max={255} step={1} />
			<NumberInput label="Spark Max" value={sparkMax} onChange={setSparkMax} min={0} max={255} step={1} />
			<ColorInput label="BG Color" value={bgColor} onChange={setBgColor} />
			<NumberInput label="Seed" value={seed} onChange={setSeed} step={1} />
		</ControlGroup>
	)
}
