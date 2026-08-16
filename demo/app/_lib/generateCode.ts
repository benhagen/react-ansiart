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
	effects?: { lens: boolean; scanline: boolean; vhs: boolean }
): string {
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

	const effectFactories: string[] = []
	if (effects?.lens) effectFactories.push('createLensEffect()')
	if (effects?.scanline) effectFactories.push('createScanlineEffect()')
	if (effects?.vhs) effectFactories.push('createVhsTrackingEffect()')
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
