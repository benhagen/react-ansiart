'use client'

import React, { useEffect, useRef } from 'react'
import { getSauceInfo, type SauceMetadata } from '../utils/sauce'

export type SauceMetadataModalProps = {
	sauce: SauceMetadata
	isOpen: boolean
	onClose: () => void
}

export function SauceMetadataModal({ sauce, isOpen, onClose }: SauceMetadataModalProps) {
	const modalRef = useRef<HTMLDivElement>(null)

	// Close on escape key
	useEffect(() => {
		if (!isOpen) return

		function handleEscape(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				onClose()
			}
		}

		document.addEventListener('keydown', handleEscape)
		return () => {
			document.removeEventListener('keydown', handleEscape)
		}
	}, [isOpen, onClose])

	// Close on click outside
	useEffect(() => {
		if (!isOpen) return

		function handleClickOutside(e: MouseEvent) {
			if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
				onClose()
			}
		}

		document.addEventListener('mousedown', handleClickOutside)
		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [isOpen, onClose])

	if (!isOpen) return null

	const sauceInfo = getSauceInfo(sauce)

	return (
		<div
			style={{
				position: 'fixed',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				background: 'rgba(0, 0, 0, 0.8)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				zIndex: 10000,
			}}
		>
			<div
				ref={modalRef}
				style={{
					background: '#1a1a1a',
					border: '1px solid #444',
					borderRadius: '8px',
					padding: '24px',
					maxWidth: '600px',
					maxHeight: '80vh',
					overflow: 'auto',
					color: '#fff',
					fontFamily: 'monospace',
					fontSize: '13px',
					lineHeight: '1.6',
					boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
				}}
			>
				{/* Header */}
				<div
					style={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						marginBottom: '20px',
						paddingBottom: '12px',
						borderBottom: '1px solid #444',
					}}
				>
					<h2
						style={{
							margin: 0,
							fontSize: '18px',
							fontWeight: 'bold',
							color: '#fff',
						}}
					>
						SAUCE Metadata
					</h2>
					<button
						onClick={onClose}
						style={{
							background: 'rgba(255, 255, 255, 0.1)',
							border: '1px solid #555',
							color: '#fff',
							width: '32px',
							height: '32px',
							borderRadius: '4px',
							cursor: 'pointer',
							fontSize: '18px',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							transition: 'background 0.2s',
						}}
						onMouseEnter={e => {
							e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
						}}
						onMouseLeave={e => {
							e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
						}}
						title='Close'
					>
						×
					</button>
				</div>

				{/* Content */}
				<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
					{/* Basic Info */}
					{sauce.title && (
						<div>
							<div style={{ color: '#888', marginBottom: '4px' }}>Title:</div>
							<div style={{ color: '#fff' }}>{sauce.title}</div>
						</div>
					)}

					{sauce.author && (
						<div>
							<div style={{ color: '#888', marginBottom: '4px' }}>Author:</div>
							<div style={{ color: '#fff' }}>{sauce.author}</div>
						</div>
					)}

					{sauce.group && (
						<div>
							<div style={{ color: '#888', marginBottom: '4px' }}>Group:</div>
							<div style={{ color: '#fff' }}>{sauce.group}</div>
						</div>
					)}

					{sauce.date && (
						<div>
							<div style={{ color: '#888', marginBottom: '4px' }}>Date:</div>
							<div style={{ color: '#fff' }}>
								{sauce.date.length === 8
									? `${sauce.date.slice(0, 4)}-${sauce.date.slice(4, 6)}-${sauce.date.slice(6, 8)}`
									: sauce.date}
							</div>
						</div>
					)}

					{/* File Type */}
					{sauceInfo && (
						<div>
							<div style={{ color: '#888', marginBottom: '4px' }}>File Type:</div>
							<div style={{ color: '#fff' }}>
								{sauceInfo.fileTypeDescription} (DataType: {sauce.dataType}, FileType: {sauce.fileType})
							</div>
						</div>
					)}

					{/* Dimensions */}
					{sauceInfo?.hasDimensions ? (
						<div>
							<div style={{ color: '#888', marginBottom: '4px' }}>Dimensions:</div>
							<div style={{ color: '#fff' }}>
								{sauceInfo.width} × {sauceInfo.height} characters
							</div>
						</div>
					) : (
						<div>
							<div style={{ color: '#888', marginBottom: '4px' }}>Dimensions:</div>
							<div style={{ color: '#666' }}>Not specified</div>
						</div>
					)}

					{/* Type Info Fields */}
					<div>
						<div style={{ color: '#888', marginBottom: '4px' }}>Type Info Fields:</div>
						<div style={{ color: '#fff', fontSize: '12px', fontFamily: 'monospace' }}>
							TInfo1: {sauce.tInfo1} | TInfo2: {sauce.tInfo2} | TInfo3: {sauce.tInfo3} | TInfo4: {sauce.tInfo4}
						</div>
					</div>

					{/* TInfoS */}
					{sauce.tInfoS && (
						<div>
							<div style={{ color: '#888', marginBottom: '4px' }}>TInfoS:</div>
							<div style={{ color: '#fff' }}>{sauce.tInfoS}</div>
						</div>
					)}

					{/* Font */}
					{sauceInfo?.fontName && (
						<div>
							<div style={{ color: '#888', marginBottom: '4px' }}>Font:</div>
							<div style={{ color: '#fff' }}>{sauceInfo.fontName}</div>
						</div>
					)}

					{/* Flags */}
					<div>
						<div style={{ color: '#888', marginBottom: '4px' }}>Flags:</div>
						<div style={{ color: '#fff', display: 'flex', flexDirection: 'column', gap: '4px' }}>
							{sauceInfo?.iceColors && <div>• ICE Colors enabled</div>}
							{sauceInfo?.letterSpacing && <div>• Letter spacing enabled</div>}
							{!sauceInfo?.iceColors && !sauceInfo?.letterSpacing && <div style={{ color: '#666' }}>None</div>}
						</div>
					</div>

					{/* Aspect Ratio */}
					{sauceInfo?.aspectRatio && (
						<div>
							<div style={{ color: '#888', marginBottom: '4px' }}>Aspect Ratio:</div>
							<div style={{ color: '#fff' }}>
								{sauceInfo.aspectRatio.width}:{sauceInfo.aspectRatio.height}
							</div>
						</div>
					)}

					{/* File Size */}
					<div>
						<div style={{ color: '#888', marginBottom: '4px' }}>File Size:</div>
						<div style={{ color: '#fff' }}>{sauce.fileSize.toLocaleString()} bytes</div>
					</div>

					{/* Version */}
					<div>
						<div style={{ color: '#888', marginBottom: '4px' }}>SAUCE Version:</div>
						<div style={{ color: '#fff' }}>{sauce.version}</div>
					</div>

					{/* Technical Details Section */}
					<div
						style={{
							marginTop: '8px',
							paddingTop: '16px',
							borderTop: '1px solid #333',
						}}
					>
						<div style={{ color: '#888', marginBottom: '12px', fontSize: '12px', fontWeight: 'bold' }}>
							Technical Details
						</div>
						<div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', color: '#aaa' }}>
							<div>ID: {sauce.id}</div>
							<div>Version: {sauce.version}</div>
							<div>DataType: {sauce.dataType}</div>
							<div>FileType: {sauce.fileType}</div>
							<div>TInfo1: {sauce.tInfo1} | TInfo2: {sauce.tInfo2} | TInfo3: {sauce.tInfo3} | TInfo4: {sauce.tInfo4}</div>
							<div>tFlags: 0x{sauce.tFlags.toString(16).toUpperCase().padStart(2, '0')} ({sauce.tFlags})</div>
							{sauce.tInfoS && <div>TInfoS: {sauce.tInfoS}</div>}
							<div>Comments: {sauce.comments}</div>
							<div>FileSize: {sauce.fileSize} bytes</div>
						</div>
					</div>

					{/* Comments */}
					{sauce.comments > 0 && sauce.commentLines.length > 0 && (
						<div>
							<div style={{ color: '#888', marginBottom: '8px' }}>
								Comments ({sauce.comments}):
							</div>
							<div
								style={{
									color: '#fff',
									background: 'rgba(0, 0, 0, 0.3)',
									padding: '12px',
									borderRadius: '4px',
									border: '1px solid #333',
									maxHeight: '200px',
									overflow: 'auto',
								}}
							>
								{sauce.commentLines.map((comment, idx) => (
									<div key={idx} style={{ marginBottom: idx < sauce.commentLines.length - 1 ? '8px' : '0' }}>
										{comment}
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

