'use client'

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import {
	AnsiVirtualDisplay,
	clearDatamoshState,
	clearFireState,
	clearGameOfLifeState,
	clearMatrixRainState,
	clearReactionDiffusionState,
	clearStarfieldState,
	clearWaterRippleState,
	clearCyclicAutomatonState,
	clearFallingSandState,
	clearBoidsState,
	clearShadebobsState,
	clearPhysarumState,
	clearSandpileState,
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
	generateAsciiCopperBarsFrame,
	generateAsciiCrtStaticFrame,
	generateAsciiAuroraBorealisFrame,
	generateAsciiReactionDiffusionFrame,
	generateAsciiTerrainFlyoverFrame,
	generateAsciiRotozoomerFrame,
	generateAsciiMoireFrame,
	generateAsciiKefrensBarsFrame,
	generateAsciiTwisterFrame,
	generateAsciiSineScrollerFrame,
	generateAsciiBoingBallFrame,
	generateAsciiCyclicAutomatonFrame,
	generateAsciiFallingSandFrame,
	generateAsciiBumpMappingFrame,
	generateAsciiJuliaFrame,
	generateAsciiBoidsFrame,
	generateAsciiDonutFrame,
	generateAsciiWireframeFrame,
	generateAsciiShadebobsFrame,
	generateAsciiMunchingSquaresFrame,
	generateAsciiFireworksFrame,
	generateAsciiAquariumFrame,
	generateAsciiPhysarumFrame,
	generateAsciiSandpileFrame,
	generateMandelbrotPixels,
	createAsciiBoidsGenerator,
	createAsciiCyclicAutomatonGenerator,
	createAsciiDatamoshGenerator,
	createAsciiFallingSandGenerator,
	createAsciiFireGenerator,
	createAsciiGameOfLifeGenerator,
	createAsciiMatrixRainGenerator,
	createAsciiReactionDiffusionGenerator,
	createAsciiStarfieldGenerator,
	createAsciiWaterRippleGenerator,
	createAsciiShadebobsGenerator,
	createAsciiPhysarumGenerator,
	createAsciiSandpileGenerator,
	createAnsiGeneratorCycle,
	createShapeConverter,
	getEmbeddedVgaFont,
	composeAnsiEffects,
	createLensEffect,
	createScanlineEffect,
	createVhsTrackingEffect,
	createPhosphorPersistenceEffect,
	createChromaticAberrationEffect,
	createKaleidoscopeEffect,
	type TransitionKind,
	type FrameData,
	type DisplayFrameGenerator,
	type CharacterFrameGenerator,
	type AnsiPostEffect,
} from 'react-ansiart'
import { CodePreview } from '../_components/CodePreview'
import { ControlGroup } from '../_components/ControlGroup'
import { NumberInput, SelectInput, ToggleInput } from '../_components/ControlRow'
import { GeneratorThumb } from '../_components/GeneratorThumb'
import { Stage } from '../_components/Stage'
import { generateGeneratorCode } from '../_lib/generateCode'
import {
	AURORA_BOREALIS_DEFAULTS,
	COPPER_BARS_DEFAULTS,
	CRT_STATIC_DEFAULTS,
	DATAMOSH_DEFAULTS,
	FIRE_DEFAULTS,
	GAME_OF_LIFE_DEFAULTS,
	MANDELBROT_DEFAULTS,
	MATRIX_DEFAULTS,
	METABALLS_DEFAULTS,
	PLASMA_DEFAULTS,
	REACTION_DIFFUSION_DEFAULTS,
	SONAR_DEFAULTS,
	STARFIELD_DEFAULTS,
	TERRAIN_FLYOVER_DEFAULTS,
	TUNNEL_DEFAULTS,
	VIRTUAL_DISPLAY_DEFAULTS,
	WATER_RIPPLE_DEFAULTS,
	ROTOZOOMER_DEFAULTS,
	MOIRE_DEFAULTS,
	KEFRENS_BARS_DEFAULTS,
	TWISTER_DEFAULTS,
	SINE_SCROLLER_DEFAULTS,
	BOING_BALL_DEFAULTS,
	CYCLIC_AUTOMATON_DEFAULTS,
	FALLING_SAND_DEFAULTS,
	BUMP_MAPPING_DEFAULTS,
	JULIA_DEFAULTS,
	BOIDS_DEFAULTS,
	DONUT_DEFAULTS,
	WIREFRAME_DEFAULTS,
	SHADEBOBS_DEFAULTS,
	MUNCHING_SQUARES_DEFAULTS,
	FIREWORKS_DEFAULTS,
	AQUARIUM_DEFAULTS,
	PHYSARUM_DEFAULTS,
	SANDPILE_DEFAULTS,
	SCREENSAVER_DEFAULTS,
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
import { CopperBarsPanel } from './_panels/CopperBarsPanel'
import { CrtStaticPanel } from './_panels/CrtStaticPanel'
import { AuroraBorealisPanel } from './_panels/AuroraBorealisPanel'
import { ReactionDiffusionPanel } from './_panels/ReactionDiffusionPanel'
import { TerrainFlyoverPanel } from './_panels/TerrainFlyoverPanel'
import { RotozoomerPanel } from './_panels/RotozoomerPanel'
import { MoirePanel } from './_panels/MoirePanel'
import { KefrensBarsPanel } from './_panels/KefrensBarsPanel'
import { TwisterPanel } from './_panels/TwisterPanel'
import { SineScrollerPanel } from './_panels/SineScrollerPanel'
import { BoingBallPanel } from './_panels/BoingBallPanel'
import { CyclicAutomatonPanel } from './_panels/CyclicAutomatonPanel'
import { FallingSandPanel } from './_panels/FallingSandPanel'
import { BumpMappingPanel } from './_panels/BumpMappingPanel'
import { JuliaPanel } from './_panels/JuliaPanel'
import { BoidsPanel } from './_panels/BoidsPanel'
import { DonutPanel } from './_panels/DonutPanel'
import { WireframePanel } from './_panels/WireframePanel'
import { ShadebobsPanel } from './_panels/ShadebobsPanel'
import { MunchingSquaresPanel } from './_panels/MunchingSquaresPanel'
import { FireworksPanel } from './_panels/FireworksPanel'
import { AquariumPanel } from './_panels/AquariumPanel'
import { PhysarumPanel } from './_panels/PhysarumPanel'
import { SandpilePanel } from './_panels/SandpilePanel'
import { ScreensaverPanel } from './_panels/ScreensaverPanel'

type GeneratorType = 'perlinPlasma' | 'fire' | 'sonar' | 'datamosh' | 'metaballs' | 'matrix' | 'starfield' | 'tunnel' | 'gameOfLife' | 'waterRipple' | 'mandelbrot' | 'copperBars' | 'crtStatic' | 'auroraBorealis' | 'reactionDiffusion' | 'terrainFlyover' | 'rotozoomer' | 'moire' | 'kefrensBars' | 'twister' | 'sineScroller' | 'boingBall' | 'cyclicAutomaton' | 'fallingSand' | 'bumpMapping' | 'julia' | 'boids' | 'donut' | 'wireframe' | 'shadebobs' | 'munchingSquares' | 'fireworks' | 'aquarium' | 'physarum' | 'sandpile' | 'screensaver'

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
	{ key: 'copperBars', label: 'Copper Bars' },
	{ key: 'crtStatic', label: 'CRT Static' },
	{ key: 'auroraBorealis', label: 'Aurora' },
	{ key: 'reactionDiffusion', label: 'Reaction-Diff' },
	{ key: 'terrainFlyover', label: 'Terrain' },
	{ key: 'rotozoomer', label: 'Rotozoomer' },
	{ key: 'moire', label: 'Moire' },
	{ key: 'kefrensBars', label: 'Kefrens Bars' },
	{ key: 'twister', label: 'Twister' },
	{ key: 'sineScroller', label: 'Sine Scroller' },
	{ key: 'boingBall', label: 'Boing Ball' },
	{ key: 'cyclicAutomaton', label: 'Cyclic Automaton' },
	{ key: 'fallingSand', label: 'Falling Sand' },
	{ key: 'bumpMapping', label: 'Bump Mapping' },
	{ key: 'julia', label: 'Julia' },
	{ key: 'boids', label: 'Boids' },
	{ key: 'donut', label: 'Donut' },
	{ key: 'wireframe', label: 'Wireframe' },
	{ key: 'shadebobs', label: 'Shadebobs' },
	{ key: 'munchingSquares', label: 'Munching Squares' },
	{ key: 'fireworks', label: 'Fireworks' },
	{ key: 'aquarium', label: 'Aquarium' },
	{ key: 'physarum', label: 'Physarum' },
	{ key: 'sandpile', label: 'Sandpile' },
	{ key: 'screensaver', label: 'Screensaver' },
]

/** Sine Scroller leads: its editable text field is the most inviting first control. */
const DEFAULT_GENERATOR: GeneratorType = 'sineScroller'

function parseGeneratorType(value: string | null): GeneratorType | null {
	if (!value) return null
	return TABS.some((tab) => tab.key === value) ? (value as GeneratorType) : null
}

const COLUMNS_RANGE = { min: 10, max: 400 } as const
const ROWS_RANGE = { min: 10, max: 400 } as const
const FPS_RANGE = { min: 1, max: 120 } as const

/** Floors and clamps a raw numeric value into [min, max]; returns null if not finite. */
function clampInt(value: number, min: number, max: number): number | null {
	if (!Number.isFinite(value)) return null
	return Math.min(max, Math.max(min, Math.floor(value)))
}

/* ─── Thumbnail previews ─────────────────────────────────────────────────────
   Built ONCE at module scope with each generator's library defaults, so every
   tile keeps a stable function identity for the lifetime of the page (a new
   identity restarts the tile's render engine). Tiles are previews of what a
   generator *is*, deliberately not mirrors of the panel options.

   Stateful sims get a private instance from the library's create* factory:
   the bare generateAscii*Frame helpers share one process-wide store, so 27
   tiles plus the main display would otherwise fight over the same simulation.
   Stateless generators get a per-tile frame offset so the grid isn't a wall of
   synchronised clones. */

const STATELESS_THUMB_GENERATORS: Partial<Record<GeneratorType, CharacterFrameGenerator>> = {
	perlinPlasma: (f, c, r) => generateAsciiPerlinPlasmaFrame(f, c, r),
	sonar: (f, c, r) => generateAsciiSonarFrame(f, c, r),
	metaballs: (f, c, r) => generateAsciiMetaballsFrame(f, c, r),
	tunnel: (f, c, r) => generateAsciiTunnelFrame(f, c, r),
	mandelbrot: (f, c, r) => generateAsciiMandelbrotFrame(f, c, r),
	copperBars: (f, c, r) => generateAsciiCopperBarsFrame(f, c, r),
	crtStatic: (f, c, r) => generateAsciiCrtStaticFrame(f, c, r),
	auroraBorealis: (f, c, r) => generateAsciiAuroraBorealisFrame(f, c, r),
	terrainFlyover: (f, c, r) => generateAsciiTerrainFlyoverFrame(f, c, r),
	rotozoomer: (f, c, r) => generateAsciiRotozoomerFrame(f, c, r),
	moire: (f, c, r) => generateAsciiMoireFrame(f, c, r),
	kefrensBars: (f, c, r) => generateAsciiKefrensBarsFrame(f, c, r),
	twister: (f, c, r) => generateAsciiTwisterFrame(f, c, r),
	sineScroller: (f, c, r) => generateAsciiSineScrollerFrame(f, c, r),
	boingBall: (f, c, r) => generateAsciiBoingBallFrame(f, c, r),
	bumpMapping: (f, c, r) => generateAsciiBumpMappingFrame(f, c, r),
	julia: (f, c, r) => generateAsciiJuliaFrame(f, c, r),
	donut: (f, c, r) => generateAsciiDonutFrame(f, c, r),
	wireframe: (f, c, r) => generateAsciiWireframeFrame(f, c, r),
	munchingSquares: (f, c, r) => generateAsciiMunchingSquaresFrame(f, c, r),
	fireworks: (f, c, r) => generateAsciiFireworksFrame(f, c, r),
	aquarium: (f, c, r) => generateAsciiAquariumFrame(f, c, r),
}

function createThumbGenerator(type: GeneratorType, index: number): CharacterFrameGenerator {
	switch (type) {
		case 'fire': return createAsciiFireGenerator()
		case 'datamosh': return createAsciiDatamoshGenerator()
		case 'matrix': return createAsciiMatrixRainGenerator()
		case 'starfield': return createAsciiStarfieldGenerator()
		case 'gameOfLife': return createAsciiGameOfLifeGenerator()
		case 'waterRipple': return createAsciiWaterRippleGenerator()
		case 'reactionDiffusion': return createAsciiReactionDiffusionGenerator()
		case 'cyclicAutomaton': return createAsciiCyclicAutomatonGenerator()
		case 'fallingSand': return createAsciiFallingSandGenerator()
		case 'boids': return createAsciiBoidsGenerator()
		case 'shadebobs': return createAsciiShadebobsGenerator()
		case 'physarum': return createAsciiPhysarumGenerator()
		case 'sandpile': return createAsciiSandpileGenerator()
		// Short hold/transition so the tile visibly cycles; cheap stateless members only,
		// since this instance lives for the lifetime of the page alongside 35 other tiles.
		case 'screensaver': return createAnsiGeneratorCycle([
			(f, c, r) => generateAsciiDonutFrame(f, c, r),
			(f, c, r) => generateAsciiTunnelFrame(f, c, r),
			(f, c, r) => generateAsciiMoireFrame(f, c, r),
			(f, c, r) => generateAsciiMunchingSquaresFrame(f, c, r),
		], { holdFrames: 90, transitionFrames: 24 })
		default: break
	}
	const base = STATELESS_THUMB_GENERATORS[type] ?? ((f, c, r) => generateAsciiPerlinPlasmaFrame(f, c, r))
	const offset = 120 * index + 60
	return (frame: number, cols: number, r: number) => base(frame + offset, cols, r)
}

const THUMB_TILES: { key: GeneratorType; label: string; generator: CharacterFrameGenerator }[] =
	TABS.map((tab, index) => ({ key: tab.key, label: tab.label, generator: createThumbGenerator(tab.key, index) }))

const THUMB_COLUMNS = 40
const THUMB_ROWS = 12
const THUMB_FPS = 8
const THUMB_WIDTH = 160

/* ─── URL state ──────────────────────────────────────────────────────────────
   Only values that differ from their default are serialized, so a pristine
   playground has a bare URL and a shared link is short. Unknown or unparseable
   params are ignored rather than surfaced as errors. */

type UrlParam = {
	key: string
	value: string | number | boolean
	def: string | number | boolean
	apply: (raw: string) => void
}

const strParam = (key: string, value: string, def: string, set: (v: string) => void): UrlParam =>
	({ key, value, def, apply: set })

const numParam = (key: string, value: number, def: number, set: (v: number) => void): UrlParam => ({
	key,
	value,
	def,
	apply: (raw: string) => {
		const n = Number(raw)
		if (raw.trim() !== '' && Number.isFinite(n)) set(n)
	},
})

const boolParam = (key: string, value: boolean, def: boolean, set: (v: boolean) => void): UrlParam =>
	({ key, value, def, apply: (raw: string) => set(raw === '1' || raw === 'true') })

const serializeParam = (value: string | number | boolean): string =>
	typeof value === 'boolean' ? (value ? '1' : '0') : String(value)

export default function GeneratorsPage() {
	// useSearchParams opts this subtree into client-side rendering; Next requires
	// the Suspense boundary so the rest of the route can still prerender.
	return (
		<Suspense fallback={null}>
			<GeneratorsPlayground />
		</Suspense>
	)
}

function GeneratorsPlayground() {
	const pathname = usePathname()
	const searchParams = useSearchParams()
	// Snapshot of the params present on first paint — later edits rewrite the URL,
	// and re-reading it would fight the user's own input.
	const [initialParams] = useState(() => new URLSearchParams(searchParams.toString()))

	const [generatorType, setGeneratorType] = useState<GeneratorType>(
		() => parseGeneratorType(initialParams.get('g')) ?? DEFAULT_GENERATOR
	)
	const [pickerExpanded, setPickerExpanded] = useState(false)
	const [urlReady, setUrlReady] = useState(false)
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

	// Copper Bars state
	const [copperBarCount, setCopperBarCount] = useState(COPPER_BARS_DEFAULTS.barCount)
	const [copperBarHeight, setCopperBarHeight] = useState(COPPER_BARS_DEFAULTS.barHeight)
	const [copperSpeed, setCopperSpeed] = useState(COPPER_BARS_DEFAULTS.speed)
	const [copperBgColor, setCopperBgColor] = useState(COPPER_BARS_DEFAULTS.bgColor)
	const [copperChars, setCopperChars] = useState(COPPER_BARS_DEFAULTS.chars)
	const [copperSeed, setCopperSeed] = useState(COPPER_BARS_DEFAULTS.seed)

	// CRT Static state
	const [crtSignalStrength, setCrtSignalStrength] = useState(CRT_STATIC_DEFAULTS.signalStrength)
	const [crtScanlineIntensity, setCrtScanlineIntensity] = useState(CRT_STATIC_DEFAULTS.scanlineIntensity)
	const [crtTearFrequency, setCrtTearFrequency] = useState(CRT_STATIC_DEFAULTS.tearFrequency)
	const [crtRollingBarSpeed, setCrtRollingBarSpeed] = useState(CRT_STATIC_DEFAULTS.rollingBarSpeed)
	const [crtVhsMode, setCrtVhsMode] = useState(CRT_STATIC_DEFAULTS.vhsMode)
	const [crtBgColor, setCrtBgColor] = useState(CRT_STATIC_DEFAULTS.bgColor)
	const [crtChars, setCrtChars] = useState(CRT_STATIC_DEFAULTS.chars)
	const [crtSeed, setCrtSeed] = useState(CRT_STATIC_DEFAULTS.seed)

	// Aurora Borealis state
	const [auroraCurtainCount, setAuroraCurtainCount] = useState(AURORA_BOREALIS_DEFAULTS.curtainCount)
	const [auroraSpeed, setAuroraSpeed] = useState(AURORA_BOREALIS_DEFAULTS.speed)
	const [auroraIntensity, setAuroraIntensity] = useState(AURORA_BOREALIS_DEFAULTS.intensity)
	const [auroraBgColor, setAuroraBgColor] = useState(AURORA_BOREALIS_DEFAULTS.bgColor)
	const [auroraChars, setAuroraChars] = useState(AURORA_BOREALIS_DEFAULTS.chars)
	const [auroraSeed, setAuroraSeed] = useState(AURORA_BOREALIS_DEFAULTS.seed)

	// Reaction-Diffusion state
	const [rdFeedRate, setRdFeedRate] = useState(REACTION_DIFFUSION_DEFAULTS.feedRate)
	const [rdKillRate, setRdKillRate] = useState(REACTION_DIFFUSION_DEFAULTS.killRate)
	const [rdDiffusionU, setRdDiffusionU] = useState(REACTION_DIFFUSION_DEFAULTS.diffusionU)
	const [rdDiffusionV, setRdDiffusionV] = useState(REACTION_DIFFUSION_DEFAULTS.diffusionV)
	const [rdStepsPerFrame, setRdStepsPerFrame] = useState(REACTION_DIFFUSION_DEFAULTS.stepsPerFrame)
	const [rdColorMode, setRdColorMode] = useState<string>(REACTION_DIFFUSION_DEFAULTS.colorMode)
	const [rdFgColor, setRdFgColor] = useState(REACTION_DIFFUSION_DEFAULTS.fgColor)
	const [rdBgColor, setRdBgColor] = useState(REACTION_DIFFUSION_DEFAULTS.bgColor)
	const [rdChars, setRdChars] = useState(REACTION_DIFFUSION_DEFAULTS.chars)
	const [rdSeed, setRdSeed] = useState(REACTION_DIFFUSION_DEFAULTS.seed)

	// Terrain Flyover state
	const [terrainScrollSpeed, setTerrainScrollSpeed] = useState(TERRAIN_FLYOVER_DEFAULTS.scrollSpeed)
	const [terrainHeightScale, setTerrainHeightScale] = useState(TERRAIN_FLYOVER_DEFAULTS.heightScale)
	const [terrainFogDistance, setTerrainFogDistance] = useState(TERRAIN_FLYOVER_DEFAULTS.fogDistance)
	const [terrainColorMode, setTerrainColorMode] = useState<string>(TERRAIN_FLYOVER_DEFAULTS.colorMode)
	const [terrainFgColor, setTerrainFgColor] = useState(TERRAIN_FLYOVER_DEFAULTS.fgColor)
	const [terrainBgColor, setTerrainBgColor] = useState(TERRAIN_FLYOVER_DEFAULTS.bgColor)
	const [terrainSkyColor, setTerrainSkyColor] = useState(TERRAIN_FLYOVER_DEFAULTS.skyColor)
	const [terrainChars, setTerrainChars] = useState(TERRAIN_FLYOVER_DEFAULTS.chars)
	const [terrainSeed, setTerrainSeed] = useState(TERRAIN_FLYOVER_DEFAULTS.seed)

	// Rotozoomer state
	const [rotoRotationSpeed, setRotoRotationSpeed] = useState(ROTOZOOMER_DEFAULTS.rotationSpeed)
	const [rotoZoomSpeed, setRotoZoomSpeed] = useState(ROTOZOOMER_DEFAULTS.zoomSpeed)
	const [rotoBaseZoom, setRotoBaseZoom] = useState(ROTOZOOMER_DEFAULTS.baseZoom)
	const [rotoPattern, setRotoPattern] = useState<string>(ROTOZOOMER_DEFAULTS.pattern)
	const [rotoBgColor, setRotoBgColor] = useState(ROTOZOOMER_DEFAULTS.bgColor)

	// Moire state
	const [moireRingWidth, setMoireRingWidth] = useState(MOIRE_DEFAULTS.ringWidth)
	const [moireSpeed1, setMoireSpeed1] = useState(MOIRE_DEFAULTS.speed1)
	const [moireSpeed2, setMoireSpeed2] = useState(MOIRE_DEFAULTS.speed2)
	const [moirePaletteSpeed, setMoirePaletteSpeed] = useState(MOIRE_DEFAULTS.paletteSpeed)
	const [moireBgColor, setMoireBgColor] = useState(MOIRE_DEFAULTS.bgColor)

	// Kefrens Bars state
	const [kefrensBarWidth, setKefrensBarWidth] = useState(KEFRENS_BARS_DEFAULTS.barWidth)
	const [kefrensHueSpeed, setKefrensHueSpeed] = useState(KEFRENS_BARS_DEFAULTS.hueSpeed)
	const [kefrensHueRowStep, setKefrensHueRowStep] = useState(KEFRENS_BARS_DEFAULTS.hueRowStep)
	const [kefrensBgColor, setKefrensBgColor] = useState(KEFRENS_BARS_DEFAULTS.bgColor)
	const [kefrensChars, setKefrensChars] = useState(KEFRENS_BARS_DEFAULTS.chars)

	// Twister state
	const [twisterRotationSpeed, setTwisterRotationSpeed] = useState(TWISTER_DEFAULTS.rotationSpeed)
	const [twisterWaveFreq, setTwisterWaveFreq] = useState(TWISTER_DEFAULTS.waveFreq)
	const [twisterWaveSpeed, setTwisterWaveSpeed] = useState(TWISTER_DEFAULTS.waveSpeed)
	const [twisterWaveDepth, setTwisterWaveDepth] = useState(TWISTER_DEFAULTS.waveDepth)
	const [twisterBgColor, setTwisterBgColor] = useState(TWISTER_DEFAULTS.bgColor)

	// Sine Scroller state
	const [scrollerText, setScrollerText] = useState(SINE_SCROLLER_DEFAULTS.text)
	const [scrollerSpeed, setScrollerSpeed] = useState(SINE_SCROLLER_DEFAULTS.speed)
	const [scrollerAmplitude, setScrollerAmplitude] = useState(SINE_SCROLLER_DEFAULTS.amplitude)
	const [scrollerWaveSpeed, setScrollerWaveSpeed] = useState(SINE_SCROLLER_DEFAULTS.waveSpeed)
	const [scrollerFgColor, setScrollerFgColor] = useState(SINE_SCROLLER_DEFAULTS.fgColor)
	const [scrollerBgColor, setScrollerBgColor] = useState(SINE_SCROLLER_DEFAULTS.bgColor)

	// Boing Ball state
	const [boingScale, setBoingScale] = useState(BOING_BALL_DEFAULTS.scale)
	const [boingBounceSpeed, setBoingBounceSpeed] = useState(BOING_BALL_DEFAULTS.bounceSpeed)
	const [boingDriftSpeed, setBoingDriftSpeed] = useState(BOING_BALL_DEFAULTS.driftSpeed)
	const [boingCheckerDensity, setBoingCheckerDensity] = useState(BOING_BALL_DEFAULTS.checkerDensity)
	const [boingBallRedColor, setBoingBallRedColor] = useState(BOING_BALL_DEFAULTS.ballRedColor)
	const [boingBgColor, setBoingBgColor] = useState(BOING_BALL_DEFAULTS.bgColor)

	// Cyclic Automaton state
	const [cyclicStates, setCyclicStates] = useState(CYCLIC_AUTOMATON_DEFAULTS.states)
	const [cyclicThreshold, setCyclicThreshold] = useState(CYCLIC_AUTOMATON_DEFAULTS.threshold)
	const [cyclicNeighborhood, setCyclicNeighborhood] = useState<string>(CYCLIC_AUTOMATON_DEFAULTS.neighborhood)
	const [cyclicSaturation, setCyclicSaturation] = useState(CYCLIC_AUTOMATON_DEFAULTS.saturation)
	const [cyclicLightness, setCyclicLightness] = useState(CYCLIC_AUTOMATON_DEFAULTS.lightness)
	const [cyclicSeed, setCyclicSeed] = useState(CYCLIC_AUTOMATON_DEFAULTS.seed)

	// Falling Sand state
	const [sandSpoutCount, setSandSpoutCount] = useState(FALLING_SAND_DEFAULTS.spoutCount)
	const [sandSpoutRate, setSandSpoutRate] = useState(FALLING_SAND_DEFAULTS.spoutRate)
	const [sandDrainOpenThreshold, setSandDrainOpenThreshold] = useState(FALLING_SAND_DEFAULTS.drainOpenThreshold)
	const [sandWallColor, setSandWallColor] = useState(FALLING_SAND_DEFAULTS.wallColor)
	const [sandBgColor, setSandBgColor] = useState(FALLING_SAND_DEFAULTS.bgColor)
	const [sandSeed, setSandSeed] = useState(FALLING_SAND_DEFAULTS.seed)

	// Bump Mapping state
	const [bumpNoiseScale, setBumpNoiseScale] = useState(BUMP_MAPPING_DEFAULTS.noiseScale)
	const [bumpOrbitSpeed, setBumpOrbitSpeed] = useState(BUMP_MAPPING_DEFAULTS.orbitSpeed)
	const [bumpLightHeight, setBumpLightHeight] = useState(BUMP_MAPPING_DEFAULTS.lightHeight)
	const [bumpBumpStrength, setBumpBumpStrength] = useState(BUMP_MAPPING_DEFAULTS.bumpStrength)
	const [bumpSpecularPower, setBumpSpecularPower] = useState(BUMP_MAPPING_DEFAULTS.specularPower)
	const [bumpBgColor, setBumpBgColor] = useState(BUMP_MAPPING_DEFAULTS.bgColor)

	// Julia state
	const [juliaMaxIter, setJuliaMaxIter] = useState(JULIA_DEFAULTS.maxIter)
	const [juliaMorphSpeed, setJuliaMorphSpeed] = useState(JULIA_DEFAULTS.morphSpeed)
	const [juliaRadius, setJuliaRadius] = useState(JULIA_DEFAULTS.radius)
	const [juliaColorMode, setJuliaColorMode] = useState<string>(JULIA_DEFAULTS.colorMode)
	const [juliaFgColor, setJuliaFgColor] = useState(JULIA_DEFAULTS.fgColor)
	const [juliaBgColor, setJuliaBgColor] = useState(JULIA_DEFAULTS.bgColor)

	// Boids state
	const [boidsCount, setBoidsCount] = useState(BOIDS_DEFAULTS.count)
	const [boidsSepWeight, setBoidsSepWeight] = useState(BOIDS_DEFAULTS.sepWeight)
	const [boidsAlignWeight, setBoidsAlignWeight] = useState(BOIDS_DEFAULTS.alignWeight)
	const [boidsCohWeight, setBoidsCohWeight] = useState(BOIDS_DEFAULTS.cohWeight)
	const [boidsHeadColor, setBoidsHeadColor] = useState(BOIDS_DEFAULTS.headColor)
	const [boidsBgColor, setBoidsBgColor] = useState(BOIDS_DEFAULTS.bgColor)

	// Donut state
	const [donutSpeedA, setDonutSpeedA] = useState(DONUT_DEFAULTS.speedA)
	const [donutSpeedB, setDonutSpeedB] = useState(DONUT_DEFAULTS.speedB)
	const [donutSize, setDonutSize] = useState(DONUT_DEFAULTS.size)
	const [donutTubeRatio, setDonutTubeRatio] = useState(DONUT_DEFAULTS.tubeRatio)
	const [donutBaseColor, setDonutBaseColor] = useState(DONUT_DEFAULTS.baseColor)
	const [donutBgColor, setDonutBgColor] = useState(DONUT_DEFAULTS.bgColor)

	// Wireframe state
	const [wireframeShape, setWireframeShape] = useState<string>(WIREFRAME_DEFAULTS.shape)
	const [wireframeSize, setWireframeSize] = useState(WIREFRAME_DEFAULTS.size)
	const [wireframeSpeedX, setWireframeSpeedX] = useState(WIREFRAME_DEFAULTS.speedX)
	const [wireframeSpeedY, setWireframeSpeedY] = useState(WIREFRAME_DEFAULTS.speedY)
	const [wireframeSpeedZ, setWireframeSpeedZ] = useState(WIREFRAME_DEFAULTS.speedZ)
	const [wireframeEdgeColor, setWireframeEdgeColor] = useState(WIREFRAME_DEFAULTS.edgeColor)
	const [wireframeVertexColor, setWireframeVertexColor] = useState(WIREFRAME_DEFAULTS.vertexColor)
	const [wireframeDepthShading, setWireframeDepthShading] = useState(WIREFRAME_DEFAULTS.depthShading)
	const [wireframeBgColor, setWireframeBgColor] = useState(WIREFRAME_DEFAULTS.bgColor)

	// Shadebobs state
	const [shadebobsBobCount, setShadebobsBobCount] = useState(SHADEBOBS_DEFAULTS.bobCount)
	const [shadebobsBobSize, setShadebobsBobSize] = useState(SHADEBOBS_DEFAULTS.bobSize)
	const [shadebobsTrailDecay, setShadebobsTrailDecay] = useState(SHADEBOBS_DEFAULTS.trailDecay)
	const [shadebobsSpeed, setShadebobsSpeed] = useState(SHADEBOBS_DEFAULTS.speed)
	const [shadebobsSeed, setShadebobsSeed] = useState(SHADEBOBS_DEFAULTS.seed)
	const [shadebobsBgColor, setShadebobsBgColor] = useState(SHADEBOBS_DEFAULTS.bgColor)

	// Munching Squares state
	const [munchSpeed, setMunchSpeed] = useState(MUNCHING_SQUARES_DEFAULTS.speed)
	const [munchSize, setMunchSize] = useState(MUNCHING_SQUARES_DEFAULTS.size)
	const [munchInvert, setMunchInvert] = useState(MUNCHING_SQUARES_DEFAULTS.invert)
	const [munchBgColor, setMunchBgColor] = useState(MUNCHING_SQUARES_DEFAULTS.bgColor)

	// Fireworks state
	const [fireworksLaunchInterval, setFireworksLaunchInterval] = useState(FIREWORKS_DEFAULTS.launchInterval)
	const [fireworksRiseFrames, setFireworksRiseFrames] = useState(FIREWORKS_DEFAULTS.riseFrames)
	const [fireworksBurstDuration, setFireworksBurstDuration] = useState(FIREWORKS_DEFAULTS.burstDuration)
	const [fireworksParticleCount, setFireworksParticleCount] = useState(FIREWORKS_DEFAULTS.particleCount)
	const [fireworksGravity, setFireworksGravity] = useState(FIREWORKS_DEFAULTS.gravity)
	const [fireworksNightSky, setFireworksNightSky] = useState(FIREWORKS_DEFAULTS.nightSky)
	const [fireworksSeed, setFireworksSeed] = useState(FIREWORKS_DEFAULTS.seed)
	const [fireworksBgColor, setFireworksBgColor] = useState(FIREWORKS_DEFAULTS.bgColor)

	// Aquarium state
	const [aquariumFishCount, setAquariumFishCount] = useState(AQUARIUM_DEFAULTS.fishCount)
	const [aquariumBubbleDensity, setAquariumBubbleDensity] = useState(AQUARIUM_DEFAULTS.bubbleDensity)
	const [aquariumSeaweedDensity, setAquariumSeaweedDensity] = useState(AQUARIUM_DEFAULTS.seaweedDensity)
	const [aquariumSwaySpeed, setAquariumSwaySpeed] = useState(AQUARIUM_DEFAULTS.swaySpeed)
	const [aquariumSpeed, setAquariumSpeed] = useState(AQUARIUM_DEFAULTS.speed)
	const [aquariumSeed, setAquariumSeed] = useState(AQUARIUM_DEFAULTS.seed)
	const [aquariumBgColor, setAquariumBgColor] = useState(AQUARIUM_DEFAULTS.bgColor)

	// Physarum state
	const [physarumAgentDensity, setPhysarumAgentDensity] = useState(PHYSARUM_DEFAULTS.agentDensity)
	const [physarumSensorAngle, setPhysarumSensorAngle] = useState(PHYSARUM_DEFAULTS.sensorAngle)
	const [physarumSensorDistance, setPhysarumSensorDistance] = useState(PHYSARUM_DEFAULTS.sensorDistance)
	const [physarumTurnSpeed, setPhysarumTurnSpeed] = useState(PHYSARUM_DEFAULTS.turnSpeed)
	const [physarumEvaporation, setPhysarumEvaporation] = useState(PHYSARUM_DEFAULTS.evaporation)
	const [physarumStepsPerFrame, setPhysarumStepsPerFrame] = useState(PHYSARUM_DEFAULTS.stepsPerFrame)
	const [physarumSeed, setPhysarumSeed] = useState(PHYSARUM_DEFAULTS.seed)
	const [physarumBgColor, setPhysarumBgColor] = useState(PHYSARUM_DEFAULTS.bgColor)

	// Sandpile state
	const [sandpileGrainsPerStep, setSandpileGrainsPerStep] = useState(SANDPILE_DEFAULTS.grainsPerStep)
	const [sandpileStepsPerFrame, setSandpileStepsPerFrame] = useState(SANDPILE_DEFAULTS.stepsPerFrame)
	const [sandpileMaxToppleSweeps, setSandpileMaxToppleSweeps] = useState(SANDPILE_DEFAULTS.maxToppleSweeps)
	const [sandpileDropX, setSandpileDropX] = useState(SANDPILE_DEFAULTS.dropX)
	const [sandpileDropY, setSandpileDropY] = useState(SANDPILE_DEFAULTS.dropY)
	const [sandpileBgColor, setSandpileBgColor] = useState(SANDPILE_DEFAULTS.bgColor)

	// Screensaver state
	const [saverHoldFrames, setSaverHoldFrames] = useState(SCREENSAVER_DEFAULTS.holdFrames)
	const [saverTransitionFrames, setSaverTransitionFrames] = useState(SCREENSAVER_DEFAULTS.transitionFrames)
	const [saverKind, setSaverKind] = useState<string>(SCREENSAVER_DEFAULTS.kind)

	// Post FX state
	const [fxLens, setFxLens] = useState(false)
	const [fxScanline, setFxScanline] = useState(false)
	const [fxVhs, setFxVhs] = useState(false)
	const [fxPhosphor, setFxPhosphor] = useState(false)
	const [fxChromatic, setFxChromatic] = useState(false)
	const [fxKaleido, setFxKaleido] = useState(false)

	useEffect(() => {
		clearFireState()
		clearDatamoshState()
		clearMatrixRainState()
		clearStarfieldState()
		clearGameOfLifeState()
		clearWaterRippleState()
		clearReactionDiffusionState()
		clearCyclicAutomatonState()
		clearFallingSandState()
		clearBoidsState()
		clearShadebobsState()
		clearPhysarumState()
		clearSandpileState()
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
		if (generatorType === 'copperBars') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiCopperBarsFrame(frame, cols, r, {
					barCount: copperBarCount,
					barHeight: copperBarHeight,
					speed: copperSpeed,
					bgColor: copperBgColor,
					chars: copperChars.trim() ? Array.from(copperChars) : undefined,
					seed: copperSeed,
				})
		}
		if (generatorType === 'crtStatic') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiCrtStaticFrame(frame, cols, r, {
					signalStrength: crtSignalStrength,
					scanlineIntensity: crtScanlineIntensity,
					tearFrequency: crtTearFrequency,
					rollingBarSpeed: crtRollingBarSpeed,
					vhsMode: crtVhsMode,
					bgColor: crtBgColor,
					chars: crtChars.trim() ? Array.from(crtChars) : undefined,
					seed: crtSeed,
				})
		}
		if (generatorType === 'auroraBorealis') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiAuroraBorealisFrame(frame, cols, r, {
					curtainCount: auroraCurtainCount,
					speed: auroraSpeed,
					intensity: auroraIntensity,
					bgColor: auroraBgColor,
					chars: auroraChars.trim() ? Array.from(auroraChars) : undefined,
					seed: auroraSeed,
				})
		}
		if (generatorType === 'reactionDiffusion') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiReactionDiffusionFrame(frame, cols, r, {
					feedRate: rdFeedRate,
					killRate: rdKillRate,
					diffusionU: rdDiffusionU,
					diffusionV: rdDiffusionV,
					stepsPerFrame: rdStepsPerFrame,
					colorMode: rdColorMode as 'spectrum' | 'mono',
					fgColor: rdFgColor,
					bgColor: rdBgColor,
					chars: rdChars.trim() ? Array.from(rdChars) : undefined,
					seed: rdSeed,
				})
		}
		if (generatorType === 'terrainFlyover') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiTerrainFlyoverFrame(frame, cols, r, {
					scrollSpeed: terrainScrollSpeed,
					heightScale: terrainHeightScale,
					fogDistance: terrainFogDistance,
					colorMode: terrainColorMode as 'biome' | 'mono',
					fgColor: terrainFgColor,
					bgColor: terrainBgColor,
					skyColor: terrainSkyColor,
					chars: terrainChars.trim() ? Array.from(terrainChars) : undefined,
					seed: terrainSeed,
				})
		}
		if (generatorType === 'rotozoomer') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiRotozoomerFrame(frame, cols, r, {
					rotationSpeed: rotoRotationSpeed,
					zoomSpeed: rotoZoomSpeed,
					baseZoom: rotoBaseZoom,
					pattern: rotoPattern as 'checker' | 'xor',
					bgColor: rotoBgColor,
				})
		}
		if (generatorType === 'moire') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiMoireFrame(frame, cols, r, {
					ringWidth: moireRingWidth,
					speed1: moireSpeed1,
					speed2: moireSpeed2,
					paletteSpeed: moirePaletteSpeed,
					bgColor: moireBgColor,
				})
		}
		if (generatorType === 'kefrensBars') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiKefrensBarsFrame(frame, cols, r, {
					barWidth: kefrensBarWidth,
					hueSpeed: kefrensHueSpeed,
					hueRowStep: kefrensHueRowStep,
					bgColor: kefrensBgColor,
					chars: kefrensChars.trim() ? Array.from(kefrensChars) : undefined,
				})
		}
		if (generatorType === 'twister') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiTwisterFrame(frame, cols, r, {
					rotationSpeed: twisterRotationSpeed,
					waveFreq: twisterWaveFreq,
					waveSpeed: twisterWaveSpeed,
					waveDepth: twisterWaveDepth,
					bgColor: twisterBgColor,
				})
		}
		if (generatorType === 'sineScroller') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiSineScrollerFrame(frame, cols, r, {
					text: scrollerText,
					speed: scrollerSpeed,
					amplitude: scrollerAmplitude,
					waveSpeed: scrollerWaveSpeed,
					fgColor: scrollerFgColor.trim() || undefined,
					bgColor: scrollerBgColor,
				})
		}
		if (generatorType === 'boingBall') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiBoingBallFrame(frame, cols, r, {
					scale: boingScale,
					bounceSpeed: boingBounceSpeed,
					driftSpeed: boingDriftSpeed,
					checkerDensity: boingCheckerDensity,
					ballRedColor: boingBallRedColor,
					bgColor: boingBgColor,
				})
		}
		if (generatorType === 'cyclicAutomaton') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiCyclicAutomatonFrame(frame, cols, r, {
					states: cyclicStates,
					threshold: cyclicThreshold,
					neighborhood: cyclicNeighborhood as 'moore' | 'vonNeumann',
					saturation: cyclicSaturation,
					lightness: cyclicLightness,
					seed: cyclicSeed,
				})
		}
		if (generatorType === 'fallingSand') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiFallingSandFrame(frame, cols, r, {
					spoutCount: sandSpoutCount,
					spoutRate: sandSpoutRate,
					drainOpenThreshold: sandDrainOpenThreshold,
					wallColor: sandWallColor,
					bgColor: sandBgColor,
					seed: sandSeed,
				})
		}
		if (generatorType === 'bumpMapping') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiBumpMappingFrame(frame, cols, r, {
					noiseScale: bumpNoiseScale,
					orbitSpeed: bumpOrbitSpeed,
					lightHeight: bumpLightHeight,
					bumpStrength: bumpBumpStrength,
					specularPower: bumpSpecularPower,
					bgColor: bumpBgColor,
				})
		}
		if (generatorType === 'julia') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiJuliaFrame(frame, cols, r, {
					maxIter: juliaMaxIter,
					morphSpeed: juliaMorphSpeed,
					radius: juliaRadius,
					colorMode: juliaColorMode as 'spectrum' | 'mono',
					fgColor: juliaFgColor,
					bgColor: juliaBgColor,
				})
		}
		if (generatorType === 'boids') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiBoidsFrame(frame, cols, r, {
					count: boidsCount,
					sepWeight: boidsSepWeight,
					alignWeight: boidsAlignWeight,
					cohWeight: boidsCohWeight,
					headColor: boidsHeadColor,
					bgColor: boidsBgColor,
				})
		}
		if (generatorType === 'donut') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiDonutFrame(frame, cols, r, {
					speedA: donutSpeedA,
					speedB: donutSpeedB,
					size: donutSize,
					tubeRatio: donutTubeRatio,
					baseColor: donutBaseColor,
					bgColor: donutBgColor,
				})
		}
		if (generatorType === 'wireframe') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiWireframeFrame(frame, cols, r, {
					shape: wireframeShape as 'cube' | 'tetrahedron' | 'octahedron' | 'icosahedron',
					size: wireframeSize,
					speedX: wireframeSpeedX,
					speedY: wireframeSpeedY,
					speedZ: wireframeSpeedZ,
					edgeColor: wireframeEdgeColor,
					vertexColor: wireframeVertexColor,
					depthShading: wireframeDepthShading,
					bgColor: wireframeBgColor,
				})
		}
		if (generatorType === 'shadebobs') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiShadebobsFrame(frame, cols, r, {
					bobCount: shadebobsBobCount,
					bobSize: shadebobsBobSize,
					trailDecay: shadebobsTrailDecay,
					speed: shadebobsSpeed,
					seed: shadebobsSeed,
					bgColor: shadebobsBgColor,
				})
		}
		if (generatorType === 'munchingSquares') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiMunchingSquaresFrame(frame, cols, r, {
					speed: munchSpeed,
					size: munchSize,
					invert: munchInvert,
					bgColor: munchBgColor,
				})
		}
		if (generatorType === 'fireworks') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiFireworksFrame(frame, cols, r, {
					launchInterval: fireworksLaunchInterval,
					riseFrames: fireworksRiseFrames,
					burstDuration: fireworksBurstDuration,
					particleCount: fireworksParticleCount,
					gravity: fireworksGravity,
					nightSky: fireworksNightSky,
					seed: fireworksSeed,
					bgColor: fireworksBgColor,
				})
		}
		if (generatorType === 'aquarium') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiAquariumFrame(frame, cols, r, {
					fishCount: aquariumFishCount,
					bubbleDensity: aquariumBubbleDensity,
					seaweedDensity: aquariumSeaweedDensity,
					swaySpeed: aquariumSwaySpeed,
					speed: aquariumSpeed,
					seed: aquariumSeed,
					bgColor: aquariumBgColor,
				})
		}
		if (generatorType === 'physarum') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiPhysarumFrame(frame, cols, r, {
					agentDensity: physarumAgentDensity,
					sensorAngle: physarumSensorAngle,
					sensorDistance: physarumSensorDistance,
					turnSpeed: physarumTurnSpeed,
					evaporation: physarumEvaporation,
					stepsPerFrame: physarumStepsPerFrame,
					seed: physarumSeed,
					bgColor: physarumBgColor,
				})
		}
		if (generatorType === 'sandpile') {
			return (frame: number, cols: number, r: number) =>
				generateAsciiSandpileFrame(frame, cols, r, {
					grainsPerStep: sandpileGrainsPerStep,
					stepsPerFrame: sandpileStepsPerFrame,
					maxToppleSweeps: sandpileMaxToppleSweeps,
					dropX: sandpileDropX,
					dropY: sandpileDropY,
					bgColor: sandpileBgColor,
				})
		}
		if (generatorType === 'screensaver') {
			// The cycle is created inside this memo on purpose: changing any screensaver
			// option rebuilds it, which also gives the stateful members (fire, matrix,
			// shadebobs, physarum) fresh private simulations.
			return createAnsiGeneratorCycle([
				(frame: number, cols: number, r: number) => generateAsciiDonutFrame(frame, cols, r),
				(frame: number, cols: number, r: number) => generateAsciiPerlinPlasmaFrame(frame, cols, r),
				(frame: number, cols: number, r: number) => generateAsciiFireworksFrame(frame, cols, r),
				(frame: number, cols: number, r: number) => generateAsciiTunnelFrame(frame, cols, r),
				createAsciiFireGenerator(),
				createAsciiMatrixRainGenerator(),
				createAsciiShadebobsGenerator(),
				createAsciiPhysarumGenerator(),
			], {
				holdFrames: saverHoldFrames,
				transitionFrames: saverTransitionFrames,
				...(saverKind !== 'auto' ? { kind: saverKind as TransitionKind } : {}),
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
		matrixSpeed, matrixDensity, matrixTrailLength, matrixHeadColor, matrixTrailColor,
		matrixBgColor, matrixChars, matrixSeed,
		starfieldStars, starfieldSpeed, starfieldFgColor, starfieldBgColor, starfieldChars, starfieldSeed, starfieldStreaks,
		tunnelSpeed, tunnelRotationSpeed, tunnelTiles, tunnelFgColor, tunnelBgColor, tunnelChars, tunnelAspectY,
		lifeDensity, lifeFgColor, lifeBgColor, lifeSeed, lifeAutoSeed, lifeAutoSeedThreshold,
		rippleDamping, rippleDropFrequency, rippleDropStrength, rippleFgColor, rippleBgColor, rippleChars, rippleSeed,
		mandelbrotMaxIter, mandelbrotZoomSpeed, mandelbrotZoomX, mandelbrotZoomY, mandelbrotInitialZoom,
		mandelbrotFgColor, mandelbrotBgColor, mandelbrotChars, mandelbrotAspectY, mandelbrotColorMode, mandelbrotShapeMode,
		copperBarCount, copperBarHeight, copperSpeed, copperBgColor, copperChars, copperSeed,
		crtSignalStrength, crtScanlineIntensity, crtTearFrequency, crtRollingBarSpeed, crtVhsMode, crtBgColor, crtChars, crtSeed,
		auroraCurtainCount, auroraSpeed, auroraIntensity, auroraBgColor, auroraChars, auroraSeed,
		rdFeedRate, rdKillRate, rdDiffusionU, rdDiffusionV, rdStepsPerFrame, rdColorMode, rdFgColor, rdBgColor, rdChars, rdSeed,
		terrainScrollSpeed, terrainHeightScale, terrainFogDistance, terrainColorMode, terrainFgColor, terrainBgColor, terrainSkyColor, terrainChars, terrainSeed,
		rotoRotationSpeed, rotoZoomSpeed, rotoBaseZoom, rotoPattern, rotoBgColor,
		moireRingWidth, moireSpeed1, moireSpeed2, moirePaletteSpeed, moireBgColor,
		kefrensBarWidth, kefrensHueSpeed, kefrensHueRowStep, kefrensBgColor, kefrensChars,
		twisterRotationSpeed, twisterWaveFreq, twisterWaveSpeed, twisterWaveDepth, twisterBgColor,
		scrollerText, scrollerSpeed, scrollerAmplitude, scrollerWaveSpeed, scrollerFgColor, scrollerBgColor,
		boingScale, boingBounceSpeed, boingDriftSpeed, boingCheckerDensity, boingBallRedColor, boingBgColor,
		cyclicStates, cyclicThreshold, cyclicNeighborhood, cyclicSaturation, cyclicLightness, cyclicSeed,
		sandSpoutCount, sandSpoutRate, sandDrainOpenThreshold, sandWallColor, sandBgColor, sandSeed,
		bumpNoiseScale, bumpOrbitSpeed, bumpLightHeight, bumpBumpStrength, bumpSpecularPower, bumpBgColor,
		juliaMaxIter, juliaMorphSpeed, juliaRadius, juliaColorMode, juliaFgColor, juliaBgColor,
		boidsCount, boidsSepWeight, boidsAlignWeight, boidsCohWeight, boidsHeadColor, boidsBgColor,
		donutSpeedA, donutSpeedB, donutSize, donutTubeRatio, donutBaseColor, donutBgColor,
		wireframeShape, wireframeSize, wireframeSpeedX, wireframeSpeedY, wireframeSpeedZ,
		wireframeEdgeColor, wireframeVertexColor, wireframeDepthShading, wireframeBgColor,
		shadebobsBobCount, shadebobsBobSize, shadebobsTrailDecay, shadebobsSpeed, shadebobsSeed, shadebobsBgColor,
		munchSpeed, munchSize, munchInvert, munchBgColor,
		fireworksLaunchInterval, fireworksRiseFrames, fireworksBurstDuration, fireworksParticleCount,
		fireworksGravity, fireworksNightSky, fireworksSeed, fireworksBgColor,
		aquariumFishCount, aquariumBubbleDensity, aquariumSeaweedDensity, aquariumSwaySpeed, aquariumSpeed, aquariumSeed, aquariumBgColor,
		physarumAgentDensity, physarumSensorAngle, physarumSensorDistance, physarumTurnSpeed,
		physarumEvaporation, physarumStepsPerFrame, physarumSeed, physarumBgColor,
		sandpileGrainsPerStep, sandpileStepsPerFrame, sandpileMaxToppleSweeps, sandpileDropX, sandpileDropY, sandpileBgColor,
		saverHoldFrames, saverTransitionFrames, saverKind,
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
		copperBars: {
			options: { barCount: copperBarCount, barHeight: copperBarHeight, speed: copperSpeed, bgColor: copperBgColor, chars: copperChars, seed: copperSeed },
			defaults: COPPER_BARS_DEFAULTS,
		},
		crtStatic: {
			options: { signalStrength: crtSignalStrength, scanlineIntensity: crtScanlineIntensity, tearFrequency: crtTearFrequency, rollingBarSpeed: crtRollingBarSpeed, vhsMode: crtVhsMode, bgColor: crtBgColor, chars: crtChars, seed: crtSeed },
			defaults: CRT_STATIC_DEFAULTS,
		},
		auroraBorealis: {
			options: { curtainCount: auroraCurtainCount, speed: auroraSpeed, intensity: auroraIntensity, bgColor: auroraBgColor, chars: auroraChars, seed: auroraSeed },
			defaults: AURORA_BOREALIS_DEFAULTS,
		},
		reactionDiffusion: {
			options: { feedRate: rdFeedRate, killRate: rdKillRate, diffusionU: rdDiffusionU, diffusionV: rdDiffusionV, stepsPerFrame: rdStepsPerFrame, colorMode: rdColorMode, fgColor: rdFgColor, bgColor: rdBgColor, chars: rdChars, seed: rdSeed },
			defaults: REACTION_DIFFUSION_DEFAULTS,
		},
		terrainFlyover: {
			options: { scrollSpeed: terrainScrollSpeed, heightScale: terrainHeightScale, fogDistance: terrainFogDistance, colorMode: terrainColorMode, fgColor: terrainFgColor, bgColor: terrainBgColor, skyColor: terrainSkyColor, chars: terrainChars, seed: terrainSeed },
			defaults: TERRAIN_FLYOVER_DEFAULTS,
		},
		rotozoomer: {
			options: { rotationSpeed: rotoRotationSpeed, zoomSpeed: rotoZoomSpeed, baseZoom: rotoBaseZoom, pattern: rotoPattern, bgColor: rotoBgColor },
			defaults: ROTOZOOMER_DEFAULTS,
		},
		moire: {
			options: { ringWidth: moireRingWidth, speed1: moireSpeed1, speed2: moireSpeed2, paletteSpeed: moirePaletteSpeed, bgColor: moireBgColor },
			defaults: MOIRE_DEFAULTS,
		},
		kefrensBars: {
			options: { barWidth: kefrensBarWidth, hueSpeed: kefrensHueSpeed, hueRowStep: kefrensHueRowStep, bgColor: kefrensBgColor, chars: kefrensChars },
			defaults: KEFRENS_BARS_DEFAULTS,
		},
		twister: {
			options: { rotationSpeed: twisterRotationSpeed, waveFreq: twisterWaveFreq, waveSpeed: twisterWaveSpeed, waveDepth: twisterWaveDepth, bgColor: twisterBgColor },
			defaults: TWISTER_DEFAULTS,
		},
		sineScroller: {
			options: { text: scrollerText, speed: scrollerSpeed, amplitude: scrollerAmplitude, waveSpeed: scrollerWaveSpeed, fgColor: scrollerFgColor, bgColor: scrollerBgColor },
			defaults: SINE_SCROLLER_DEFAULTS,
		},
		boingBall: {
			options: { scale: boingScale, bounceSpeed: boingBounceSpeed, driftSpeed: boingDriftSpeed, checkerDensity: boingCheckerDensity, ballRedColor: boingBallRedColor, bgColor: boingBgColor },
			defaults: BOING_BALL_DEFAULTS,
		},
		cyclicAutomaton: {
			options: { states: cyclicStates, threshold: cyclicThreshold, neighborhood: cyclicNeighborhood, saturation: cyclicSaturation, lightness: cyclicLightness, seed: cyclicSeed },
			defaults: CYCLIC_AUTOMATON_DEFAULTS,
		},
		fallingSand: {
			options: { spoutCount: sandSpoutCount, spoutRate: sandSpoutRate, drainOpenThreshold: sandDrainOpenThreshold, wallColor: sandWallColor, bgColor: sandBgColor, seed: sandSeed },
			defaults: FALLING_SAND_DEFAULTS,
		},
		bumpMapping: {
			options: { noiseScale: bumpNoiseScale, orbitSpeed: bumpOrbitSpeed, lightHeight: bumpLightHeight, bumpStrength: bumpBumpStrength, specularPower: bumpSpecularPower, bgColor: bumpBgColor },
			defaults: BUMP_MAPPING_DEFAULTS,
		},
		julia: {
			options: { maxIter: juliaMaxIter, morphSpeed: juliaMorphSpeed, radius: juliaRadius, colorMode: juliaColorMode, fgColor: juliaFgColor, bgColor: juliaBgColor },
			defaults: JULIA_DEFAULTS,
		},
		boids: {
			options: { count: boidsCount, sepWeight: boidsSepWeight, alignWeight: boidsAlignWeight, cohWeight: boidsCohWeight, headColor: boidsHeadColor, bgColor: boidsBgColor },
			defaults: BOIDS_DEFAULTS,
		},
		donut: {
			options: { speedA: donutSpeedA, speedB: donutSpeedB, size: donutSize, tubeRatio: donutTubeRatio, baseColor: donutBaseColor, bgColor: donutBgColor },
			defaults: DONUT_DEFAULTS,
		},
		wireframe: {
			options: { shape: wireframeShape, size: wireframeSize, speedX: wireframeSpeedX, speedY: wireframeSpeedY, speedZ: wireframeSpeedZ, edgeColor: wireframeEdgeColor, vertexColor: wireframeVertexColor, depthShading: wireframeDepthShading, bgColor: wireframeBgColor },
			defaults: WIREFRAME_DEFAULTS,
		},
		shadebobs: {
			options: { bobCount: shadebobsBobCount, bobSize: shadebobsBobSize, trailDecay: shadebobsTrailDecay, speed: shadebobsSpeed, seed: shadebobsSeed, bgColor: shadebobsBgColor },
			defaults: SHADEBOBS_DEFAULTS,
		},
		munchingSquares: {
			options: { speed: munchSpeed, size: munchSize, invert: munchInvert, bgColor: munchBgColor },
			defaults: MUNCHING_SQUARES_DEFAULTS,
		},
		fireworks: {
			options: { launchInterval: fireworksLaunchInterval, riseFrames: fireworksRiseFrames, burstDuration: fireworksBurstDuration, particleCount: fireworksParticleCount, gravity: fireworksGravity, nightSky: fireworksNightSky, seed: fireworksSeed, bgColor: fireworksBgColor },
			defaults: FIREWORKS_DEFAULTS,
		},
		aquarium: {
			options: { fishCount: aquariumFishCount, bubbleDensity: aquariumBubbleDensity, seaweedDensity: aquariumSeaweedDensity, swaySpeed: aquariumSwaySpeed, speed: aquariumSpeed, seed: aquariumSeed, bgColor: aquariumBgColor },
			defaults: AQUARIUM_DEFAULTS,
		},
		physarum: {
			options: { agentDensity: physarumAgentDensity, sensorAngle: physarumSensorAngle, sensorDistance: physarumSensorDistance, turnSpeed: physarumTurnSpeed, evaporation: physarumEvaporation, stepsPerFrame: physarumStepsPerFrame, seed: physarumSeed, bgColor: physarumBgColor },
			defaults: PHYSARUM_DEFAULTS,
		},
		sandpile: {
			options: { grainsPerStep: sandpileGrainsPerStep, stepsPerFrame: sandpileStepsPerFrame, maxToppleSweeps: sandpileMaxToppleSweeps, dropX: sandpileDropX, dropY: sandpileDropY, bgColor: sandpileBgColor },
			defaults: SANDPILE_DEFAULTS,
		},
		screensaver: {
			options: { holdFrames: saverHoldFrames, transitionFrames: saverTransitionFrames, kind: saverKind },
			defaults: SCREENSAVER_DEFAULTS,
		},
	}

	const activeGen = generatorOptionsMap[generatorType]
	const activeLabel = TABS.find((tab) => tab.key === generatorType)?.label ?? generatorType

	// One entry per editable option, per generator: current value, default, and how to
	// parse it back off the URL. Plasma's `octaves` is intentionally absent — it is a
	// nested array of objects and would dominate the query string.
	const urlParams: Record<GeneratorType, UrlParam[]> = {
		perlinPlasma: [
			strParam('chars', plasmaChars, PLASMA_DEFAULTS.chars, setPlasmaChars),
			numParam('timeScale', plasmaTimeScale, PLASMA_DEFAULTS.timeScale, setPlasmaTimeScale),
			strParam('fgColor', plasmaFgColor, PLASMA_DEFAULTS.fgColor, setPlasmaFgColor),
			strParam('bgColor', plasmaBgColor, PLASMA_DEFAULTS.bgColor, setPlasmaBgColor),
			numParam('seed', plasmaSeed, PLASMA_DEFAULTS.seed, setPlasmaSeed),
		],
		fire: [
			strParam('chars', fireChars, FIRE_DEFAULTS.chars, setFireChars),
			numParam('darkenAmount', fireDarkenAmount, FIRE_DEFAULTS.darkenAmount, setFireDarkenAmount),
			numParam('sparkMin', fireSparkMin, FIRE_DEFAULTS.sparkMin, setFireSparkMin),
			numParam('sparkMax', fireSparkMax, FIRE_DEFAULTS.sparkMax, setFireSparkMax),
			strParam('bgColor', fireBgColor, FIRE_DEFAULTS.bgColor, setFireBgColor),
			numParam('seed', fireSeed, FIRE_DEFAULTS.seed, setFireSeed),
		],
		sonar: [
			numParam('frequency', sonarFrequency, SONAR_DEFAULTS.frequency, setSonarFrequency),
			numParam('intensity', sonarIntensity, SONAR_DEFAULTS.intensity, setSonarIntensity),
			strParam('fgColor', sonarFgColor, SONAR_DEFAULTS.fgColor, setSonarFgColor),
			strParam('bgColor', sonarBgColor, SONAR_DEFAULTS.bgColor, setSonarBgColor),
			strParam('dotChar', sonarDotChar, SONAR_DEFAULTS.dotChar, setSonarDotChar),
			numParam('speed', sonarSpeed, SONAR_DEFAULTS.speed, setSonarSpeed),
			numParam('bandWidth', sonarBandWidth, SONAR_DEFAULTS.bandWidth, setSonarBandWidth),
			numParam('decay', sonarDecay, SONAR_DEFAULTS.decay, setSonarDecay),
			numParam('baseAlpha', sonarBaseAlpha, SONAR_DEFAULTS.baseAlpha, setSonarBaseAlpha),
			numParam('alphaSteps', sonarAlphaSteps, SONAR_DEFAULTS.alphaSteps, setSonarAlphaSteps),
			strParam('centerX', sonarCenterX, SONAR_DEFAULTS.centerX, setSonarCenterX),
			strParam('centerY', sonarCenterY, SONAR_DEFAULTS.centerY, setSonarCenterY),
			numParam('aspectY', sonarAspectY, SONAR_DEFAULTS.aspectY, setSonarAspectY),
			numParam('maxRings', sonarMaxRings, SONAR_DEFAULTS.maxRings, setSonarMaxRings),
		],
		datamosh: [
			numParam('seed', datamoshSeed, DATAMOSH_DEFAULTS.seed, setDatamoshSeed),
			numParam('keyframeIntervalFrames', datamoshKeyframeIntervalFrames, DATAMOSH_DEFAULTS.keyframeIntervalFrames, setDatamoshKeyframeIntervalFrames),
			numParam('blockOpsPerFrame', datamoshBlockOpsPerFrame, DATAMOSH_DEFAULTS.blockOpsPerFrame, setDatamoshBlockOpsPerFrame),
			numParam('minBlockSize', datamoshMinBlockSize, DATAMOSH_DEFAULTS.minBlockSize, setDatamoshMinBlockSize),
			numParam('maxBlockSize', datamoshMaxBlockSize, DATAMOSH_DEFAULTS.maxBlockSize, setDatamoshMaxBlockSize),
			numParam('maxShift', datamoshMaxShift, DATAMOSH_DEFAULTS.maxShift, setDatamoshMaxShift),
			strParam('bgColor', datamoshBgColor, DATAMOSH_DEFAULTS.bgColor, setDatamoshBgColor),
		],
		metaballs: [
			numParam('seed', metaballsSeed, METABALLS_DEFAULTS.seed, setMetaballsSeed),
			numParam('balls', metaballsBalls, METABALLS_DEFAULTS.balls, setMetaballsBalls),
			numParam('speed', metaballsSpeed, METABALLS_DEFAULTS.speed, setMetaballsSpeed),
			numParam('radiusMin', metaballsRadiusMin, METABALLS_DEFAULTS.radiusMin, setMetaballsRadiusMin),
			numParam('radiusMax', metaballsRadiusMax, METABALLS_DEFAULTS.radiusMax, setMetaballsRadiusMax),
			numParam('intensity', metaballsIntensity, METABALLS_DEFAULTS.intensity, setMetaballsIntensity),
			numParam('aspectY', metaballsAspectY, METABALLS_DEFAULTS.aspectY, setMetaballsAspectY),
			strParam('fgColor', metaballsFgColor, METABALLS_DEFAULTS.fgColor, setMetaballsFgColor),
			strParam('bgColor', metaballsBgColor, METABALLS_DEFAULTS.bgColor, setMetaballsBgColor),
			strParam('chars', metaballsChars, METABALLS_DEFAULTS.chars, setMetaballsChars),
		],
		matrix: [
			numParam('speed', matrixSpeed, MATRIX_DEFAULTS.speed, setMatrixSpeed),
			numParam('density', matrixDensity, MATRIX_DEFAULTS.density, setMatrixDensity),
			numParam('trailLength', matrixTrailLength, MATRIX_DEFAULTS.trailLength, setMatrixTrailLength),
			strParam('headColor', matrixHeadColor, MATRIX_DEFAULTS.headColor, setMatrixHeadColor),
			strParam('trailColor', matrixTrailColor, MATRIX_DEFAULTS.trailColor, setMatrixTrailColor),
			strParam('bgColor', matrixBgColor, MATRIX_DEFAULTS.bgColor, setMatrixBgColor),
			strParam('chars', matrixChars, MATRIX_DEFAULTS.chars, setMatrixChars),
			numParam('seed', matrixSeed, MATRIX_DEFAULTS.seed, setMatrixSeed),
		],
		starfield: [
			numParam('stars', starfieldStars, STARFIELD_DEFAULTS.stars, setStarfieldStars),
			numParam('speed', starfieldSpeed, STARFIELD_DEFAULTS.speed, setStarfieldSpeed),
			strParam('fgColor', starfieldFgColor, STARFIELD_DEFAULTS.fgColor, setStarfieldFgColor),
			strParam('bgColor', starfieldBgColor, STARFIELD_DEFAULTS.bgColor, setStarfieldBgColor),
			strParam('chars', starfieldChars, STARFIELD_DEFAULTS.chars, setStarfieldChars),
			numParam('seed', starfieldSeed, STARFIELD_DEFAULTS.seed, setStarfieldSeed),
			boolParam('streaks', starfieldStreaks, STARFIELD_DEFAULTS.streaks, setStarfieldStreaks),
		],
		tunnel: [
			numParam('speed', tunnelSpeed, TUNNEL_DEFAULTS.speed, setTunnelSpeed),
			numParam('rotationSpeed', tunnelRotationSpeed, TUNNEL_DEFAULTS.rotationSpeed, setTunnelRotationSpeed),
			numParam('tiles', tunnelTiles, TUNNEL_DEFAULTS.tiles, setTunnelTiles),
			strParam('fgColor', tunnelFgColor, TUNNEL_DEFAULTS.fgColor, setTunnelFgColor),
			strParam('bgColor', tunnelBgColor, TUNNEL_DEFAULTS.bgColor, setTunnelBgColor),
			strParam('chars', tunnelChars, TUNNEL_DEFAULTS.chars, setTunnelChars),
			numParam('aspectY', tunnelAspectY, TUNNEL_DEFAULTS.aspectY, setTunnelAspectY),
		],
		gameOfLife: [
			numParam('density', lifeDensity, GAME_OF_LIFE_DEFAULTS.density, setLifeDensity),
			strParam('fgColor', lifeFgColor, GAME_OF_LIFE_DEFAULTS.fgColor, setLifeFgColor),
			strParam('bgColor', lifeBgColor, GAME_OF_LIFE_DEFAULTS.bgColor, setLifeBgColor),
			numParam('seed', lifeSeed, GAME_OF_LIFE_DEFAULTS.seed, setLifeSeed),
			boolParam('autoSeed', lifeAutoSeed, GAME_OF_LIFE_DEFAULTS.autoSeed, setLifeAutoSeed),
			numParam('autoSeedThreshold', lifeAutoSeedThreshold, GAME_OF_LIFE_DEFAULTS.autoSeedThreshold, setLifeAutoSeedThreshold),
		],
		waterRipple: [
			numParam('damping', rippleDamping, WATER_RIPPLE_DEFAULTS.damping, setRippleDamping),
			numParam('dropFrequency', rippleDropFrequency, WATER_RIPPLE_DEFAULTS.dropFrequency, setRippleDropFrequency),
			numParam('dropStrength', rippleDropStrength, WATER_RIPPLE_DEFAULTS.dropStrength, setRippleDropStrength),
			strParam('fgColor', rippleFgColor, WATER_RIPPLE_DEFAULTS.fgColor, setRippleFgColor),
			strParam('bgColor', rippleBgColor, WATER_RIPPLE_DEFAULTS.bgColor, setRippleBgColor),
			strParam('chars', rippleChars, WATER_RIPPLE_DEFAULTS.chars, setRippleChars),
			numParam('seed', rippleSeed, WATER_RIPPLE_DEFAULTS.seed, setRippleSeed),
		],
		mandelbrot: [
			numParam('maxIter', mandelbrotMaxIter, MANDELBROT_DEFAULTS.maxIter, setMandelbrotMaxIter),
			numParam('zoomSpeed', mandelbrotZoomSpeed, MANDELBROT_DEFAULTS.zoomSpeed, setMandelbrotZoomSpeed),
			numParam('zoomX', mandelbrotZoomX, MANDELBROT_DEFAULTS.zoomX, setMandelbrotZoomX),
			numParam('zoomY', mandelbrotZoomY, MANDELBROT_DEFAULTS.zoomY, setMandelbrotZoomY),
			numParam('initialZoom', mandelbrotInitialZoom, MANDELBROT_DEFAULTS.initialZoom, setMandelbrotInitialZoom),
			strParam('fgColor', mandelbrotFgColor, MANDELBROT_DEFAULTS.fgColor, setMandelbrotFgColor),
			strParam('bgColor', mandelbrotBgColor, MANDELBROT_DEFAULTS.bgColor, setMandelbrotBgColor),
			strParam('chars', mandelbrotChars, MANDELBROT_DEFAULTS.chars, setMandelbrotChars),
			numParam('aspectY', mandelbrotAspectY, MANDELBROT_DEFAULTS.aspectY, setMandelbrotAspectY),
			strParam('colorMode', mandelbrotColorMode, MANDELBROT_DEFAULTS.colorMode, setMandelbrotColorMode),
			boolParam('shapeMode', mandelbrotShapeMode, false, setMandelbrotShapeMode),
		],
		copperBars: [
			numParam('barCount', copperBarCount, COPPER_BARS_DEFAULTS.barCount, setCopperBarCount),
			numParam('barHeight', copperBarHeight, COPPER_BARS_DEFAULTS.barHeight, setCopperBarHeight),
			numParam('speed', copperSpeed, COPPER_BARS_DEFAULTS.speed, setCopperSpeed),
			strParam('bgColor', copperBgColor, COPPER_BARS_DEFAULTS.bgColor, setCopperBgColor),
			strParam('chars', copperChars, COPPER_BARS_DEFAULTS.chars, setCopperChars),
			numParam('seed', copperSeed, COPPER_BARS_DEFAULTS.seed, setCopperSeed),
		],
		crtStatic: [
			numParam('signalStrength', crtSignalStrength, CRT_STATIC_DEFAULTS.signalStrength, setCrtSignalStrength),
			numParam('scanlineIntensity', crtScanlineIntensity, CRT_STATIC_DEFAULTS.scanlineIntensity, setCrtScanlineIntensity),
			numParam('tearFrequency', crtTearFrequency, CRT_STATIC_DEFAULTS.tearFrequency, setCrtTearFrequency),
			numParam('rollingBarSpeed', crtRollingBarSpeed, CRT_STATIC_DEFAULTS.rollingBarSpeed, setCrtRollingBarSpeed),
			boolParam('vhsMode', crtVhsMode, CRT_STATIC_DEFAULTS.vhsMode, setCrtVhsMode),
			strParam('bgColor', crtBgColor, CRT_STATIC_DEFAULTS.bgColor, setCrtBgColor),
			strParam('chars', crtChars, CRT_STATIC_DEFAULTS.chars, setCrtChars),
			numParam('seed', crtSeed, CRT_STATIC_DEFAULTS.seed, setCrtSeed),
		],
		auroraBorealis: [
			numParam('curtainCount', auroraCurtainCount, AURORA_BOREALIS_DEFAULTS.curtainCount, setAuroraCurtainCount),
			numParam('speed', auroraSpeed, AURORA_BOREALIS_DEFAULTS.speed, setAuroraSpeed),
			numParam('intensity', auroraIntensity, AURORA_BOREALIS_DEFAULTS.intensity, setAuroraIntensity),
			strParam('bgColor', auroraBgColor, AURORA_BOREALIS_DEFAULTS.bgColor, setAuroraBgColor),
			strParam('chars', auroraChars, AURORA_BOREALIS_DEFAULTS.chars, setAuroraChars),
			numParam('seed', auroraSeed, AURORA_BOREALIS_DEFAULTS.seed, setAuroraSeed),
		],
		reactionDiffusion: [
			numParam('feedRate', rdFeedRate, REACTION_DIFFUSION_DEFAULTS.feedRate, setRdFeedRate),
			numParam('killRate', rdKillRate, REACTION_DIFFUSION_DEFAULTS.killRate, setRdKillRate),
			numParam('diffusionU', rdDiffusionU, REACTION_DIFFUSION_DEFAULTS.diffusionU, setRdDiffusionU),
			numParam('diffusionV', rdDiffusionV, REACTION_DIFFUSION_DEFAULTS.diffusionV, setRdDiffusionV),
			numParam('stepsPerFrame', rdStepsPerFrame, REACTION_DIFFUSION_DEFAULTS.stepsPerFrame, setRdStepsPerFrame),
			strParam('colorMode', rdColorMode, REACTION_DIFFUSION_DEFAULTS.colorMode, setRdColorMode),
			strParam('fgColor', rdFgColor, REACTION_DIFFUSION_DEFAULTS.fgColor, setRdFgColor),
			strParam('bgColor', rdBgColor, REACTION_DIFFUSION_DEFAULTS.bgColor, setRdBgColor),
			strParam('chars', rdChars, REACTION_DIFFUSION_DEFAULTS.chars, setRdChars),
			numParam('seed', rdSeed, REACTION_DIFFUSION_DEFAULTS.seed, setRdSeed),
		],
		terrainFlyover: [
			numParam('scrollSpeed', terrainScrollSpeed, TERRAIN_FLYOVER_DEFAULTS.scrollSpeed, setTerrainScrollSpeed),
			numParam('heightScale', terrainHeightScale, TERRAIN_FLYOVER_DEFAULTS.heightScale, setTerrainHeightScale),
			numParam('fogDistance', terrainFogDistance, TERRAIN_FLYOVER_DEFAULTS.fogDistance, setTerrainFogDistance),
			strParam('colorMode', terrainColorMode, TERRAIN_FLYOVER_DEFAULTS.colorMode, setTerrainColorMode),
			strParam('fgColor', terrainFgColor, TERRAIN_FLYOVER_DEFAULTS.fgColor, setTerrainFgColor),
			strParam('bgColor', terrainBgColor, TERRAIN_FLYOVER_DEFAULTS.bgColor, setTerrainBgColor),
			strParam('skyColor', terrainSkyColor, TERRAIN_FLYOVER_DEFAULTS.skyColor, setTerrainSkyColor),
			strParam('chars', terrainChars, TERRAIN_FLYOVER_DEFAULTS.chars, setTerrainChars),
			numParam('seed', terrainSeed, TERRAIN_FLYOVER_DEFAULTS.seed, setTerrainSeed),
		],
		rotozoomer: [
			numParam('rotationSpeed', rotoRotationSpeed, ROTOZOOMER_DEFAULTS.rotationSpeed, setRotoRotationSpeed),
			numParam('zoomSpeed', rotoZoomSpeed, ROTOZOOMER_DEFAULTS.zoomSpeed, setRotoZoomSpeed),
			numParam('baseZoom', rotoBaseZoom, ROTOZOOMER_DEFAULTS.baseZoom, setRotoBaseZoom),
			strParam('pattern', rotoPattern, ROTOZOOMER_DEFAULTS.pattern, setRotoPattern),
			strParam('bgColor', rotoBgColor, ROTOZOOMER_DEFAULTS.bgColor, setRotoBgColor),
		],
		moire: [
			numParam('ringWidth', moireRingWidth, MOIRE_DEFAULTS.ringWidth, setMoireRingWidth),
			numParam('speed1', moireSpeed1, MOIRE_DEFAULTS.speed1, setMoireSpeed1),
			numParam('speed2', moireSpeed2, MOIRE_DEFAULTS.speed2, setMoireSpeed2),
			numParam('paletteSpeed', moirePaletteSpeed, MOIRE_DEFAULTS.paletteSpeed, setMoirePaletteSpeed),
			strParam('bgColor', moireBgColor, MOIRE_DEFAULTS.bgColor, setMoireBgColor),
		],
		kefrensBars: [
			numParam('barWidth', kefrensBarWidth, KEFRENS_BARS_DEFAULTS.barWidth, setKefrensBarWidth),
			numParam('hueSpeed', kefrensHueSpeed, KEFRENS_BARS_DEFAULTS.hueSpeed, setKefrensHueSpeed),
			numParam('hueRowStep', kefrensHueRowStep, KEFRENS_BARS_DEFAULTS.hueRowStep, setKefrensHueRowStep),
			strParam('bgColor', kefrensBgColor, KEFRENS_BARS_DEFAULTS.bgColor, setKefrensBgColor),
			strParam('chars', kefrensChars, KEFRENS_BARS_DEFAULTS.chars, setKefrensChars),
		],
		twister: [
			numParam('rotationSpeed', twisterRotationSpeed, TWISTER_DEFAULTS.rotationSpeed, setTwisterRotationSpeed),
			numParam('waveFreq', twisterWaveFreq, TWISTER_DEFAULTS.waveFreq, setTwisterWaveFreq),
			numParam('waveSpeed', twisterWaveSpeed, TWISTER_DEFAULTS.waveSpeed, setTwisterWaveSpeed),
			numParam('waveDepth', twisterWaveDepth, TWISTER_DEFAULTS.waveDepth, setTwisterWaveDepth),
			strParam('bgColor', twisterBgColor, TWISTER_DEFAULTS.bgColor, setTwisterBgColor),
		],
		sineScroller: [
			strParam('text', scrollerText, SINE_SCROLLER_DEFAULTS.text, setScrollerText),
			numParam('speed', scrollerSpeed, SINE_SCROLLER_DEFAULTS.speed, setScrollerSpeed),
			numParam('amplitude', scrollerAmplitude, SINE_SCROLLER_DEFAULTS.amplitude, setScrollerAmplitude),
			numParam('waveSpeed', scrollerWaveSpeed, SINE_SCROLLER_DEFAULTS.waveSpeed, setScrollerWaveSpeed),
			strParam('fgColor', scrollerFgColor, SINE_SCROLLER_DEFAULTS.fgColor, setScrollerFgColor),
			strParam('bgColor', scrollerBgColor, SINE_SCROLLER_DEFAULTS.bgColor, setScrollerBgColor),
		],
		boingBall: [
			numParam('scale', boingScale, BOING_BALL_DEFAULTS.scale, setBoingScale),
			numParam('bounceSpeed', boingBounceSpeed, BOING_BALL_DEFAULTS.bounceSpeed, setBoingBounceSpeed),
			numParam('driftSpeed', boingDriftSpeed, BOING_BALL_DEFAULTS.driftSpeed, setBoingDriftSpeed),
			numParam('checkerDensity', boingCheckerDensity, BOING_BALL_DEFAULTS.checkerDensity, setBoingCheckerDensity),
			strParam('ballRedColor', boingBallRedColor, BOING_BALL_DEFAULTS.ballRedColor, setBoingBallRedColor),
			strParam('bgColor', boingBgColor, BOING_BALL_DEFAULTS.bgColor, setBoingBgColor),
		],
		cyclicAutomaton: [
			numParam('states', cyclicStates, CYCLIC_AUTOMATON_DEFAULTS.states, setCyclicStates),
			numParam('threshold', cyclicThreshold, CYCLIC_AUTOMATON_DEFAULTS.threshold, setCyclicThreshold),
			strParam('neighborhood', cyclicNeighborhood, CYCLIC_AUTOMATON_DEFAULTS.neighborhood, setCyclicNeighborhood),
			numParam('saturation', cyclicSaturation, CYCLIC_AUTOMATON_DEFAULTS.saturation, setCyclicSaturation),
			numParam('lightness', cyclicLightness, CYCLIC_AUTOMATON_DEFAULTS.lightness, setCyclicLightness),
			numParam('seed', cyclicSeed, CYCLIC_AUTOMATON_DEFAULTS.seed, setCyclicSeed),
		],
		fallingSand: [
			numParam('spoutCount', sandSpoutCount, FALLING_SAND_DEFAULTS.spoutCount, setSandSpoutCount),
			numParam('spoutRate', sandSpoutRate, FALLING_SAND_DEFAULTS.spoutRate, setSandSpoutRate),
			numParam('drainOpenThreshold', sandDrainOpenThreshold, FALLING_SAND_DEFAULTS.drainOpenThreshold, setSandDrainOpenThreshold),
			strParam('wallColor', sandWallColor, FALLING_SAND_DEFAULTS.wallColor, setSandWallColor),
			strParam('bgColor', sandBgColor, FALLING_SAND_DEFAULTS.bgColor, setSandBgColor),
			numParam('seed', sandSeed, FALLING_SAND_DEFAULTS.seed, setSandSeed),
		],
		bumpMapping: [
			numParam('noiseScale', bumpNoiseScale, BUMP_MAPPING_DEFAULTS.noiseScale, setBumpNoiseScale),
			numParam('orbitSpeed', bumpOrbitSpeed, BUMP_MAPPING_DEFAULTS.orbitSpeed, setBumpOrbitSpeed),
			numParam('lightHeight', bumpLightHeight, BUMP_MAPPING_DEFAULTS.lightHeight, setBumpLightHeight),
			numParam('bumpStrength', bumpBumpStrength, BUMP_MAPPING_DEFAULTS.bumpStrength, setBumpBumpStrength),
			numParam('specularPower', bumpSpecularPower, BUMP_MAPPING_DEFAULTS.specularPower, setBumpSpecularPower),
			strParam('bgColor', bumpBgColor, BUMP_MAPPING_DEFAULTS.bgColor, setBumpBgColor),
		],
		julia: [
			numParam('maxIter', juliaMaxIter, JULIA_DEFAULTS.maxIter, setJuliaMaxIter),
			numParam('morphSpeed', juliaMorphSpeed, JULIA_DEFAULTS.morphSpeed, setJuliaMorphSpeed),
			numParam('radius', juliaRadius, JULIA_DEFAULTS.radius, setJuliaRadius),
			strParam('colorMode', juliaColorMode, JULIA_DEFAULTS.colorMode, setJuliaColorMode),
			strParam('fgColor', juliaFgColor, JULIA_DEFAULTS.fgColor, setJuliaFgColor),
			strParam('bgColor', juliaBgColor, JULIA_DEFAULTS.bgColor, setJuliaBgColor),
		],
		boids: [
			numParam('count', boidsCount, BOIDS_DEFAULTS.count, setBoidsCount),
			numParam('sepWeight', boidsSepWeight, BOIDS_DEFAULTS.sepWeight, setBoidsSepWeight),
			numParam('alignWeight', boidsAlignWeight, BOIDS_DEFAULTS.alignWeight, setBoidsAlignWeight),
			numParam('cohWeight', boidsCohWeight, BOIDS_DEFAULTS.cohWeight, setBoidsCohWeight),
			strParam('headColor', boidsHeadColor, BOIDS_DEFAULTS.headColor, setBoidsHeadColor),
			strParam('bgColor', boidsBgColor, BOIDS_DEFAULTS.bgColor, setBoidsBgColor),
		],
		donut: [
			numParam('speedA', donutSpeedA, DONUT_DEFAULTS.speedA, setDonutSpeedA),
			numParam('speedB', donutSpeedB, DONUT_DEFAULTS.speedB, setDonutSpeedB),
			numParam('size', donutSize, DONUT_DEFAULTS.size, setDonutSize),
			numParam('tubeRatio', donutTubeRatio, DONUT_DEFAULTS.tubeRatio, setDonutTubeRatio),
			strParam('baseColor', donutBaseColor, DONUT_DEFAULTS.baseColor, setDonutBaseColor),
			strParam('bgColor', donutBgColor, DONUT_DEFAULTS.bgColor, setDonutBgColor),
		],
		wireframe: [
			strParam('shape', wireframeShape, WIREFRAME_DEFAULTS.shape, setWireframeShape),
			numParam('size', wireframeSize, WIREFRAME_DEFAULTS.size, setWireframeSize),
			numParam('speedX', wireframeSpeedX, WIREFRAME_DEFAULTS.speedX, setWireframeSpeedX),
			numParam('speedY', wireframeSpeedY, WIREFRAME_DEFAULTS.speedY, setWireframeSpeedY),
			numParam('speedZ', wireframeSpeedZ, WIREFRAME_DEFAULTS.speedZ, setWireframeSpeedZ),
			strParam('edgeColor', wireframeEdgeColor, WIREFRAME_DEFAULTS.edgeColor, setWireframeEdgeColor),
			strParam('vertexColor', wireframeVertexColor, WIREFRAME_DEFAULTS.vertexColor, setWireframeVertexColor),
			boolParam('depthShading', wireframeDepthShading, WIREFRAME_DEFAULTS.depthShading, setWireframeDepthShading),
			strParam('bgColor', wireframeBgColor, WIREFRAME_DEFAULTS.bgColor, setWireframeBgColor),
		],
		shadebobs: [
			numParam('bobCount', shadebobsBobCount, SHADEBOBS_DEFAULTS.bobCount, setShadebobsBobCount),
			numParam('bobSize', shadebobsBobSize, SHADEBOBS_DEFAULTS.bobSize, setShadebobsBobSize),
			numParam('trailDecay', shadebobsTrailDecay, SHADEBOBS_DEFAULTS.trailDecay, setShadebobsTrailDecay),
			numParam('speed', shadebobsSpeed, SHADEBOBS_DEFAULTS.speed, setShadebobsSpeed),
			numParam('seed', shadebobsSeed, SHADEBOBS_DEFAULTS.seed, setShadebobsSeed),
			strParam('bgColor', shadebobsBgColor, SHADEBOBS_DEFAULTS.bgColor, setShadebobsBgColor),
		],
		munchingSquares: [
			numParam('speed', munchSpeed, MUNCHING_SQUARES_DEFAULTS.speed, setMunchSpeed),
			numParam('size', munchSize, MUNCHING_SQUARES_DEFAULTS.size, setMunchSize),
			boolParam('invert', munchInvert, MUNCHING_SQUARES_DEFAULTS.invert, setMunchInvert),
			strParam('bgColor', munchBgColor, MUNCHING_SQUARES_DEFAULTS.bgColor, setMunchBgColor),
		],
		fireworks: [
			numParam('launchInterval', fireworksLaunchInterval, FIREWORKS_DEFAULTS.launchInterval, setFireworksLaunchInterval),
			numParam('riseFrames', fireworksRiseFrames, FIREWORKS_DEFAULTS.riseFrames, setFireworksRiseFrames),
			numParam('burstDuration', fireworksBurstDuration, FIREWORKS_DEFAULTS.burstDuration, setFireworksBurstDuration),
			numParam('particleCount', fireworksParticleCount, FIREWORKS_DEFAULTS.particleCount, setFireworksParticleCount),
			numParam('gravity', fireworksGravity, FIREWORKS_DEFAULTS.gravity, setFireworksGravity),
			boolParam('nightSky', fireworksNightSky, FIREWORKS_DEFAULTS.nightSky, setFireworksNightSky),
			numParam('seed', fireworksSeed, FIREWORKS_DEFAULTS.seed, setFireworksSeed),
			strParam('bgColor', fireworksBgColor, FIREWORKS_DEFAULTS.bgColor, setFireworksBgColor),
		],
		aquarium: [
			numParam('fishCount', aquariumFishCount, AQUARIUM_DEFAULTS.fishCount, setAquariumFishCount),
			numParam('bubbleDensity', aquariumBubbleDensity, AQUARIUM_DEFAULTS.bubbleDensity, setAquariumBubbleDensity),
			numParam('seaweedDensity', aquariumSeaweedDensity, AQUARIUM_DEFAULTS.seaweedDensity, setAquariumSeaweedDensity),
			numParam('swaySpeed', aquariumSwaySpeed, AQUARIUM_DEFAULTS.swaySpeed, setAquariumSwaySpeed),
			numParam('speed', aquariumSpeed, AQUARIUM_DEFAULTS.speed, setAquariumSpeed),
			numParam('seed', aquariumSeed, AQUARIUM_DEFAULTS.seed, setAquariumSeed),
			strParam('bgColor', aquariumBgColor, AQUARIUM_DEFAULTS.bgColor, setAquariumBgColor),
		],
		physarum: [
			numParam('agentDensity', physarumAgentDensity, PHYSARUM_DEFAULTS.agentDensity, setPhysarumAgentDensity),
			numParam('sensorAngle', physarumSensorAngle, PHYSARUM_DEFAULTS.sensorAngle, setPhysarumSensorAngle),
			numParam('sensorDistance', physarumSensorDistance, PHYSARUM_DEFAULTS.sensorDistance, setPhysarumSensorDistance),
			numParam('turnSpeed', physarumTurnSpeed, PHYSARUM_DEFAULTS.turnSpeed, setPhysarumTurnSpeed),
			numParam('evaporation', physarumEvaporation, PHYSARUM_DEFAULTS.evaporation, setPhysarumEvaporation),
			numParam('stepsPerFrame', physarumStepsPerFrame, PHYSARUM_DEFAULTS.stepsPerFrame, setPhysarumStepsPerFrame),
			numParam('seed', physarumSeed, PHYSARUM_DEFAULTS.seed, setPhysarumSeed),
			strParam('bgColor', physarumBgColor, PHYSARUM_DEFAULTS.bgColor, setPhysarumBgColor),
		],
		sandpile: [
			numParam('grainsPerStep', sandpileGrainsPerStep, SANDPILE_DEFAULTS.grainsPerStep, setSandpileGrainsPerStep),
			numParam('stepsPerFrame', sandpileStepsPerFrame, SANDPILE_DEFAULTS.stepsPerFrame, setSandpileStepsPerFrame),
			numParam('maxToppleSweeps', sandpileMaxToppleSweeps, SANDPILE_DEFAULTS.maxToppleSweeps, setSandpileMaxToppleSweeps),
			numParam('dropX', sandpileDropX, SANDPILE_DEFAULTS.dropX, setSandpileDropX),
			numParam('dropY', sandpileDropY, SANDPILE_DEFAULTS.dropY, setSandpileDropY),
			strParam('bgColor', sandpileBgColor, SANDPILE_DEFAULTS.bgColor, setSandpileBgColor),
		],
		screensaver: [
			numParam('holdFrames', saverHoldFrames, SCREENSAVER_DEFAULTS.holdFrames, setSaverHoldFrames),
			numParam('transitionFrames', saverTransitionFrames, SCREENSAVER_DEFAULTS.transitionFrames, setSaverTransitionFrames),
			strParam('kind', saverKind, SCREENSAVER_DEFAULTS.kind, setSaverKind),
		],
	}

	// Setters are stable, so a ref keeps the mount/shuffle handlers off the render-scoped
	// spec without re-subscribing every keystroke.
	const urlParamsRef = useRef(urlParams)
	urlParamsRef.current = urlParams

	// Hydrate state from the query string once, after mount. generatorType is already
	// seeded from the URL by useState, so only its options and the display/FX flags remain.
	useEffect(() => {
		const type = parseGeneratorType(initialParams.get('g')) ?? DEFAULT_GENERATOR
		for (const param of urlParamsRef.current[type]) {
			const raw = initialParams.get(param.key)
			if (raw !== null) param.apply(raw)
		}
		const rawCols = initialParams.get('cols')
		if (rawCols !== null) {
			const cols = clampInt(Number(rawCols), COLUMNS_RANGE.min, COLUMNS_RANGE.max)
			if (cols !== null) setColumns(cols)
		}
		const rawRows = initialParams.get('rows')
		if (rawRows !== null) {
			const rws = clampInt(Number(rawRows), ROWS_RANGE.min, ROWS_RANGE.max)
			if (rws !== null) setRows(rws)
		}
		const rawFps = initialParams.get('fps')
		if (rawFps !== null) {
			const f = clampInt(Number(rawFps), FPS_RANGE.min, FPS_RANGE.max)
			if (f !== null) setFps(f)
		}
		if (initialParams.get('perf') !== null) setShowPerformanceOverlay(initialParams.get('perf') === '1')
		const fx = initialParams.get('fx')
		if (fx !== null) {
			const active = fx.split(',')
			setFxLens(active.includes('lens'))
			setFxScanline(active.includes('scanline'))
			setFxVhs(active.includes('vhs'))
			setFxPhosphor(active.includes('phosphor'))
			setFxChromatic(active.includes('chromatic'))
			setFxKaleido(active.includes('kaleido'))
		}
		setUrlReady(true)
	}, [initialParams])

	const search = (() => {
		const params = new URLSearchParams()
		if (generatorType !== DEFAULT_GENERATOR) params.set('g', generatorType)
		for (const param of urlParams[generatorType]) {
			if (param.value !== param.def) params.set(param.key, serializeParam(param.value))
		}
		if (columns !== VIRTUAL_DISPLAY_DEFAULTS.columns) params.set('cols', String(columns))
		if (rows !== VIRTUAL_DISPLAY_DEFAULTS.rows) params.set('rows', String(rows))
		if (fps !== VIRTUAL_DISPLAY_DEFAULTS.fps) params.set('fps', String(fps))
		if (showPerformanceOverlay) params.set('perf', '1')
		const fx = [
			fxLens ? 'lens' : '',
			fxScanline ? 'scanline' : '',
			fxVhs ? 'vhs' : '',
			fxPhosphor ? 'phosphor' : '',
			fxChromatic ? 'chromatic' : '',
			fxKaleido ? 'kaleido' : '',
		].filter(Boolean)
		if (fx.length) params.set('fx', fx.join(','))
		return params.toString()
	})()

	// Debounced so a slider drag leaves one URL behind, not sixty. replaceState keeps
	// Next's own history entry (and its router state) intact.
	useEffect(() => {
		if (!urlReady) return
		const timer = window.setTimeout(() => {
			window.history.replaceState(window.history.state, '', search ? `${pathname}?${search}` : pathname)
		}, 250)
		return () => window.clearTimeout(timer)
	}, [search, pathname, urlReady])

	// Stable per-tile click handlers: GeneratorThumb is memoized, and a fresh closure
	// every render would re-render all 27 live previews on every slider tick.
	const selectHandlers = useMemo(() => {
		const map = {} as Record<GeneratorType, () => void>
		for (const tab of TABS) map[tab.key] = () => setGeneratorType(tab.key)
		return map
	}, [])

	const shuffleGenerator = useCallback(() => {
		const pool = TABS.filter((tab) => tab.key !== generatorType)
		const next = pool[Math.floor(Math.random() * pool.length)].key
		// Land on the generator's own defaults so the shared URL stays clean.
		for (const param of urlParamsRef.current[next]) param.apply(serializeParam(param.def))
		setGeneratorType(next)
	}, [generatorType])

	// Post FX: composed left-to-right (lens -> scanline -> vhs -> phosphor -> chromatic ->
	// kaleidoscope) onto whichever generator is currently active. Memoized separately from
	// `frameGenerator` so toggling an effect alone doesn't rebuild the underlying generator,
	// and vice versa.
	const postEffects = useMemo<AnsiPostEffect[]>(() => {
		const list: AnsiPostEffect[] = []
		if (fxLens) list.push(createLensEffect())
		if (fxScanline) list.push(createScanlineEffect())
		if (fxVhs) list.push(createVhsTrackingEffect())
		if (fxPhosphor) list.push(createPhosphorPersistenceEffect())
		if (fxChromatic) list.push(createChromaticAberrationEffect())
		if (fxKaleido) list.push(createKaleidoscopeEffect())
		return list
	}, [fxLens, fxScanline, fxVhs, fxPhosphor, fxChromatic, fxKaleido])

	const composedGenerator = useMemo(() => {
		if (postEffects.length === 0 || typeof frameGenerator !== 'function') return frameGenerator
		return composeAnsiEffects(frameGenerator as CharacterFrameGenerator, postEffects)
	}, [frameGenerator, postEffects])

	const code = useMemo(() => {
		return generateGeneratorCode(
			generatorType,
			{ columns, rows, fps, showPerformanceOverlay },
			VIRTUAL_DISPLAY_DEFAULTS,
			activeGen.options,
			activeGen.defaults,
			{ lens: fxLens, scanline: fxScanline, vhs: fxVhs, phosphor: fxPhosphor, chromatic: fxChromatic, kaleidoscope: fxKaleido }
		)
	}, [generatorType, columns, rows, fps, showPerformanceOverlay, activeGen.options, activeGen.defaults, fxLens, fxScanline, fxVhs, fxPhosphor, fxChromatic, fxKaleido])

	return (
		<>
			<div className="page-header">
				<h1>Generators</h1>
				<p>Procedural frame generators rendered with AnsiVirtualDisplay</p>
			</div>
			<div className="playground">
				{/* Deliberately not `.playground-canvas`: that class forces `max-width:100%`
				    on every descendant canvas, which fights Stage's and the thumbnails' own
				    pixel-exact scaling. */}
				<div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, overflow: 'hidden', background: 'var(--bg-root)' }}>
					<div className="stack-8">
						<div className="wrap-row" style={{ justifyContent: 'space-between' }}>
							<span className="section-title" style={{ margin: 0 }}>
								Generator — <span style={{ color: 'var(--accent)' }}>{activeLabel}</span>
							</span>
							<span className="wrap-row">
								<button type="button" className="btn-sm" onClick={shuffleGenerator} title="Jump to a random generator">
									🎲 Shuffle
								</button>
								<button
									type="button"
									className="btn-sm"
									onClick={() => setPickerExpanded((v) => !v)}
									aria-expanded={pickerExpanded}
								>
									{pickerExpanded ? 'Collapse' : `Browse all ${TABS.length}`}
								</button>
							</span>
						</div>
						<div
							className={pickerExpanded ? 'gen-thumb-grid' : 'scroll-x'}
							style={pickerExpanded ? undefined : { display: 'flex', flexWrap: 'nowrap', gap: 12, paddingBottom: 4 }}
						>
							{THUMB_TILES.map((tile) => (
								<div key={tile.key} style={pickerExpanded ? undefined : { flex: '0 0 auto' }}>
									<GeneratorThumb
										generator={tile.generator}
										label={tile.label}
										selected={tile.key === generatorType}
										onClick={selectHandlers[tile.key]}
										columns={THUMB_COLUMNS}
										rows={THUMB_ROWS}
										fps={THUMB_FPS}
										width={THUMB_WIDTH}
									/>
								</div>
							))}
						</div>
					</div>
					<Stage style={{ ['--stage-height' as string]: 'clamp(280px, calc(100vh - 300px), 900px)' } as React.CSSProperties}>
						<AnsiVirtualDisplay
							columns={columns}
							rows={rows}
							fps={fps}
							frameGenerator={composedGenerator}
							showPerformanceOverlay={showPerformanceOverlay}
						/>
					</Stage>
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

					<ControlGroup label="Post FX">
						<ToggleInput label="Lens" value={fxLens} onChange={setFxLens} />
						<ToggleInput label="Scanline" value={fxScanline} onChange={setFxScanline} />
						<ToggleInput label="VHS Tracking" value={fxVhs} onChange={setFxVhs} />
						<ToggleInput label="Phosphor Trails" value={fxPhosphor} onChange={setFxPhosphor} />
						<ToggleInput label="Chromatic Aberration" value={fxChromatic} onChange={setFxChromatic} />
						<ToggleInput label="Kaleidoscope" value={fxKaleido} onChange={setFxKaleido} />
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

					{generatorType === 'copperBars' && (
						<CopperBarsPanel
							barCount={copperBarCount} setBarCount={setCopperBarCount}
							barHeight={copperBarHeight} setBarHeight={setCopperBarHeight}
							speed={copperSpeed} setSpeed={setCopperSpeed}
							bgColor={copperBgColor} setBgColor={setCopperBgColor}
							chars={copperChars} setChars={setCopperChars}
							seed={copperSeed} setSeed={setCopperSeed}
						/>
					)}

					{generatorType === 'crtStatic' && (
						<CrtStaticPanel
							signalStrength={crtSignalStrength} setSignalStrength={setCrtSignalStrength}
							scanlineIntensity={crtScanlineIntensity} setScanlineIntensity={setCrtScanlineIntensity}
							tearFrequency={crtTearFrequency} setTearFrequency={setCrtTearFrequency}
							rollingBarSpeed={crtRollingBarSpeed} setRollingBarSpeed={setCrtRollingBarSpeed}
							vhsMode={crtVhsMode} setVhsMode={setCrtVhsMode}
							bgColor={crtBgColor} setBgColor={setCrtBgColor}
							chars={crtChars} setChars={setCrtChars}
							seed={crtSeed} setSeed={setCrtSeed}
						/>
					)}

					{generatorType === 'auroraBorealis' && (
						<AuroraBorealisPanel
							curtainCount={auroraCurtainCount} setCurtainCount={setAuroraCurtainCount}
							speed={auroraSpeed} setSpeed={setAuroraSpeed}
							intensity={auroraIntensity} setIntensity={setAuroraIntensity}
							bgColor={auroraBgColor} setBgColor={setAuroraBgColor}
							chars={auroraChars} setChars={setAuroraChars}
							seed={auroraSeed} setSeed={setAuroraSeed}
						/>
					)}

					{generatorType === 'reactionDiffusion' && (
						<ReactionDiffusionPanel
							feedRate={rdFeedRate} setFeedRate={setRdFeedRate}
							killRate={rdKillRate} setKillRate={setRdKillRate}
							diffusionU={rdDiffusionU} setDiffusionU={setRdDiffusionU}
							diffusionV={rdDiffusionV} setDiffusionV={setRdDiffusionV}
							stepsPerFrame={rdStepsPerFrame} setStepsPerFrame={setRdStepsPerFrame}
							colorMode={rdColorMode} setColorMode={setRdColorMode}
							fgColor={rdFgColor} setFgColor={setRdFgColor}
							bgColor={rdBgColor} setBgColor={setRdBgColor}
							chars={rdChars} setChars={setRdChars}
							seed={rdSeed} setSeed={setRdSeed}
						/>
					)}

					{generatorType === 'terrainFlyover' && (
						<TerrainFlyoverPanel
							scrollSpeed={terrainScrollSpeed} setScrollSpeed={setTerrainScrollSpeed}
							heightScale={terrainHeightScale} setHeightScale={setTerrainHeightScale}
							fogDistance={terrainFogDistance} setFogDistance={setTerrainFogDistance}
							colorMode={terrainColorMode} setColorMode={setTerrainColorMode}
							fgColor={terrainFgColor} setFgColor={setTerrainFgColor}
							bgColor={terrainBgColor} setBgColor={setTerrainBgColor}
							skyColor={terrainSkyColor} setSkyColor={setTerrainSkyColor}
							chars={terrainChars} setChars={setTerrainChars}
							seed={terrainSeed} setSeed={setTerrainSeed}
						/>
					)}

					{generatorType === 'rotozoomer' && (
						<RotozoomerPanel
							rotationSpeed={rotoRotationSpeed} setRotationSpeed={setRotoRotationSpeed}
							zoomSpeed={rotoZoomSpeed} setZoomSpeed={setRotoZoomSpeed}
							baseZoom={rotoBaseZoom} setBaseZoom={setRotoBaseZoom}
							pattern={rotoPattern} setPattern={setRotoPattern}
							bgColor={rotoBgColor} setBgColor={setRotoBgColor}
						/>
					)}

					{generatorType === 'moire' && (
						<MoirePanel
							ringWidth={moireRingWidth} setRingWidth={setMoireRingWidth}
							speed1={moireSpeed1} setSpeed1={setMoireSpeed1}
							speed2={moireSpeed2} setSpeed2={setMoireSpeed2}
							paletteSpeed={moirePaletteSpeed} setPaletteSpeed={setMoirePaletteSpeed}
							bgColor={moireBgColor} setBgColor={setMoireBgColor}
						/>
					)}

					{generatorType === 'kefrensBars' && (
						<KefrensBarsPanel
							barWidth={kefrensBarWidth} setBarWidth={setKefrensBarWidth}
							hueSpeed={kefrensHueSpeed} setHueSpeed={setKefrensHueSpeed}
							hueRowStep={kefrensHueRowStep} setHueRowStep={setKefrensHueRowStep}
							bgColor={kefrensBgColor} setBgColor={setKefrensBgColor}
							chars={kefrensChars} setChars={setKefrensChars}
						/>
					)}

					{generatorType === 'twister' && (
						<TwisterPanel
							rotationSpeed={twisterRotationSpeed} setRotationSpeed={setTwisterRotationSpeed}
							waveFreq={twisterWaveFreq} setWaveFreq={setTwisterWaveFreq}
							waveSpeed={twisterWaveSpeed} setWaveSpeed={setTwisterWaveSpeed}
							waveDepth={twisterWaveDepth} setWaveDepth={setTwisterWaveDepth}
							bgColor={twisterBgColor} setBgColor={setTwisterBgColor}
						/>
					)}

					{generatorType === 'sineScroller' && (
						<SineScrollerPanel
							text={scrollerText} setText={setScrollerText}
							speed={scrollerSpeed} setSpeed={setScrollerSpeed}
							amplitude={scrollerAmplitude} setAmplitude={setScrollerAmplitude}
							waveSpeed={scrollerWaveSpeed} setWaveSpeed={setScrollerWaveSpeed}
							fgColor={scrollerFgColor} setFgColor={setScrollerFgColor}
							bgColor={scrollerBgColor} setBgColor={setScrollerBgColor}
						/>
					)}

					{generatorType === 'boingBall' && (
						<BoingBallPanel
							scale={boingScale} setScale={setBoingScale}
							bounceSpeed={boingBounceSpeed} setBounceSpeed={setBoingBounceSpeed}
							driftSpeed={boingDriftSpeed} setDriftSpeed={setBoingDriftSpeed}
							checkerDensity={boingCheckerDensity} setCheckerDensity={setBoingCheckerDensity}
							ballRedColor={boingBallRedColor} setBallRedColor={setBoingBallRedColor}
							bgColor={boingBgColor} setBgColor={setBoingBgColor}
						/>
					)}

					{generatorType === 'cyclicAutomaton' && (
						<CyclicAutomatonPanel
							states={cyclicStates} setStates={setCyclicStates}
							threshold={cyclicThreshold} setThreshold={setCyclicThreshold}
							neighborhood={cyclicNeighborhood} setNeighborhood={setCyclicNeighborhood}
							saturation={cyclicSaturation} setSaturation={setCyclicSaturation}
							lightness={cyclicLightness} setLightness={setCyclicLightness}
							seed={cyclicSeed} setSeed={setCyclicSeed}
						/>
					)}

					{generatorType === 'fallingSand' && (
						<FallingSandPanel
							spoutCount={sandSpoutCount} setSpoutCount={setSandSpoutCount}
							spoutRate={sandSpoutRate} setSpoutRate={setSandSpoutRate}
							drainOpenThreshold={sandDrainOpenThreshold} setDrainOpenThreshold={setSandDrainOpenThreshold}
							wallColor={sandWallColor} setWallColor={setSandWallColor}
							bgColor={sandBgColor} setBgColor={setSandBgColor}
							seed={sandSeed} setSeed={setSandSeed}
						/>
					)}

					{generatorType === 'bumpMapping' && (
						<BumpMappingPanel
							noiseScale={bumpNoiseScale} setNoiseScale={setBumpNoiseScale}
							orbitSpeed={bumpOrbitSpeed} setOrbitSpeed={setBumpOrbitSpeed}
							lightHeight={bumpLightHeight} setLightHeight={setBumpLightHeight}
							bumpStrength={bumpBumpStrength} setBumpStrength={setBumpBumpStrength}
							specularPower={bumpSpecularPower} setSpecularPower={setBumpSpecularPower}
							bgColor={bumpBgColor} setBgColor={setBumpBgColor}
						/>
					)}

					{generatorType === 'julia' && (
						<JuliaPanel
							maxIter={juliaMaxIter} setMaxIter={setJuliaMaxIter}
							morphSpeed={juliaMorphSpeed} setMorphSpeed={setJuliaMorphSpeed}
							radius={juliaRadius} setRadius={setJuliaRadius}
							colorMode={juliaColorMode} setColorMode={setJuliaColorMode}
							fgColor={juliaFgColor} setFgColor={setJuliaFgColor}
							bgColor={juliaBgColor} setBgColor={setJuliaBgColor}
						/>
					)}

					{generatorType === 'boids' && (
						<BoidsPanel
							count={boidsCount} setCount={setBoidsCount}
							sepWeight={boidsSepWeight} setSepWeight={setBoidsSepWeight}
							alignWeight={boidsAlignWeight} setAlignWeight={setBoidsAlignWeight}
							cohWeight={boidsCohWeight} setCohWeight={setBoidsCohWeight}
							headColor={boidsHeadColor} setHeadColor={setBoidsHeadColor}
							bgColor={boidsBgColor} setBgColor={setBoidsBgColor}
						/>
					)}

					{generatorType === 'donut' && (
						<DonutPanel
							speedA={donutSpeedA} setSpeedA={setDonutSpeedA}
							speedB={donutSpeedB} setSpeedB={setDonutSpeedB}
							size={donutSize} setSize={setDonutSize}
							tubeRatio={donutTubeRatio} setTubeRatio={setDonutTubeRatio}
							baseColor={donutBaseColor} setBaseColor={setDonutBaseColor}
							bgColor={donutBgColor} setBgColor={setDonutBgColor}
						/>
					)}

					{generatorType === 'wireframe' && (
						<WireframePanel
							shape={wireframeShape} setShape={setWireframeShape}
							size={wireframeSize} setSize={setWireframeSize}
							speedX={wireframeSpeedX} setSpeedX={setWireframeSpeedX}
							speedY={wireframeSpeedY} setSpeedY={setWireframeSpeedY}
							speedZ={wireframeSpeedZ} setSpeedZ={setWireframeSpeedZ}
							edgeColor={wireframeEdgeColor} setEdgeColor={setWireframeEdgeColor}
							vertexColor={wireframeVertexColor} setVertexColor={setWireframeVertexColor}
							depthShading={wireframeDepthShading} setDepthShading={setWireframeDepthShading}
							bgColor={wireframeBgColor} setBgColor={setWireframeBgColor}
						/>
					)}

					{generatorType === 'shadebobs' && (
						<ShadebobsPanel
							bobCount={shadebobsBobCount} setBobCount={setShadebobsBobCount}
							bobSize={shadebobsBobSize} setBobSize={setShadebobsBobSize}
							trailDecay={shadebobsTrailDecay} setTrailDecay={setShadebobsTrailDecay}
							speed={shadebobsSpeed} setSpeed={setShadebobsSpeed}
							seed={shadebobsSeed} setSeed={setShadebobsSeed}
							bgColor={shadebobsBgColor} setBgColor={setShadebobsBgColor}
						/>
					)}

					{generatorType === 'munchingSquares' && (
						<MunchingSquaresPanel
							speed={munchSpeed} setSpeed={setMunchSpeed}
							size={munchSize} setSize={setMunchSize}
							invert={munchInvert} setInvert={setMunchInvert}
							bgColor={munchBgColor} setBgColor={setMunchBgColor}
						/>
					)}

					{generatorType === 'fireworks' && (
						<FireworksPanel
							launchInterval={fireworksLaunchInterval} setLaunchInterval={setFireworksLaunchInterval}
							riseFrames={fireworksRiseFrames} setRiseFrames={setFireworksRiseFrames}
							burstDuration={fireworksBurstDuration} setBurstDuration={setFireworksBurstDuration}
							particleCount={fireworksParticleCount} setParticleCount={setFireworksParticleCount}
							gravity={fireworksGravity} setGravity={setFireworksGravity}
							nightSky={fireworksNightSky} setNightSky={setFireworksNightSky}
							seed={fireworksSeed} setSeed={setFireworksSeed}
							bgColor={fireworksBgColor} setBgColor={setFireworksBgColor}
						/>
					)}

					{generatorType === 'aquarium' && (
						<AquariumPanel
							fishCount={aquariumFishCount} setFishCount={setAquariumFishCount}
							bubbleDensity={aquariumBubbleDensity} setBubbleDensity={setAquariumBubbleDensity}
							seaweedDensity={aquariumSeaweedDensity} setSeaweedDensity={setAquariumSeaweedDensity}
							swaySpeed={aquariumSwaySpeed} setSwaySpeed={setAquariumSwaySpeed}
							speed={aquariumSpeed} setSpeed={setAquariumSpeed}
							seed={aquariumSeed} setSeed={setAquariumSeed}
							bgColor={aquariumBgColor} setBgColor={setAquariumBgColor}
						/>
					)}

					{generatorType === 'physarum' && (
						<PhysarumPanel
							agentDensity={physarumAgentDensity} setAgentDensity={setPhysarumAgentDensity}
							sensorAngle={physarumSensorAngle} setSensorAngle={setPhysarumSensorAngle}
							sensorDistance={physarumSensorDistance} setSensorDistance={setPhysarumSensorDistance}
							turnSpeed={physarumTurnSpeed} setTurnSpeed={setPhysarumTurnSpeed}
							evaporation={physarumEvaporation} setEvaporation={setPhysarumEvaporation}
							stepsPerFrame={physarumStepsPerFrame} setStepsPerFrame={setPhysarumStepsPerFrame}
							seed={physarumSeed} setSeed={setPhysarumSeed}
							bgColor={physarumBgColor} setBgColor={setPhysarumBgColor}
						/>
					)}

					{generatorType === 'sandpile' && (
						<SandpilePanel
							grainsPerStep={sandpileGrainsPerStep} setGrainsPerStep={setSandpileGrainsPerStep}
							stepsPerFrame={sandpileStepsPerFrame} setStepsPerFrame={setSandpileStepsPerFrame}
							maxToppleSweeps={sandpileMaxToppleSweeps} setMaxToppleSweeps={setSandpileMaxToppleSweeps}
							dropX={sandpileDropX} setDropX={setSandpileDropX}
							dropY={sandpileDropY} setDropY={setSandpileDropY}
							bgColor={sandpileBgColor} setBgColor={setSandpileBgColor}
						/>
					)}

					{generatorType === 'screensaver' && (
						<ScreensaverPanel
							holdFrames={saverHoldFrames} setHoldFrames={setSaverHoldFrames}
							transitionFrames={saverTransitionFrames} setTransitionFrames={setSaverTransitionFrames}
							kind={saverKind} setKind={setSaverKind}
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
