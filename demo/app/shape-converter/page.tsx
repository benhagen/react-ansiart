'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
	AmbientLight,
	BoxGeometry,
	ConeGeometry,
	DirectionalLight,
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	PlaneGeometry,
	PointLight,
	Scene,
	WebGLRenderer,
} from 'three'
import {
	AnsiVirtualDisplay,
	createShapeConverter,
	getEmbeddedVgaFont,
	SHAPE_CHAR_PRESETS,
	type FrameData,
	type PixelFrameGenerator,
	type ShapeCharPreset,
} from 'react-ansiart'
import { ControlGroup } from '../_components/ControlGroup'
import { NumberInput, SelectInput, TextInput, ToggleInput } from '../_components/ControlRow'
import { CodePreview } from '../_components/CodePreview'

const CHAR_SET_OPTIONS = [
	{ value: 'cp437', label: 'CP437 (ASCII + blocks)' },
	{ value: 'ascii', label: 'ASCII only' },
	{ value: 'minimal', label: 'Minimal' },
	{ value: 'blocks', label: 'Blocks only' },
	{ value: 'custom', label: 'Custom' },
]

// ── Three.js scene setup (created once, reused across frames) ───

interface Scene3D {
	renderer: WebGLRenderer
	scene: Scene
	camera: PerspectiveCamera
	cube: Mesh
	pyramid: Mesh
	redLight: PointLight
	greenLight: PointLight
	blueLight: PointLight
	pixelBuf: Uint8Array
	width: number
	height: number
}

function createScene3D(width: number, height: number): Scene3D {
	const renderer = new WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true })
	renderer.setSize(width, height)
	renderer.setPixelRatio(1)

	const scene = new Scene()

	const camera = new PerspectiveCamera(35, width / height, 0.1, 100)
	camera.position.set(0, 1.5, 10)
	camera.lookAt(0, 0, 0)

	// Dim ambient — just enough to see silhouettes; colored lights do the heavy lifting
	scene.add(new AmbientLight(0xffffff, 0.05))

	// Orbiting colored point lights — high intensity, no distance falloff cap
	const redLight = new PointLight(0xff0000, 80, 0, 1.5)
	scene.add(redLight)
	const greenLight = new PointLight(0x00ff44, 80, 0, 1.5)
	scene.add(greenLight)
	const blueLight = new PointLight(0x0044ff, 80, 0, 1.5)
	scene.add(blueLight)

	// Cube — white diffuse surface to reflect colored light
	const cubeMat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.0 })
	const cube = new Mesh(new BoxGeometry(1.8, 1.8, 1.8), cubeMat)
	cube.position.x = -2.2
	scene.add(cube)

	// Pyramid — white diffuse, flat shaded to show distinct face colors
	const pyrMat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.0, flatShading: true })
	const pyramid = new Mesh(new ConeGeometry(1.2, 2.2, 4), pyrMat)
	pyramid.position.x = 2.2
	scene.add(pyramid)

	// Ground plane — lighter so it catches colored light too
	const groundMat = new MeshStandardMaterial({ color: 0x888888, roughness: 0.8 })
	const ground = new Mesh(new PlaneGeometry(14, 6), groundMat)
	ground.rotation.x = -Math.PI / 2
	ground.position.y = -1.6
	scene.add(ground)

	const pixelBuf = new Uint8Array(width * height * 4)

	return { renderer, scene, camera, cube, pyramid, redLight, greenLight, blueLight, pixelBuf, width, height }
}

function resizeScene3D(s: Scene3D, width: number, height: number): void {
	if (s.width === width && s.height === height) return
	s.renderer.setSize(width, height)
	s.camera.aspect = width / height
	s.camera.updateProjectionMatrix()
	s.pixelBuf = new Uint8Array(width * height * 4)
	s.width = width
	s.height = height
}

function renderScene3D(s: Scene3D, frame: number): FrameData {
	const t = frame * 0.025

	s.cube.rotation.y = t
	s.cube.rotation.x = t * 0.6

	s.pyramid.rotation.y = -t * 0.8
	s.pyramid.rotation.x = Math.sin(t * 0.5) * 0.3

	// Orbit colored lights close to objects for strong, visible color casts
	const orbitR = 3.5
	const P = Math.PI * 2 / 3
	s.redLight.position.set(
		Math.cos(t * 0.7) * orbitR,
		1.0 + Math.sin(t * 1.1) * 1.0,
		Math.sin(t * 0.7) * orbitR,
	)
	s.greenLight.position.set(
		Math.cos(t * 0.7 + P) * orbitR,
		1.0 + Math.sin(t * 1.1 + 2) * 1.0,
		Math.sin(t * 0.7 + P) * orbitR,
	)
	s.blueLight.position.set(
		Math.cos(t * 0.7 + P * 2) * orbitR,
		1.0 + Math.sin(t * 1.1 + 4) * 1.0,
		Math.sin(t * 0.7 + P * 2) * orbitR,
	)

	s.renderer.render(s.scene, s.camera)

	// Read pixels from WebGL (bottom-up) and convert to top-down RGB
	const gl = s.renderer.getContext()
	gl.readPixels(0, 0, s.width, s.height, gl.RGBA, gl.UNSIGNED_BYTE, s.pixelBuf)

	const w = s.width
	const h = s.height
	const pixels = new Uint8Array(w * h * 3)

	for (let row = 0; row < h; row++) {
		const srcRow = h - 1 - row // flip Y
		for (let col = 0; col < w; col++) {
			const si = (srcRow * w + col) * 4
			const di = (row * w + col) * 3
			pixels[di] = s.pixelBuf[si]
			pixels[di + 1] = s.pixelBuf[si + 1]
			pixels[di + 2] = s.pixelBuf[si + 2]
		}
	}

	return { width: w, height: h, pixels }
}

// ── Page component ──────────────────────────────────────────────

export default function ShapeConverterPage() {
	const [columns, setColumns] = useState(120)
	const [rows, setRows] = useState(40)
	const [fps, setFps] = useState(30)
	const [rampLength, setRampLength] = useState(70)
	const [contrastExponent, setContrastExponent] = useState(2.2)
	const [charSetPreset, setCharSetPreset] = useState<string>('cp437')
	const [customChars, setCustomChars] = useState<string>(SHAPE_CHAR_PRESETS.ascii)
	const [monoBackground, setMonoBackground] = useState(true)
	const [rgbColor, setRgbColor] = useState(false)
	const [showPerformanceOverlay, setShowPerformanceOverlay] = useState(false)

	const font = useMemo(() => getEmbeddedVgaFont(), [])

	// Three.js scene persists across renders
	const sceneRef = useRef<Scene3D | null>(null)

	// Visible preview canvas
	const previewCanvasRef = useRef<HTMLCanvasElement>(null)

	// Cleanup Three.js on unmount
	useEffect(() => {
		return () => {
			if (sceneRef.current) {
				sceneRef.current.renderer.dispose()
				sceneRef.current = null
			}
		}
	}, [])

	const frameGenerator: PixelFrameGenerator = useMemo(() => {
		const converter = createShapeConverter({
			bitmapFont: font,
			rampLength,
			contrastExponent,
			...(charSetPreset === 'custom'
				? { chars: customChars.trim() || undefined }
				: { charSet: charSetPreset as ShapeCharPreset }),
			monoBackground,
			rgbColor,
		})

		const generator = (frame: number, cols: number, r: number): FrameData => {
			const pixelW = cols * 6
			const pixelH = r * 12

			if (!sceneRef.current) {
				sceneRef.current = createScene3D(pixelW, pixelH)
			}
			resizeScene3D(sceneRef.current, pixelW, pixelH)

			const frameData = renderScene3D(sceneRef.current, frame)

			// Mirror to visible preview canvas
			const preview = previewCanvasRef.current
			if (preview) {
				const srcCanvas = sceneRef.current.renderer.domElement
				if (preview.width !== pixelW || preview.height !== pixelH) {
					preview.width = pixelW
					preview.height = pixelH
				}
				const pctx = preview.getContext('2d')
				if (pctx) pctx.drawImage(srcCanvas, 0, 0)
			}

			return frameData
		}

		return { generator, converter }
	}, [font, rampLength, contrastExponent, charSetPreset, customChars, monoBackground, rgbColor])

	const code = useMemo(() => {
		const lines = [
			`import { AnsiVirtualDisplay, createShapeConverter, getEmbeddedVgaFont } from 'react-ansiart'`,
			``,
			`const font = getEmbeddedVgaFont()`,
			`const converter = createShapeConverter({`,
			`  bitmapFont: font,`,
		]
		if (rampLength !== 70) lines.push(`  rampLength: ${rampLength},`)
		if (contrastExponent !== 2.2) lines.push(`  contrastExponent: ${contrastExponent},`)
		if (charSetPreset === 'custom') {
			lines.push(`  chars: '${customChars}',`)
		} else if (charSetPreset !== 'cp437') {
			lines.push(`  charSet: '${charSetPreset}',`)
		}
		if (monoBackground) lines.push(`  monoBackground: true,`)
		if (rgbColor) lines.push(`  rgbColor: true,`)
		lines.push(`})`)
		lines.push(``)
		lines.push(`const generator = (frame, cols, rows) => {`)
		lines.push(`  // Render your 3D scene to pixels...`)
		lines.push(`  return { width, height, pixels }`)
		lines.push(`}`)
		lines.push(``)
		lines.push(`<AnsiVirtualDisplay`)
		if (columns !== 80) lines.push(`  columns={${columns}}`)
		if (rows !== 25) lines.push(`  rows={${rows}}`)
		if (fps !== 30) lines.push(`  fps={${fps}}`)
		lines.push(`  frameGenerator={{ generator, converter }}`)
		lines.push(`/>`)
		return lines.join('\n')
	}, [columns, rows, fps, rampLength, contrastExponent, charSetPreset, customChars, monoBackground, rgbColor])

	return (
		<>
			<div className="page-header">
				<h1>Shape Converter</h1>
				<p>3D scene converted to ASCII using 6D shape-vector matching</p>
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
					<div style={{ marginTop: 12 }}>
						<div style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 4 }}>Source canvas</div>
						<canvas
							ref={previewCanvasRef}
							style={{
								width: '100%',
								maxWidth: columns * 8,
								imageRendering: 'pixelated',
								borderRadius: 4,
								border: '1px solid var(--surface-border)',
							}}
						/>
					</div>
				</div>
				<div className="controls-panel">
					<ControlGroup label="Display">
						<NumberInput label="Columns" value={columns} onChange={setColumns} min={20} step={1} />
						<NumberInput label="Rows" value={rows} onChange={setRows} min={10} step={1} />
						<NumberInput label="FPS" value={fps} onChange={setFps} min={1} step={1} />
						<ToggleInput label="Performance Overlay" value={showPerformanceOverlay} onChange={setShowPerformanceOverlay} />
					</ControlGroup>

					<ControlGroup label="Shape Converter">
						<SelectInput label="Character Set" value={charSetPreset} onChange={setCharSetPreset} options={CHAR_SET_OPTIONS} />
						{charSetPreset === 'custom' && (
							<TextInput label="Characters" value={customChars} onChange={setCustomChars} />
						)}
						<NumberInput label="Ramp Length" value={rampLength} onChange={setRampLength} min={2} max={102} step={1} />
						<NumberInput label="Contrast Exponent" value={contrastExponent} onChange={setContrastExponent} min={0.1} max={5} step={0.1} />
						<ToggleInput label="Mono Background" value={monoBackground} onChange={setMonoBackground} />
						<ToggleInput label="RGB Color" value={rgbColor} onChange={setRgbColor} />
					</ControlGroup>

					<ControlGroup label="Code" defaultOpen={true}>
						<CodePreview code={code} />
					</ControlGroup>
				</div>
			</div>
		</>
	)
}
