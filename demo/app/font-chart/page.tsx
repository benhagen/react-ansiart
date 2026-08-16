'use client'

import { FontCharacterChart } from 'react-ansiart'

export default function FontChartPage() {
	return (
		<div className="font-chart-page" style={{ padding: 20 }}>
			{/*
				FontCharacterChart (from react-ansiart) renders a single unstyled,
				classless <button> for the sort toggle — it's not exposed as a prop
				we can style directly, so we restyle it here by targeting the only
				<button> the component renders, matching the app's `.toggle` pill
				convention (see globals.css) without touching the library source.
			*/}
			<style>{`
				.font-chart-page button {
					display: inline-flex;
					align-items: center;
					gap: 6px;
					padding: 6px 14px;
					border-radius: 999px;
					border: 1px solid var(--border-default);
					background: var(--bg-elevated);
					color: var(--text-secondary);
					font-size: 12px;
					font-family: var(--font-sans);
					cursor: pointer;
					transition: all 0.15s;
				}
				.font-chart-page button:hover {
					border-color: var(--bg-hover);
					color: var(--text-primary);
				}
				.font-chart-page button:focus-visible {
					outline: none;
					border-color: var(--accent);
					box-shadow: 0 0 0 2px var(--accent-muted);
				}
			`}</style>
			<div className="page-header" style={{ padding: '0 0 16px 0' }}>
				<h1>Font Character Chart</h1>
				<p>CP437 bitmap font character grid — embedded IBM VGA 8x16</p>
				<p style={{ color: 'var(--text-tertiary)', fontSize: 12, margin: '4px 0 0 0' }}>
					Density percentages rank characters by lit-pixel coverage — the same metric used to build
					brightness ramps for the procedural generators.
				</p>
			</div>
			<FontCharacterChart />
		</div>
	)
}
