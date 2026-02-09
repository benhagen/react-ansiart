import Link from 'next/link'

export default function HomePage() {
	return (
		<div>
			<div className='panel'>
				<h2 style={{ marginTop: 0 }}>Welcome</h2>
				<p className='muted' style={{ marginBottom: 0 }}>
					This Next.js app is a small playground to demo and debug <code>react-ansiart</code>.
				</p>
			</div>

			<div className='panel'>
				<h3 style={{ marginTop: 0 }}>Demos</h3>
				<ul style={{ margin: 0, paddingLeft: 18 }}>
					<li>
						<Link href='/ansi'>ANSI Art</Link> (final / animated / overlays)
					</li>
					<li>
						<Link href='/virtual-display'>Virtual Display</Link> (procedural generator)
					</li>
				</ul>
			</div>

			<div className='panel'>
				<h3 style={{ marginTop: 0 }}>Quick notes</h3>
				<ul style={{ margin: 0, paddingLeft: 18 }}>
					<li>
						ANSI files live in <code>demo/public/ansi</code> and are fetched by URL (e.g.{' '}
						<code>/ansi/example.ans</code>).
					</li>
					<li>
						The bitmap font is fetched from <code>/ansi/fonts/Bm437_IBM_VGA_8x16.FON</code>.
					</li>
				</ul>
			</div>
		</div>
	)
}



