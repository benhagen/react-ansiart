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
			</body>
		</html>
	)
}
