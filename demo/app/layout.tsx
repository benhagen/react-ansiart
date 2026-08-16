'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import './globals.css'

const NAV_LINKS = [
	{ href: '/', label: 'Home' },
	{ href: '/ansi-art', label: 'ANSI Art' },
	{ href: '/generators', label: 'Generators' },
	{ href: '/backgrounds', label: 'Backgrounds' },
	{ href: '/font-chart', label: 'Font Chart' },
	{ href: '/shape-converter', label: 'Shape Converter' },
]

const GITHUB_URL = 'https://github.com/benhagen/react-ansiart'
const NPM_URL = 'https://www.npmjs.com/package/react-ansiart'

export default function RootLayout({ children }: { children: React.ReactNode }) {
	const pathname = usePathname()

	return (
		<html lang="en">
			<body>
				<nav className="navbar">
					<span className="navbar-brand">react-ansiart</span>
					<div className="navbar-links">
						{NAV_LINKS.map((link) => (
							<Link
								key={link.href}
								href={link.href}
								className={pathname === link.href ? 'active' : ''}
							>
								{link.label}
							</Link>
						))}
					</div>
				</nav>
				<div className="page-body">{children}</div>
				<footer className="site-footer" id="site-footer">
					<div className="site-footer-links">
						<a href={GITHUB_URL} target="_blank" rel="noreferrer noopener">
							GitHub
						</a>
						<span className="site-footer-sep" aria-hidden="true">
							/
						</span>
						<a href={NPM_URL} target="_blank" rel="noreferrer noopener">
							npm
						</a>
					</div>
					<p className="site-footer-note">
						🤖❤️ Built by human-assisted and curated AI — for the love of ANSI art.
					</p>
				</footer>
			</body>
		</html>
	)
}
