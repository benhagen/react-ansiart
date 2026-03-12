import { ControlGroup } from '../../_components/ControlGroup'
import { ColorInput, NumberInput } from '../../_components/ControlRow'

export function DatamoshPanel({
	seed, setSeed,
	keyframeIntervalFrames, setKeyframeIntervalFrames,
	blockOpsPerFrame, setBlockOpsPerFrame,
	minBlockSize, setMinBlockSize,
	maxBlockSize, setMaxBlockSize,
	maxShift, setMaxShift,
	bgColor, setBgColor,
}: {
	seed: number; setSeed: (v: number) => void
	keyframeIntervalFrames: number; setKeyframeIntervalFrames: (v: number) => void
	blockOpsPerFrame: number; setBlockOpsPerFrame: (v: number) => void
	minBlockSize: number; setMinBlockSize: (v: number) => void
	maxBlockSize: number; setMaxBlockSize: (v: number) => void
	maxShift: number; setMaxShift: (v: number) => void
	bgColor: string; setBgColor: (v: string) => void
}) {
	return (
		<ControlGroup label="Datamosh Options">
			<NumberInput label="Seed" value={seed} onChange={setSeed} step={1} />
			<NumberInput label="Keyframe Interval" value={keyframeIntervalFrames} onChange={setKeyframeIntervalFrames} min={1} step={1} />
			<NumberInput label="Block Ops/Frame" value={blockOpsPerFrame} onChange={setBlockOpsPerFrame} min={0} step={1} />
			<NumberInput label="Min Block Size" value={minBlockSize} onChange={setMinBlockSize} min={1} step={1} />
			<NumberInput label="Max Block Size" value={maxBlockSize} onChange={setMaxBlockSize} min={1} step={1} />
			<NumberInput label="Max Shift" value={maxShift} onChange={setMaxShift} min={0} step={1} />
			<ColorInput label="BG Color" value={bgColor} onChange={setBgColor} />
		</ControlGroup>
	)
}
