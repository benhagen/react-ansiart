import { ColorInput, NumberInput, SelectInput, TextInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function TerrainFlyoverPanel({
	scrollSpeed, setScrollSpeed,
	heightScale, setHeightScale,
	fogDistance, setFogDistance,
	colorMode, setColorMode,
	fgColor, setFgColor,
	bgColor, setBgColor,
	skyColor, setSkyColor,
	chars, setChars,
	seed, setSeed,
}: {
	scrollSpeed: number; setScrollSpeed: (v: number) => void
	heightScale: number; setHeightScale: (v: number) => void
	fogDistance: number; setFogDistance: (v: number) => void
	colorMode: string; setColorMode: (v: string) => void
	fgColor: string; setFgColor: (v: string) => void
	bgColor: string; setBgColor: (v: string) => void
	skyColor: string; setSkyColor: (v: string) => void
	chars: string; setChars: (v: string) => void
	seed: number; setSeed: (v: number) => void
}) {
	return (
		<ControlGroup label="Terrain Flyover">
			<NumberInput label="Scroll Speed" value={scrollSpeed} onChange={setScrollSpeed} min={0.01} max={2} step={0.05} />
			<NumberInput label="Height Scale" value={heightScale} onChange={setHeightScale} min={0.1} max={1} step={0.05} />
			<NumberInput label="Fog Distance" value={fogDistance} onChange={setFogDistance} min={0} max={1} step={0.05} />
			<SelectInput
				label="Color Mode"
				value={colorMode}
				onChange={setColorMode}
				options={[
					{ value: 'biome', label: 'Biome' },
					{ value: 'mono', label: 'Mono' },
				]}
			/>
			{colorMode === 'mono' && (
				<ColorInput label="FG Color" value={fgColor} onChange={setFgColor} />
			)}
			<ColorInput label="Background" value={bgColor} onChange={setBgColor} />
			<ColorInput label="Sky Color" value={skyColor} onChange={setSkyColor} />
			<TextInput label="Characters" value={chars} onChange={setChars} />
			<NumberInput label="Seed" value={seed} onChange={setSeed} min={0} step={1} />
		</ControlGroup>
	)
}
