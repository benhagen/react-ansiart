import { defineConfig } from 'tsup'

export default defineConfig({
	entry: {
		index: 'src/index.ts',
		// Components
		'components/AnsiArt': 'src/components/AnsiArt.tsx',
		'components/AnsiVirtualDisplay': 'src/components/AnsiVirtualDisplay.tsx',
		'components/AnsiPlayerOverlay': 'src/components/AnsiPlayerOverlay.tsx',
		'components/PlasmaBackgroundLayout': 'src/components/PlasmaBackgroundLayout.tsx',
		'components/FontCharacterChart': 'src/components/FontCharacterChart.tsx',
		// Generators
		'generators/plasma': 'src/generators/asciiPerlinPlasmaGenerator.ts',
		'generators/fire': 'src/generators/asciiFireGenerator.ts',
		'generators/sonar': 'src/generators/asciiSonarFrameGenerator.ts',
		'generators/datamosh': 'src/generators/asciiDatamoshGenerator.ts',
		'generators/metaballs': 'src/generators/asciiMetaballsGenerator.ts',
		'generators/ansiFrame': 'src/generators/ansiFrameGenerator.ts',
		// Core
		'ansi/parser': 'src/ansi/parser.ts',
		'ansi/types': 'src/ansi/types.ts',
		'ansi/frameToAnsi': 'src/ansi/frameToAnsi.ts',
		// Font
		'font/bitmapFont': 'src/font/bitmapFont.ts',
		'font/bitmapFontLoader': 'src/font/bitmapFontLoader.ts',
		'font/embeddedVgaFont': 'src/font/embeddedVgaFont.ts',
		// Utils
		'utils/sauce': 'src/utils/sauce.ts',
		'utils/rgbToAnsi': 'src/utils/rgbToAnsi.ts',
		// Types
		'types/types': 'src/types/types.ts',
	},
	format: ['esm'],
	dts: true,
	splitting: true,
	sourcemap: true,
	clean: true,
	external: ['react'],
})
