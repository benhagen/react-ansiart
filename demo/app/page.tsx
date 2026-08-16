'use client'

import Link from 'next/link'
import {
	AnsiVirtualDisplay,
	PlasmaBackgroundLayout,
	generateAsciiCrtStaticFrame,
	generateAsciiFireFrame,
	generateAsciiMetaballsFrame,
	generateAsciiPerlinPlasmaFrame,
	generateAsciiSineScrollerFrame,
	type CharacterFrameGenerator,
} from 'react-ansiart'
import styles from './page.module.css'

// Small live preview strips behind each card. Grids are tiny and fps is capped low (7) so
// five extra canvases stay cheap alongside the full-page plasma background. Generator
// refs are module-level constants — stable identity across renders, no re-init per paint.
const PREVIEW_COLUMNS = 36
const PREVIEW_ROWS = 8
const PREVIEW_FPS = 7

const ansiArtPreview: CharacterFrameGenerator = (frame, cols, rows) =>
	generateAsciiSineScrollerFrame(frame, cols, rows, {
		text: 'ANSI ART ♦ 16COLO.RS ',
		speed: 0.7,
		amplitude: 2,
		waveSpeed: 0.07,
		fgColor: '#38bdf8',
		bgColor: '#000000',
	})

const generatorsPreview: CharacterFrameGenerator = (frame, cols, rows) =>
	generateAsciiFireFrame(frame, cols, rows, {
		bgColor: '#000000',
	})

const backgroundsPreview: CharacterFrameGenerator = (frame, cols, rows) =>
	generateAsciiPerlinPlasmaFrame(frame, cols, rows, {
		fgColor: '#38bdf8',
		bgColor: '#000000',
		timeScale: 0.6,
	})

const fontChartPreview: CharacterFrameGenerator = (frame, cols, rows) =>
	generateAsciiCrtStaticFrame(frame, cols, rows, {
		bgColor: '#000000',
	})

const shapeConverterPreview: CharacterFrameGenerator = (frame, cols, rows) =>
	generateAsciiMetaballsFrame(frame, cols, rows, {
		fgColor: '#38bdf8',
		bgColor: '#000000',
		balls: 4,
	})

const DEMO_LINKS = [
	{
		href: '/ansi-art',
		title: 'ANSI Art',
		desc: 'Load and animate .ANS files with authentic VGA rendering',
		preview: ansiArtPreview,
	},
	{
		href: '/generators',
		title: 'Generators',
		desc: 'Procedural plasma, fire, sonar, datamosh, and metaballs',
		preview: generatorsPreview,
	},
	{
		href: '/backgrounds',
		title: 'Backgrounds',
		desc: 'Full-page animated PlasmaBackgroundLayout',
		preview: backgroundsPreview,
	},
	{
		href: '/font-chart',
		title: 'Font Chart',
		desc: 'CP437 bitmap font character grid',
		preview: fontChartPreview,
	},
	{
		href: '/shape-converter',
		title: 'Shape Converter',
		desc: 'Live camera/image → ANSI shape conversion',
		preview: shapeConverterPreview,
	},
]

export default function HomePage() {
	return (
		<PlasmaBackgroundLayout mode="fixed" fps={24}>
			<div className="hero-wrapper">
				<div className="hero-card">
					<h1 className="hero-title">react-ansiart</h1>
					<p className="hero-subtitle">
						React components for rendering ANSI art with authentic VGA bitmap fonts,
						procedural generators, and smooth animation.
					</p>
					<div className={`hero-grid ${styles.responsiveGrid}`}>
						{DEMO_LINKS.map((link) => (
							<Link
								key={link.href}
								href={link.href}
								className={`hero-link ${styles.previewCard}`}
							>
								<span className={styles.previewStrip} aria-hidden="true">
									<span className={styles.previewScaler}>
										<AnsiVirtualDisplay
											columns={PREVIEW_COLUMNS}
											rows={PREVIEW_ROWS}
											fps={PREVIEW_FPS}
											frameGenerator={link.preview}
											background="#000"
										/>
									</span>
								</span>
								<div className="hero-link-title">{link.title}</div>
								<div className="hero-link-desc">{link.desc}</div>
							</Link>
						))}
					</div>
				</div>
			</div>
		</PlasmaBackgroundLayout>
	)
}
