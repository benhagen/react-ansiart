function serializeValue(value: unknown): string {
	if (typeof value === 'string') return `"${value}"`
	if (typeof value === 'boolean') return String(value)
	if (typeof value === 'number') return String(value)
	if (Array.isArray(value)) {
		if (value.length === 0) return '[]'
		if (typeof value[0] === 'object') {
			const items = value.map(
				(v) => `{ ${Object.entries(v).map(([k, val]) => `${k}: ${val}`).join(', ')} }`
			)
			return `[\n    ${items.join(',\n    ')}\n  ]`
		}
		return `[${value.map(serializeValue).join(', ')}]`
	}
	if (typeof value === 'object' && value !== null) {
		const entries = Object.entries(value).map(([k, v]) => `${k}: ${serializeValue(v)}`)
		return `{ ${entries.join(', ')} }`
	}
	return String(value)
}

function propsToAttributes(
	props: Record<string, unknown>,
	defaults: Record<string, unknown>
): string[] {
	const attrs: string[] = []
	for (const [key, value] of Object.entries(props)) {
		if (value === undefined || value === null) continue
		const def = defaults[key]
		if (JSON.stringify(value) === JSON.stringify(def)) continue
		if (typeof value === 'boolean') {
			attrs.push(value ? key : `${key}={false}`)
		} else if (typeof value === 'string') {
			attrs.push(`${key}="${value}"`)
		} else {
			attrs.push(`${key}={${serializeValue(value)}}`)
		}
	}
	return attrs
}

export function generateComponentCode(
	componentName: string,
	importPath: string,
	props: Record<string, unknown>,
	defaults: Record<string, unknown>,
	children?: string
): string {
	const attrs = propsToAttributes(props, defaults)
	const attrStr = attrs.length > 0 ? `\n  ${attrs.join('\n  ')}\n` : ''

	let jsx: string
	if (children) {
		jsx = `<${componentName}${attrStr}>\n  ${children}\n</${componentName}>`
	} else {
		jsx = `<${componentName}${attrStr}/>`
	}

	return `import { ${componentName} } from '${importPath}'\n\n${jsx}`
}

export function generateGeneratorCode(
	generatorType: string,
	displayProps: Record<string, unknown>,
	displayDefaults: Record<string, unknown>,
	generatorOptions: Record<string, unknown>,
	generatorDefaults: Record<string, unknown>,
	effects?: { lens: boolean; scanline: boolean; vhs: boolean; phosphor: boolean; chromatic: boolean; kaleidoscope: boolean }
): string {
	if (generatorType === 'screensaver') {
		return generateScreensaverCode(displayProps, displayDefaults, generatorOptions, generatorDefaults, effects)
	}

	const generatorMap: Record<string, { fn: string; type: string }> = {
		perlinPlasma: { fn: 'generateAsciiPerlinPlasmaFrame', type: 'AsciiPerlinPlasmaOptions' },
		fire: { fn: 'generateAsciiFireFrame', type: 'AsciiFireOptions' },
		sonar: { fn: 'generateAsciiSonarFrame', type: 'AsciiSonarOptions' },
		datamosh: { fn: 'generateAsciiDatamoshFrame', type: 'AsciiDatamoshOptions' },
		metaballs: { fn: 'generateAsciiMetaballsFrame', type: 'AsciiMetaballsOptions' },
		matrix: { fn: 'generateAsciiMatrixRainFrame', type: 'AsciiMatrixRainOptions' },
		starfield: { fn: 'generateAsciiStarfieldFrame', type: 'AsciiStarfieldOptions' },
		tunnel: { fn: 'generateAsciiTunnelFrame', type: 'AsciiTunnelOptions' },
		gameOfLife: { fn: 'generateAsciiGameOfLifeFrame', type: 'AsciiGameOfLifeOptions' },
		waterRipple: { fn: 'generateAsciiWaterRippleFrame', type: 'AsciiWaterRippleOptions' },
		mandelbrot: { fn: 'generateAsciiMandelbrotFrame', type: 'AsciiMandelbrotOptions' },
		copperBars: { fn: 'generateAsciiCopperBarsFrame', type: 'AsciiCopperBarsOptions' },
		crtStatic: { fn: 'generateAsciiCrtStaticFrame', type: 'AsciiCrtStaticOptions' },
		auroraBorealis: { fn: 'generateAsciiAuroraBorealisFrame', type: 'AsciiAuroraBorealisOptions' },
		reactionDiffusion: { fn: 'generateAsciiReactionDiffusionFrame', type: 'AsciiReactionDiffusionOptions' },
		terrainFlyover: { fn: 'generateAsciiTerrainFlyoverFrame', type: 'AsciiTerrainFlyoverOptions' },
		rotozoomer: { fn: 'generateAsciiRotozoomerFrame', type: 'AsciiRotozoomerOptions' },
		moire: { fn: 'generateAsciiMoireFrame', type: 'AsciiMoireOptions' },
		kefrensBars: { fn: 'generateAsciiKefrensBarsFrame', type: 'AsciiKefrensBarsOptions' },
		twister: { fn: 'generateAsciiTwisterFrame', type: 'AsciiTwisterOptions' },
		sineScroller: { fn: 'generateAsciiSineScrollerFrame', type: 'AsciiSineScrollerOptions' },
		boingBall: { fn: 'generateAsciiBoingBallFrame', type: 'AsciiBoingBallOptions' },
		cyclicAutomaton: { fn: 'generateAsciiCyclicAutomatonFrame', type: 'AsciiCyclicAutomatonOptions' },
		fallingSand: { fn: 'generateAsciiFallingSandFrame', type: 'AsciiFallingSandOptions' },
		bumpMapping: { fn: 'generateAsciiBumpMappingFrame', type: 'AsciiBumpMappingOptions' },
		julia: { fn: 'generateAsciiJuliaFrame', type: 'AsciiJuliaOptions' },
		boids: { fn: 'generateAsciiBoidsFrame', type: 'AsciiBoidsOptions' },
		donut: { fn: 'generateAsciiDonutFrame', type: 'AsciiDonutOptions' },
		wireframe: { fn: 'generateAsciiWireframeFrame', type: 'AsciiWireframeOptions' },
		shadebobs: { fn: 'generateAsciiShadebobsFrame', type: 'AsciiShadebobsOptions' },
		munchingSquares: { fn: 'generateAsciiMunchingSquaresFrame', type: 'AsciiMunchingSquaresOptions' },
		fireworks: { fn: 'generateAsciiFireworksFrame', type: 'AsciiFireworksOptions' },
		aquarium: { fn: 'generateAsciiAquariumFrame', type: 'AsciiAquariumOptions' },
		physarum: { fn: 'generateAsciiPhysarumFrame', type: 'AsciiPhysarumOptions' },
		sandpile: { fn: 'generateAsciiSandpileFrame', type: 'AsciiSandpileOptions' },
	}

	const gen = generatorMap[generatorType]
	if (!gen) return '// Unknown generator type'

	const optionAttrs: string[] = []
	for (const [key, value] of Object.entries(generatorOptions)) {
		if (value === undefined || value === null || value === '') continue
		const def = generatorDefaults[key]
		if (JSON.stringify(value) === JSON.stringify(def)) continue
		optionAttrs.push(`    ${key}: ${serializeValue(value)},`)
	}

	const optionsBlock = optionAttrs.length > 0
		? `const options: ${gen.type} = {\n${optionAttrs.join('\n')}\n  }\n\n  `
		: ''

	const optionsArg = optionAttrs.length > 0 ? ', options' : ''

	const displayAttrs = propsToAttributes(displayProps, displayDefaults)
	const displayAttrStr = displayAttrs.length > 0 ? `\n    ${displayAttrs.join('\n    ')}\n    ` : ' '

	const effectFactories = collectEffectFactories(effects)
	const hasEffects = effectFactories.length > 0

	const imports = [gen.fn, 'AnsiVirtualDisplay']
	if (optionAttrs.length > 0) imports.push(gen.type)
	if (hasEffects) imports.push('composeAnsiEffects', ...effectFactories.map((f) => f.slice(0, -2)))

	const baseGenerator = `(frame: number, cols: number, rows: number) =>\n      ${gen.fn}(frame, cols, rows${optionsArg})`
	const generatorExpr = hasEffects
		? `composeAnsiEffects(\n      ${baseGenerator},\n      ${effectFactories.join(', ')}\n    )`
		: baseGenerator

	return `import { useMemo } from 'react'
import { ${imports.join(', ')} } from 'react-ansiart'

function MyComponent() {
  ${optionsBlock}const frameGenerator = useMemo(() => {
    return ${generatorExpr}
  }, [])

  return (
    <AnsiVirtualDisplay${displayAttrStr}frameGenerator={frameGenerator}
    />
  )
}`
}

function collectEffectFactories(
	effects?: { lens: boolean; scanline: boolean; vhs: boolean; phosphor: boolean; chromatic: boolean; kaleidoscope: boolean }
): string[] {
	const effectFactories: string[] = []
	if (effects?.lens) effectFactories.push('createLensEffect()')
	if (effects?.scanline) effectFactories.push('createScanlineEffect()')
	if (effects?.vhs) effectFactories.push('createVhsTrackingEffect()')
	if (effects?.phosphor) effectFactories.push('createPhosphorPersistenceEffect()')
	if (effects?.chromatic) effectFactories.push('createChromaticAberrationEffect()')
	if (effects?.kaleidoscope) effectFactories.push('createKaleidoscopeEffect()')
	return effectFactories
}

// Hand-written snippet: the screensaver is a cycle over other generators rather than a
// single generateAscii*Frame call, so the generatorMap template doesn't fit.
function generateScreensaverCode(
	displayProps: Record<string, unknown>,
	displayDefaults: Record<string, unknown>,
	generatorOptions: Record<string, unknown>,
	generatorDefaults: Record<string, unknown>,
	effects?: { lens: boolean; scanline: boolean; vhs: boolean; phosphor: boolean; chromatic: boolean; kaleidoscope: boolean }
): string {
	const cycleAttrs = [
		`      holdFrames: ${serializeValue(generatorOptions.holdFrames)},`,
		`      transitionFrames: ${serializeValue(generatorOptions.transitionFrames)},`,
	]
	if (generatorOptions.kind !== undefined && generatorOptions.kind !== generatorDefaults.kind) {
		cycleAttrs.push(`      kind: ${serializeValue(generatorOptions.kind)},`)
	}

	const displayAttrs = propsToAttributes(displayProps, displayDefaults)
	const displayAttrStr = displayAttrs.length > 0 ? `\n    ${displayAttrs.join('\n    ')}\n    ` : ' '

	const effectFactories = collectEffectFactories(effects)
	const hasEffects = effectFactories.length > 0

	const imports = [
		'createAnsiGeneratorCycle',
		'createAsciiFireGenerator',
		'createAsciiMatrixRainGenerator',
		'generateAsciiDonutFrame',
		'generateAsciiPerlinPlasmaFrame',
		'generateAsciiTunnelFrame',
		'AnsiVirtualDisplay',
	]
	if (hasEffects) imports.push('composeAnsiEffects', ...effectFactories.map((f) => f.slice(0, -2)))

	const returnExpr = hasEffects
		? `composeAnsiEffects(\n      screensaver,\n      ${effectFactories.join(', ')}\n    )`
		: 'screensaver'

	return `import { useMemo } from 'react'
import { ${imports.join(', ')} } from 'react-ansiart'

function MyComponent() {
  const frameGenerator = useMemo(() => {
    const screensaver = createAnsiGeneratorCycle([
      (frame: number, cols: number, rows: number) => generateAsciiDonutFrame(frame, cols, rows),
      (frame: number, cols: number, rows: number) => generateAsciiPerlinPlasmaFrame(frame, cols, rows),
      (frame: number, cols: number, rows: number) => generateAsciiTunnelFrame(frame, cols, rows),
      createAsciiFireGenerator(),
      createAsciiMatrixRainGenerator(),
    ], {
${cycleAttrs.join('\n')}
    })
    return ${returnExpr}
  }, [])

  return (
    <AnsiVirtualDisplay${displayAttrStr}frameGenerator={frameGenerator}
    />
  )
}`
}
