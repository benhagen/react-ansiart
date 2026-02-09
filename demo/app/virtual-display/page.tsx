'use client'

import { useEffect, useMemo, useState } from 'react'
import {
	AnsiVirtualDisplay,
	clearDatamoshState,
	clearFireState,
	generateAsciiDatamoshFrame,
	generateAsciiFireFrame,
	generateAsciiMetaballsFrame,
	generateAsciiPerlinPlasmaFrame,
	generateAsciiSonarFrame,
} from 'react-ansiart'

const FONT_URL = '/ansi/fonts/Bm437_IBM_VGA_8x16.FON'

type GeneratorType = 'perlinPlasma' | 'fire' | 'sonar' | 'datamosh' | 'metaballs'

export default function VirtualDisplayPage() {
	const [generatorType, setGeneratorType] = useState<GeneratorType>('perlinPlasma')
	const [columns, setColumns] = useState(80)
	const [rows, setRows] = useState(25)
	const [fps, setFps] = useState(30)
	const [showPerformanceOverlay, setShowPerformanceOverlay] = useState(false)

	// Perlin plasma options (AsciiPerlinPlasmaOptions)
	const [plasmaChars, setPlasmaChars] = useState('QB$8@0#2*+:,ùú      ')
	const [plasmaTimeScale, setPlasmaTimeScale] = useState(0.9)
	const [plasmaFgColor, setPlasmaFgColor] = useState('#55FFFF')
	const [plasmaBgColor, setPlasmaBgColor] = useState('#000000')
	const [plasmaSeed, setPlasmaSeed] = useState(12345)
	const [plasmaOctaves, setPlasmaOctaves] = useState<
		Array<{ scale: number; amplitude: number; timeScaleX: number; timeScaleY: number }>
	>([
		{ scale: 0.02, amplitude: 1.0, timeScaleX: -1.0, timeScaleY: -0.5 },
		{ scale: 0.04, amplitude: 1.0, timeScaleX: -0.5, timeScaleY: -0.3 },
	])

	// Fire options (AsciiFireOptions)
	const [fireChars, setFireChars] = useState(' .:;+=xX$&#@')
	const [fireDarkenAmount, setFireDarkenAmount] = useState(0.5)
	const [fireSparkMin, setFireSparkMin] = useState(200)
	const [fireSparkMax, setFireSparkMax] = useState(255)
	const [fireBgColor, setFireBgColor] = useState('#000000')
	const [fireSeed, setFireSeed] = useState(12345)
	const [fireWorldWidth, setFireWorldWidth] = useState<string>('') // optional
	const [fireWorldHeight, setFireWorldHeight] = useState<string>('') // optional

	// Sonar options (AsciiSonarOptions)
	const [sonarFrequency, setSonarFrequency] = useState(0.9)
	const [sonarIntensity, setSonarIntensity] = useState(1.0)
	const [sonarFgColor, setSonarFgColor] = useState('#ffffff')
	const [sonarBgColor, setSonarBgColor] = useState('#000000')
	const [sonarDotChar, setSonarDotChar] = useState('.')
	const [sonarSpeed, setSonarSpeed] = useState(14)
	const [sonarBandWidth, setSonarBandWidth] = useState(1.25)
	const [sonarDecay, setSonarDecay] = useState(0.75)
	const [sonarBaseAlpha, setSonarBaseAlpha] = useState(0.03)
	const [sonarAlphaSteps, setSonarAlphaSteps] = useState(32)
	const [sonarCenterX, setSonarCenterX] = useState<string>('') // optional
	const [sonarCenterY, setSonarCenterY] = useState<string>('') // optional
	const [sonarAspectY, setSonarAspectY] = useState(2)
	const [sonarMaxRings, setSonarMaxRings] = useState(24)

	// Datamosh options (AsciiDatamoshOptions)
	const [datamoshSeed, setDatamoshSeed] = useState(1337)
	const [datamoshKeyframeIntervalFrames, setDatamoshKeyframeIntervalFrames] = useState(24)
	const [datamoshBlockOpsPerFrame, setDatamoshBlockOpsPerFrame] = useState(10)
	const [datamoshMinBlockSize, setDatamoshMinBlockSize] = useState(3)
	const [datamoshMaxBlockSize, setDatamoshMaxBlockSize] = useState(18)
	const [datamoshMaxShift, setDatamoshMaxShift] = useState(12)
	const [datamoshBgColor, setDatamoshBgColor] = useState('#000000')

	// Metaballs options (AsciiMetaballsOptions)
	const [metaballsSeed, setMetaballsSeed] = useState(1337)
	const [metaballsBalls, setMetaballsBalls] = useState(6)
	const [metaballsSpeed, setMetaballsSpeed] = useState(0.085)
	const [metaballsRadiusMin, setMetaballsRadiusMin] = useState(2.5)
	const [metaballsRadiusMax, setMetaballsRadiusMax] = useState(9.5)
	const [metaballsIntensity, setMetaballsIntensity] = useState(0.55)
	const [metaballsAspectY, setMetaballsAspectY] = useState(2)
	const [metaballsFgColor, setMetaballsFgColor] = useState('#55FFFF')
	const [metaballsBgColor, setMetaballsBgColor] = useState('#000000')
	const [metaballsChars, setMetaballsChars] = useState(' .,:;+=xX$&#@')

	useEffect(() => {
		clearFireState()
		clearDatamoshState()
	}, [generatorType])

	const parseOptionalNumber = (value: string): number | undefined => {
		const v = value.trim()
		if (!v) return undefined
		const n = Number(v)
		return Number.isFinite(n) ? n : undefined
	}

	const frameGenerator = useMemo(() => {
		if (generatorType === 'fire') {
			return (frame: number, cols: number, r: number) => {
				return generateAsciiFireFrame(frame, cols, r, {
					chars: fireChars.trim() ? Array.from(fireChars) : undefined,
					darkenAmount: fireDarkenAmount,
					sparkRange: [fireSparkMin, fireSparkMax],
					bgColor: fireBgColor,
					seed: fireSeed,
					worldWidth: parseOptionalNumber(fireWorldWidth),
					worldHeight: parseOptionalNumber(fireWorldHeight),
				})
			}
		}

		if (generatorType === 'sonar') {
			return (frame: number, cols: number, r: number) => {
				return generateAsciiSonarFrame(frame, cols, r, {
					frequency: sonarFrequency,
					intensity: sonarIntensity,
					fps,
					fgColor: sonarFgColor,
					bgColor: sonarBgColor,
					dotChar: sonarDotChar || '.',
					speed: sonarSpeed,
					bandWidth: sonarBandWidth,
					decay: sonarDecay,
					baseAlpha: sonarBaseAlpha,
					alphaSteps: sonarAlphaSteps,
					centerX: parseOptionalNumber(sonarCenterX),
					centerY: parseOptionalNumber(sonarCenterY),
					aspectY: sonarAspectY,
					maxRings: sonarMaxRings,
				})
			}
		}

		if (generatorType === 'datamosh') {
			return (frame: number, cols: number, r: number) => {
				return generateAsciiDatamoshFrame(frame, cols, r, {
					seed: datamoshSeed,
					keyframeIntervalFrames: datamoshKeyframeIntervalFrames,
					blockOpsPerFrame: datamoshBlockOpsPerFrame,
					minBlockSize: datamoshMinBlockSize,
					maxBlockSize: datamoshMaxBlockSize,
					maxShift: datamoshMaxShift,
					bgColor: datamoshBgColor,
				})
			}
		}

		if (generatorType === 'metaballs') {
			return (frame: number, cols: number, r: number) => {
				return generateAsciiMetaballsFrame(frame, cols, r, {
					seed: metaballsSeed,
					balls: metaballsBalls,
					speed: metaballsSpeed,
					radiusMin: metaballsRadiusMin,
					radiusMax: metaballsRadiusMax,
					intensity: metaballsIntensity,
					aspectY: metaballsAspectY,
					fgColor: metaballsFgColor,
					bgColor: metaballsBgColor,
					chars: metaballsChars.trim() ? Array.from(metaballsChars) : undefined,
				})
			}
		}

		return (frame: number, cols: number, r: number) => {
			return generateAsciiPerlinPlasmaFrame(frame, cols, r, {
				chars: plasmaChars.trim() ? Array.from(plasmaChars) : undefined,
				timeScale: plasmaTimeScale,
				fgColor: plasmaFgColor,
				bgColor: plasmaBgColor,
				octaves: plasmaOctaves.length ? plasmaOctaves : undefined,
				seed: plasmaSeed,
			})
		}
	}, [
		generatorType,
		fps,
		plasmaChars,
		plasmaTimeScale,
		plasmaFgColor,
		plasmaBgColor,
		plasmaSeed,
		plasmaOctaves,
		fireChars,
		fireDarkenAmount,
		fireSparkMin,
		fireSparkMax,
		fireBgColor,
		fireSeed,
		fireWorldWidth,
		fireWorldHeight,
		sonarFrequency,
		sonarIntensity,
		sonarFgColor,
		sonarBgColor,
		sonarDotChar,
		sonarSpeed,
		sonarBandWidth,
		sonarDecay,
		sonarBaseAlpha,
		sonarAlphaSteps,
		sonarCenterX,
		sonarCenterY,
		sonarAspectY,
		sonarMaxRings,
		datamoshSeed,
		datamoshKeyframeIntervalFrames,
		datamoshBlockOpsPerFrame,
		datamoshMinBlockSize,
		datamoshMaxBlockSize,
		datamoshMaxShift,
		datamoshBgColor,
		metaballsSeed,
		metaballsBalls,
		metaballsSpeed,
		metaballsRadiusMin,
		metaballsRadiusMax,
		metaballsIntensity,
		metaballsAspectY,
		metaballsFgColor,
		metaballsBgColor,
		metaballsChars,
	])

	const updatePlasmaOctave = (
		index: number,
		patch: Partial<{ scale: number; amplitude: number; timeScaleX: number; timeScaleY: number }>
	) => {
		setPlasmaOctaves(prev => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)))
	}

	return (
		<div>
			<div className='panel'>
				<h2 style={{ marginTop: 0 }}>Virtual Display</h2>
				<p className='muted' style={{ marginBottom: 0 }}>
					Procedural animation using{' '}
					<code>
						{generatorType === 'fire'
							? 'generateAsciiFireFrame'
							: generatorType === 'sonar'
							? 'generateAsciiSonarFrame'
							: generatorType === 'datamosh'
							? 'generateAsciiDatamoshFrame'
							: generatorType === 'metaballs'
							? 'generateAsciiMetaballsFrame'
							: 'generateAsciiPerlinPlasmaFrame'}
					</code>
					.
				</p>
			</div>

			<div className='panel'>
				<h3 style={{ marginTop: 0 }}>Controls</h3>
				<div className='row'>
					<label className='muted'>
						Generator:{' '}
						<select
							value={generatorType}
							onChange={e => setGeneratorType(e.target.value as GeneratorType)}
							style={{ marginLeft: 8 }}
						>
							<option value='perlinPlasma'>Perlin plasma</option>
							<option value='fire'>Fire</option>
							<option value='sonar'>Sonar</option>
							<option value='datamosh'>Glitch / datamosh</option>
							<option value='metaballs'>Metaballs</option>
						</select>
					</label>
					<label className='muted'>
						Columns:{' '}
						<input
							type='number'
							min={10}
							step={1}
							value={columns}
							onChange={e => setColumns(Number(e.target.value))}
							style={{ marginLeft: 8, width: 90 }}
						/>
					</label>
					<label className='muted'>
						Rows:{' '}
						<input
							type='number'
							min={10}
							step={1}
							value={rows}
							onChange={e => setRows(Number(e.target.value))}
							style={{ marginLeft: 8, width: 90 }}
						/>
					</label>
					<label className='muted'>
						fps:{' '}
						<input
							type='number'
							min={1}
							step={1}
							value={fps}
							onChange={e => setFps(Number(e.target.value))}
							style={{ marginLeft: 8, width: 90 }}
						/>
					</label>
					<button className='btn' onClick={() => setShowPerformanceOverlay(v => !v)}>
						Performance overlay: {showPerformanceOverlay ? 'on' : 'off'}
					</button>
				</div>

				{generatorType === 'perlinPlasma' && (
					<div className='row' style={{ marginTop: 12, gap: 12, flexWrap: 'wrap' }}>
						<label className='muted'>
							chars:{' '}
							<input
								type='text'
								value={plasmaChars}
								onChange={e => setPlasmaChars(e.target.value)}
								style={{ marginLeft: 8, width: 260 }}
							/>
						</label>
						<label className='muted'>
							timeScale:{' '}
							<input
								type='number'
								step={0.05}
								value={plasmaTimeScale}
								onChange={e => setPlasmaTimeScale(Number(e.target.value))}
								style={{ marginLeft: 8, width: 110 }}
							/>
						</label>
						<label className='muted'>
							fgColor:{' '}
							<input
								type='text'
								value={plasmaFgColor}
								onChange={e => setPlasmaFgColor(e.target.value)}
								style={{ marginLeft: 8, width: 150 }}
							/>
						</label>
						<label className='muted'>
							bgColor:{' '}
							<input
								type='text'
								value={plasmaBgColor}
								onChange={e => setPlasmaBgColor(e.target.value)}
								style={{ marginLeft: 8, width: 150 }}
							/>
						</label>
						<label className='muted'>
							seed:{' '}
							<input
								type='number'
								step={1}
								value={plasmaSeed}
								onChange={e => setPlasmaSeed(Number(e.target.value))}
								style={{ marginLeft: 8, width: 110 }}
							/>
						</label>
						<button
							className='btn'
							onClick={() =>
								setPlasmaOctaves(prev => [
									...prev,
									{ scale: 0.02, amplitude: 1.0, timeScaleX: -1.0, timeScaleY: -0.5 },
								])
							}
						>
							Add octave
						</button>
					</div>
				)}

				{generatorType === 'perlinPlasma' &&
					plasmaOctaves.map((oct, i) => (
						<div
							key={i}
							className='row'
							style={{ marginTop: 8, gap: 12, flexWrap: 'wrap', alignItems: 'center' }}
						>
							<div className='muted' style={{ minWidth: 80 }}>
								Octave {i + 1}
							</div>
							<label className='muted'>
								scale:{' '}
								<input
									type='number'
									step={0.01}
									value={oct.scale}
									onChange={e => updatePlasmaOctave(i, { scale: Number(e.target.value) })}
									style={{ marginLeft: 8, width: 110 }}
								/>
							</label>
							<label className='muted'>
								amplitude:{' '}
								<input
									type='number'
									step={0.1}
									value={oct.amplitude}
									onChange={e => updatePlasmaOctave(i, { amplitude: Number(e.target.value) })}
									style={{ marginLeft: 8, width: 110 }}
								/>
							</label>
							<label className='muted'>
								timeScaleX:{' '}
								<input
									type='number'
									step={0.1}
									value={oct.timeScaleX}
									onChange={e => updatePlasmaOctave(i, { timeScaleX: Number(e.target.value) })}
									style={{ marginLeft: 8, width: 110 }}
								/>
							</label>
							<label className='muted'>
								timeScaleY:{' '}
								<input
									type='number'
									step={0.1}
									value={oct.timeScaleY}
									onChange={e => updatePlasmaOctave(i, { timeScaleY: Number(e.target.value) })}
									style={{ marginLeft: 8, width: 110 }}
								/>
							</label>
							<button
								className='btn'
								onClick={() => setPlasmaOctaves(prev => prev.filter((_, idx) => idx !== i))}
								disabled={plasmaOctaves.length <= 1}
							>
								Remove
							</button>
						</div>
					))}

				{generatorType === 'fire' && (
					<div className='row' style={{ marginTop: 12, gap: 12, flexWrap: 'wrap' }}>
						<label className='muted'>
							chars:{' '}
							<input
								type='text'
								value={fireChars}
								onChange={e => setFireChars(e.target.value)}
								style={{ marginLeft: 8, width: 220 }}
							/>
						</label>
						<label className='muted'>
							darkenAmount:{' '}
							<input
								type='number'
								min={0}
								step={0.05}
								value={fireDarkenAmount}
								onChange={e => setFireDarkenAmount(Number(e.target.value))}
								style={{ marginLeft: 8, width: 110 }}
							/>
						</label>
						<label className='muted'>
							sparkRange min:{' '}
							<input
								type='number'
								min={0}
								max={255}
								step={1}
								value={fireSparkMin}
								onChange={e => setFireSparkMin(Number(e.target.value))}
								style={{ marginLeft: 8, width: 90 }}
							/>
						</label>
						<label className='muted'>
							max:{' '}
							<input
								type='number'
								min={0}
								max={255}
								step={1}
								value={fireSparkMax}
								onChange={e => setFireSparkMax(Number(e.target.value))}
								style={{ marginLeft: 8, width: 90 }}
							/>
						</label>
						<label className='muted'>
							bgColor:{' '}
							<input
								type='text'
								value={fireBgColor}
								onChange={e => setFireBgColor(e.target.value)}
								style={{ marginLeft: 8, width: 150 }}
							/>
						</label>
						<label className='muted'>
							seed:{' '}
							<input
								type='number'
								step={1}
								value={fireSeed}
								onChange={e => setFireSeed(Number(e.target.value))}
								style={{ marginLeft: 8, width: 110 }}
							/>
						</label>
						<label className='muted'>
							worldWidth (optional):{' '}
							<input
								type='text'
								value={fireWorldWidth}
								onChange={e => setFireWorldWidth(e.target.value)}
								placeholder='(blank)'
								style={{ marginLeft: 8, width: 120 }}
							/>
						</label>
						<label className='muted'>
							worldHeight (optional):{' '}
							<input
								type='text'
								value={fireWorldHeight}
								onChange={e => setFireWorldHeight(e.target.value)}
								placeholder='(blank)'
								style={{ marginLeft: 8, width: 120 }}
							/>
						</label>
					</div>
				)}

				{generatorType === 'sonar' && (
					<div className='row' style={{ marginTop: 12, gap: 12, flexWrap: 'wrap' }}>
						<label className='muted'>
							frequency (Hz):{' '}
							<input
								type='number'
								min={0.05}
								step={0.05}
								value={sonarFrequency}
								onChange={e => setSonarFrequency(Number(e.target.value))}
								style={{ marginLeft: 8, width: 110 }}
							/>
						</label>
						<label className='muted'>
							intensity:{' '}
							<input
								type='number'
								min={0}
								step={0.1}
								value={sonarIntensity}
								onChange={e => setSonarIntensity(Number(e.target.value))}
								style={{ marginLeft: 8, width: 110 }}
							/>
						</label>
						<label className='muted'>
							fps (derived):{' '}
							<input
								type='number'
								value={fps}
								disabled
								style={{ marginLeft: 8, width: 90, opacity: 0.7 }}
							/>
						</label>
						<label className='muted'>
							fgColor:{' '}
							<input
								type='text'
								value={sonarFgColor}
								onChange={e => setSonarFgColor(e.target.value)}
								style={{ marginLeft: 8, width: 150 }}
							/>
						</label>
						<label className='muted'>
							bgColor:{' '}
							<input
								type='text'
								value={sonarBgColor}
								onChange={e => setSonarBgColor(e.target.value)}
								style={{ marginLeft: 8, width: 150 }}
							/>
						</label>
						<label className='muted'>
							dotChar:{' '}
							<input
								type='text'
								value={sonarDotChar}
								onChange={e => setSonarDotChar(e.target.value)}
								style={{ marginLeft: 8, width: 60 }}
							/>
						</label>
						<label className='muted'>
							speed:{' '}
							<input
								type='number'
								step={1}
								value={sonarSpeed}
								onChange={e => setSonarSpeed(Number(e.target.value))}
								style={{ marginLeft: 8, width: 90 }}
							/>
						</label>
						<label className='muted'>
							bandWidth:{' '}
							<input
								type='number'
								step={0.05}
								value={sonarBandWidth}
								onChange={e => setSonarBandWidth(Number(e.target.value))}
								style={{ marginLeft: 8, width: 110 }}
							/>
						</label>
						<label className='muted'>
							decay:{' '}
							<input
								type='number'
								min={0}
								step={0.05}
								value={sonarDecay}
								onChange={e => setSonarDecay(Number(e.target.value))}
								style={{ marginLeft: 8, width: 110 }}
							/>
						</label>
						<label className='muted'>
							baseAlpha:{' '}
							<input
								type='number'
								min={0}
								max={1}
								step={0.01}
								value={sonarBaseAlpha}
								onChange={e => setSonarBaseAlpha(Number(e.target.value))}
								style={{ marginLeft: 8, width: 110 }}
							/>
						</label>
						<label className='muted'>
							alphaSteps:{' '}
							<input
								type='number'
								min={2}
								step={1}
								value={sonarAlphaSteps}
								onChange={e => setSonarAlphaSteps(Number(e.target.value))}
								style={{ marginLeft: 8, width: 90 }}
							/>
						</label>
						<label className='muted'>
							centerX (optional):{' '}
							<input
								type='text'
								value={sonarCenterX}
								onChange={e => setSonarCenterX(e.target.value)}
								placeholder='auto'
								style={{ marginLeft: 8, width: 90 }}
							/>
						</label>
						<label className='muted'>
							centerY (optional):{' '}
							<input
								type='text'
								value={sonarCenterY}
								onChange={e => setSonarCenterY(e.target.value)}
								placeholder='auto'
								style={{ marginLeft: 8, width: 90 }}
							/>
						</label>
						<label className='muted'>
							aspectY:{' '}
							<input
								type='number'
								step={0.1}
								value={sonarAspectY}
								onChange={e => setSonarAspectY(Number(e.target.value))}
								style={{ marginLeft: 8, width: 90 }}
							/>
						</label>
						<label className='muted'>
							maxRings:{' '}
							<input
								type='number'
								min={1}
								step={1}
								value={sonarMaxRings}
								onChange={e => setSonarMaxRings(Number(e.target.value))}
								style={{ marginLeft: 8, width: 90 }}
							/>
						</label>
					</div>
				)}

				{generatorType === 'datamosh' && (
					<div className='row' style={{ marginTop: 12, gap: 12, flexWrap: 'wrap' }}>
						<label className='muted'>
							seed:{' '}
							<input
								type='number'
								step={1}
								value={datamoshSeed}
								onChange={e => setDatamoshSeed(Number(e.target.value))}
								style={{ marginLeft: 8, width: 110 }}
							/>
						</label>
						<label className='muted'>
							keyframeIntervalFrames:{' '}
							<input
								type='number'
								min={1}
								step={1}
								value={datamoshKeyframeIntervalFrames}
								onChange={e => setDatamoshKeyframeIntervalFrames(Number(e.target.value))}
								style={{ marginLeft: 8, width: 110 }}
							/>
						</label>
						<label className='muted'>
							blockOpsPerFrame:{' '}
							<input
								type='number'
								min={0}
								step={1}
								value={datamoshBlockOpsPerFrame}
								onChange={e => setDatamoshBlockOpsPerFrame(Number(e.target.value))}
								style={{ marginLeft: 8, width: 110 }}
							/>
						</label>
						<label className='muted'>
							minBlockSize:{' '}
							<input
								type='number'
								min={1}
								step={1}
								value={datamoshMinBlockSize}
								onChange={e => setDatamoshMinBlockSize(Number(e.target.value))}
								style={{ marginLeft: 8, width: 110 }}
							/>
						</label>
						<label className='muted'>
							maxBlockSize:{' '}
							<input
								type='number'
								min={1}
								step={1}
								value={datamoshMaxBlockSize}
								onChange={e => setDatamoshMaxBlockSize(Number(e.target.value))}
								style={{ marginLeft: 8, width: 110 }}
							/>
						</label>
						<label className='muted'>
							maxShift:{' '}
							<input
								type='number'
								min={0}
								step={1}
								value={datamoshMaxShift}
								onChange={e => setDatamoshMaxShift(Number(e.target.value))}
								style={{ marginLeft: 8, width: 110 }}
							/>
						</label>
						<label className='muted'>
							bgColor:{' '}
							<input
								type='text'
								value={datamoshBgColor}
								onChange={e => setDatamoshBgColor(e.target.value)}
								style={{ marginLeft: 8, width: 150 }}
							/>
						</label>
					</div>
				)}

				{generatorType === 'metaballs' && (
					<div className='row' style={{ marginTop: 12, gap: 12, flexWrap: 'wrap' }}>
						<label className='muted'>
							seed:{' '}
							<input
								type='number'
								step={1}
								value={metaballsSeed}
								onChange={e => setMetaballsSeed(Number(e.target.value))}
								style={{ marginLeft: 8, width: 110 }}
							/>
						</label>
						<label className='muted'>
							balls:{' '}
							<input
								type='number'
								min={1}
								step={1}
								value={metaballsBalls}
								onChange={e => setMetaballsBalls(Number(e.target.value))}
								style={{ marginLeft: 8, width: 90 }}
							/>
						</label>
						<label className='muted'>
							speed:{' '}
							<input
								type='number'
								step={0.005}
								value={metaballsSpeed}
								onChange={e => setMetaballsSpeed(Number(e.target.value))}
								style={{ marginLeft: 8, width: 110 }}
							/>
						</label>
						<label className='muted'>
							radiusMin:{' '}
							<input
								type='number'
								step={0.5}
								value={metaballsRadiusMin}
								onChange={e => setMetaballsRadiusMin(Number(e.target.value))}
								style={{ marginLeft: 8, width: 110 }}
							/>
						</label>
						<label className='muted'>
							radiusMax:{' '}
							<input
								type='number'
								step={0.5}
								value={metaballsRadiusMax}
								onChange={e => setMetaballsRadiusMax(Number(e.target.value))}
								style={{ marginLeft: 8, width: 110 }}
							/>
						</label>
						<label className='muted'>
							intensity(k):{' '}
							<input
								type='number'
								min={0}
								step={0.05}
								value={metaballsIntensity}
								onChange={e => setMetaballsIntensity(Number(e.target.value))}
								style={{ marginLeft: 8, width: 110 }}
							/>
						</label>
						<label className='muted'>
							aspectY:{' '}
							<input
								type='number'
								step={0.1}
								value={metaballsAspectY}
								onChange={e => setMetaballsAspectY(Number(e.target.value))}
								style={{ marginLeft: 8, width: 90 }}
							/>
						</label>
						<label className='muted'>
							fgColor:{' '}
							<input
								type='text'
								value={metaballsFgColor}
								onChange={e => setMetaballsFgColor(e.target.value)}
								style={{ marginLeft: 8, width: 150 }}
							/>
						</label>
						<label className='muted'>
							bgColor:{' '}
							<input
								type='text'
								value={metaballsBgColor}
								onChange={e => setMetaballsBgColor(e.target.value)}
								style={{ marginLeft: 8, width: 150 }}
							/>
						</label>
						<label className='muted'>
							chars:{' '}
							<input
								type='text'
								value={metaballsChars}
								onChange={e => setMetaballsChars(e.target.value)}
								style={{ marginLeft: 8, width: 220 }}
							/>
						</label>
					</div>
				)}
			</div>

			<div className='panel'>
				<h3 style={{ marginTop: 0 }}>Render</h3>
				<AnsiVirtualDisplay
					columns={columns}
					rows={rows}
					fps={fps}
					frameGenerator={frameGenerator}
					bitmapFontUrl={FONT_URL}
					showPerformanceOverlay={showPerformanceOverlay}
				/>
			</div>
		</div>
	)
}
