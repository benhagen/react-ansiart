export const ANSI_ART_DEFAULTS = {
	src: '/ansi/example.ans',
	mode: 'final' as const,
	columns: 80 as number | 'auto',
	rows: 'auto' as number | 'auto',
	showOverlayControls: false,
	showPerformanceOverlay: false,
	sauceOverlay: false,
	fps: 30,
	bytesPerSecond: 960,
	autoStart: true,
	allowDrop: true,
}

export const VIRTUAL_DISPLAY_DEFAULTS = {
	columns: 80,
	rows: 25,
	fps: 30,
	showPerformanceOverlay: false,
}

export const PLASMA_BG_DEFAULTS = {
	mode: 'fixed' as const,
	generatorType: 'plasma' as const,
	fps: 30,
	showPerformanceOverlay: false,
	fgColor: '',
	bgColor: '',
}

export const PLASMA_DEFAULTS = {
	chars: 'QB$8@0#2*+:,\u00f9\u00fa      ',
	timeScale: 0.9,
	fgColor: '#55FFFF',
	bgColor: '#000000',
	seed: 12345,
	octaves: [
		{ scale: 0.02, amplitude: 1.0, timeScaleX: -1.0, timeScaleY: -0.5 },
		{ scale: 0.04, amplitude: 1.0, timeScaleX: -0.5, timeScaleY: -0.3 },
	],
}

export const FIRE_DEFAULTS = {
	chars: ' .:;+=xX$&#@',
	darkenAmount: 0.5,
	sparkMin: 200,
	sparkMax: 255,
	bgColor: '#000000',
	seed: 12345,
}

export const SONAR_DEFAULTS = {
	frequency: 0.9,
	intensity: 1.0,
	fgColor: '#ffffff',
	bgColor: '#000000',
	dotChar: '.',
	speed: 14,
	bandWidth: 1.25,
	decay: 0.75,
	baseAlpha: 0.03,
	alphaSteps: 32,
	centerX: '',
	centerY: '',
	aspectY: 2,
	maxRings: 24,
}

export const DATAMOSH_DEFAULTS = {
	seed: 1337,
	keyframeIntervalFrames: 24,
	blockOpsPerFrame: 10,
	minBlockSize: 3,
	maxBlockSize: 18,
	maxShift: 12,
	bgColor: '#000000',
}

export const MATRIX_DEFAULTS = {
	speed: 0.5,
	density: 0.7,
	trailLength: 15,
	headColor: '#ffffff',
	trailColor: '#00ff44',
	bgColor: '#000000',
	chars: 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789:."=*+-<>',
	seed: 7331,
}

export const STARFIELD_DEFAULTS = {
	stars: 200,
	speed: 0.02,
	fgColor: '#ffffff',
	bgColor: '#000000',
	chars: '·.+*#@',
	seed: 4242,
	streaks: true,
}

export const TUNNEL_DEFAULTS = {
	speed: 0.08,
	rotationSpeed: 0.01,
	tiles: 8,
	fgColor: '#00ffaa',
	bgColor: '#000000',
	chars: ' .:-=+*#%@',
	aspectY: 2,
}

export const GAME_OF_LIFE_DEFAULTS = {
	density: 0.3,
	fgColor: '#55ff55',
	bgColor: '#000000',
	seed: 9999,
	autoSeed: true,
	autoSeedThreshold: 0.05,
}

export const WATER_RIPPLE_DEFAULTS = {
	damping: 0.97,
	dropFrequency: 15,
	dropStrength: 255,
	fgColor: '#4488ff',
	bgColor: '#000011',
	chars: ' ·:~=@',
	seed: 5555,
}

export const MANDELBROT_DEFAULTS = {
	maxIter: 64,
	zoomSpeed: 0.02,
	zoomX: -0.7435,
	zoomY: 0.1314,
	initialZoom: 0.5,
	fgColor: '#ff8800',
	bgColor: '#000000',
	chars: ' .:-=+*#%@',
	aspectY: 2,
	colorMode: 'spectrum' as const,
}

export const COPPER_BARS_DEFAULTS = {
	barCount: 5,
	barHeight: 6,
	speed: 0.04,
	bgColor: '#000000',
	chars: ' .·:+=# @',
	seed: 7777,
}

export const CRT_STATIC_DEFAULTS = {
	signalStrength: 0.3,
	scanlineIntensity: 0.3,
	tearFrequency: 0.08,
	rollingBarSpeed: 0.02,
	vhsMode: false,
	bgColor: '#000000',
	chars: ' .·-:+=%#@',
	seed: 4242,
}

export const AURORA_BOREALIS_DEFAULTS = {
	curtainCount: 4,
	speed: 0.015,
	intensity: 1.0,
	bgColor: '#000008',
	chars: '  .·:~=+*#@',
	seed: 3333,
}

export const REACTION_DIFFUSION_DEFAULTS = {
	feedRate: 0.055,
	killRate: 0.062,
	diffusionU: 1.0,
	diffusionV: 0.5,
	stepsPerFrame: 8,
	colorMode: 'spectrum' as const,
	fgColor: '#55ffaa',
	bgColor: '#000000',
	chars: '  .·:;+=xX$#@',
	seed: 9876,
}

export const TERRAIN_FLYOVER_DEFAULTS = {
	scrollSpeed: 0.3,
	heightScale: 0.4,
	fogDistance: 0.7,
	colorMode: 'biome' as const,
	fgColor: '#88cc88',
	bgColor: '#000011',
	skyColor: '#000022',
	chars: ' .·:;=+xX%#@',
	seed: 54321,
}

export const METABALLS_DEFAULTS = {
	seed: 1337,
	balls: 6,
	speed: 0.085,
	radiusMin: 2.5,
	radiusMax: 9.5,
	intensity: 0.55,
	aspectY: 2,
	fgColor: '#55FFFF',
	bgColor: '#000000',
	chars: ' .,:;+=xX$&#@',
}

export const ROTOZOOMER_DEFAULTS = {
	rotationSpeed: 0.035,
	zoomSpeed: 0.02,
	baseZoom: 1.0,
	pattern: 'checker' as const,
	bgColor: '#000000',
}

export const MOIRE_DEFAULTS = {
	ringWidth: 6,
	speed1: 0.015,
	speed2: 0.023,
	paletteSpeed: 0.01,
	bgColor: '#000000',
}

export const KEFRENS_BARS_DEFAULTS = {
	barWidth: 7,
	hueSpeed: 0.15,
	hueRowStep: 0.4,
	bgColor: '#000000',
	chars: '█▓▒░',
}

export const TWISTER_DEFAULTS = {
	rotationSpeed: 0.05,
	waveFreq: 0.25,
	waveSpeed: 0.04,
	waveDepth: 0.6,
	bgColor: '#000000',
}

export const SINE_SCROLLER_DEFAULTS = {
	text: 'REACT-ANSIART ♦ GREETINGS TO THE SCENE ♦ ',
	speed: 1.5,
	amplitude: 3,
	waveSpeed: 0.06,
	fgColor: '',
	bgColor: '#000000',
}

export const BOING_BALL_DEFAULTS = {
	scale: 1,
	bounceSpeed: 0.15,
	driftSpeed: 0.045,
	checkerDensity: 8,
	ballRedColor: '#cc2222',
	bgColor: '#c9c9cf',
}

export const CYCLIC_AUTOMATON_DEFAULTS = {
	states: 10,
	threshold: 1,
	neighborhood: 'moore' as const,
	saturation: 0.75,
	lightness: 0.5,
	seed: 1337,
}

export const FALLING_SAND_DEFAULTS = {
	spoutCount: 3,
	spoutRate: 0.55,
	drainOpenThreshold: 0.55,
	wallColor: '#5c5c6b',
	bgColor: '#0a0a12',
	seed: 424242,
}

export const BUMP_MAPPING_DEFAULTS = {
	noiseScale: 0.15,
	orbitSpeed: 0.05,
	lightHeight: 6,
	bumpStrength: 6,
	specularPower: 12,
	bgColor: '#050302',
}

export const JULIA_DEFAULTS = {
	maxIter: 64,
	morphSpeed: 0.015,
	radius: 0.7885,
	colorMode: 'spectrum' as const,
	fgColor: '#00ccff',
	bgColor: '#000000',
}

export const BOIDS_DEFAULTS = {
	count: 60,
	sepWeight: 1.4,
	alignWeight: 1.0,
	cohWeight: 0.8,
	headColor: '#eafcff',
	bgColor: '#000006',
}
