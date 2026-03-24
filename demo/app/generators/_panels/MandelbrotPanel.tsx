import { ColorInput, NumberInput, SelectInput, TextInput, ToggleInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function MandelbrotPanel({
	maxIter, setMaxIter,
	zoomSpeed, setZoomSpeed,
	zoomX, setZoomX,
	zoomY, setZoomY,
	initialZoom, setInitialZoom,
	fgColor, setFgColor,
	bgColor, setBgColor,
	chars, setChars,
	aspectY, setAspectY,
	colorMode, setColorMode,
	shapeMode, setShapeMode,
}: {
	maxIter: number; setMaxIter: (v: number) => void
	zoomSpeed: number; setZoomSpeed: (v: number) => void
	zoomX: number; setZoomX: (v: number) => void
	zoomY: number; setZoomY: (v: number) => void
	initialZoom: number; setInitialZoom: (v: number) => void
	fgColor: string; setFgColor: (v: string) => void
	bgColor: string; setBgColor: (v: string) => void
	chars: string; setChars: (v: string) => void
	aspectY: number; setAspectY: (v: number) => void
	colorMode: string; setColorMode: (v: string) => void
	shapeMode: boolean; setShapeMode: (v: boolean) => void
}) {
	return (
		<ControlGroup label="Mandelbrot">
			<ToggleInput label="Shape Renderer" value={shapeMode} onChange={setShapeMode} />
			<NumberInput label="Max Iterations" value={maxIter} onChange={setMaxIter} min={16} max={256} step={8} />
			<NumberInput label="Zoom Speed" value={zoomSpeed} onChange={setZoomSpeed} min={0.005} max={0.1} step={0.005} />
			<NumberInput label="Zoom X" value={zoomX} onChange={setZoomX} min={-2} max={1} step={0.001} />
			<NumberInput label="Zoom Y" value={zoomY} onChange={setZoomY} min={-1.5} max={1.5} step={0.001} />
			<NumberInput label="Initial Zoom" value={initialZoom} onChange={setInitialZoom} min={0.1} max={5} step={0.1} />
			<SelectInput label="Color Mode" value={colorMode} onChange={setColorMode} options={[
				{ value: 'spectrum', label: 'Spectrum' },
				{ value: 'mono', label: 'Mono' },
			]} />
			<ColorInput label="Foreground" value={fgColor} onChange={setFgColor} />
			<ColorInput label="Background" value={bgColor} onChange={setBgColor} />
			{!shapeMode && (
				<TextInput label="Characters" value={chars} onChange={setChars} />
			)}
			{!shapeMode && (
				<NumberInput label="Aspect Y" value={aspectY} onChange={setAspectY} min={1} max={4} step={0.1} />
			)}
		</ControlGroup>
	)
}
