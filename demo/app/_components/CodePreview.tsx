'use client'

import { useCallback, useState } from 'react'

export function CodePreview({ code }: { code: string }) {
	const [copied, setCopied] = useState(false)

	const handleCopy = useCallback(() => {
		navigator.clipboard.writeText(code).then(() => {
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		})
	}, [code])

	return (
		<div className="code-block">
			<button className="code-block-copy" onClick={handleCopy}>
				{copied ? 'Copied!' : 'Copy'}
			</button>
			<pre>{code}</pre>
		</div>
	)
}
