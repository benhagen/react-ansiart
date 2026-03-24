'use client'

import { useEffect, useMemo, useState } from 'react'
import {
	AnsiVirtualDisplay,
	clearDatamoshState,
	clearFireState,
	clearGameOfLifeState,
	clearMatrixRainState,
	clearStarfieldState,
	clearWaterRippleState,
	generateAsciiDatamoshFrame,
	generateAsciiFireFrame,
	generateAsciiGameOfLifeFrame,
	generateAsciiMatrixRainFrame,
	generateAsciiMetaballsFrame,
	generateAsciiPerlinPlasmaFrame,
	generateAsciiSonarFrame,
	generateAsciiStarfieldFrame,
	generateAsciiMandelbrotFrame,
	generateAsciiTunnelFrame,
	generateAsciiWaterRippleFrame,
	generateMandelbrotPixels,
	createShapeConverter,
	getEmbeddedVgaFont,
	type FrameData,
	type DisplayFrameGenerator,
} from 'react-ansiart'
import { CodePreview } from '../_components/CodePreview'
import { ControlGroup } from '../_components/ControlGroup'
import { NumberInput, SelectInput, ToggleInput } from '../_components/ControlRow'
import { generateGeneratorCode } from '../_lib/generateCode'
import {
	DATAMOSH_DEFAULTS,
	FIRE_DEFAULTS,
	GAME_OF_LIFE_DEFAULTS,
	MANDELBROT_DEFAULTS,
	MATRIX_DEFAULTS,
	METABALLS_DEFAULTS,
	PLASMA_DEFAULTS,
	SONAR_DEFAULTS,
	STARFIELD_DEFAULTS,
	TUNNEL_DEFAULTS,
	VIRTUAL_DISPLAY_DEFAULTS,
	WATER_RIPPLE_DEFAULTS,
} from '../_lib/defaults'
import { PlasmaPanel } from './_panels/PlasmaPanel'
import { FirePanel } from './_panels/FirePanel'
import { SonarPanel } from './_panels/SonarPanel'
import { DatamoshPanel } from './_panels/DatamoshPanel'
import { MetaballsPanel } from './_panels/MetaballsPanel'
import { MatrixPanel } from './_panels/MatrixPanel'
import { StarfieldPanel } from './_panels/StarfieldPanel'
import { TunnelPanel } from './_panels/TunnelPanel'
import { GameOfLifePanel } from './_panels/GameOfLifePanel'
import { WaterRipplePanel } from './_panels/WaterRipplePanel'
import { MandelbrotPanel } from './_panels/MandelbrotPanel'

type GeneratorType = 'perlinPlasma' | 'fire' | 'sonar' | 'datamosh' | 'metaballs' | 'matrix' | 'starfield' | 'tunnel' | 'gameOfLife' | 'waterRipple' | 'mandelbrot'

const TABS: { key: GeneratorType; label: string }[] = [
	{ key: 'perlinPlasma', label: 'Plasma' },
	{ key: 'fire', label: 'Fire' },
	{ key: 'sonar', label: 'Sonar' },
	{ key: 'datamosh', label: 'Datamosh' },
	{ key: 'metaballs', label: 'Metaballs' },
	{ key: 'matrix', label: 'Matrix' },
	{ key: 'starfield', label: 'Starfield' },
	{ key: 'tunnel', label: 'Tunnel' },
	{ key: 'gameOfLife', label: 'Life' },
	{ key: 'waterRipple', label: 'Ripples' },
	{ key: 'mandelbrot', label: 'Mandelbrot' },
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

	// Matrix state
	const [matrixSpeed, setMatrixSpeed] = useState(MATRIX_DEFAULTS.speed)
	const [matrixDensity, setMatrixDensity] = useState(MATRIX_DEFAULTS.density)
	const [matrixTrailLength, setMatrixTrailLength] = useState(MATRIX_DEFAULTS.trailLength)
	const [matrixHeadColor, setMatrixHeadColor] = useState(MATRIX_DEFAULTS.headColor)
	const [matrixTrailColor, setMatrixTrailColor] = useState(MATRIX_DEFAULTS.trailColor)
	const [matrixBgColor, setMatrixBgColor] = useState(MATRIX_DEFAULTS.bgColor)
	const [matrixChars, setMatrixChars] = useState(MATRIX_DEFAULTS.chars)
	const [matrixSeed, setMatrixSeed] = useState(MATRIX_DEFAULTS.seed)

	// Starfield state
	const [starfieldStars, setStarfieldStars] = useState(STARFIELD_DEFAULTS.stars)
	const [starfieldSpeed, setStarfieldSpeed] = useState(STARFIELD_DEFAULTS.speed)
	const [starfieldFgColor, setStarfieldFgColor] = useState(STARFIELD_DEFAULTS.fgColor)
	const [starfieldBgColor, setStarfieldBgColor] = useState(STARFIELD_DEFAULTS.bgColor)
	const [starfieldChars, setStarfieldChars] = useState(STARFIELD_DEFAULTS.chars)
	const [starfieldSeed, setStarfieldSeed] = useState(STARFIELD_DEFAULTS.seed)
	const [starfieldStreaks, setStarfieldStreaks] = useState(STARFIELD_DEFAULTS.streaks)

	// Tunnel state
	const [tunnelSpeed, setTunnelSpeed] = useState(TUNNEL_DEFAULTS.speed)
	const [tunnelRotationSpeed, setTunnelRotationSpeed] = useState(TUNNEL_DEFAULTS.rotationSpeed)
	const [tunnelTiles, setTunnelTiles] = useState(TUNNEL_DEFAULTS.tiles)
	const [tunnelFgColor, setTunnelFgColor] = useState(TUNNEL_DEFAULTS.fgColor)
	const [tunnelBgColor, setTunnelBgColor] = useState(TUNNEL_DEFAULTS.bgColor)
	const [tunnelChars, setTunnelChars] = useState(TUNNEL_DEFAULTS.chars)
	const [tunnelAspectY, setTunnelAspectY] = useState(TUNNEL_DEFAULTS.aspectY)

	// Game of Life state
	const [lifeDensity, setLifeDensity] = useState(GAME_OF_LIFE_DEFAULTS.density)
	const [lifeFgColor, setLifeFgColor] = useState(GAME_OF_LIFE_DEFAULTS.fgColor)
	const [lifeBgColor, setLifeBgColor] = useState(GAME_OF_LIFE_DEFAULTS.bgColor)
	const [lifeSeed, setLifeSeed] = useState(GAME_OF_LIFE_DEFAULTS.seed)
	const [lifeAutoSeed, setLifeAutoSeed] = useState(GAME_OF_LIFE_DEFAULTS.autoSeed)
	const [lifeAutoSeedThreshold, setLifeAutoSeedThreshold] = useState(GAME_OF_LIFE_DEFAULTS.autoSeedThreshold)

	// Water Ripple state
	const [rippleDamping, setRippleDamping] = useState(WATER_RIPPLE_DEFAULTS.damping)
	const [rippleDropFrequency, setRippleDropFrequency] = useState(WATER_RIPPLE_DEFAULTS.dropFrequency)
	const [rippleDropStrength, setRippleDropStrength] = useState(WATER_RIPPLE_DEFAULTS.dropStrength)
	const [rippleFgColor, setRippleFgColor] = useState(WATER_RIPPLE_DEFAULTS.fgColor)
	const [rippleBgColor, setRippleBgColor] = useState(WATER_RIPPLE_DEFAULTS.bgColor)
	const [rippleChars, setRippleChars] = useState(WATER_RIPPLE_DEFAULTS.chars)
	const [rippleSeed, setRippleSeed] = useState(WATER_RIPPLE_DEFAULTS.seed)

	// Mandelbrot state
	const [mandelbrotMaxIter, setMandelbrotMaxIter] = useState(MANDELBROT_DEFAULTS.maxIter)
	const [mandelbrotZoomSpeed, setMandelbrotZoomSpeed] = useState(MANDELBROT_DEFAULTS.zoomSpeed)
	const [mandelbrotZoomX, setMandelbrotZoomX] = useState(MANDELBROT_DEFAULTS.zoomX)
	const [mandelbrotZoomY, setMandelbrotZoomY] = useState(MANDELBROT_DEFAULTS.zoomY)
	const [mandelbrotInitialZoom, setMandelbrotInitialZoom] = useState(MANDELBROT_DEFAULTS.initialZoom)
	const [mandelbrotFgColor, setMandelbrotFgColor] = useState(MANDELBROT_DEFAULTS.fgColor)
	const [mandelbrotBgColor, setMandelbrotBgColor] = useState(MANDELBROT_DEFAULTS.bgColor)
	const [mandelbrotChars, setMandelbrotChars] = useState(MANDELBROT_DEFAULTS.chars)
	const [mandelbrotAspectY, setMandelbrotAspectY] = useState(MANDELBROT_DEFAULTS.aspectY)
	const [mandelbrotColorMode, setMandelbrotColorMode] = useState<string>(MANDELBROT_DEFAULTS.colorMode)
	const [mandelbrotShapeMode, setMandelbrotShapeMode] = useState(false)

	useEffect(() => {
		clearFireState()
		clearDatamoshState()
		clearMatrixRainState()
		clearStarfieldState()
		clearGameOfLifeState()
		clearWaterRippleState()
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
		if (generatorType === 'matrix') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiMatrixRainFrame(frame, cols, r, {
					speed: matrixSpeed,
					density: matrixDensity,
					trailLength: matrixTrailLength,
					headColor: matrixHeadColor,
					trailColor: matrixTrailColor,
					bgColor: matrixBgColor,
					chars: matrixChars.trim() || undefined,
					seed: matrixSeed,
				})
		}
		if (generatorType === 'starfield') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiStarfieldFrame(frame, cols, r, {
					stars: starfieldStars,
					speed: starfieldSpeed,
					fgColor: starfieldFgColor,
					bgColor: starfieldBgColor,
					chars: starfieldChars.trim() || undefined,
					seed: starfieldSeed,
					streaks: starfieldStreaks,
				})
		}
		if (generatorType === 'tunnel') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiTunnelFrame(frame, cols, r, {
					speed: tunnelSpeed,
					rotationSpeed: tunnelRotationSpeed,
					tiles: tunnelTiles,
					fgColor: tunnelFgColor,
					bgColor: tunnelBgColor,
					chars: tunnelChars.trim() || undefined,
					aspectY: tunnelAspectY,
				})
		}
		if (generatorType === 'gameOfLife') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiGameOfLifeFrame(frame, cols, r, {
					density: lifeDensity,
					fgColor: lifeFgColor,
					bgColor: lifeBgColor,
					seed: lifeSeed,
					autoSeed: lifeAutoSeed,
					autoSeedThreshold: lifeAutoSeedThreshold,
				})
		}
		if (generatorType === 'waterRipple') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiWaterRippleFrame(frame, cols, r, {
					damping: rippleDamping,
					dropFrequency: rippleDropFrequency,
					dropStrength: rippleDropStrength,
					fgColor: rippleFgColor,
					bgColor: rippleBgColor,
					chars: rippleChars.trim() || undefined,
					seed: rippleSeed,
				})
		}
		if (generatorType === 'mandelbrot') {
			const mandelbrotOpts = {
				maxIter: mandelbrotMaxIter,
				zoomSpeed: mandelbrotZoomSpeed,
				zoomX: mandelbrotZoomX,
				zoomY: mandelbrotZoomY,
				initialZoom: mandelbrotInitialZoom,
				fgColor: mandelbrotFgColor,
				bgColor: mandelbrotBgColor,
				chars: mandelbrotChars.trim() || undefined,
				aspectY: mandelbrotAspectY,
				colorMode: mandelbrotColorMode as 'spectrum' | 'mono',
			}
			if (mandelbrotShapeMode) {
				const font = getEmbeddedVgaFont()
				const converter = createShapeConverter({ bitmapFont: font, rgbColor: true, monoBackground: true })
				const generator = (frame: number, cols: number, r: number): FrameData =>
					generateMandelbrotPixels(frame, cols * 6, r * 12, mandelbrotOpts)
				return { generator, converter } as unknown as DisplayFrameGenerator
			}
			return (frame: number, cols: number, r: number) =>
				generateAsciiMandelbrotFrame(frame, cols, r, mandelbrotOpts)
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
		matrixSpeed, matrixDensity, matrixTrailLength, matrixHeadColor, matrixTrailColor,
		matrixBgColor, matrixChars, matrixSeed,
		starfieldStars, starfieldSpeed, starfieldFgColor, starfieldBgColor, starfieldChars, starfieldSeed, starfieldStreaks,
		tunnelSpeed, tunnelRotationSpeed, tunnelTiles, tunnelFgColor, tunnelBgColor, tunnelChars, tunnelAspectY,
		lifeDensity, lifeFgColor, lifeBgColor, lifeSeed, lifeAutoSeed, lifeAutoSeedThreshold,
		rippleDamping, rippleDropFrequency, rippleDropStrength, rippleFgColor, rippleBgColor, rippleChars, rippleSeed,
		mandelbrotMaxIter, mandelbrotZoomSpeed, mandelbrotZoomX, mandelbrotZoomY, mandelbrotInitialZoom,
		mandelbrotFgColor, mandelbrotBgColor, mandelbrotChars, mandelbrotAspectY, mandelbrotColorMode, mandelbrotShapeMode,
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
		matrix: {
			options: { speed: matrixSpeed, density: matrixDensity, trailLength: matrixTrailLength, headColor: matrixHeadColor, trailColor: matrixTrailColor, bgColor: matrixBgColor, chars: matrixChars, seed: matrixSeed },
			defaults: MATRIX_DEFAULTS,
		},
		starfield: {
			options: { stars: starfieldStars, speed: starfieldSpeed, fgColor: starfieldFgColor, bgColor: starfieldBgColor, chars: starfieldChars, seed: starfieldSeed, streaks: starfieldStreaks },
			defaults: STARFIELD_DEFAULTS,
		},
		tunnel: {
			options: { speed: tunnelSpeed, rotationSpeed: tunnelRotationSpeed, tiles: tunnelTiles, fgColor: tunnelFgColor, bgColor: tunnelBgColor, chars: tunnelChars, aspectY: tunnelAspectY },
			defaults: TUNNEL_DEFAULTS,
		},
		gameOfLife: {
			options: { density: lifeDensity, fgColor: lifeFgColor, bgColor: lifeBgColor, seed: lifeSeed, autoSeed: lifeAutoSeed, autoSeedThreshold: lifeAutoSeedThreshold },
			defaults: GAME_OF_LIFE_DEFAULTS,
		},
		waterRipple: {
			options: { damping: rippleDamping, dropFrequency: rippleDropFrequency, dropStrength: rippleDropStrength, fgColor: rippleFgColor, bgColor: rippleBgColor, chars: rippleChars, seed: rippleSeed },
			defaults: WATER_RIPPLE_DEFAULTS,
		},
		mandelbrot: {
			options: { maxIter: mandelbrotMaxIter, zoomSpeed: mandelbrotZoomSpeed, zoomX: mandelbrotZoomX, zoomY: mandelbrotZoomY, initialZoom: mandelbrotInitialZoom, fgColor: mandelbrotFgColor, bgColor: mandelbrotBgColor, chars: mandelbrotChars, aspectY: mandelbrotAspectY, colorMode: mandelbrotColorMode },
			defaults: MANDELBROT_DEFAULTS,
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
					<ControlGroup label="Generator">
						<SelectInput
							label="Type"
							value={generatorType}
							onChange={(v) => setGeneratorType(v as GeneratorType)}
							options={TABS.map((tab) => ({ value: tab.key, label: tab.label }))}
						/>
					</ControlGroup>

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

					{generatorType === 'matrix' && (
						<MatrixPanel
							speed={matrixSpeed} setSpeed={setMatrixSpeed}
							density={matrixDensity} setDensity={setMatrixDensity}
							trailLength={matrixTrailLength} setTrailLength={setMatrixTrailLength}
							headColor={matrixHeadColor} setHeadColor={setMatrixHeadColor}
							trailColor={matrixTrailColor} setTrailColor={setMatrixTrailColor}
							bgColor={matrixBgColor} setBgColor={setMatrixBgColor}
							chars={matrixChars} setChars={setMatrixChars}
							seed={matrixSeed} setSeed={setMatrixSeed}
						/>
					)}

					{generatorType === 'starfield' && (
						<StarfieldPanel
							stars={starfieldStars} setStars={setStarfieldStars}
							speed={starfieldSpeed} setSpeed={setStarfieldSpeed}
							fgColor={starfieldFgColor} setFgColor={setStarfieldFgColor}
							bgColor={starfieldBgColor} setBgColor={setStarfieldBgColor}
							chars={starfieldChars} setChars={setStarfieldChars}
							seed={starfieldSeed} setSeed={setStarfieldSeed}
							streaks={starfieldStreaks} setStreaks={setStarfieldStreaks}
						/>
					)}

					{generatorType === 'tunnel' && (
						<TunnelPanel
							speed={tunnelSpeed} setSpeed={setTunnelSpeed}
							rotationSpeed={tunnelRotationSpeed} setRotationSpeed={setTunnelRotationSpeed}
							tiles={tunnelTiles} setTiles={setTunnelTiles}
							fgColor={tunnelFgColor} setFgColor={setTunnelFgColor}
							bgColor={tunnelBgColor} setBgColor={setTunnelBgColor}
							chars={tunnelChars} setChars={setTunnelChars}
							aspectY={tunnelAspectY} setAspectY={setTunnelAspectY}
						/>
					)}

					{generatorType === 'gameOfLife' && (
						<GameOfLifePanel
							density={lifeDensity} setDensity={setLifeDensity}
							fgColor={lifeFgColor} setFgColor={setLifeFgColor}
							bgColor={lifeBgColor} setBgColor={setLifeBgColor}
							seed={lifeSeed} setSeed={setLifeSeed}
							autoSeed={lifeAutoSeed} setAutoSeed={setLifeAutoSeed}
							autoSeedThreshold={lifeAutoSeedThreshold} setAutoSeedThreshold={setLifeAutoSeedThreshold}
						/>
					)}

					{generatorType === 'waterRipple' && (
						<WaterRipplePanel
							damping={rippleDamping} setDamping={setRippleDamping}
							dropFrequency={rippleDropFrequency} setDropFrequency={setRippleDropFrequency}
							dropStrength={rippleDropStrength} setDropStrength={setRippleDropStrength}
							fgColor={rippleFgColor} setFgColor={setRippleFgColor}
							bgColor={rippleBgColor} setBgColor={setRippleBgColor}
							chars={rippleChars} setChars={setRippleChars}
							seed={rippleSeed} setSeed={setRippleSeed}
						/>
					)}

					{generatorType === 'mandelbrot' && (
						<MandelbrotPanel
							maxIter={mandelbrotMaxIter} setMaxIter={setMandelbrotMaxIter}
							zoomSpeed={mandelbrotZoomSpeed} setZoomSpeed={setMandelbrotZoomSpeed}
							zoomX={mandelbrotZoomX} setZoomX={setMandelbrotZoomX}
							zoomY={mandelbrotZoomY} setZoomY={setMandelbrotZoomY}
							initialZoom={mandelbrotInitialZoom} setInitialZoom={setMandelbrotInitialZoom}
							fgColor={mandelbrotFgColor} setFgColor={setMandelbrotFgColor}
							bgColor={mandelbrotBgColor} setBgColor={setMandelbrotBgColor}
							chars={mandelbrotChars} setChars={setMandelbrotChars}
							aspectY={mandelbrotAspectY} setAspectY={setMandelbrotAspectY}
							colorMode={mandelbrotColorMode} setColorMode={setMandelbrotColorMode}
							shapeMode={mandelbrotShapeMode} setShapeMode={setMandelbrotShapeMode}
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
