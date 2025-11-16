'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { SauceMetadata } from '../ansi/parser'

export type AnsiPlayerOverlayProps = {
	isPlaying: boolean
	currentBytes: number
	totalBytes: number
	currentSpeed: number
	isVisible: boolean
	onPlayPause: () => void
	onRestart: () => void
	onSeek: (bytePosition: number) => void
	onSpeedChange: (bytesPerSecond: number) => void
	onAdvanceByte: () => void
	onRewindByte: () => void
	onMouseMove: () => void
	sauce?: SauceMetadata
	onSauceClick?: () => void
}

// Baud rate presets
// Baud = bits per second, but we need bytes per second
// Serial communication: 8 data bits + 1 start bit + 1 stop bit = 10 bits per byte
// So bytes/sec ≈ baud / 10
const SPEED_PRESETS = [
	{ label: '300 baud', value: Math.floor(300 / 10) }, // 30 bytes/sec
	{ label: '1200 baud', value: Math.floor(1200 / 10) }, // 120 bytes/sec
	{ label: '2400 baud', value: Math.floor(2400 / 10) }, // 240 bytes/sec
	{ label: '9600 baud', value: Math.floor(9600 / 10) }, // 960 bytes/sec
	{ label: '14.4k baud', value: Math.floor(14400 / 10) }, // 1440 bytes/sec
	{ label: '28.8k baud', value: Math.floor(28800 / 10) }, // 2880 bytes/sec
	{ label: '33.6k baud', value: Math.floor(33600 / 10) }, // 3360 bytes/sec
	{ label: '56k baud', value: Math.floor(56000 / 10) }, // 5600 bytes/sec
]

/**
 * Format seconds as MM:SS
 */
function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60)
	const secs = Math.floor(seconds % 60)
	return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function AnsiPlayerOverlay({
	isPlaying,
	currentBytes,
	totalBytes,
	currentSpeed,
	isVisible,
	onPlayPause,
	onRestart,
	onSeek,
	onSpeedChange,
	onAdvanceByte,
	onRewindByte,
	onMouseMove,
	sauce,
	onSauceClick,
}: AnsiPlayerOverlayProps) {
	const [isScrubbing, setIsScrubbing] = useState(false)
	const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false)
	const [scrubValue, setScrubValue] = useState(currentBytes)
	const progressBarRef = useRef<HTMLDivElement>(null)
	const speedMenuRef = useRef<HTMLDivElement>(null)

	// Keep scrubValue in sync with currentBytes when not scrubbing
	useEffect(() => {
		if (!isScrubbing) {
			setScrubValue(currentBytes)
		}
	}, [currentBytes, isScrubbing])

	// Close speed menu when clicking outside
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (speedMenuRef.current && !speedMenuRef.current.contains(event.target as Node)) {
				setIsSpeedMenuOpen(false)
			}
		}

		if (isSpeedMenuOpen) {
			document.addEventListener('mousedown', handleClickOutside)
			return () => {
				document.removeEventListener('mousedown', handleClickOutside)
			}
		}
	}, [isSpeedMenuOpen])

	const handleProgressBarClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			if (!progressBarRef.current || totalBytes === 0) return

			const rect = progressBarRef.current.getBoundingClientRect()
			const x = e.clientX - rect.left
			const percentage = Math.max(0, Math.min(1, x / rect.width))
			const targetBytes = Math.floor(percentage * totalBytes)

			onSeek(targetBytes)
		},
		[totalBytes, onSeek]
	)

	const handleProgressBarMouseDown = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			if (!progressBarRef.current || totalBytes === 0) return

			setIsScrubbing(true)

			const rect = progressBarRef.current.getBoundingClientRect()
			const x = e.clientX - rect.left
			const percentage = Math.max(0, Math.min(1, x / rect.width))
			const targetBytes = Math.floor(percentage * totalBytes)

			setScrubValue(targetBytes)

			// Track the final byte value
			let finalBytes = targetBytes

			function handleMouseMove(moveEvent: MouseEvent) {
				if (!progressBarRef.current) return

				const rect = progressBarRef.current.getBoundingClientRect()
				const x = moveEvent.clientX - rect.left
				const percentage = Math.max(0, Math.min(1, x / rect.width))
				const targetBytes = Math.floor(percentage * totalBytes)

				finalBytes = targetBytes
				setScrubValue(targetBytes)
			}

			function handleMouseUp() {
				setIsScrubbing(false)
				onSeek(finalBytes) // Use the final byte value, not state
				document.removeEventListener('mousemove', handleMouseMove)
				document.removeEventListener('mouseup', handleMouseUp)
			}

			document.addEventListener('mousemove', handleMouseMove)
			document.addEventListener('mouseup', handleMouseUp)
		},
		[totalBytes, onSeek]
	)

	const handleSpeedSelect = useCallback(
		(speed: number) => {
			onSpeedChange(speed)
			setIsSpeedMenuOpen(false)
		},
		[onSpeedChange]
	)

	// Calculate progress percentage
	const progressPercent = totalBytes > 0 ? (scrubValue / totalBytes) * 100 : 0

	// Calculate current and total time based on bytes and speed
	const currentTime = currentSpeed > 0 ? currentBytes / currentSpeed : 0
	const totalTime = currentSpeed > 0 ? totalBytes / currentSpeed : 0

	// Find current speed label
	const currentSpeedLabel =
		SPEED_PRESETS.find(preset => preset.value === currentSpeed)?.label || `${currentSpeed} bps`

	// Check if we're at the end
	const isAtEnd = totalBytes > 0 && currentBytes >= totalBytes

	// Check if animation has started (not at beginning)
	const hasStarted = currentBytes > 0

	// Only show if visible, scrubbing, menu is open, at the end, or paused
	const shouldShow = isVisible || isScrubbing || isSpeedMenuOpen || isAtEnd || !isPlaying

	return (
		<div
			style={{
				position: 'absolute',
				bottom: 0,
				left: 0,
				right: 0,
				background: 'linear-gradient(to top, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0))',
				padding: '40px 16px 16px',
				transition: 'opacity 0.3s ease',
				opacity: shouldShow ? 1 : 0,
				pointerEvents: shouldShow ? 'auto' : 'none',
			}}
			onMouseMove={onMouseMove}
		>
			{/* Progress bar */}
			<div
				ref={progressBarRef}
				onMouseDown={handleProgressBarMouseDown}
				onClick={handleProgressBarClick}
				style={{
					width: '100%',
					height: '8px',
					background: 'rgba(255, 255, 255, 0.3)',
					borderRadius: '4px',
					cursor: 'pointer',
					marginBottom: '12px',
					position: 'relative',
				}}
			>
				{/* Filled progress */}
				<div
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						height: '100%',
						width: `${progressPercent}%`,
						background: '#ff0000',
						borderRadius: '4px',
						transition: isScrubbing ? 'none' : 'width 0.1s linear',
					}}
				/>
				{/* Scrubber handle */}
				<div
					style={{
						position: 'absolute',
						top: '50%',
						left: `${progressPercent}%`,
						width: '14px',
						height: '14px',
						borderRadius: '50%',
						background: '#ff0000',
						transform: 'translate(-50%, -50%)',
						transition: isScrubbing ? 'none' : 'left 0.1s linear',
					}}
				/>
			</div>

			{/* Controls bar */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: '12px',
					color: '#fff',
					fontFamily: 'monospace',
					fontSize: '14px',
				}}
			>
				{/* Play/Pause/Restart button */}
				<button
					onClick={onPlayPause}
					style={{
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
						fontSize: '16px',
						transition: 'background 0.2s',
					}}
					onMouseEnter={e => {
						e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'
					}}
					onMouseLeave={e => {
						e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
					}}
					title={isAtEnd ? 'Restart' : isPlaying ? 'Pause' : 'Play'}
				>
					{isAtEnd ? '↻' : isPlaying ? '⏸' : '▶'}
				</button>

				{/* Return to beginning button - only show after animation has started */}
				{hasStarted && !isAtEnd && (
					<button
						onClick={onRestart}
						style={{
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
							fontSize: '16px',
							transition: 'background 0.2s',
						}}
						onMouseEnter={e => {
							e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'
						}}
						onMouseLeave={e => {
							e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
						}}
						title='Return to beginning'
					>
						⏮
					</button>
				)}

				{/* Rewind one byte button */}
				<button
					onClick={onRewindByte}
					disabled={currentBytes <= 0}
					style={{
						background: 'rgba(255, 255, 255, 0.2)',
						border: 'none',
						color: currentBytes <= 0 ? 'rgba(255, 255, 255, 0.5)' : '#fff',
						width: '36px',
						height: '36px',
						borderRadius: '50%',
						cursor: currentBytes <= 0 ? 'not-allowed' : 'pointer',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						fontSize: '16px',
						transition: 'background 0.2s',
					}}
					onMouseEnter={e => {
						if (currentBytes > 0) {
							e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'
						}
					}}
					onMouseLeave={e => {
						if (currentBytes > 0) {
							e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
						}
					}}
					title='Rewind one byte'
				>
					‹‹
				</button>

				{/* Advance one byte button */}
				<button
					onClick={onAdvanceByte}
					disabled={currentBytes >= totalBytes}
					style={{
						background: 'rgba(255, 255, 255, 0.2)',
						border: 'none',
						color: currentBytes >= totalBytes ? 'rgba(255, 255, 255, 0.5)' : '#fff',
						width: '36px',
						height: '36px',
						borderRadius: '50%',
						cursor: currentBytes >= totalBytes ? 'not-allowed' : 'pointer',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						fontSize: '16px',
						transition: 'background 0.2s',
					}}
					onMouseEnter={e => {
						if (currentBytes < totalBytes) {
							e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'
						}
					}}
					onMouseLeave={e => {
						if (currentBytes < totalBytes) {
							e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
						}
					}}
					title='Advance one byte'
				>
					››
				</button>

				{/* Time display */}
				<div
					style={{
						minWidth: '120px',
						textAlign: 'left',
					}}
				>
					{formatTime(currentTime)} / {formatTime(totalTime)}
				</div>

				{/* Spacer */}
				<div style={{ flex: 1 }} />

				{/* SAUCE button */}
				{sauce && onSauceClick && (
					<button
						onClick={onSauceClick}
						style={{
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
							transition: 'background 0.2s',
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
				)}

				{/* Speed selector */}
				<div style={{ position: 'relative' }} ref={speedMenuRef}>
					<button
						onClick={() => setIsSpeedMenuOpen(!isSpeedMenuOpen)}
						style={{
							background: 'rgba(255, 255, 255, 0.2)',
							border: 'none',
							color: '#fff',
							padding: '8px 12px',
							borderRadius: '4px',
							cursor: 'pointer',
							fontFamily: 'monospace',
							fontSize: '13px',
							transition: 'background 0.2s',
							minWidth: '110px',
							textAlign: 'left',
						}}
						onMouseEnter={e => {
							e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'
						}}
						onMouseLeave={e => {
							e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
						}}
					>
						{currentSpeedLabel}
					</button>

					{/* Speed dropdown menu */}
					{isSpeedMenuOpen && (
						<div
							style={{
								position: 'absolute',
								bottom: '100%',
								right: 0,
								marginBottom: '8px',
								background: 'rgba(0, 0, 0, 0.95)',
								border: '1px solid rgba(255, 255, 255, 0.3)',
								borderRadius: '4px',
								overflow: 'hidden',
								minWidth: '140px',
								boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
							}}
						>
							{SPEED_PRESETS.map(preset => (
								<button
									key={preset.value}
									onClick={() => handleSpeedSelect(preset.value)}
									style={{
										width: '100%',
										background:
											preset.value === currentSpeed ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
										border: 'none',
										color: '#fff',
										padding: '10px 16px',
										textAlign: 'left',
										cursor: 'pointer',
										fontFamily: 'monospace',
										fontSize: '13px',
										transition: 'background 0.15s',
									}}
									onMouseEnter={e => {
										if (preset.value !== currentSpeed) {
											e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
										}
									}}
									onMouseLeave={e => {
										if (preset.value !== currentSpeed) {
											e.currentTarget.style.background = 'transparent'
										}
									}}
								>
									{preset.label}
								</button>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
