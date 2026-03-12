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
import { CodePreview } from '../_components/CodePreview'
import { ControlGroup } from '../_components/ControlGroup'
import { NumberInput, ToggleInput } from '../_components/ControlRow'
import { generateGeneratorCode } from '../_lib/generateCode'
import {
	DATAMOSH_DEFAULTS,
	FIRE_DEFAULTS,
	METABALLS_DEFAULTS,
	PLASMA_DEFAULTS,
	SONAR_DEFAULTS,
	VIRTUAL_DISPLAY_DEFAULTS,
} from '../_lib/defaults'
import { PlasmaPanel } from './_panels/PlasmaPanel'
import { FirePanel } from './_panels/FirePanel'
import { SonarPanel } from './_panels/SonarPanel'
import { DatamoshPanel } from './_panels/DatamoshPanel'
import { MetaballsPanel } from './_panels/MetaballsPanel'

type GeneratorType = 'perlinPlasma' | 'fire' | 'sonar' | 'datamosh' | 'metaballs'

const TABS: { key: GeneratorType; label: string }[] = [
	{ key: 'perlinPlasma', label: 'Plasma' },
	{ key: 'fire', label: 'Fire' },
	{ key: 'sonar', label: 'Sonar' },
	{ key: 'datamosh', label: 'Datamosh' },
	{ key: 'metaballs', label: 'Metaballs' },
]

export default function GeneratorsPage() {
	const [generatorType, setGeneratorType] = useState<GeneratorType>('perlinPlasma')
	const [columns, setColumns] = useState(80)
	const [rows, setRows] = useState(25)
	const [fps, setFps] = useState(30)
	const [showPerformanceOverlay, setShowPerformanceOverlay] = useState(false)

	// Plasma state
	const [plasmaChars, setPlasmaChars] = useState(PLASMA_DEFAULTS.chars)
	const [plasmaTimeScale, setPlasmaTimeScale] = useState(PLASMA_DEFAULTS.timeScale)
	const [plasmaFgColor, setPlasmaFgColor] = useState(PLASMA_DEFAULTS.fgColor)
	const [plasmaBgColor, setPlasmaBgColor] = useState(PLASMA_DEFAULTS.bgColor)
	const [plasmaSeed, setPlasmaSeed] = useState(PLASMA_DEFAULTS.seed)
	const [plasmaOctaves, setPlasmaOctaves] = useState(PLASMA_DEFAULTS.octaves)

	// Fire state
	const [fireChars, setFireChars] = useState(FIRE_DEFAULTS.chars)
	const [fireDarkenAmount, setFireDarkenAmount] = useState(FIRE_DEFAULTS.darkenAmount)
	const [fireSparkMin, setFireSparkMin] = useState(FIRE_DEFAULTS.sparkMin)
	const [fireSparkMax, setFireSparkMax] = useState(FIRE_DEFAULTS.sparkMax)
	const [fireBgColor, setFireBgColor] = useState(FIRE_DEFAULTS.bgColor)
	const [fireSeed, setFireSeed] = useState(FIRE_DEFAULTS.seed)

	// Sonar state
	const [sonarFrequency, setSonarFrequency] = useState(SONAR_DEFAULTS.frequency)
	const [sonarIntensity, setSonarIntensity] = useState(SONAR_DEFAULTS.intensity)
	const [sonarFgColor, setSonarFgColor] = useState(SONAR_DEFAULTS.fgColor)
	const [sonarBgColor, setSonarBgColor] = useState(SONAR_DEFAULTS.bgColor)
	const [sonarDotChar, setSonarDotChar] = useState(SONAR_DEFAULTS.dotChar)
	const [sonarSpeed, setSonarSpeed] = useState(SONAR_DEFAULTS.speed)
	const [sonarBandWidth, setSonarBandWidth] = useState(SONAR_DEFAULTS.bandWidth)
	const [sonarDecay, setSonarDecay] = useState(SONAR_DEFAULTS.decay)
	const [sonarBaseAlpha, setSonarBaseAlpha] = useState(SONAR_DEFAULTS.baseAlpha)
	const [sonarAlphaSteps, setSonarAlphaSteps] = useState(SONAR_DEFAULTS.alphaSteps)
	const [sonarCenterX, setSonarCenterX] = useState(SONAR_DEFAULTS.centerX)
	const [sonarCenterY, setSonarCenterY] = useState(SONAR_DEFAULTS.centerY)
	const [sonarAspectY, setSonarAspectY] = useState(SONAR_DEFAULTS.aspectY)
	const [sonarMaxRings, setSonarMaxRings] = useState(SONAR_DEFAULTS.maxRings)

	// Datamosh state
	const [datamoshSeed, setDatamoshSeed] = useState(DATAMOSH_DEFAULTS.seed)
	const [datamoshKeyframeIntervalFrames, setDatamoshKeyframeIntervalFrames] = useState(DATAMOSH_DEFAULTS.keyframeIntervalFrames)
	const [datamoshBlockOpsPerFrame, setDatamoshBlockOpsPerFrame] = useState(DATAMOSH_DEFAULTS.blockOpsPerFrame)
	const [datamoshMinBlockSize, setDatamoshMinBlockSize] = useState(DATAMOSH_DEFAULTS.minBlockSize)
	const [datamoshMaxBlockSize, setDatamoshMaxBlockSize] = useState(DATAMOSH_DEFAULTS.maxBlockSize)
	const [datamoshMaxShift, setDatamoshMaxShift] = useState(DATAMOSH_DEFAULTS.maxShift)
	const [datamoshBgColor, setDatamoshBgColor] = useState(DATAMOSH_DEFAULTS.bgColor)

	// Metaballs state
	const [metaballsSeed, setMetaballsSeed] = useState(METABALLS_DEFAULTS.seed)
	const [metaballsBalls, setMetaballsBalls] = useState(METABALLS_DEFAULTS.balls)
	const [metaballsSpeed, setMetaballsSpeed] = useState(METABALLS_DEFAULTS.speed)
	const [metaballsRadiusMin, setMetaballsRadiusMin] = useState(METABALLS_DEFAULTS.radiusMin)
	const [metaballsRadiusMax, setMetaballsRadiusMax] = useState(METABALLS_DEFAULTS.radiusMax)
	const [metaballsIntensity, setMetaballsIntensity] = useState(METABALLS_DEFAULTS.intensity)
	const [metaballsAspectY, setMetaballsAspectY] = useState(METABALLS_DEFAULTS.aspectY)
	const [metaballsFgColor, setMetaballsFgColor] = useState(METABALLS_DEFAULTS.fgColor)
	const [metaballsBgColor, setMetaballsBgColor] = useState(METABALLS_DEFAULTS.bgColor)
	const [metaballsChars, setMetaballsChars] = useState(METABALLS_DEFAULTS.chars)

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
			return (frame: number, cols: number, r: number) =>
				generateAsciiFireFrame(frame, cols, r, {
					chars: fireChars.trim() ? Array.from(fireChars) : undefined,
					darkenAmount: fireDarkenAmount,
					sparkRange: [fireSparkMin, fireSparkMax],
					bgColor: fireBgColor,
					seed: fireSeed,
				})
		}
		if (generatorType === 'sonar') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiSonarFrame(frame, cols, r, {
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
		if (generatorType === 'datamosh') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiDatamoshFrame(frame, cols, r, {
					seed: datamoshSeed,
					keyframeIntervalFrames: datamoshKeyframeIntervalFrames,
					blockOpsPerFrame: datamoshBlockOpsPerFrame,
					minBlockSize: datamoshMinBlockSize,
					maxBlockSize: datamoshMaxBlockSize,
					maxShift: datamoshMaxShift,
					bgColor: datamoshBgColor,
				})
		}
		if (generatorType === 'metaballs') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiMetaballsFrame(frame, cols, r, {
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
		return (frame: number, cols: number, r: number) =>
			generateAsciiPerlinPlasmaFrame(frame, cols, r, {
				chars: plasmaChars.trim() ? Array.from(plasmaChars) : undefined,
				timeScale: plasmaTimeScale,
				fgColor: plasmaFgColor,
				bgColor: plasmaBgColor,
				octaves: plasmaOctaves.length ? plasmaOctaves : undefined,
				seed: plasmaSeed,
			})
	}, [
		generatorType, fps,
		plasmaChars, plasmaTimeScale, plasmaFgColor, plasmaBgColor, plasmaSeed, plasmaOctaves,
		fireChars, fireDarkenAmount, fireSparkMin, fireSparkMax, fireBgColor, fireSeed,
		sonarFrequency, sonarIntensity, sonarFgColor, sonarBgColor, sonarDotChar, sonarSpeed,
		sonarBandWidth, sonarDecay, sonarBaseAlpha, sonarAlphaSteps, sonarCenterX, sonarCenterY,
		sonarAspectY, sonarMaxRings,
		datamoshSeed, datamoshKeyframeIntervalFrames, datamoshBlockOpsPerFrame, datamoshMinBlockSize,
		datamoshMaxBlockSize, datamoshMaxShift, datamoshBgColor,
		metaballsSeed, metaballsBalls, metaballsSpeed, metaballsRadiusMin, metaballsRadiusMax,
		metaballsIntensity, metaballsAspectY, metaballsFgColor, metaballsBgColor, metaballsChars,
	])

	const generatorOptionsMap: Record<GeneratorType, { options: Record<string, unknown>; defaults: Record<string, unknown> }> = {
		perlinPlasma: {
			options: { chars: plasmaChars, timeScale: plasmaTimeScale, fgColor: plasmaFgColor, bgColor: plasmaBgColor, seed: plasmaSeed, octaves: plasmaOctaves },
			defaults: PLASMA_DEFAULTS,
		},
		fire: {
			options: { chars: fireChars, darkenAmount: fireDarkenAmount, sparkRange: [fireSparkMin, fireSparkMax], bgColor: fireBgColor, seed: fireSeed },
			defaults: { ...FIRE_DEFAULTS, sparkRange: [FIRE_DEFAULTS.sparkMin, FIRE_DEFAULTS.sparkMax] },
		},
		sonar: {
			options: { frequency: sonarFrequency, intensity: sonarIntensity, fps, fgColor: sonarFgColor, bgColor: sonarBgColor, dotChar: sonarDotChar, speed: sonarSpeed, bandWidth: sonarBandWidth, decay: sonarDecay, baseAlpha: sonarBaseAlpha, alphaSteps: sonarAlphaSteps, centerX: sonarCenterX, centerY: sonarCenterY, aspectY: sonarAspectY, maxRings: sonarMaxRings },
			defaults: SONAR_DEFAULTS,
		},
		datamosh: {
			options: { seed: datamoshSeed, keyframeIntervalFrames: datamoshKeyframeIntervalFrames, blockOpsPerFrame: datamoshBlockOpsPerFrame, minBlockSize: datamoshMinBlockSize, maxBlockSize: datamoshMaxBlockSize, maxShift: datamoshMaxShift, bgColor: datamoshBgColor },
			defaults: DATAMOSH_DEFAULTS,
		},
		metaballs: {
			options: { seed: metaballsSeed, balls: metaballsBalls, speed: metaballsSpeed, radiusMin: metaballsRadiusMin, radiusMax: metaballsRadiusMax, intensity: metaballsIntensity, aspectY: metaballsAspectY, fgColor: metaballsFgColor, bgColor: metaballsBgColor, chars: metaballsChars },
			defaults: METABALLS_DEFAULTS,
		},
	}

	const activeGen = generatorOptionsMap[generatorType]
	const code = useMemo(() => {
		return generateGeneratorCode(
			generatorType,
			{ columns, rows, fps, showPerformanceOverlay },
			VIRTUAL_DISPLAY_DEFAULTS,
			activeGen.options,
			activeGen.defaults
		)
	}, [generatorType, columns, rows, fps, showPerformanceOverlay, activeGen.options, activeGen.defaults])

	return (
		<>
			<div className="page-header">
				<h1>Generators</h1>
				<p>Procedural frame generators rendered with AnsiVirtualDisplay</p>
			</div>
			<div className="playground">
				<div className="playground-canvas">
					<AnsiVirtualDisplay
						columns={columns}
						rows={rows}
						fps={fps}
						frameGenerator={frameGenerator}
						showPerformanceOverlay={showPerformanceOverlay}
					/>
				</div>
				<div className="controls-panel">
					<div className="tab-bar">
						{TABS.map((tab) => (
							<button
								key={tab.key}
								className={generatorType === tab.key ? 'active' : ''}
								onClick={() => setGeneratorType(tab.key)}
							>
								{tab.label}
							</button>
						))}
					</div>

					<ControlGroup label="Display">
						<NumberInput label="Columns" value={columns} onChange={setColumns} min={10} step={1} />
						<NumberInput label="Rows" value={rows} onChange={setRows} min={10} step={1} />
						<NumberInput label="FPS" value={fps} onChange={setFps} min={1} step={1} />
						<ToggleInput label="Performance Overlay" value={showPerformanceOverlay} onChange={setShowPerformanceOverlay} />
					</ControlGroup>

					{generatorType === 'perlinPlasma' && (
						<PlasmaPanel
							chars={plasmaChars} setChars={setPlasmaChars}
							timeScale={plasmaTimeScale} setTimeScale={setPlasmaTimeScale}
							fgColor={plasmaFgColor} setFgColor={setPlasmaFgColor}
							bgColor={plasmaBgColor} setBgColor={setPlasmaBgColor}
							seed={plasmaSeed} setSeed={setPlasmaSeed}
							octaves={plasmaOctaves} setOctaves={setPlasmaOctaves}
						/>
					)}

					{generatorType === 'fire' && (
						<FirePanel
							chars={fireChars} setChars={setFireChars}
							darkenAmount={fireDarkenAmount} setDarkenAmount={setFireDarkenAmount}
							sparkMin={fireSparkMin} setSparkMin={setFireSparkMin}
							sparkMax={fireSparkMax} setSparkMax={setFireSparkMax}
							bgColor={fireBgColor} setBgColor={setFireBgColor}
							seed={fireSeed} setSeed={setFireSeed}
						/>
					)}

					{generatorType === 'sonar' && (
						<SonarPanel
							frequency={sonarFrequency} setFrequency={setSonarFrequency}
							intensity={sonarIntensity} setIntensity={setSonarIntensity}
							fgColor={sonarFgColor} setFgColor={setSonarFgColor}
							bgColor={sonarBgColor} setBgColor={setSonarBgColor}
							dotChar={sonarDotChar} setDotChar={setSonarDotChar}
							speed={sonarSpeed} setSpeed={setSonarSpeed}
							bandWidth={sonarBandWidth} setBandWidth={setSonarBandWidth}
							decay={sonarDecay} setDecay={setSonarDecay}
							baseAlpha={sonarBaseAlpha} setBaseAlpha={setSonarBaseAlpha}
							alphaSteps={sonarAlphaSteps} setAlphaSteps={setSonarAlphaSteps}
							centerX={sonarCenterX} setCenterX={setSonarCenterX}
							centerY={sonarCenterY} setCenterY={setSonarCenterY}
							aspectY={sonarAspectY} setAspectY={setSonarAspectY}
							maxRings={sonarMaxRings} setMaxRings={setSonarMaxRings}
						/>
					)}

					{generatorType === 'datamosh' && (
						<DatamoshPanel
							seed={datamoshSeed} setSeed={setDatamoshSeed}
							keyframeIntervalFrames={datamoshKeyframeIntervalFrames} setKeyframeIntervalFrames={setDatamoshKeyframeIntervalFrames}
							blockOpsPerFrame={datamoshBlockOpsPerFrame} setBlockOpsPerFrame={setDatamoshBlockOpsPerFrame}
							minBlockSize={datamoshMinBlockSize} setMinBlockSize={setDatamoshMinBlockSize}
							maxBlockSize={datamoshMaxBlockSize} setMaxBlockSize={setDatamoshMaxBlockSize}
							maxShift={datamoshMaxShift} setMaxShift={setDatamoshMaxShift}
							bgColor={datamoshBgColor} setBgColor={setDatamoshBgColor}
						/>
					)}

					{generatorType === 'metaballs' && (
						<MetaballsPanel
							seed={metaballsSeed} setSeed={setMetaballsSeed}
							balls={metaballsBalls} setBalls={setMetaballsBalls}
							speed={metaballsSpeed} setSpeed={setMetaballsSpeed}
							radiusMin={metaballsRadiusMin} setRadiusMin={setMetaballsRadiusMin}
							radiusMax={metaballsRadiusMax} setRadiusMax={setMetaballsRadiusMax}
							intensity={metaballsIntensity} setIntensity={setMetaballsIntensity}
							aspectY={metaballsAspectY} setAspectY={setMetaballsAspectY}
							fgColor={metaballsFgColor} setFgColor={setMetaballsFgColor}
							bgColor={metaballsBgColor} setBgColor={setMetaballsBgColor}
							chars={metaballsChars} setChars={setMetaballsChars}
						/>
					)}

					<ControlGroup label="Code" defaultOpen={true}>
						<CodePreview code={code} />
					</ControlGroup>
				</div>
			</div>
		</>
	)
}
