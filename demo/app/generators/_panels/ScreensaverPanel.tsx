import { NumberInput, SelectInput } from '../../_components/ControlRow'
import { ControlGroup } from '../../_components/ControlGroup'

export function ScreensaverPanel({
	holdFrames, setHoldFrames,
	transitionFrames, setTransitionFrames,
	kind, setKind,
}: {
	holdFrames: number; setHoldFrames: (v: number) => void
	transitionFrames: number; setTransitionFrames: (v: number) => void
	kind: string; setKind: (v: string) => void
}) {
	return (
		<ControlGroup label="Screensaver">
			<NumberInput label="Hold Frames" value={holdFrames} onChange={setHoldFrames} min={60} max={1200} step={30} />
			<NumberInput label="Transition Frames" value={transitionFrames} onChange={setTransitionFrames} min={12} max={180} step={6} />
			<SelectInput
				label="Transition"
				value={kind}
				onChange={setKind}
				options={[
					{ value: 'auto', label: 'Auto (cycle all)' },
					{ value: 'dissolve', label: 'Dissolve' },
					{ value: 'wipeRight', label: 'Wipe Right' },
					{ value: 'wipeLeft', label: 'Wipe Left' },
					{ value: 'wipeDown', label: 'Wipe Down' },
					{ value: 'wipeUp', label: 'Wipe Up' },
					{ value: 'blocks', label: 'Blocks' },
				]}
			/>
		</ControlGroup>
	)
}
