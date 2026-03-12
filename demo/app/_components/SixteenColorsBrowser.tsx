'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type PackResult = {
	year: number
	name: string
	gallery: string
}

type PackFile = {
	name: string
	tnUri: string | null
}

type BrowseMode = 'search' | 'pack'

const API_BASE = 'https://api.16colo.rs/v1'

export function SixteenColorsBrowser({
	onSelectFile,
}: {
	onSelectFile: (url: string, label: string) => void
}) {
	const [mode, setMode] = useState<BrowseMode>('search')
	const [query, setQuery] = useState('')
	const [packs, setPacks] = useState<PackResult[]>([])
	const [packFiles, setPackFiles] = useState<PackFile[]>([])
	const [activePack, setActivePack] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [page, setPage] = useState(1)
	const [totalPages, setTotalPages] = useState(1)
	const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

	const searchPacks = useCallback(async (filter: string, pageNum: number) => {
		setLoading(true)
		setError(null)
		try {
			const params = new URLSearchParams({
				pagesize: '20',
				page: String(pageNum),
			})
			if (filter.trim()) {
				params.set('filter', filter.trim())
			}
			const res = await fetch(`${API_BASE}/pack?${params}`)
			if (!res.ok) throw new Error(`API returned ${res.status}`)
			const data = await res.json()
			setPacks(data.results || [])
			setTotalPages(data.page?.pages || 1)
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Search failed')
			setPacks([])
		} finally {
			setLoading(false)
		}
	}, [])

	const loadPackFiles = useCallback(async (packName: string) => {
		setLoading(true)
		setError(null)
		setActivePack(packName)
		setMode('pack')
		try {
			const res = await fetch(`${API_BASE}/pack/${encodeURIComponent(packName)}?fileid=true&dimensions=true`)
			if (!res.ok) throw new Error(`API returned ${res.status}`)
			const data = await res.json()
			const result = data.results?.[0]
			if (!result?.files) {
				setPackFiles([])
				return
			}
			const files: PackFile[] = Object.entries(result.files)
				.filter(([name]) => /\.(ans|asc|ice|diz)$/i.test(name))
				.map(([name, info]: [string, any]) => ({
					name,
					tnUri: info?.file?.tn?.uri
						? `https://16colo.rs${info.file.tn.uri}`
						: null,
				}))
				.sort((a, b) => a.name.localeCompare(b.name))
			setPackFiles(files)
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to load pack')
			setPackFiles([])
		} finally {
			setLoading(false)
		}
	}, [])

	// Initial load: latest packs
	useEffect(() => {
		searchPacks('', 1)
	}, [searchPacks])

	// Debounced search
	useEffect(() => {
		if (mode !== 'search') return
		if (debounceRef.current) clearTimeout(debounceRef.current)
		debounceRef.current = setTimeout(() => {
			setPage(1)
			searchPacks(query, 1)
		}, 400)
		return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
	}, [query, mode, searchPacks])

	const handlePageChange = (newPage: number) => {
		setPage(newPage)
		searchPacks(query, newPage)
	}

	const handleSelectFile = (fileName: string) => {
		if (!activePack) return
		const proxyUrl = `/api/proxy-ansi?pack=${encodeURIComponent(activePack)}&file=${encodeURIComponent(fileName)}`
		onSelectFile(proxyUrl, `${activePack}/${fileName}`)
	}

	const handleBackToSearch = () => {
		setMode('search')
		setActivePack(null)
		setPackFiles([])
	}

	return (
		<div className="browser-container">
			{mode === 'search' ? (
				<>
					<div className="browser-search">
						<input
							type="text"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Search packs..."
							className="browser-search-input"
						/>
					</div>
					{error && <div className="browser-error">{error}</div>}
					{loading ? (
						<div className="browser-loading">Loading...</div>
					) : (
						<>
							<div className="browser-list">
								{packs.map((pack) => (
									<button
										key={pack.name}
										className="browser-pack-item"
										onClick={() => loadPackFiles(pack.name)}
									>
										<span className="browser-pack-name">{pack.name}</span>
										<span className="browser-pack-year">{pack.year}</span>
									</button>
								))}
								{packs.length === 0 && <div className="browser-empty">No packs found</div>}
							</div>
							{totalPages > 1 && (
								<div className="browser-pagination">
									<button
										className="btn-sm"
										disabled={page <= 1}
										onClick={() => handlePageChange(page - 1)}
									>
										Prev
									</button>
									<span className="browser-page-info">
										{page} / {totalPages}
									</span>
									<button
										className="btn-sm"
										disabled={page >= totalPages}
										onClick={() => handlePageChange(page + 1)}
									>
										Next
									</button>
								</div>
							)}
						</>
					)}
				</>
			) : (
				<>
					<div className="browser-pack-header">
						<button className="btn-sm" onClick={handleBackToSearch}>
							&larr; Back
						</button>
						<span className="browser-pack-title">{activePack}</span>
					</div>
					{error && <div className="browser-error">{error}</div>}
					{loading ? (
						<div className="browser-loading">Loading...</div>
					) : (
						<div className="browser-file-grid">
							{packFiles.map((file) => (
								<button
									key={file.name}
									className="browser-file-item"
									onClick={() => handleSelectFile(file.name)}
									title={file.name}
								>
									{file.tnUri && (
										<img
											src={file.tnUri}
											alt={file.name}
											className="browser-file-thumb"
											loading="lazy"
										/>
									)}
									<span className="browser-file-name">{file.name}</span>
								</button>
							))}
							{packFiles.length === 0 && (
								<div className="browser-empty">No ANSI/ASCII files in this pack</div>
							)}
						</div>
					)}
				</>
			)}
		</div>
	)
}
