'use client'

import Link from 'next/link'
import { PlasmaBackgroundLayout } from 'react-ansiart'

const DEMO_LINKS = [
	{
		href: '/ansi-art',
		title: 'ANSI Art',
		desc: 'Load and animate .ANS files with authentic VGA rendering',
	},
	{
		href: '/generators',
		title: 'Generators',
		desc: 'Procedural plasma, fire, sonar, datamosh, and metaballs',
	},
	{
		href: '/backgrounds',
		title: 'Backgrounds',
		desc: 'Full-page animated PlasmaBackgroundLayout',
	},
	{
		href: '/font-chart',
		title: 'Font Chart',
		desc: 'CP437 bitmap font character grid',
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
					<div className="hero-grid">
						{DEMO_LINKS.map((link) => (
							<Link key={link.href} href={link.href} className="hero-link">
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
