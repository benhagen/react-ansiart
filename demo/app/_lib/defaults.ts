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
