'use client'

import React from 'react'

export type SauceOverlayProps = {
	isVisible: boolean
	onClick: () => void
}

export function SauceOverlay({ isVisible, onClick }: SauceOverlayProps) {
	if (!isVisible) return null

	return (
		<button
			onClick={onClick}
			style={{
				position: 'absolute',
				top: '16px',
				right: '16px',
				background: 'rgba(255, 255, 255, 0.2)',
				border: 'none',
				color: '#fff',
				width: '36px',
				height: '36px',
				borderRadius: '50%',
				cursor: 'pointer',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				fontSize: '10px',
				fontWeight: 'bold',
				transition: 'background 0.2s, opacity 0.3s',
				opacity: isVisible ? 1 : 0,
				pointerEvents: isVisible ? 'auto' : 'none',
				zIndex: 1000,
				lineHeight: '1',
				padding: 0,
			}}
			onMouseEnter={e => {
				e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'
			}}
			onMouseLeave={e => {
				e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
			}}
			title='View SAUCE metadata'
		>
			S
		</button>
	)
}

