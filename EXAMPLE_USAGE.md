# AnsiArtNG Usage Examples

## Basic Examples

### Example 1: Fixed Viewscreen, Final Mode (Default)

The simplest usage - displays complete ANSI art in a fixed 80x25 terminal size:

```tsx
<AnsiArtNG
	src='/ansi-art/welcome.ans'
	viewscreen='fixed'
	mode='final'
	columns={80}
	rows={25}
	bitmapFontUrl='/fonts/Px437_IBM_VGA_8x16.ttf'
/>
```

### Example 2: Dynamic Viewscreen, Final Mode

Automatically detects and uses the actual size of the ANSI art:

```tsx
<AnsiArtNG
	src='/ansi-art/splash.ans'
	viewscreen='dynamic'
	mode='final'
	bitmapFontUrl='/fonts/Px437_IBM_VGA_8x16.ttf'
/>
```

### Example 3: Dynamic Viewscreen, Animated Mode

Viewport starts at 80x25 and grows as content appears:

```tsx
<AnsiArtNG
	src='/ansi-art/banner.ans'
	viewscreen='dynamic'
	mode='animated'
	bitmapFontUrl='/fonts/Px437_IBM_VGA_8x16.ttf'
	showControls={true}
	bytesPerSecond={9600} // 9600 baud modem speed
	fps={30}
/>
```

## Animation Examples

Animation simulates receiving data over a modem at different baud rates.

### Example 4: Fast Animation (9600 baud, default)

```tsx
<AnsiArtNG
	src='/ansi-art/welcome.ans'
	mode='animated'
	viewscreen='fixed'
	columns={80}
	rows={25}
	bitmapFontUrl='/fonts/Px437_IBM_VGA_8x16.ttf'
	showControls={true}
	bytesPerSecond={9600} // 9600 baud (default)
	fps={30}
/>
```

### Example 5: Slow Animation (1200 baud)

Simulates an early BBS modem connection:

```tsx
<AnsiArtNG
	src='/ansi-art/animation.ans'
	mode='animated'
	viewscreen='fixed'
	columns={80}
	rows={25}
	bitmapFontUrl='/fonts/Px437_IBM_VGA_8x16.ttf'
	showControls={true}
	bytesPerSecond={1200} // Very slow, like early BBS days
	fps={30}
/>
```

### Example 6: Very Fast Animation (57600 baud)

```tsx
<AnsiArtNG
	src='/ansi-art/large-art.ans'
	mode='animated'
	viewscreen='dynamic'
	bitmapFontUrl='/fonts/Px437_IBM_VGA_8x16.ttf'
	showControls={true}
	bytesPerSecond={57600} // Very fast
	fps={60}
/>
```

## Common Baud Rates

Simulate different network speeds by adjusting `bytesPerSecond`:

- `300` - 300 baud (extremely slow, acoustic coupler era)
- `1200` - 1200 baud (early modems, slow)
- `2400` - 2400 baud (common in the 80s)
- `9600` - 9600 baud (common modem speed, default)
- `14400` - 14.4k modem
- `19200` - 19.2k
- `28800` - 28.8k modem
- `57600` - 57.6k (very fast)

## Advanced Examples

### Example 7: Custom Styling and Performance Monitoring

```tsx
<AnsiArtNG
	src='/ansi-art/art.ans'
	mode='animated'
	viewscreen='fixed'
	columns={132}
	rows={50}
	background='#000000'
	bitmapFontUrl='/fonts/Px437_IBM_VGA_8x16.ttf'
	showControls={true}
	showPerformanceOverlay={true}
	fps={30}
	bytesPerSecond={9600}
	allowDrop={true}
/>
```

### Example 8: Disable Drag-and-Drop

```tsx
<AnsiArtNG
	src='/ansi-art/art.ans'
	viewscreen='fixed'
	columns={80}
	rows={25}
	bitmapFontUrl='/fonts/Px437_IBM_VGA_8x16.ttf'
	allowDrop={false}
/>
```

## Complete Example with Multiple Configurations

```tsx
import { useState } from 'react'
import { AnsiArtNG } from 'react-ansiart'

function AnsiArtGallery() {
	const [mode, setMode] = useState<'animated' | 'final'>('final')
	const [viewscreen, setViewscreen] = useState<'fixed' | 'dynamic'>('fixed')
	const [baudRate, setBaudRate] = useState(9600)

	return (
		<div>
			<div style={{ marginBottom: '20px' }}>
				<label>
					Mode:
					<select value={mode} onChange={e => setMode(e.target.value as any)}>
						<option value='final'>Final</option>
						<option value='animated'>Animated</option>
					</select>
				</label>

				<label style={{ marginLeft: '20px' }}>
					Viewscreen:
					<select value={viewscreen} onChange={e => setViewscreen(e.target.value as any)}>
						<option value='fixed'>Fixed</option>
						<option value='dynamic'>Dynamic</option>
					</select>
				</label>

				{mode === 'animated' && (
					<label style={{ marginLeft: '20px' }}>
						Baud Rate:
						<select value={baudRate} onChange={e => setBaudRate(Number(e.target.value))}>
							<option value={1200}>1200 (slow)</option>
							<option value={2400}>2400</option>
							<option value={9600}>9600 (default)</option>
							<option value={19200}>19200</option>
							<option value={57600}>57600 (fast)</option>
						</select>
					</label>
				)}
			</div>

			<AnsiArtNG
				src='/public/ansi/example.ans'
				bitmapFontUrl='/public/ansi/fonts/Bm437_IBM_VGA_8x16.FON'
				mode={mode}
				viewscreen={viewscreen}
				columns={viewscreen === 'fixed' ? 80 : undefined}
				rows={viewscreen === 'fixed' ? 25 : undefined}
				showControls={mode === 'animated'}
				showPerformanceOverlay={mode === 'animated'}
				fps={30}
				bytesPerSecond={baudRate}
			/>
		</div>
	)
}
```

## Props Reference

| Prop                     | Type                    | Default      | Description                                  |
| ------------------------ | ----------------------- | ------------ | -------------------------------------------- |
| `src`                    | `string`                | **required** | URL to ANSI file                             |
| `bitmapFontUrl`          | `string`                | **required** | Path to .FON or raw bitmap font file         |
| `mode`                   | `'animated' \| 'final'` | `'final'`    | Rendering mode                               |
| `viewscreen`             | `'fixed' \| 'dynamic'`  | `'fixed'`    | Viewscreen sizing mode                       |
| `columns`                | `number`                | -            | Required for fixed mode, ignored for dynamic |
| `rows`                   | `number`                | `25`         | Optional for fixed mode, ignored for dynamic |
| `background`             | `string`                | `'#000'`     | Background color (CSS color)                 |
| `showControls`           | `boolean`               | `false`      | Show play/pause/restart controls             |
| `showPerformanceOverlay` | `boolean`               | `false`      | Show performance metrics overlay             |
| `fps`                    | `number`                | `30`         | Frames per second (animated mode)            |
| `bytesPerSecond`         | `number`                | `9600`       | Network speed simulation (baud rate)         |
| `allowDrop`              | `boolean`               | `true`       | Enable drag-and-drop file loading            |

## Mode and Viewscreen Combinations

### Fixed + Final

- Uses provided `columns` and `rows`
- Parses entire file once
- Best for: Standard terminal-sized ANSI art

### Fixed + Animated

- Uses provided `columns` and `rows`
- Progressively renders file at specified baud rate
- Best for: Animated ANSI art in fixed terminal size

### Dynamic + Final

- Detects actual dimensions from file
- Parses entire file once
- Best for: ANSI art of unknown size

### Dynamic + Animated

- Starts at 80x25, grows as content appears
- Progressively renders file at specified baud rate
- Best for: Large ANSI art with progressive reveal
