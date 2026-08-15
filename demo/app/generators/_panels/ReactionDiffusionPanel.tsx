import { ColorInput, NumberInput, SelectInput, TextInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function ReactionDiffusionPanel({
	feedRate, setFeedRate,
	killRate, setKillRate,
	diffusionU, setDiffusionU,
	diffusionV, setDiffusionV,
	stepsPerFrame, setStepsPerFrame,
	colorMode, setColorMode,
	fgColor, setFgColor,
	bgColor, setBgColor,
	chars, setChars,
	seed, setSeed,
}: {
	feedRate: number; setFeedRate: (v: number) => void
	killRate: number; setKillRate: (v: number) => void
	diffusionU: number; setDiffusionU: (v: number) => void
	diffusionV: number; setDiffusionV: (v: number) => void
	stepsPerFrame: number; setStepsPerFrame: (v: number) => void
	colorMode: string; setColorMode: (v: string) => void
	fgColor: string; setFgColor: (v: string) => void
	bgColor: string; setBgColor: (v: string) => void
	chars: string; setChars: (v: string) => void
	seed: number; setSeed: (v: number) => void
}) {
	return (
		<ControlGroup label="Reaction-Diffusion">
			<NumberInput label="Feed Rate" value={feedRate} onChange={setFeedRate} min={0.01} max={0.08} step={0.001} />
			<NumberInput label="Kill Rate" value={killRate} onChange={setKillRate} min={0.045} max={0.07} step={0.001} />
			<NumberInput label="Diffusion U" value={diffusionU} onChange={setDiffusionU} min={0.1} max={2} step={0.1} />
			<NumberInput label="Diffusion V" value={diffusionV} onChange={setDiffusionV} min={0.1} max={1.5} step={0.05} />
			<NumberInput label="Steps/Frame" value={stepsPerFrame} onChange={setStepsPerFrame} min={1} max={20} step={1} />
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
			<TextInput label="Characters" value={chars} onChange={setChars} />
			<NumberInput label="Seed" value={seed} onChange={setSeed} min={0} step={1} />
		</ControlGroup>
	)
}
