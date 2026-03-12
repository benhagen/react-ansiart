import type { ReactNode } from 'react'

function Row({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="control-row">
			<label>{label}</label>
			{children}
		</div>
	)
}

export function NumberInput({
	label,
	value,
	onChange,
	min,
	max,
	step,
}: {
	label: string
	value: number
	onChange: (v: number) => void
	min?: number
	max?: number
	step?: number
}) {
	return (
		<Row label={label}>
			<input
				type="number"
				value={value}
				min={min}
				max={max}
				step={step}
				onChange={(e) => onChange(Number(e.target.value))}
			/>
		</Row>
	)
}

export function TextInput({
	label,
	value,
	onChange,
	placeholder,
	width,
}: {
	label: string
	value: string
	onChange: (v: string) => void
	placeholder?: string
	width?: number
}) {
	return (
		<Row label={label}>
			<input
				type="text"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				style={width ? { width } : undefined}
			/>
		</Row>
	)
}

export function SelectInput({
	label,
	value,
	onChange,
	options,
}: {
	label: string
	value: string
	onChange: (v: string) => void
	options: { value: string; label: string }[]
}) {
	return (
		<Row label={label}>
			<select value={value} onChange={(e) => onChange(e.target.value)}>
				{options.map((o) => (
					<option key={o.value} value={o.value}>
						{o.label}
					</option>
				))}
			</select>
		</Row>
	)
}

export function ToggleInput({
	label,
	value,
	onChange,
}: {
	label: string
	value: boolean
	onChange: (v: boolean) => void
}) {
	return (
		<Row label={label}>
			<button
				className={`toggle ${value ? 'active' : ''}`}
				onClick={() => onChange(!value)}
			>
				{value ? 'On' : 'Off'}
			</button>
		</Row>
	)
}

export function ColorInput({
	label,
	value,
	onChange,
}: {
	label: string
	value: string
	onChange: (v: string) => void
}) {
	return (
		<Row label={label}>
			<div className="flex-row">
				<input
					type="color"
					value={value}
					onChange={(e) => onChange(e.target.value)}
				/>
				<input
					type="text"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					style={{ width: 80 }}
				/>
			</div>
		</Row>
	)
}
