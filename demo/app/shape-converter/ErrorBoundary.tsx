'use client'

import { Component, type ReactNode } from 'react'

interface Props {
	fallback: ReactNode
	children: ReactNode
}

interface State {
	hasError: boolean
}

/**
 * Backstop error boundary for the shape-converter's volatile 3D/WebGL subtree.
 * The primary defense against WebGL failures is the try/catch around scene
 * creation in page.tsx (errors thrown from a requestAnimationFrame loop are
 * NOT caught by React error boundaries), but this boundary still protects
 * against any other unexpected render-time throw in the canvas subtree so a
 * single failure degrades this panel instead of white-screening the app.
 */
export class ShapeConverterErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props)
		this.state = { hasError: false }
	}

	static getDerivedStateFromError(): State {
		return { hasError: true }
	}

	componentDidCatch(error: unknown) {
		// eslint-disable-next-line no-console
		console.error('Shape converter subtree crashed:', error)
	}

	render() {
		if (this.state.hasError) {
			return this.props.fallback
		}
		return this.props.children
	}
}
