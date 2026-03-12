export function ControlGroup({
	label,
	defaultOpen = true,
	children,
}: {
	label: string
	defaultOpen?: boolean
	children: React.ReactNode
}) {
	return (
		<details className="control-group" open={defaultOpen || undefined}>
			<summary>{label}</summary>
			<div className="control-group-body">{children}</div>
		</details>
	)
}
