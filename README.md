# react-ansiart

A React component for rendering ANSI art files (.ANS, .ASC) with support for CP437 character encoding, cursor control codes, and progressive animation playback.

## Features

- **ANSI Art Rendering**: Displays .ANS and .ASC files with proper cursor control code support
- **CP437 Encoding**: Full support for Code Page 437 characters including box-drawing and block elements
- **Dual Rendering Modes**:
  - DOM mode: Uses HTML/CSS with fallback fonts
  - Canvas mode: Pixel-perfect rendering with optional bitmap font support
- **Bitmap Font Support**: Load and use Windows .FON bitmap fonts for authentic VGA display
- **Progressive Animation**: Animate ANSI sequences progressively to simulate BBS-era terminal playback
- **Drag & Drop**: Drop .ans or .asc files directly onto the component
- **Playback Controls**: Optional play/pause/restart controls for animated mode

## Installation

```bash
npm install react-ansiart
```

## Usage

### Basic Example

```tsx
import { AnsiArt } from 'react-ansiart'

function App() {
	return <AnsiArt src='/ansi/example.ans' columns={80} renderMode='canvas' />
}
```

### With Bitmap Font

```tsx
import { AnsiArt } from 'react-ansiart'

function App() {
	return (
		<AnsiArt
			src='/ansi/example.ans'
			columns={80}
			renderMode='canvas'
			bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON'
		/>
	)
}
```

### Animated Playback

```tsx
import { AnsiArt } from 'react-ansiart'

function App() {
	return (
		<AnsiArt
			src='/ansi/animated.ans'
			columns={80}
			renderMode='canvas'
			animated={true}
			frameDelay={200}
			animationSpeed={1.0}
			showControls={true}
		/>
	)
}
```

### Debug Font Rendering

```tsx
import { AnsiArt } from 'react-ansiart'

function App() {
	return (
		<AnsiArt
			src='/ansi/charset-test.ans'
			columns={16}
			renderMode='canvas'
			bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON'
			debugFont={true}
		/>
	)
}
```

## Props

| Prop             | Type                | Default      | Description                                             |
| ---------------- | ------------------- | ------------ | ------------------------------------------------------- |
| `src`            | `string`            | **required** | URL or path to ANSI art file                            |
| `columns`        | `number`            | `80`         | Number of columns (standard BBS width)                  |
| `fontSizePx`     | `number`            | `16`         | Font size in pixels (DOM mode)                          |
| `fontFamily`     | `string`            | -            | Override default font stack                             |
| `background`     | `string`            | `'#000'`     | Background color                                        |
| `allowDrop`      | `boolean`           | `true`       | Enable drag-and-drop file loading                       |
| `yScale`         | `number`            | `1.2`        | Vertical scaling factor (DOM mode, emulates VGA aspect) |
| `renderMode`     | `'dom' \| 'canvas'` | `'dom'`      | Rendering mode                                          |
| `cellWidthPx`    | `number`            | `8`          | Character cell width (canvas mode)                      |
| `cellHeightPx`   | `number`            | `16`         | Character cell height (canvas mode)                     |
| `bitmapFontUrl`  | `string`            | -            | URL or path to .FON bitmap font file                    |
| `debugFont`      | `boolean`           | `false`      | Render font glyphs to debug canvas                      |
| `animated`       | `boolean`           | `false`      | Enable progressive animation playback                   |
| `frameDelay`     | `number`            | `50`         | Delay between frames in milliseconds                    |
| `animationSpeed` | `number`            | `1.0`        | Speed multiplier (applied to frameDelay)                |
| `showControls`   | `boolean`           | `false`      | Show play/pause/restart controls                        |

## Animation and Modem Speed Simulation

When using `animated={true}`, the component progressively renders ANSI sequences with configurable frame delays. The `frameDelay` prop controls the time between render points (after escape sequences, newlines, or batches of characters).

### Modem Speed Equivalents

The following table provides approximate `frameDelay` values to simulate classic BBS modem speeds. These are rough approximations based on typical character rendering rates:

| Modem Speed | Baud Rate       | Recommended `frameDelay` | Notes                            |
| ----------- | --------------- | ------------------------ | -------------------------------- |
| 300 baud    | ~30 bytes/sec   | `800-1200ms`             | Very slow, classic early BBS era |
| 1200 baud   | ~120 bytes/sec  | `200-300ms`              | Common in early 1980s            |
| 2400 baud   | ~240 bytes/sec  | `100-150ms`              | Standard in mid-1980s            |
| 9600 baud   | ~960 bytes/sec  | `25-50ms`                | Fast by late 1980s standards     |
| 14.4k baud  | ~1440 bytes/sec | `15-30ms`                | Popular in early 1990s           |
| 28.8k baud  | ~2880 bytes/sec | `8-15ms`                 | Mid-1990s standard               |
| 33.6k baud  | ~3360 bytes/sec | `6-12ms`                 | Late 1990s                       |
| 56k baud    | ~5600 bytes/sec | `4-8ms`                  | Maximum dial-up speed            |

**Note**: Actual display speed depends on:

- File content (escape sequences vs. text density)
- Network/server latency (not simulated)
- Terminal software rendering speed (varies by implementation)

For a more authentic experience, typical BBS ANSI art animations were often optimized for **1200-2400 baud** connections, so `frameDelay` values of **150-250ms** provide a good retro feel.

### Animation Speed Multiplier

Use `animationSpeed` to adjust playback rate:

- `animationSpeed={0.5}` - Half speed (doubles effective frameDelay)
- `animationSpeed={1.0}` - Normal speed
- `animationSpeed={2.0}` - Double speed (halves effective frameDelay)

Example for 2x speed at 2400 baud:

```tsx
<AnsiArt
	animated={true}
	frameDelay={150} // 2400 baud equivalent
	animationSpeed={2.0} // Play 2x faster
/>
```

## Character Encoding

The component uses Code Page 437 (CP437) encoding, the standard character set for DOS/VGA text mode. This includes:

- Standard ASCII (0x20-0x7E)
- Extended ASCII with box-drawing characters (0x80-0xFF)
- Control characters mapped to visible CP437 glyphs (0x00-0x1F)

Control characters (except LF, CR, TAB) are replaced with spaces in the current implementation.

## Bitmap Font Format

The component supports Windows .FON (New Executable) font files containing raw 8×16 pixel bitmap fonts. The font extractor:

- Parses NE executable format
- Locates font resources in the resource table
- Extracts raw 8×16 bitmap data (4096 bytes for 256 characters)
- Automatically detects correct bitmap offset using heuristic validation

## ANSI Code Support

The parser supports standard ANSI escape sequences:

- **Cursor Movement**: `[H]`, `[A]`, `[B]`, `[C]`, `[D]`, `[G]`, `[f]`
- **Cursor Save/Restore**: `[s]`, `[u]`
- **Screen Clearing**: `[J]`, `[K]`
- **Color/Attributes**: `[m]` (SGR - Select Graphic Rendition)
  - Foreground colors: 30-37, 90-97
  - Background colors: 40-47, 100-107
  - Bold: 1, Normal: 22

## File Loading

The component loads ANSI files and fonts via URLs using the `fetch` API. You can provide:

- Absolute URLs: `https://example.com/file.ans`
- Relative URLs (works with bundlers that support static assets): `/assets/file.ans`
- Data URLs: For small files bundled with your app

In frameworks like Next.js, place static files in the `public/` directory:
- ANSI files: `public/ansi/*.ans` → accessible at `/ansi/*.ans`
- Font files: `public/ansi/fonts/*.FON` → accessible at `/ansi/fonts/*.FON`

## Browser Compatibility

Requires:

- Modern browser with Canvas API support
- ES2020+ JavaScript features
- Fetch API for file loading

## License

MIT

