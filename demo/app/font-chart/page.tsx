'use client'

import { FontCharacterChart } from 'react-ansiart'

export default function FontChartPage() {
	return (
		<div style={{ padding: 20 }}>
			<div className="page-header" style={{ padding: '0 0 16px 0' }}>
				<h1>Font Character Chart</h1>
				<p>CP437 bitmap font character grid — embedded IBM VGA 8x16</p>
			</div>
			<FontCharacterChart />
		</div>
	)
}
