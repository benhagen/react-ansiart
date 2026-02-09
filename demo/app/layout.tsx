import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
	title: 'react-ansiart demo',
	description: 'Demo + debug app for react-ansiart',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang='en'>
			<body>
				<div className='layout'>
					<aside className='sidebar'>
						<h1>react-ansiart demo</h1>
						<nav className='nav'>
							<Link href='/'>Home</Link>
							<Link href='/ansi'>ANSI</Link>
							<Link href='/virtual-display'>Virtual Display</Link>
						</nav>
						<div className='divider' />
						<div className='muted' style={{ fontSize: 12, lineHeight: 1.5 }}>
							<div>
								<strong>Assets:</strong> served from <code>demo/public</code>
							</div>
							<div>
								<strong>Library:</strong> imported via <code>file:..</code> (root <code>dist/</code>
								)
							</div>
						</div>
					</aside>
					<main className='content'>{children}</main>
				</div>
			</body>
		</html>
	)
}



