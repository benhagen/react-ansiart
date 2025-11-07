# react-ansiart

React components for rendering ANSI art files (.ANS, .ASC) and creating animated virtual displays. Includes support for CP437 character encoding, cursor control codes, progressive animation playback, and procedural frame generation with Perlin noise effects.

## Features

- **ANSI Art Rendering**: Displays .ANS and .ASC files with proper cursor control code support
- **Virtual Display**: Create animated procedural displays using frame generation functions
- **CP437 Encoding**: Full support for Code Page 437 characters including box-drawing and block elements
- **Bitmap Font Rendering**: Pixel-perfect canvas rendering using Windows .FON bitmap fonts for authentic VGA display
- **Progressive Animation**: Animate ANSI sequences progressively to simulate BBS-era terminal playback
- **Perlin Noise**: Built-in Perlin noise implementation for procedural effects
- **Plasma Effect**: Default animated plasma generator using multi-octave Perlin noise
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
	return (
		<AnsiArt src='/ansi/example.ans' columns={80} bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON' />
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
			bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON'
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
			bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON'
			debugFont={true}
		/>
	)
}
```

## Virtual Display

The `AnsiVirtualDisplay` component creates an animated virtual display that generates frames using a callback function. It's perfect for creating procedural animations, demos, and effects rendered in ANSI style.

### Basic Plasma Example

```tsx
import { AnsiVirtualDisplay } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON'
			fps={30}
		/>
	)
}
```

### With Custom Display Size and Controls

```tsx
import { AnsiVirtualDisplay } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={120}
			rows={40}
			cellWidthPx={8}
			cellHeightPx={16}
			bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON'
			fps={60}
			showControls={true}
		/>
	)
}
```

### With Custom Palette

```tsx
import { AnsiVirtualDisplay } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON'
			palette={64} // Use 64 evenly-spaced colors for better color accuracy
			fps={30}
		/>
	)
}
```

### Unconstrained Palette Mode

```tsx
import { AnsiVirtualDisplay } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON'
			palette='unconstrained' // Use 256 colors for maximum color fidelity
			fps={30}
		/>
	)
}
```

### Custom Frame Generator

```tsx
import { AnsiVirtualDisplay, type FrameGenerator, type FrameData } from 'react-ansiart'

// Create a custom frame generator
const checkerboardGenerator: FrameGenerator = (frame, width, height) => {
	const pixels = new Uint8Array(width * height * 3)
	const size = 10
	const offset = Math.floor(frame / 5) % size

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const checkX = Math.floor((x + offset) / size) % 2
			const checkY = Math.floor(y / size) % 2
			const isWhite = (checkX + checkY) % 2 === 0

			const index = (y * width + x) * 3
			const value = isWhite ? 255 : 0
			pixels[index] = value // R
			pixels[index + 1] = value // G
			pixels[index + 2] = value // B
		}
	}

	return { width, height, pixels }
}

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON'
			frameGenerator={checkerboardGenerator}
			fps={30}
		/>
	)
}
```

## Props

### AnsiArt Props

| Prop             | Type      | Default      | Description                              |
| ---------------- | --------- | ------------ | ---------------------------------------- |
| `src`            | `string`  | **required** | URL or path to ANSI art file             |
| `columns`        | `number`  | `80`         | Number of columns (standard BBS width)   |
| `background`     | `string`  | `'#000'`     | Background color                         |
| `allowDrop`      | `boolean` | `true`       | Enable drag-and-drop file loading        |
| `bitmapFontUrl`  | `string`  | **required** | URL or path to .FON bitmap font file     |
| `debugFont`      | `boolean` | `false`      | Render font glyphs to debug canvas       |
| `animated`       | `boolean` | `false`      | Enable progressive animation playback    |
| `frameDelay`     | `number`  | `50`         | Delay between frames in milliseconds     |
| `animationSpeed` | `number`  | `1.0`        | Speed multiplier (applied to frameDelay) |
| `showControls`   | `boolean` | `false`      | Show play/pause/restart controls         |

### AnsiVirtualDisplay Props

| Prop             | Type             | Default               | Description                                                                                                        |
| ---------------- | ---------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `columns`        | `number`         | `80`                  | Number of character columns                                                                                        |
| `rows`           | `number`         | `25`                  | Number of character rows                                                                                           |
| `cellWidthPx`    | `number`         | `8`                   | Character cell width in pixels                                                                                     |
| `cellHeightPx`   | `number`         | `16`                  | Character cell height in pixels                                                                                    |
| `frameGenerator` | `FrameGenerator` | `generatePlasmaFrame` | Function that generates frame data                                                                                 |
| `fps`            | `number`         | `30`                  | Frames per second                                                                                                  |
| `background`     | `string`         | `'#000'`              | Background color                                                                                                   |
| `bitmapFontUrl`  | `string`         | **required**          | URL or path to .FON bitmap font file                                                                               |
| `showControls`   | `boolean`        | `false`               | Show play/pause/restart controls                                                                                   |
| `palette`        | `PaletteMode`    | `'ansi16'`            | Color palette mode: `'ansi16'` (16 ANSI colors), `'unconstrained'` (256 colors), or `number` (custom palette size) |

## Frame Generators

A `FrameGenerator` is a function that creates RGB pixel data for each frame:

```tsx
type FrameGenerator = (frame: number, width: number, height: number) => FrameData

type FrameData = {
	width: number
	height: number
	pixels: Uint8Array // RGB format: 3 bytes per pixel (r, g, b)
}
```

The library includes a built-in plasma generator (`generatePlasmaFrame`) that uses Perlin noise to create flowing, organic patterns. You can also create custom generators for any effect you want.

### Using Built-in Plasma Generator

```tsx
import { AnsiVirtualDisplay, generatePlasmaFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON'
			frameGenerator={generatePlasmaFrame}
			fps={30}
		/>
	)
}
```

### Creating Custom Frame Generators

The `pixels` array stores RGB values in row-major order:

- Index `(y * width + x) * 3` = Red
- Index `(y * width + x) * 3 + 1` = Green
- Index `(y * width + x) * 3 + 2` = Blue

Example: Simple gradient animation

```tsx
import { AnsiVirtualDisplay, type FrameGenerator } from 'react-ansiart'

const gradientGenerator: FrameGenerator = (frame, width, height) => {
	const pixels = new Uint8Array(width * height * 3)
	const offset = (frame % 360) / 360

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const hue = (x / width + offset) % 1
			const [r, g, b] = hslToRgb(hue, 1, 0.5)

			const index = (y * width + x) * 3
			pixels[index] = r
			pixels[index + 1] = g
			pixels[index + 2] = b
		}
	}

	return { width, height, pixels }
}

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON'
			frameGenerator={gradientGenerator}
		/>
	)
}
```

### Color Conversion Utilities

The library exports utilities for working with colors:

- `rgbToAnsiColor(r, g, b)` - Convert RGB (0-255) to closest ANSI color index (0-15)
- `rgbToPaletteColor(r, g, b, palette)` - Convert RGB to closest color in custom palette
- `generateEvenlySpacedPalette(size)` - Generate evenly spaced color palette
- `getPalette(mode)` - Get palette for a given mode (`'ansi16'`, `'unconstrained'`, or custom size)
- `ANSI_COLORS_RGB` - Array of ANSI 16-color RGB values
- `perlinNoise(x, y, z?)` - Generate Perlin noise values (-1 to 1)
- `perlinNoise2D(x, y)` - 2D Perlin noise
- `perlinNoise3D(x, y, z)` - 3D Perlin noise

### Palette Modes

The `palette` prop controls how colors are matched and rendered:

- **`'ansi16'`** (default): Uses the standard ANSI 16-color VGA palette. This provides authentic retro terminal colors.

- **`'unconstrained'`**: Uses 256 evenly-spaced colors for color matching. Provides better color accuracy while still rendering with ANSI-style characters.

- **`number`** (e.g., `64`, `128`): Generates a custom palette with the specified number of evenly-spaced colors across the RGB spectrum. Useful for balancing color accuracy with performance.

**Note**: While custom palettes provide better color matching during conversion, rendering still uses the ANSI 16-color set for display. The palette affects how source RGB colors are matched to the available ANSI colors.

Example: Using Perlin noise in custom generator

```tsx
import { AnsiVirtualDisplay, perlinNoise3D, type FrameGenerator } from 'react-ansiart'

const noiseGenerator: FrameGenerator = (frame, width, height) => {
	const pixels = new Uint8Array(width * height * 3)
	const time = frame * 0.1

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const noise = perlinNoise3D(x * 0.1, y * 0.1, time)
			const value = Math.floor((noise + 1) * 127.5)

			const index = (y * width + x) * 3
			pixels[index] = value
			pixels[index + 1] = value
			pixels[index + 2] = value
		}
	}

	return { width, height, pixels }
}
```

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

## References

https://mrogalski.eu/ansi-art/
