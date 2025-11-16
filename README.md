# react-ansiart

React components for rendering ANSI art files (.ANS, .ASC) and RIP vector graphics (.RIP), and creating animated virtual displays. Includes support for CP437 character encoding, cursor control codes, progressive animation playback, and procedural frame generation with Perlin noise effects.

## Features

- **ANSI Art Rendering**: Displays .ANS and .ASC files with proper cursor control code support
- **RIP Vector Graphics**: Renders RIP (RIPscrip) vector graphics files, converting them to modern SVG format with full command support
- **Flexible Rendering Modes**: Choose between `final` (complete render) or `animated` (progressive playback) modes
- **Flexible Sizing**: Auto-detect dimensions or use fixed sizes with `columns` and `rows` props supporting `'auto'` values
- **Virtual Display**: Create animated procedural displays using frame generation functions
- **CP437 Encoding**: Full support for Code Page 437 characters including box-drawing and block elements
- **Bitmap Font Rendering**: Pixel-perfect canvas rendering using Windows .FON bitmap fonts for authentic VGA display
- **Progressive Animation**: Animate ANSI sequences progressively to simulate BBS-era terminal playback with configurable modem speeds
- **YouTube-Style Controls**: Overlay controls with seek, speed adjustment, and frame-by-frame navigation
- **Perlin Noise**: Built-in Perlin noise implementation for procedural effects
- **Plasma Effect**: Default animated plasma generator using multi-octave Perlin noise
- **Plasma Background Layout**: Full-page layout component with scrollable plasma background
- **Font Character Chart**: Visualize and explore bitmap font characters
- **Drag & Drop**: Drop .ans, .asc, or .rip files directly onto the component
- **Performance Monitoring**: Optional performance overlay for debugging

## Installation

```bash
npm install react-ansiart
```

## Usage

### Basic Example - Fixed Size, Final Mode

The simplest usage - displays complete ANSI art in a fixed 80 column width with auto-detected height:

```tsx
import { AnsiArt } from 'react-ansiart'

function App() {
	return (
		<AnsiArt
			src='/ansi/example.ans'
			mode='final'
			columns={80}
			bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON'
		/>
	)
}
```

### Auto-Detected Size, Final Mode

Automatically detects and uses the actual size of the ANSI art:

```tsx
import { AnsiArt } from 'react-ansiart'

function App() {
	return (
		<AnsiArt
			src='/ansi/splash.ans'
			mode='final'
			columns='auto'
			bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON'
		/>
	)
}
```

### Animated Playback with Overlay Controls

Progressive animation with YouTube-style overlay controls:

```tsx
import { AnsiArt } from 'react-ansiart'

function App() {
	return (
		<AnsiArt
			src='/ansi/animated.ans'
			mode='animated'
			columns={80}
			rows={25}
			bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON'
			showOverlayControls={true}
			bytesPerSecond={960} // 9600 baud (960 bytes/sec)
			fps={30}
		/>
	)
}
```

### Auto-Detected Size, Animated Mode

Canvas starts at final size and animates progressively:

```tsx
import { AnsiArt } from 'react-ansiart'

function App() {
	return (
		<AnsiArt
			src='/ansi/banner.ans'
			mode='animated'
			columns='auto'
			rows='auto'
			bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON'
			showOverlayControls={true}
			bytesPerSecond={240} // 2400 baud
			fps={30}
		/>
	)
}
```

### With Performance Overlay

Enable performance monitoring for debugging:

```tsx
import { AnsiArt } from 'react-ansiart'

function App() {
	return (
		<AnsiArt
			src='/ansi/art.ans'
			mode='animated'
			columns={80}
			rows={25}
			bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON'
			showPerformanceOverlay={true}
			bytesPerSecond={960}
			fps={30}
		/>
	)
}
```

### Size Configuration Examples

Different combinations of `columns` and `rows`:

**Fixed columns, auto rows (default):**

```tsx
<AnsiArt
	src='/ansi/art.ans'
	mode='final'
	columns={80}
	// rows defaults to 'auto'
	bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON'
/>
```

**Auto columns, auto rows:**

```tsx
<AnsiArt
	src='/ansi/art.ans'
	mode='final'
	columns='auto'
	rows='auto'
	bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON'
/>
```

**Fixed columns, fixed rows:**

```tsx
<AnsiArt
	src='/ansi/art.ans'
	mode='animated'
	columns={80}
	rows={25}
	bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON'
/>
```

**Auto columns, fixed rows:**

```tsx
<AnsiArt
	src='/ansi/art.ans'
	mode='animated'
	columns='auto'
	rows={30}
	bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON'
/>
```

## RIP Vector Graphics

The `RipArt` component renders RIP (RIPscrip) vector graphics files, converting them to modern SVG format. RIP was a popular vector graphics format used on BBS systems in the 1990s.

### Basic Example - Auto-Detected Size, Final Mode

The simplest usage - displays complete RIP graphics with auto-detected dimensions:

```tsx
import { RipArt } from 'react-ansiart'

function App() {
	return <RipArt url='/rip/example.rip' mode='final' width='auto' height='auto' />
}
```

### Fixed Size, Final Mode

Display RIP graphics with fixed dimensions:

```tsx
import { RipArt } from 'react-ansiart'

function App() {
	return <RipArt url='/rip/art.rip' mode='final' width={640} height={350} background='#000000' />
}
```

### Animated Playback with Overlay Controls

Progressive animation with YouTube-style overlay controls:

```tsx
import { RipArt } from 'react-ansiart'

function App() {
	return (
		<RipArt
			url='/rip/animated.rip'
			mode='animated'
			width='auto'
			height='auto'
			showOverlayControls={true}
			bytesPerSecond={960} // 9600 baud (960 bytes/sec)
			fps={30}
		/>
	)
}
```

### Auto-Detection Mode

Automatically detect if the RIP file contains animation:

```tsx
import { RipArt } from 'react-ansiart'

function App() {
	return (
		<RipArt
			url='/rip/file.rip'
			mode='auto' // Automatically detects animation
			width='auto' // Auto-detect from viewport
			height='auto' // Auto-detect from viewport
			showOverlayControls={true}
		/>
	)
}
```

### Drag and Drop

Drop `.rip` files directly onto the component:

```tsx
import { RipArt } from 'react-ansiart'

function App() {
	return (
		<RipArt
			allowDrop={true} // Enable drag-and-drop (default)
		/>
	)
}
```

### Custom Background

Set a custom background color:

```tsx
import { RipArt } from 'react-ansiart'

function App() {
	return <RipArt url='/rip/art.rip' background='#1a1a1a' width={640} height={480} />
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

### With Overlay Controls

```tsx
import { AnsiVirtualDisplay } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={120}
			rows={40}
			bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON'
			fps={60}
			showOverlayControls={true}
		/>
	)
}
```

### Fill Container Width

```tsx
import { AnsiVirtualDisplay } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON'
			fillContainer={true}
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

| Prop                     | Type                    | Default      | Description                                                                                                                              |
| ------------------------ | ----------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src`                    | `string`                | **required** | URL or path to ANSI art file                                                                                                             |
| `mode`                   | `'animated' \| 'final'` | `'final'`    | Rendering mode: `'final'` displays complete art, `'animated'` shows progressive playback                                                 |
| `columns`                | `number \| 'auto'`      | `80`         | Number of columns or `'auto'` to detect natural width                                                                                    |
| `rows`                   | `number \| 'auto'`      | `'auto'`     | Number of rows or `'auto'` to display full height. In final mode, `'auto'` auto-detects; in animated mode, `'auto'` uses final height    |
| `background`             | `string`                | `'#000'`     | Background color (any valid CSS color)                                                                                                   |
| `bitmapFontUrl`          | `string`                | **required** | URL or path to .FON bitmap font file                                                                                                     |
| `showControls`           | `boolean`               | `false`      | Show simple play/pause/restart controls (deprecated, use `showOverlayControls` instead)                                                  |
| `showOverlayControls`    | `boolean`               | `false`      | Show YouTube-style overlay controls with seek, speed adjustment, and frame navigation (only for animated mode with supported generators) |
| `showPerformanceOverlay` | `boolean`               | `false`      | Show performance metrics overlay for debugging                                                                                           |
| `fps`                    | `number`                | `30`         | Frames per second (only used in animated mode)                                                                                           |
| `bytesPerSecond`         | `number`                | `960`        | Bytes per second for animation speed (NOT baud). For reference: 1200 baud ≈ 120 bytes/sec, 9600 baud ≈ 960 bytes/sec                     |
| `allowDrop`              | `boolean`               | `true`       | Enable drag-and-drop file loading                                                                                                        |
| `debugCursorCodes`       | `boolean`               | `false`      | Log ANSI cursor control codes to console for debugging                                                                                   |

### RipArt Props

| Prop                     | Type                              | Default     | Description                                                                                                                        |
| ------------------------ | --------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `url`                    | `string`                          | -           | URL or path to RIP file (optional if using drag-and-drop)                                                                          |
| `mode`                   | `'animated' \| 'final' \| 'auto'` | `'auto'`    | Rendering mode: `'final'` displays complete art, `'animated'` shows progressive playback, `'auto'` detects animation automatically |
| `width`                  | `number \| 'auto'`                | `'auto'`    | Canvas width in pixels or `'auto'` to detect from viewport                                                                         |
| `height`                 | `number \| 'auto'`                | `'auto'`    | Canvas height in pixels or `'auto'` to detect from viewport                                                                        |
| `background`             | `string`                          | `'#000000'` | Background color (any valid CSS color)                                                                                             |
| `allowDrop`              | `boolean`                         | `true`      | Enable drag-and-drop file loading                                                                                                  |
| `showOverlayControls`    | `boolean`                         | `false`     | Show YouTube-style overlay controls with seek, speed adjustment, and frame navigation (only for animated mode)                     |
| `showPerformanceOverlay` | `boolean`                         | `false`     | Show performance metrics overlay for debugging                                                                                     |
| `fps`                    | `number`                          | `30`        | Frames per second (only used in animated mode)                                                                                     |
| `bytesPerSecond`         | `number`                          | `960`       | Bytes per second for animation speed (NOT baud). For reference: 1200 baud ≈ 120 bytes/sec, 9600 baud ≈ 960 bytes/sec               |
| `autoStart`              | `boolean`                         | `true`      | Start animation automatically on file load (only applies to animated mode)                                                         |

### AnsiVirtualDisplay Props

| Prop                     | Type                    | Default      | Description                                                                                 |
| ------------------------ | ----------------------- | ------------ | ------------------------------------------------------------------------------------------- |
| `columns`                | `number`                | `80`         | Number of character columns (visible viewport)                                              |
| `rows`                   | `number`                | `25`         | Number of character rows (visible viewport)                                                 |
| `frameGenerator`         | `DisplayFrameGenerator` | **required** | Function that generates frame data (character-based or pixel-based)                         |
| `fps`                    | `number`                | `30`         | Frames per second                                                                           |
| `background`             | `string`                | `'#000'`     | Background color (any valid CSS color)                                                      |
| `bitmapFont`             | `BitmapFont`            | -            | Pre-loaded font object (avoids duplicate loading if provided)                               |
| `bitmapFontUrl`          | `string`                | -            | URL or path to .FON bitmap font file (required if `bitmapFont` not provided)                |
| `showControls`           | `boolean`               | `false`      | Show simple play/pause/restart controls (deprecated, use `showOverlayControls` instead)     |
| `showOverlayControls`    | `boolean`               | `false`      | Show YouTube-style overlay controls (only for generators with `capabilities` support)       |
| `showPerformanceOverlay` | `boolean`               | `false`      | Show performance metrics overlay for debugging                                              |
| `fillContainer`          | `boolean`               | `false`      | Fill container width instead of fit-content                                                 |
| `virtualColumns`         | `number`                | -            | Virtual world width in character columns (defaults to `columns` for backward compatibility) |
| `virtualRows`            | `number`                | -            | Virtual world height in character rows (defaults to `rows` for backward compatibility)      |
| `viewX`                  | `number`                | `0`          | Viewport X position within virtual world (character coordinates)                            |
| `viewY`                  | `number`                | `0`          | Viewport Y position within virtual world (character coordinates)                            |
| `pixelOffsetX`           | `number`                | `0`          | Pixel offset X for smooth scrolling (sub-character precision)                               |
| `pixelOffsetY`           | `number`                | `0`          | Pixel offset Y for smooth scrolling (sub-character precision)                               |
| `onViewChange`           | `function`              | -            | Callback when viewport position changes: `(view: { viewX: number; viewY: number }) => void` |

## Additional Components

### PlasmaBackgroundLayout

A full-page layout component that provides an animated plasma background behind scrollable content. Perfect for creating retro-themed websites with animated backgrounds.

#### Fixed Mode

The plasma background stays fixed while content scrolls over it:

```tsx
import { PlasmaBackgroundLayout } from 'react-ansiart'

function App() {
	return (
		<PlasmaBackgroundLayout mode='fixed' bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON' fps={30}>
			<div style={{ padding: '40px', color: '#fff' }}>
				<h1>My Content</h1>
				<p>This content scrolls over the animated plasma background.</p>
			</div>
		</PlasmaBackgroundLayout>
	)
}
```

#### Scrollable Mode

The plasma background scrolls with the content, creating a seamless infinite background:

```tsx
import { PlasmaBackgroundLayout } from 'react-ansiart'

function App() {
	return (
		<PlasmaBackgroundLayout
			mode='scrollable'
			bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON'
			fps={30}
			timeScale={0.5}
		>
			<div style={{ padding: '40px', color: '#fff', minHeight: '200vh' }}>
				<h1>Long Content</h1>
				<p>The plasma background scrolls with this content.</p>
			</div>
		</PlasmaBackgroundLayout>
	)
}
```

#### Custom Plasma Options

```tsx
import { PlasmaBackgroundLayout } from 'react-ansiart'

function App() {
	return (
		<PlasmaBackgroundLayout
			mode='fixed'
			bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON'
			chars={['.', ':', ';', '=', '+', '*', '#', '%', '@']}
			timeScale={0.3}
			fgColor='#00ff00'
			bgColor='#000000'
			octaves={[
				{ scale: 0.1, amplitude: 1.0 },
				{ scale: 0.05, amplitude: 0.5 },
			]}
			fps={60}
		>
			<div>Content here</div>
		</PlasmaBackgroundLayout>
	)
}
```

#### PlasmaBackgroundLayout Props

| Prop                     | Type                      | Default      | Description                                                                        |
| ------------------------ | ------------------------- | ------------ | ---------------------------------------------------------------------------------- |
| `children`               | `ReactNode`               | **required** | Content to display over the plasma background                                      |
| `mode`                   | `'fixed' \| 'scrollable'` | `'fixed'`    | Background mode: `'fixed'` stays in place, `'scrollable'` scrolls with content     |
| `bitmapFontUrl`          | `string`                  | **required** | URL or path to .FON bitmap font file                                               |
| `fps`                    | `number`                  | `30`         | Frames per second                                                                  |
| `chars`                  | `string[]`                | -            | Array of characters to use for ASCII rendering (defaults to standard plasma chars) |
| `timeScale`              | `number`                  | `1.0`        | Animation speed multiplier                                                         |
| `octaves`                | `OctaveConfig[]`          | -            | Perlin noise octave configurations for multi-layered effects                       |
| `seed`                   | `number`                  | -            | Random seed for noise generation                                                   |
| `fgColor`                | `string`                  | -            | Foreground color (CSS color string)                                                |
| `bgColor`                | `string`                  | -            | Background color (CSS color string)                                                |
| `virtualWidthPx`         | `number`                  | -            | Virtual world width in pixels (calculated from content if not provided)            |
| `virtualHeightPx`        | `number`                  | -            | Virtual world height in pixels (calculated from content if not provided)           |
| `showPerformanceOverlay` | `boolean`                 | `false`      | Show performance metrics overlay                                                   |
| `contentClassName`       | `string`                  | -            | CSS class name for content container                                               |
| `contentStyle`           | `CSSProperties`           | -            | Inline styles for content container                                                |
| `plasmaClassName`        | `string`                  | -            | CSS class name for plasma background container                                     |

### FontCharacterChart

A component for visualizing and exploring bitmap font characters. Useful for understanding character darkness values and selecting characters for ASCII art generation.

```tsx
import { FontCharacterChart } from 'react-ansiart'

function App() {
	return <FontCharacterChart bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON' />
}
```

#### FontCharacterChart Props

| Prop            | Type     | Default      | Description                          |
| --------------- | -------- | ------------ | ------------------------------------ |
| `bitmapFontUrl` | `string` | **required** | URL or path to .FON bitmap font file |

The component displays all printable characters (32-255) with their visual representation and darkness percentage. Click any character to copy it to the clipboard. Use the sort button to organize characters by darkness value.

## Frame Generators

Frame generators create the visual content for `AnsiVirtualDisplay`. There are two types of generators:

### Character-Based Generators

Character-based generators directly produce ANSI screen data:

```tsx
type CharacterFrameGenerator = (frame: number, columns: number, rows: number) => AnsiScreen

type AnsiScreen = {
	lines: Array<
		Array<{
			char: string
			fgColor?: number
			bgColor?: number
			bold?: boolean
		}>
	>
	columns: number
}
```

### Pixel-Based Generators

Pixel-based generators produce RGB pixel data that gets converted to ANSI:

```tsx
type FrameGenerator = (frame: number, width: number, height: number) => FrameData

type FrameData = {
	width: number
	height: number
	pixels: Uint8Array // RGB format: 3 bytes per pixel (r, g, b)
}
```

### DisplayFrameGenerator Type

`AnsiVirtualDisplay` accepts either type:

```tsx
type DisplayFrameGenerator = CharacterFrameGenerator | PixelFrameGenerator
```

### Generator Capabilities

For generators that support overlay controls, you can add metadata:

```tsx
type CharacterFrameGeneratorWithMetadata = CharacterFrameGenerator & {
	capabilities?: {
		supportsSeek: boolean
		supportsSpeedControl: boolean
		getTotalBytes?: () => number
	}
	setSpeed?: (bytesPerSecond: number) => void
	seekToFrame?: (frame: number) => void
	getCurrentBytePosition?: () => number
	advanceByte?: () => void
	rewindByte?: () => void
}
```

When a generator has `capabilities`, `showOverlayControls={true}` will enable YouTube-style controls.

### Creating Custom Frame Generators

#### Pixel-Based Generator Example

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
			fps={30}
		/>
	)
}
```

#### Character-Based Generator Example

For more control, create a character-based generator:

```tsx
import { AnsiVirtualDisplay, type CharacterFrameGenerator } from 'react-ansiart'

const checkerboardGenerator: CharacterFrameGenerator = (frame, columns, rows) => {
	const lines: Array<Array<{ char: string; fgColor?: number; bgColor?: number }>> = []
	const size = 10
	const offset = Math.floor(frame / 5) % size

	for (let y = 0; y < rows; y++) {
		const line: Array<{ char: string; fgColor?: number; bgColor?: number }> = []
		for (let x = 0; x < columns; x++) {
			const checkX = Math.floor((x + offset) / size) % 2
			const checkY = Math.floor(y / size) % 2
			const isWhite = (checkX + checkY) % 2 === 0

			line.push({
				char: '█',
				fgColor: isWhite ? 15 : 0,
				bgColor: isWhite ? 0 : 15,
			})
		}
		lines.push(line)
	}

	return { lines, columns }
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

## Utility Functions and Exports

### Color Conversion Utilities

```tsx
import {
	rgbToAnsiColor,
	rgbToPaletteColor,
	generateEvenlySpacedPalette,
	getPalette,
	ANSI_COLORS_RGB,
	type PaletteMode,
} from 'react-ansiart'
```

- **`rgbToAnsiColor(r, g, b)`** - Convert RGB (0-255) to closest ANSI color index (0-15)
- **`rgbToPaletteColor(r, g, b, palette)`** - Convert RGB to closest color in custom palette
- **`generateEvenlySpacedPalette(size)`** - Generate evenly spaced color palette
- **`getPalette(mode)`** - Get palette for a given mode (`'ansi16'`, `'unconstrained'`, or custom size)
- **`ANSI_COLORS_RGB`** - Array of ANSI 16-color RGB values

### Perlin Noise Utilities

```tsx
import { perlinNoise, perlinNoise2D, perlinNoise3D } from 'react-ansiart'
```

- **`perlinNoise(x, y, z?)`** - Generate Perlin noise values (-1 to 1)
- **`perlinNoise2D(x, y)`** - 2D Perlin noise
- **`perlinNoise3D(x, y, z)`** - 3D Perlin noise

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

### Font Loading Utilities

```tsx
import {
	loadBitmapFontFromUrl,
	loadRawBitmapFont,
	extractFontFromFON,
	renderGlyph,
	renderText,
	type BitmapFont,
	type FontExtractionResult,
} from 'react-ansiart'
```

- **`loadBitmapFontFromUrl(url)`** - Load a bitmap font from a URL (supports .FON files and raw bitmap data)
- **`loadRawBitmapFont(url, width, height)`** - Load raw bitmap font data
- **`extractFontFromFON(url)`** - Extract font from Windows .FON file
- **`renderGlyph(ctx, font, charCode, x, y, fgColor, bgColor)`** - Render a single glyph to canvas
- **`renderText(ctx, font, text, x, y, fgColor, bgColor)`** - Render text to canvas

### ANSI Parser Utilities

```tsx
import {
	parseAnsi,
	parseAscii,
	parseSauce,
	detectAnimation,
	getSauceInfo,
	type SauceMetadata,
	type CharacterEncoding,
} from 'react-ansiart'
```

- **`parseAnsi(data)`** - Parse ANSI art file data
- **`parseAscii(data, encoding?)`** - Parse ASCII art file
- **`parseSauce(data)`** - Parse SAUCE metadata from file
- **`detectAnimation(data)`** - Detect if file contains animation sequences
- **`getSauceInfo(data)`** - Extract SAUCE metadata information

### Frame Generator Utilities

```tsx
import {
	createAnsiArtFrameGenerator,
	createAnsiFrameGenerator,
	generateAsciiPerlinPlasmaFrame,
	createAsciiPerlinPlasmaSampler,
	convertFrameDataToAnsi,
	type AnsiArtFrameGeneratorOptions,
	type AnsiFrameGeneratorOptions,
	type AsciiPerlinPlasmaOptions,
} from 'react-ansiart'
```

- **`createAnsiArtFrameGenerator(options)`** - Create frame generator from ANSI art file
- **`createAnsiFrameGenerator(options)`** - Create frame generator with animation support
- **`generateAsciiPerlinPlasmaFrame(frame, columns, rows, options?)`** - Generate ASCII plasma frame
- **`createAsciiPerlinPlasmaSampler(frame, options?)`** - Create plasma sampler function
- **`convertFrameDataToAnsi(frameData, columns, rows, palette?)`** - Convert pixel frame data to ANSI screen

### Performance Utilities

```tsx
import { drawPerformanceOverlay, type PerformanceStats } from 'react-ansiart'
```

- **`drawPerformanceOverlay(ctx, stats, x, y)`** - Draw performance overlay on canvas

## Animation and Modem Speed Simulation

When using `mode='animated'`, the component progressively renders ANSI sequences at a configurable byte rate. The `bytesPerSecond` prop controls the playback speed by simulating data transfer rates.

### Understanding Bytes Per Second vs Baud

**Important**: The `bytesPerSecond` prop uses bytes per second, not baud rate. Serial communication typically uses 8 data bits + 1 start bit + 1 stop bit = 10 bits per byte, so:

**bytes/sec ≈ baud / 10**

For example:

- 1200 baud ≈ 120 bytes/sec
- 9600 baud ≈ 960 bytes/sec
- 56k baud ≈ 5600 bytes/sec

### Modem Speed Equivalents

The following table provides `bytesPerSecond` values to simulate classic BBS modem speeds:

| Modem Speed | Baud Rate       | `bytesPerSecond` | Notes                                  |
| ----------- | --------------- | ---------------- | -------------------------------------- |
| 300 baud    | ~30 bytes/sec   | `30`             | Very slow, classic early BBS era       |
| 1200 baud   | ~120 bytes/sec  | `120`            | Common in early 1980s                  |
| 2400 baud   | ~240 bytes/sec  | `240`            | Standard in mid-1980s                  |
| 9600 baud   | ~960 bytes/sec  | `960`            | Fast by late 1980s standards (default) |
| 14.4k baud  | ~1440 bytes/sec | `1440`           | Popular in early 1990s                 |
| 28.8k baud  | ~2880 bytes/sec | `2880`           | Mid-1990s standard                     |
| 33.6k baud  | ~3360 bytes/sec | `3360`           | Late 1990s                             |
| 56k baud    | ~5600 bytes/sec | `5600`           | Maximum dial-up speed                  |

**Note**: Actual display speed depends on:

- File content (escape sequences vs. text density)
- Network/server latency (not simulated)
- Terminal software rendering speed (varies by implementation)

For a more authentic experience, typical BBS ANSI art animations were often optimized for **1200-2400 baud** connections, so `bytesPerSecond` values of **120-240** provide a good retro feel.

### Overlay Controls

When `showOverlayControls={true}` is enabled, users get YouTube-style controls including:

- **Seek bar**: Click or drag to jump to any position in the animation
- **Speed selector**: Choose from preset modem speeds (300 baud to 56k baud)
- **Frame navigation**: Step forward/backward one byte at a time
- **Play/Pause**: Control playback
- **Time display**: Shows current time and total duration

Example with overlay controls:

```tsx
<AnsiArt
	mode='animated'
	columns={80}
	rows={25}
	bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON'
	showOverlayControls={true}
	bytesPerSecond={240} // 2400 baud
	fps={30}
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
