import { ControlGroup } from '../../_components/ControlGroup'
import { ColorInput, NumberInput, TextInput } from '../../_components/ControlRow'

type Octave = { scale: number; amplitude: number; timeScaleX: number; timeScaleY: number }

export function PlasmaPanel({
	chars,
	setChars,
	timeScale,
	setTimeScale,
	fgColor,
	setFgColor,
	bgColor,
	setBgColor,
	seed,
	setSeed,
	octaves,
	setOctaves,
}: {
	chars: string
	setChars: (v: string) => void
	timeScale: number
	setTimeScale: (v: number) => void
	fgColor: string
	setFgColor: (v: string) => void
	bgColor: string
	setBgColor: (v: string) => void
	seed: number
	setSeed: (v: number) => void
	octaves: Octave[]
	setOctaves: (v: Octave[] | ((prev: Octave[]) => Octave[])) => void
}) {
	const updateOctave = (index: number, patch: Partial<Octave>) => {
		setOctaves((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)))
	}

	return (
		<ControlGroup label="Plasma Options">
			<TextInput label="Chars" value={chars} onChange={setChars} width={200} />
			<NumberInput label="Time Scale" value={timeScale} onChange={setTimeScale} step={0.05} />
			<ColorInput label="FG Color" value={fgColor} onChange={setFgColor} />
			<ColorInput label="BG Color" value={bgColor} onChange={setBgColor} />
			<NumberInput label="Seed" value={seed} onChange={setSeed} step={1} />

			<div className="flex-between mt-8">
				<label style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
					Octaves
				</label>
				<button
					className="btn-sm"
					onClick={() =>
						setOctaves((prev) => [
							...prev,
							{ scale: 0.02, amplitude: 1.0, timeScaleX: -1.0, timeScaleY: -0.5 },
						])
					}
				>
					+ Add
				</button>
			</div>
			{octaves.map((oct, i) => (
				<div key={i} className="octave-row">
					<span className="octave-label">{i + 1}</span>
					<div>
						<label>scale</label>
						<input type="number" step={0.01} value={oct.scale} onChange={(e) => updateOctave(i, { scale: Number(e.target.value) })} />
					</div>
					<div>
						<label>amp</label>
						<input type="number" step={0.1} value={oct.amplitude} onChange={(e) => updateOctave(i, { amplitude: Number(e.target.value) })} />
					</div>
					<div>
						<label>tsX</label>
						<input type="number" step={0.1} value={oct.timeScaleX} onChange={(e) => updateOctave(i, { timeScaleX: Number(e.target.value) })} />
					</div>
					<div>
						<label>tsY</label>
						<input type="number" step={0.1} value={oct.timeScaleY} onChange={(e) => updateOctave(i, { timeScaleY: Number(e.target.value) })} />
					</div>
					<button
						className="btn-sm danger"
						onClick={() => setOctaves((prev) => prev.filter((_, idx) => idx !== i))}
						disabled={octaves.length <= 1}
					>
						x
					</button>
				</div>
			))}
		</ControlGroup>
	)
}
