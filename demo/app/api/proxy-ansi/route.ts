import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
	const pack = request.nextUrl.searchParams.get('pack')
	const file = request.nextUrl.searchParams.get('file')

	if (!pack || !file) {
		return NextResponse.json({ error: 'Missing pack or file parameter' }, { status: 400 })
	}

	// Validate inputs to prevent path traversal
	if (pack.includes('/') || pack.includes('..') || file.includes('/') || file.includes('..')) {
		return NextResponse.json({ error: 'Invalid pack or file name' }, { status: 400 })
	}

	const url = `https://16colo.rs/pack/${encodeURIComponent(pack)}/raw/${encodeURIComponent(file)}`

	try {
		const upstream = await fetch(url)
		if (!upstream.ok) {
			return NextResponse.json(
				{ error: `Upstream returned ${upstream.status}` },
				{ status: upstream.status }
			)
		}

		const data = await upstream.arrayBuffer()
		return new NextResponse(data, {
			headers: {
				'Content-Type': 'application/octet-stream',
				'Cache-Control': 'public, max-age=86400',
			},
		})
	} catch {
		return NextResponse.json({ error: 'Failed to fetch file' }, { status: 502 })
	}
}
