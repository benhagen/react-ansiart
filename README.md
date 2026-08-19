# react-ansiart

> 🤖❤️ **Built by human-assisted and curated AI — for the love of ANSI art.** The code, tests, and docs in this library were written by AI agents working under human direction, review, and curation.

React components for rendering ANSI art files (.ANS, .ASC) and creating animated virtual displays. Includes support for CP437 character encoding, cursor control codes, progressive animation playback, and procedural frame generators (plasma, fire, sonar, datamosh, metaballs).

## Features

- **ANSI Art Rendering**: Displays .ANS and .ASC files with proper cursor control code support
- **Flexible Rendering Modes**: Choose between `final` (complete render), `animated` (progressive playback), or `auto` (auto-detect) modes
- **Flexible Sizing**: Auto-detect dimensions or use fixed sizes with `columns` and `rows` props supporting `'auto'` values
- **Virtual Display**: Create animated procedural displays using frame generation functions
- **CP437 Encoding**: Full support for Code Page 437 characters including box-drawing and block elements
- **Bitmap Font Rendering**: Pixel-perfect canvas rendering using Windows .FON bitmap fonts for authentic VGA display
- **Embedded VGA Font**: Built-in IBM VGA 8x16 font — no external font file required

- **Progressive Animation**: Animate ANSI sequences progressively to simulate BBS-era terminal playback with configurable modem speeds
- **YouTube-Style Controls**: Overlay controls with seek, speed adjustment, and frame-by-frame navigation
- **SAUCE Metadata**: Parse and display SAUCE metadata from ANSI art files
- **Procedural Generators**: Built-in plasma, fire, sonar, datamosh, and metaballs effects
- **Plasma Background Layout**: Full-page layout component with scrollable plasma background
- **Font Character Chart**: Visualize and explore bitmap font characters
- **Drag & Drop**: Drop .ans or .asc files directly onto the component
- **Performance Monitoring**: Optional performance overlay for debugging

## Installation

```bash
npm install react-ansiart
```

## Usage

### Basic Example - Fixed Size, Final Mode

The simplest usage — displays complete ANSI art with the embedded VGA font (no font file needed):

```tsx
import { AnsiArt } from 'react-ansiart'

function App() {
	return (
		<AnsiArt
			src='/ansi/example.ans'
			mode='final'
			columns={80}
		/>
	)
}
```

### With External Bitmap Font

Use a custom `.FON` bitmap font instead of the embedded default:

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
			showOverlayControls={true}
			bytesPerSecond={240} // 2400 baud
			fps={30}
		/>
	)
}
```

### With SAUCE Metadata Overlay

Display SAUCE metadata embedded in ANSI art files:

```tsx
import { AnsiArt } from 'react-ansiart'

function App() {
	return (
		<AnsiArt
			src='/ansi/art.ans'
			mode='final'
			columns={80}
			sauceOverlay={true}
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
/>
```

**Auto columns, auto rows:**

```tsx
<AnsiArt
	src='/ansi/art.ans'
	mode='final'
	columns='auto'
	rows='auto'
/>
```

**Fixed columns, fixed rows:**

```tsx
<AnsiArt
	src='/ansi/art.ans'
	mode='animated'
	columns={80}
	rows={25}
/>
```

**Auto columns, fixed rows:**

```tsx
<AnsiArt
	src='/ansi/art.ans'
	mode='animated'
	columns='auto'
	rows={30}
/>
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
			fillContainer={true}
			fps={30}
		/>
	)
}
```

### Custom Frame Generator

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
				char: '\u2588',
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
			frameGenerator={checkerboardGenerator}
			fps={30}
		/>
	)
}
```

## Props

### AnsiArt Props

| Prop                     | Type                               | Default      | Description                                                                                                                              |
| ------------------------ | ---------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src`                    | `string`                           | **required** | URL or path to ANSI art file                                                                                                             |
| `mode`                   | `'animated' \| 'final' \| 'auto'`  | `'final'`    | Rendering mode: `'final'` displays complete art, `'animated'` shows progressive playback, `'auto'` auto-detects                          |
| `columns`                | `number \| 'auto'`                 | `80`         | Number of columns or `'auto'` to detect natural width                                                                                    |
| `rows`                   | `number \| 'auto'`                 | `'auto'`     | Number of rows or `'auto'` to display full height. In final mode, `'auto'` auto-detects; in animated mode, `'auto'` uses final height    |
| `background`             | `string`                           | `'#000'`     | Background color (any valid CSS color)                                                                                                   |
| `bitmapFontUrl`          | `string`                           | -            | URL or path to .FON bitmap font file (uses embedded VGA font if not provided)                                                            |
| `showControls`           | `boolean`                          | `false`      | Show simple play/pause/restart controls (deprecated, use `showOverlayControls` instead)                                                  |
| `showOverlayControls`    | `boolean`                          | `false`      | Show YouTube-style overlay controls with seek, speed adjustment, and frame navigation (only for animated mode with supported generators) |
| `showPerformanceOverlay` | `boolean`                          | `false`      | Show performance metrics overlay for debugging                                                                                           |
| `sauceOverlay`           | `boolean`                          | `false`      | Show SAUCE metadata overlay                                                                                                              |
| `fps`                    | `number`                           | `30`         | Frames per second (only used in animated mode)                                                                                           |
| `bytesPerSecond`         | `number`                           | `960`        | Bytes per second for animation speed (NOT baud). For reference: 1200 baud = 120 bytes/sec, 9600 baud = 960 bytes/sec                     |
| `autoStart`              | `boolean`                          | `true`       | Automatically start animation playback                                                                                                   |
| `allowDrop`              | `boolean`                          | `true`       | Enable drag-and-drop file loading                                                                                                        |
| `debugCursorCodes`       | `boolean`                          | `false`      | Log ANSI cursor control codes to console for debugging                                                                                   |

### AnsiVirtualDisplay Props

| Prop                     | Type                    | Default      | Description                                                                                 |
| ------------------------ | ----------------------- | ------------ | ------------------------------------------------------------------------------------------- |
| `columns`                | `number`                | `80`         | Number of character columns (visible viewport)                                              |
| `rows`                   | `number`                | `25`         | Number of character rows (visible viewport)                                                 |
| `frameGenerator`         | `DisplayFrameGenerator` | **required** | Function that generates frame data (character-based or pixel-based)                         |
| `fps`                    | `number`                | `30`         | Frames per second                                                                           |
| `background`             | `string`                | `'#000'`     | Background color (any valid CSS color)                                                      |
| `bitmapFont`             | `BitmapFont`            | -            | Pre-loaded font object (avoids duplicate loading if provided)                               |
| `bitmapFontUrl`          | `string`                | -            | URL or path to .FON bitmap font file (uses embedded VGA font if not provided)               |
| `showControls`           | `boolean`               | `false`      | Show simple play/pause/restart controls (deprecated, use `showOverlayControls` instead)     |
| `showOverlayControls`    | `boolean`               | `false`      | Show YouTube-style overlay controls (only for generators with `capabilities` support)       |
| `showPerformanceOverlay` | `boolean`               | `false`      | Show performance metrics overlay for debugging                                              |
| `fillContainer`          | `boolean`               | `false`      | Fill container width instead of fit-content                                                 |
| `autoStart`              | `boolean`               | `true`       | Automatically start animation playback                                                     |
| `virtualColumns`         | `number`                | -            | Virtual world width in character columns (defaults to `columns` for backward compatibility) |
| `virtualRows`            | `number`                | -            | Virtual world height in character rows (defaults to `rows` for backward compatibility)      |
| `viewX`                  | `number`                | `0`          | Viewport X position within virtual world (character coordinates)                            |
| `viewY`                  | `number`                | `0`          | Viewport Y position within virtual world (character coordinates)                            |
| `pixelOffsetX`           | `number`                | `0`          | Pixel offset X for smooth scrolling (sub-character precision)                               |
| `pixelOffsetY`           | `number`                | `0`          | Pixel offset Y for smooth scrolling (sub-character precision)                               |
| `onViewChange`           | `function`              | -            | Callback when viewport position changes: `(view: { viewX: number; viewY: number }) => void` |
| `sauce`                  | `SauceMetadata`         | -            | Optional SAUCE metadata to display                                                         |
| `onSauceClick`           | `function`              | -            | Callback when SAUCE button is clicked                                                      |

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
| `bitmapFontUrl`          | `string`                  | -            | URL or path to .FON bitmap font file                                               |
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

### AnsiPlayerOverlay

A standalone YouTube-style player overlay component for custom player implementations.

```tsx
import { AnsiPlayerOverlay } from 'react-ansiart'

function CustomPlayer() {
	return (
		<AnsiPlayerOverlay
			isPlaying={true}
			currentBytes={500}
			totalBytes={10000}
			currentSpeed={960}
			isVisible={true}
			onPlayPause={() => {}}
			onRestart={() => {}}
			onSeek={(bytePosition) => {}}
			onSpeedChange={(bytesPerSecond) => {}}
			onAdvanceByte={() => {}}
			onRewindByte={() => {}}
			onMouseMove={() => {}}
		/>
	)
}
```

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

## Procedural Frame Generators

Frame generators create the visual content for `AnsiVirtualDisplay`. All character-based generators follow the same pattern and can be used directly or via sampler functions for viewport-based rendering.

### Built-in Generators

#### Plasma

Multi-octave Perlin noise plasma effect:

```tsx
import { AnsiVirtualDisplay, generateAsciiPerlinPlasmaFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiPerlinPlasmaFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiPerlinPlasmaOptions`):

| Option      | Type             | Default       | Description                              |
| ----------- | ---------------- | ------------- | ---------------------------------------- |
| `chars`     | `string[]`       | standard set  | Characters for brightness-based rendering |
| `timeScale` | `number`         | `0.9`         | Animation speed multiplier               |
| `fgColor`   | `string`         | `'#55FFFF'`   | Foreground color                         |
| `bgColor`   | `string`         | `'#000000'`   | Background color                         |
| `octaves`   | `OctaveConfig[]` | -             | Noise octave configurations              |
| `seed`      | `number`         | `12345`       | Noise seed                               |

#### Fire

Realistic rising fire simulation:

```tsx
import { AnsiVirtualDisplay, generateAsciiFireFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiFireFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiFireOptions`):

| Option         | Type               | Default                                          | Description                  |
| -------------- | ------------------ | ------------------------------------------------ | ---------------------------- |
| `chars`        | `string[]`         | `[' ', '.', ':', ';', '+', '=', 'x', 'X', '$', '&', '#', '@']` | Fire gradient characters |
| `darkenAmount` | `number`           | `0.5`                                            | Cooling speed                |
| `sparkRange`   | `[number, number]` | `[200, 255]`                                     | Palette indices for fuel     |
| `bgColor`      | `string`           | `'#000000'`                                      | Background color             |
| `seed`         | `number`           | `12345`                                          | RNG seed                     |
| `worldHeight`  | `number`           | -                                                | Virtual world height         |
| `worldWidth`   | `number`           | -                                                | Virtual world width          |

Use `clearFireState()` to reset the fire simulation state.

#### Sonar

Expanding ring sonar/radar effect:

```tsx
import { AnsiVirtualDisplay, generateAsciiSonarFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiSonarFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiSonarOptions`):

| Option       | Type     | Default       | Description                    |
| ------------ | -------- | ------------- | ------------------------------ |
| `frequency`  | `number` | `0.9`         | Pulses per second              |
| `intensity`  | `number` | `1.0`         | Ripple strength                |
| `fps`        | `number` | `30`          | Frames per second              |
| `fgColor`    | `string` | `'#ffffff'`   | Foreground color               |
| `bgColor`    | `string` | `'#000000'`   | Background color               |
| `dotChar`    | `string` | `'.'`         | Character to render            |
| `speed`      | `number` | `14`          | Ring expansion cells/sec       |
| `bandWidth`  | `number` | `1.25`        | Ring band width                |
| `decay`      | `number` | `0.75`        | Ring decay per second          |
| `baseAlpha`  | `number` | `0.03`        | Ambient alpha                  |
| `alphaSteps` | `number` | `32`          | Alpha quantization steps       |
| `centerX`    | `number` | center        | Center X coordinate            |
| `centerY`    | `number` | center        | Center Y coordinate            |
| `aspectY`    | `number` | `2`           | Vertical aspect scale          |
| `maxRings`   | `number` | `24`          | Max active rings               |

#### Datamosh

Glitch art / datamosh corruption effect:

```tsx
import { AnsiVirtualDisplay, generateAsciiDatamoshFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiDatamoshFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiDatamoshOptions`):

| Option                  | Type      | Default     | Description                      |
| ----------------------- | --------- | ----------- | -------------------------------- |
| `seed`                  | `number`  | `1337`      | Random seed                      |
| `bgColor`               | `string`  | `'#000000'` | Background color                 |
| `keyframeIntervalFrames`| `number`  | `24`        | Keyframe refresh interval        |
| `blockOpsPerFrame`      | `number`  | `10`        | Corruption ops per frame         |
| `minBlockSize`          | `number`  | `3`         | Min block size                   |
| `maxBlockSize`          | `number`  | `18`        | Max block size                   |
| `maxShift`              | `number`  | `12`        | Max horizontal/vertical shift    |
| `tearChance`            | `number`  | `0.5`       | Horizontal tear probability      |
| `paletteShiftChance`    | `number`  | `0.65`      | Palette shift probability        |
| `noiseFillChance`       | `number`  | `0.35`      | Noise fill probability           |
| `baseChars`             | `string`  | `' \u2591\u2592\u2593\u2588'`  | Base shading characters |
| `noiseChars`            | `string`  | mixed set   | Noise fill characters            |
| `wrap`                  | `boolean` | `true`      | Allow wrap-around edges          |

Use `clearDatamoshState()` to reset the datamosh simulation state.

#### Metaballs

Organic blob/metaball effect:

```tsx
import { AnsiVirtualDisplay, generateAsciiMetaballsFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiMetaballsFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiMetaballsOptions`):

| Option      | Type       | Default       | Description                   |
| ----------- | ---------- | ------------- | ----------------------------- |
| `seed`      | `number`   | `1337`        | Random seed                   |
| `fgColor`   | `string`   | `'#55FFFF'`   | Foreground color              |
| `bgColor`   | `string`   | `'#000000'`   | Background color              |
| `chars`     | `string[]` | standard set  | Shading characters            |
| `balls`     | `number`   | `6`           | Number of metaballs           |
| `speed`     | `number`   | `0.085`       | Animation speed               |
| `radiusMin` | `number`   | `2.5`         | Min radius in cells           |
| `radiusMax` | `number`   | `9.5`         | Max radius in cells           |
| `intensity` | `number`   | `0.55`        | Normalization k value         |
| `aspectY`   | `number`   | `2`           | Vertical aspect scale         |

#### Matrix Rain

Falling half-width-katakana character rain, classic "digital rain" effect:

```tsx
import { AnsiVirtualDisplay, generateAsciiMatrixRainFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiMatrixRainFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiMatrixRainOptions`):

| Option        | Type     | Default                 | Description                            |
| ------------- | -------- | ------------------------ | ----------------------------------------|
| `speed`       | `number` | `0.5`                    | Base fall speed, rows per frame         |
| `density`     | `number` | `0.7`                    | Fraction of columns with active streams |
| `trailLength` | `number` | `15`                     | Average trail length in rows            |
| `headColor`   | `string` | `'#ffffff'`               | Head character color                    |
| `trailColor`  | `string` | `'#00ff44'`               | Trail body color                        |
| `bgColor`     | `string` | `'#000000'`               | Background color                        |
| `chars`       | `string` | katakana + digits + symbols | Character pool to draw from          |
| `seed`        | `number` | `7331`                    | RNG seed                                |

Use `clearMatrixRainState()` to reset the shared simulation state, or `createAsciiMatrixRainGenerator()` for an isolated instance.

#### Starfield

A forward-flying 3D starfield with depth-based brightness and optional streak trails:

```tsx
import { AnsiVirtualDisplay, generateAsciiStarfieldFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiStarfieldFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiStarfieldOptions`):

| Option    | Type      | Default       | Description                                  |
| --------- | --------- | ------------- | ---------------------------------------------- |
| `stars`   | `number`  | `200`         | Number of stars in the field                   |
| `speed`   | `number`  | `0.02`        | Speed at which stars approach the viewer        |
| `fgColor` | `string`  | `'#ffffff'`   | Foreground color for stars                     |
| `bgColor` | `string`  | `'#000000'`   | Background color                               |
| `chars`   | `string`  | `'·.+*#@'`    | Characters by depth, farthest to nearest        |
| `seed`    | `number`  | `4242`        | Seed for deterministic random generation        |
| `streaks` | `boolean` | `true`        | Whether near stars draw streak trails           |

Use `clearStarfieldState()` to reset the shared simulation state, or `createAsciiStarfieldGenerator()` for an isolated instance.

#### Tunnel

An infinite checkerboard tunnel flying toward the viewer, with rotation:

```tsx
import { AnsiVirtualDisplay, generateAsciiTunnelFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiTunnelFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiTunnelOptions`):

| Option          | Type     | Default        | Description                          |
| --------------- | -------- | -------------- | --------------------------------------|
| `speed`         | `number` | `0.08`         | Forward movement speed through the tunnel |
| `rotationSpeed` | `number` | `0.01`         | Rotation speed of the tunnel          |
| `tiles`         | `number` | `8`            | Number of checkerboard tiles per direction |
| `fgColor`       | `string` | `'#00ffaa'`    | Foreground color                      |
| `bgColor`       | `string` | `'#000000'`    | Background color                      |
| `chars`         | `string` | `' .:-=+*#%@'` | Characters for brightness mapping, dark to bright |
| `aspectY`       | `number` | `2`            | Vertical aspect ratio correction      |

#### Game of Life

Conway's Game of Life, with auto-reseeding when the population drops too low:

```tsx
import { AnsiVirtualDisplay, generateAsciiGameOfLifeFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiGameOfLifeFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiGameOfLifeOptions`):

| Option              | Type      | Default       | Description                                       |
| ------------------- | --------- | ------------- | ---------------------------------------------------|
| `density`           | `number`  | `0.3`         | Initial density of live cells (0-1)                |
| `fgColor`           | `string`  | `'#55ff55'`   | Foreground color for live cells                    |
| `bgColor`           | `string`  | `'#000000'`   | Background color                                   |
| `seed`              | `number`  | `9999`        | Seed for random number generation                  |
| `autoSeed`          | `boolean` | `true`        | Whether to auto-seed when population drops too low  |
| `autoSeedThreshold` | `number`  | `0.05`        | Population threshold that triggers auto-seeding     |

Use `clearGameOfLifeState()` to reset the shared simulation state, or `createAsciiGameOfLifeGenerator()` for an isolated instance.

#### Water Ripple

Ripples spreading and interfering across a still water surface, with periodic dropped stones:

```tsx
import { AnsiVirtualDisplay, generateAsciiWaterRippleFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiWaterRippleFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiWaterRippleOptions`):

| Option          | Type     | Default            | Description                                |
| --------------- | -------- | -------------------- | --------------------------------------------|
| `damping`       | `number` | `0.97`               | Wave decay factor (0-1); lower = faster decay |
| `dropFrequency` | `number` | `15`                 | Drop a stone every N frames                |
| `dropStrength`  | `number` | `255`                | Amplitude of dropped stones                |
| `fgColor`       | `string` | `'#4488ff'`          | Foreground color for disturbed water       |
| `bgColor`       | `string` | `'#000011'`          | Background color for calm water            |
| `chars`         | `string` | `' ·:~=@'`           | Characters for brightness ramp             |
| `seed`          | `number` | `5555`               | Seed for random number generation          |

Use `clearWaterRippleState()` to reset the shared simulation state, or `createAsciiWaterRippleGenerator()` for an isolated instance.

#### Mandelbrot

A continuously zooming Mandelbrot set fractal:

```tsx
import { AnsiVirtualDisplay, generateAsciiMandelbrotFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiMandelbrotFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiMandelbrotOptions`):

| Option        | Type                    | Default        | Description                              |
| ------------- | ------------------------ | -------------- | -------------------------------------------|
| `maxIter`     | `number`                 | `64`           | Maximum iteration count                    |
| `zoomSpeed`   | `number`                 | `0.02`         | Zoom rate per frame                        |
| `zoomX`       | `number`                 | `-0.7435`      | Zoom target real component (Seahorse Valley) |
| `zoomY`       | `number`                 | `0.1314`       | Zoom target imaginary component            |
| `initialZoom` | `number`                 | `0.5`          | Starting zoom level                        |
| `fgColor`     | `string`                 | `'#ff8800'`    | Base foreground color (mono mode)          |
| `bgColor`     | `string`                 | `'#000000'`    | Background / set interior color            |
| `chars`       | `string`                 | `' .:-=+*#%@'` | Character ramp, low to high iteration count |
| `aspectY`     | `number`                 | `2`            | Y aspect correction for non-square cells   |
| `colorMode`   | `'spectrum' \| 'mono'`   | `'spectrum'`   | Rainbow hues vs. `fgColor` brightness      |

Also exports `generateMandelbrotPixels` for pixel-level access to the underlying fractal data.

#### Copper Bars

Classic Amiga "copper bars" — horizontal gradient bars drifting and cycling through a vivid palette:

```tsx
import { AnsiVirtualDisplay, generateAsciiCopperBarsFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiCopperBarsFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiCopperBarsOptions`):

| Option           | Type       | Default        | Description                          |
| ---------------- | ---------- | -------------- | --------------------------------------|
| `barCount`       | `number`   | `5`            | Number of bars (3-8)                  |
| `barHeight`      | `number`   | `6`            | Height of each bar in rows (gaussian sigma) |
| `speed`          | `number`   | `0.04`         | Animation speed multiplier            |
| `colorPalette`   | `string[]` | Amiga palette  | Color palette for bars                |
| `bgColor`        | `string`   | `'#000000'`    | Background color                      |
| `backgroundChar` | `string`   | `' '`          | Background character                  |
| `chars`          | `string[]` | `' .·:+=# @'`  | Characters for brightness ramp        |
| `seed`           | `number`   | `7777`         | Seed for deterministic bar phases     |

#### CRT Static

Simulated dead-channel CRT static/noise, with optional VHS tracking artifacts:

```tsx
import { AnsiVirtualDisplay, generateAsciiCrtStaticFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiCrtStaticFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiCrtStaticOptions`):

| Option              | Type       | Default          | Description                              |
| ------------------- | ---------- | ------------------ | -------------------------------------------|
| `signalStrength`    | `number`   | `0.3`              | Signal strength, `0` (lost) to `1` (clean) |
| `scanlineIntensity` | `number`   | `0.3`              | Scanline banding intensity (0-1)           |
| `tearFrequency`     | `number`   | `0.08`             | Probability of a horizontal tear per frame |
| `rollingBarSpeed`   | `number`   | `0.02`             | Rolling bar speed                          |
| `vhsMode`           | `boolean`  | `false`            | Enable VHS mode (tracking lines + chroma aberration) |
| `seed`              | `number`   | `4242`             | Seed for deterministic noise               |
| `bgColor`           | `string`   | `'#000000'`        | Background color                           |
| `chars`             | `string[]` | `' .·-:+=%#@'`     | Characters for brightness ramp             |

#### Aurora Borealis

Drifting, layered aurora curtains in greens, teals, and purples:

```tsx
import { AnsiVirtualDisplay, generateAsciiAuroraBorealisFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiAuroraBorealisFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiAuroraBorealisOptions`):

| Option         | Type       | Default        | Description                            |
| -------------- | ---------- | -------------- | ----------------------------------------|
| `curtainCount` | `number`   | `4`            | Number of curtain layers (2-6)          |
| `speed`        | `number`   | `0.015`        | Animation speed                         |
| `intensity`    | `number`   | `1.0`          | Overall intensity multiplier            |
| `colorPalette` | `string[]` | aurora greens/purples | Color palette for curtains       |
| `bgColor`      | `string`   | `'#000008'`    | Background color                        |
| `chars`        | `string[]` | `'  .·:~=+*#@'`| Characters for brightness ramp          |
| `seed`         | `number`   | `3333`         | Seed for deterministic curtain configuration |

#### Reaction Diffusion

A Gray-Scott reaction-diffusion simulation producing organic coral-growth patterns:

```tsx
import { AnsiVirtualDisplay, generateAsciiReactionDiffusionFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiReactionDiffusionFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiReactionDiffusionOptions`):

| Option          | Type                    | Default        | Description                              |
| --------------- | ------------------------ | -------------- | -------------------------------------------|
| `feedRate`      | `number`                 | `0.055`        | Feed rate; controls pattern type (0.01-0.08) |
| `killRate`      | `number`                 | `0.062`        | Kill rate; controls pattern type (0.045-0.07) |
| `diffusionU`    | `number`                 | `1.0`          | Diffusion rate of chemical U               |
| `diffusionV`    | `number`                 | `0.5`          | Diffusion rate of chemical V               |
| `stepsPerFrame` | `number`                 | `8`            | Simulation substeps per frame              |
| `dt`            | `number`                 | `1.0`          | Simulation time step                       |
| `colorMode`     | `'spectrum' \| 'mono'`   | `'spectrum'`   | HSL rainbow vs. mono color                 |
| `fgColor`       | `string`                 | `'#55ffaa'`    | Foreground color for mono mode             |
| `bgColor`       | `string`                 | `'#000000'`    | Background color                           |
| `chars`         | `string[]`               | dim-to-bright set | Characters for brightness ramp          |
| `seed`          | `number`                 | `9876`         | Seed for initial perturbation              |

Use `clearReactionDiffusionState()` to reset the shared simulation state, or `createAsciiReactionDiffusionGenerator()` for an isolated instance.

#### Terrain Flyover

A scrolling procedural landscape flyover with biome-based coloring and distance fog:

```tsx
import { AnsiVirtualDisplay, generateAsciiTerrainFlyoverFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiTerrainFlyoverFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiTerrainFlyoverOptions`):

| Option        | Type                  | Default        | Description                              |
| ------------- | ---------------------- | -------------- | -------------------------------------------|
| `scrollSpeed` | `number`               | `0.3`          | How fast terrain moves toward the camera   |
| `heightScale` | `number`               | `0.4`          | Terrain amplitude (0-1)                    |
| `fogDistance` | `number`               | `0.7`          | Fog distance factor (0-1); lower = more fog |
| `colorMode`   | `'biome' \| 'mono'`    | `'biome'`      | Height-based terrain colors vs. mono       |
| `fgColor`     | `string`               | `'#88cc88'`    | Foreground color for mono mode             |
| `bgColor`     | `string`               | `'#000011'`    | Background / sky color                     |
| `skyColor`    | `string`               | `'#000022'`    | Sky color for above-horizon rows           |
| `chars`       | `string[]`              | height ramp set| Characters for height ramp                 |
| `seed`        | `number`               | `54321`        | Seed for terrain generation                |

Use `createAsciiTerrainFlyoverSampler()` for viewport-based rendering.

#### Rotozoomer

Classic rotating, zooming procedural texture (checker or xor pattern):

```tsx
import { AnsiVirtualDisplay, generateAsciiRotozoomerFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiRotozoomerFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiRotozoomerOptions`):

| Option          | Type                  | Default                  | Description                          |
| --------------- | --------------------- | ------------------------- | ------------------------------------- |
| `rotationSpeed` | `number`               | `0.02`                    | Radians of rotation added per frame   |
| `zoomSpeed`     | `number`               | `0.03`                    | Angular speed of the zoom oscillation |
| `baseZoom`      | `number`               | `1.0`                     | Baseline zoom level                   |
| `zoomAmplitude` | `number`               | `0.4`                     | How far the zoom oscillates           |
| `textureSize`   | `number`               | `4`                       | Size of one texture tile              |
| `pattern`       | `'checker' \| 'xor'`   | `'checker'`               | Procedural texture pattern            |
| `chars`         | `string[]`             | `' .:-=+*#%@'`            | Texture ramp characters               |
| `fgColors`      | `string[]`             | cyan/magenta pair         | Foreground colors cycled by texture   |
| `bgColor`       | `string`               | `'#000000'`               | Background color                      |
| `aspectY`       | `number`               | `2`                       | Vertical aspect correction            |

#### Moiré

Two orbiting ring fields whose interference produces a drifting moiré pattern:

```tsx
import { AnsiVirtualDisplay, generateAsciiMoireFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiMoireFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiMoireOptions`):

| Option         | Type       | Default       | Description                              |
| -------------- | ---------- | ------------- | ----------------------------------------- |
| `ringWidth`    | `number`   | `1.5`         | Width of one ring, in cells               |
| `speed1`       | `number`   | `0.015`       | Orbit speed of ring-field 1               |
| `speed2`       | `number`   | `0.023`       | Orbit speed of ring-field 2               |
| `orbitRadius1` | `number`   | `0.35`        | Orbit radius of center 1                  |
| `orbitRadius2` | `number`   | `0.35`        | Orbit radius of center 2                  |
| `phaseOffset`  | `number`   | `Math.PI`     | Phase offset between the two centers      |
| `paletteSpeed` | `number`   | `0.01`        | Palette cycling speed                     |
| `palette`      | `string[]` | rainbow set   | Colors cycled by interference sum         |
| `chars`        | `string[]` | `' .:+*#@'`   | Characters for "on" cells                 |
| `bgColor`      | `string`   | `'#000000'`   | Background color for "off" cells          |
| `aspectY`      | `number`   | `2`           | Vertical aspect correction                |

#### Kefrens Bars

Cascading "impossible bars" curtain effect, a classic Amiga copper-bar trick:

```tsx
import { AnsiVirtualDisplay, generateAsciiKefrensBarsFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiKefrensBarsFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiKefrensBarsOptions`):

| Option           | Type       | Default        | Description                          |
| ---------------- | ---------- | -------------- | -------------------------------------- |
| `barWidth`       | `number`   | `7`            | Width of each bar in cells             |
| `amplitude1`     | `number`   | ~28% of columns | Amplitude of the primary wobble       |
| `frequency1`     | `number`   | `0.15`         | Row-frequency of the primary wobble    |
| `speed1`         | `number`   | `0.05`         | Frame-speed of the primary wobble      |
| `amplitude2`     | `number`   | ~12% of columns | Amplitude of the secondary wobble     |
| `frequency2`     | `number`   | `0.37`         | Row-frequency of the secondary wobble  |
| `speed2`         | `number`   | `-0.08`        | Frame-speed of the secondary wobble    |
| `palette`        | `string[]` | rainbow set    | Colors bars cycle through              |
| `hueSpeed`       | `number`   | `0.15`         | Color cycle speed over time            |
| `hueRowStep`     | `number`   | `0.4`          | Color cycle speed per row              |
| `chars`          | `string[]` | `'█▓▒░'`       | Shading ramp, bright center to dark edge |
| `bgColor`        | `string`   | `'#000000'`    | Background color                       |
| `backgroundChar` | `string`   | `' '`          | Background character                   |

#### Twister

A vertically twisted ribbon rendered as a rotating square column seen edge-on (classic C64/Amiga twister):

```tsx
import { AnsiVirtualDisplay, generateAsciiTwisterFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiTwisterFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiTwisterOptions`):

| Option           | Type       | Default          | Description                        |
| ---------------- | ---------- | ---------------- | ------------------------------------ |
| `width`          | `number`   | ~30% of columns  | Half-width of the ribbon in cells   |
| `rotationSpeed`  | `number`   | `0.05`           | Rotation speed of the ribbon        |
| `waveFreq`       | `number`   | `0.25`           | Row-frequency of the twist wave     |
| `waveSpeed`      | `number`   | `0.04`           | Frame-speed of the twist wave       |
| `waveDepth`      | `number`   | `0.6`            | Amplitude of the twist wave         |
| `palette`        | `string[]` | metallic-blue set | Color per ribbon face               |
| `chars`          | `string[]` | `'░▒▓█'`         | Shading ramp, dim edge to bright center |
| `bgColor`        | `string`   | `'#000000'`      | Background color                    |
| `backgroundChar` | `string`   | `' '`            | Background character                |
| `centerX`        | `number`   | `(columns-1)/2`  | Horizontal center of the ribbon     |

#### Sine Scroller

A scrolling greeting message rendered with the library's embedded VGA bitmap font, riding a vertical sine wave and cycling through a rainbow:

```tsx
import { AnsiVirtualDisplay, generateAsciiSineScrollerFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiSineScrollerFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiSineScrollerOptions`):

| Option           | Type       | Default                                         | Description                          |
| ---------------- | ---------- | ------------------------------------------------ | ------------------------------------- |
| `text`           | `string`   | `'REACT-ANSIART ♦ GREETINGS TO THE SCENE ♦ '`     | Message to scroll (CP437 chars only)  |
| `speed`          | `number`   | `1.5`                                            | Scroll speed, font pixels per frame   |
| `amplitude`      | `number`   | `3`                                              | Vertical sine amplitude in rows       |
| `waveFreq`       | `number`   | `0.08`                                           | Sine frequency, radians per pixel     |
| `waveSpeed`      | `number`   | `0.06`                                           | Sine speed, radians per frame         |
| `hueStep`        | `number`   | `1.5`                                            | Rainbow steps per strip pixel         |
| `hueSpeed`       | `number`   | `1.2`                                            | Rainbow steps per frame               |
| `saturation`     | `number`   | `1`                                              | Rainbow saturation (0-1)              |
| `lightness`      | `number`   | `0.55`                                           | Rainbow lightness (0-1)               |
| `fgColor`        | `string`   | —                                                 | Fixed color, bypasses the rainbow     |
| `bgColor`        | `string`   | `'#000000'`                                      | Background color                      |
| `backgroundChar` | `string`   | `' '`                                            | Background character                  |
| `char`           | `string`   | `'█'`                                            | Lit-pixel character                   |
| `scale`          | `1 \| 2`   | `1`                                              | `2` doubles each font pixel's width   |
| `shadow`         | `boolean`  | `true`                                           | Drop shadow one cell down-right       |
| `shadowColor`    | `string`   | `'#1b1b28'`                                      | Drop shadow color                     |

#### Boing Ball

The Amiga "Boing Ball" demo (1984): a checkered sphere bouncing in a perspective room with a grid wall/floor and a cast shadow:

```tsx
import { AnsiVirtualDisplay, generateAsciiBoingBallFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiBoingBallFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiBoingBallOptions`):

| Option            | Type     | Default       | Description                              |
| ----------------- | -------- | ------------- | ------------------------------------------ |
| `scale`           | `number` | `1`           | Ball size multiplier                       |
| `bounceSpeed`     | `number` | `0.15`        | Vertical bounce angular speed              |
| `driftSpeed`      | `number` | `0.045`       | Horizontal drift speed                     |
| `spinSpeed`       | `number` | `0.22`        | Checker roll rate around the vertical axis |
| `checkerDensity`  | `number` | `8`           | Latitude checker bands on the sphere       |
| `ballRedColor`    | `string` | `'#cc2222'`   | Red checker squares                        |
| `ballWhiteColor`  | `string` | `'#f2f2f2'`   | White checker squares                      |
| `gridColor`       | `string` | `'#a239d6'`   | Back wall / floor grid line color          |
| `bgColor`         | `string` | `'#c9c9cf'`   | Back wall / floor background color         |
| `shadowColor`     | `string` | `'#4a4a52'`   | Shadow cast by the ball                    |
| `lightDirX`       | `number` | `-0.5`        | Light direction X component                |
| `lightDirY`       | `number` | `-0.65`       | Light direction Y component                |
| `lightDirZ`       | `number` | `0.58`        | Light direction Z component                |

#### Cyclic Automaton

A cyclic cellular automaton ("rock-paper-scissors" states arranged in a ring) that self-organizes from noise into rotating spiral waves:

```tsx
import { AnsiVirtualDisplay, generateAsciiCyclicAutomatonFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiCyclicAutomatonFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiCyclicAutomatonOptions`):

| Option         | Type                       | Default    | Description                                    |
| -------------- | -------------------------- | ---------- | ------------------------------------------------ |
| `states`       | `number`                   | `14`       | Number of states in the cyclic ring (3-24)       |
| `threshold`    | `number`                   | `1`        | "Successor state" neighbors needed to advance    |
| `neighborhood` | `'moore' \| 'vonNeumann'`  | `'moore'`  | Neighborhood used when counting neighbors        |
| `stepsPerFrame`| `number`                   | `1`        | Simulation substeps per frame                    |
| `seed`         | `number`                   | `1337`     | Seed for the initial random state assignment     |
| `chars`        | `string[]`                 | solid block | Character ramp indexed by state                |
| `saturation`   | `number`                   | `0.75`     | Saturation of the generated hue-wheel palette    |
| `lightness`    | `number`                   | `0.5`      | Lightness of the generated hue-wheel palette     |
| `bgColor`      | `string`                   | `'#000000'` | Background color behind sparse char ramps      |

Use `clearCyclicAutomatonState()` to reset the shared simulation state, or `createAsciiCyclicAutomatonGenerator()` for an isolated instance.

#### Falling Sand

An autonomous falling-sand toy: spouts drip sand that piles against wall ledges, draining once the screen gets too full so the scene breathes forever:

```tsx
import { AnsiVirtualDisplay, generateAsciiFallingSandFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiFallingSandFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiFallingSandOptions`):

| Option                 | Type                       | Default                              | Description                             |
| ---------------------- | --------------------------- | ------------------------------------- | ----------------------------------------- |
| `seed`                 | `number`                    | `424242`                             | Seed for ledges, jitter, and grain choices |
| `stepsPerFrame`        | `number`                    | `1`                                   | Simulation steps per frame                |
| `spoutCount`           | `number`                    | `3`                                   | Number of sand-emitting spouts            |
| `spoutRate`            | `number`                    | `0.55`                                | Probability each spout emits per step     |
| `drainOpenThreshold`   | `number`                    | `0.55`                                | Fill fraction at which the drain opens    |
| `drainCloseThreshold`  | `number`                    | `0.35`                                | Fill fraction at which the drain closes   |
| `sandColors`           | `[string, string, string]`  | `['#e8d18a', '#d1a94e', '#a97733']`  | Colors for the 3 sand variants            |
| `wallColor`            | `string`                    | `'#5c5c6b'`                          | Color for wall ledges                     |
| `bgColor`              | `string`                    | `'#0a0a12'`                          | Background color for empty cells          |

Use `clearFallingSandState()` to reset the shared simulation state, or `createAsciiFallingSandGenerator()` for an isolated instance.

#### Bump Mapping

A static heightfield lit by an orbiting point light with specular highlights, real-time bump mapping over a fixed procedural surface:

```tsx
import { AnsiVirtualDisplay, generateAsciiBumpMappingFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiBumpMappingFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiBumpMappingOptions`):

| Option          | Type       | Default                                | Description                              |
| --------------- | ---------- | ---------------------------------------- | ------------------------------------------ |
| `seed`          | `number`   | `9001`                                  | Seed for the static heightfield            |
| `noiseScale`    | `number`   | `0.15`                                  | Noise frequency for the heightfield        |
| `octaves`       | `number`   | `4`                                     | Octaves of fbm noise                       |
| `lightRadius`   | `number`   | `0.6`                                   | Orbit radius of the light                  |
| `orbitSpeed`    | `number`   | `0.05`                                  | Angular speed of the orbiting light        |
| `lightHeight`   | `number`   | `6`                                     | Height (z) of the light above the surface  |
| `bumpStrength`  | `number`   | `6`                                     | Steepness multiplier for the surface normal|
| `specularPower` | `number`   | `12`                                    | Specular exponent                          |
| `chars`         | `string`   | `' ·░▒▓█'`                              | Character ramp, dark to bright             |
| `palette`       | `string[]` | warm bronze / steel gradient            | Color stops, low to high intensity         |
| `bgColor`       | `string`   | `'#050302'`                             | Background color                           |
| `aspectY`       | `number`   | `2`                                     | Y aspect correction for non-square cells   |

#### Julia

An animated Julia set fractal, morphing continuously as its c-parameter orbits just outside the Mandelbrot cardioid:

```tsx
import { AnsiVirtualDisplay, generateAsciiJuliaFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiJuliaFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiJuliaOptions`):

| Option       | Type                     | Default        | Description                             |
| ------------ | ------------------------ | -------------- | ------------------------------------------ |
| `maxIter`    | `number`                 | `64`           | Maximum iteration count                    |
| `morphSpeed` | `number`                 | `0.015`        | Angular speed of the c-parameter orbit     |
| `radius`     | `number`                 | `0.7885`       | Orbit radius of the c-parameter            |
| `zoom`       | `number`                 | `1.0`          | Zoom level of the viewing plane            |
| `centerX`    | `number`                 | `0`            | Plane center real component                |
| `centerY`    | `number`                 | `0`            | Plane center imaginary component           |
| `hueSpeed`   | `number`                 | `0.005`        | Hue drift speed per frame (spectrum mode)  |
| `fgColor`    | `string`                 | `'#00ccff'`    | Base foreground color (mono mode)          |
| `bgColor`    | `string`                 | `'#000000'`    | Background / interior color                |
| `chars`      | `string`                 | `' .:-=+*#%@'` | Character ramp, low to high iteration count|
| `aspectY`    | `number`                 | `2`            | Y aspect correction for non-square cells   |
| `colorMode`  | `'spectrum' \| 'mono'`   | `'spectrum'`   | Rainbow hues vs. `fgColor` brightness      |

#### Boids

A flocking simulation (separation, alignment, cohesion) with a glowing head and fading trail per boid:

```tsx
import { AnsiVirtualDisplay, generateAsciiBoidsFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiBoidsFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiBoidsOptions`):

| Option            | Type                   | Default                     | Description                          |
| ----------------- | ----------------------- | ---------------------------- | --------------------------------------|
| `count`           | `number`                | `60`                         | Number of boids (clamped to 40-120)  |
| `maxSpeed`        | `number`                | `1.2`                        | Maximum boid speed                    |
| `minSpeed`        | `number`                | `0.4`                        | Minimum boid speed                    |
| `sepRadius`       | `number`                | `2.5`                        | Separation radius                     |
| `alignRadius`     | `number`                | `5`                          | Alignment radius                      |
| `cohRadius`       | `number`                | `6`                          | Cohesion radius                       |
| `sepWeight`       | `number`                | `1.4`                        | Separation steering weight            |
| `alignWeight`     | `number`                | `1.0`                        | Alignment steering weight             |
| `cohWeight`       | `number`                | `0.8`                        | Cohesion steering weight              |
| `wander`          | `number`                | `0.3`                        | Strength of the per-boid wander term  |
| `scatterInterval` | `number`                | `240`                        | Frames between "predator" scatter impulses |
| `trailDecay`      | `number`                | `0.88`                       | Per-frame decay of the trail buffer   |
| `headColor`       | `string`                | `'#eafcff'`                  | Boid head color                       |
| `trailPalette`    | `[string, string]`      | `['#00e5ff', '#02040f']`     | Trail color pair [near, far]          |
| `chars`           | `string`                | `' .:■'`                     | Trail intensity to character ramp     |
| `seed`            | `number`                | `9001`                       | RNG seed                              |
| `bgColor`         | `string`                | `'#000006'`                  | Background color                      |

Use `clearBoidsState()` to reset the shared flock state, or `createAsciiBoidsGenerator()` for an isolated instance.

#### Donut

The classic donut.c spinning torus — rotated about two axes, z-buffered, and shaded by surface luminance through a character ramp:

```tsx
import { AnsiVirtualDisplay, generateAsciiDonutFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiDonutFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiDonutOptions`):

| Option      | Type       | Default          | Description                                                    |
| ----------- | ---------- | ---------------- | -------------------------------------------------------------- |
| `speedA`    | `number`   | `0.07`           | Rotation speed about the X axis, radians per frame             |
| `speedB`    | `number`   | `0.03`           | Rotation speed about the Z axis, radians per frame             |
| `phaseA`    | `number`   | `1.0`            | Initial X-axis rotation (radians)                              |
| `phaseB`    | `number`   | `0.4`            | Initial Z-axis rotation (radians)                              |
| `size`      | `number`   | `0.9`            | Donut diameter as a fraction of the smaller screen dimension (0.1-1.5) |
| `tubeRatio` | `number`   | `0.5`            | Tube radius as a fraction of the ring radius (0.15-0.9)        |
| `chars`     | `string[]` | `'.,-~:;=!*#$@'` | Luminance ramp characters, dim to bright                       |
| `baseColor` | `string`   | `'#ffaa33'`      | Base color, shaded dark to bright by luminance                 |
| `bgColor`   | `string`   | `'#000000'`      | Background color                                               |

#### Wireframe

A spinning wireframe polyhedron (cube, tetrahedron, octahedron, or icosahedron) drawn with depth-buffered, depth-shaded edges and marked vertices:

```tsx
import { AnsiVirtualDisplay, generateAsciiWireframeFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiWireframeFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiWireframeOptions`):

| Option         | Type                                                     | Default                  | Description                                          |
| -------------- | -------------------------------------------------------- | ------------------------- | ----------------------------------------------------- |
| `shape`        | `'cube' \| 'tetrahedron' \| 'octahedron' \| 'icosahedron'` | `'cube'`                | Which polyhedron to spin                              |
| `size`         | `number`                                                  | `0.8`                    | Object diameter as a fraction of screen height (0.1-2) |
| `speedX`       | `number`                                                  | `0.019`                  | Rotation speed about the X axis, radians per frame    |
| `speedY`       | `number`                                                  | `0.023`                  | Rotation speed about the Y axis, radians per frame    |
| `speedZ`       | `number`                                                  | `0.011`                  | Rotation speed about the Z axis, radians per frame    |
| `edgeColor`    | `string`                                                  | `'#44ff88'`              | Edge color, shaded darker with depth                  |
| `vertexColor`  | `string`                                                  | `'#ffffff'`              | Vertex marker color                                   |
| `depthShading` | `boolean`                                                 | `true`                   | Shade nearer edges brighter via a 16-level table      |
| `bgColor`      | `string`                                                  | `'#000000'`              | Background color                                      |
| `edgeChars`    | `string[]`                                                | `['·', ':', '+', '#']`   | Edge characters from far to near                      |
| `vertexChar`   | `string`                                                  | `'■'`                    | Vertex marker character                               |

#### Shadebobs

The classic Amiga shadebobs effect — soft additive gaussian blobs sweep the screen on Lissajous paths, leaving decaying trails that glow brighter where paths cross:

```tsx
import { AnsiVirtualDisplay, generateAsciiShadebobsFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiShadebobsFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiShadebobsOptions`):

| Option       | Type       | Default        | Description                                                        |
| ------------ | ---------- | -------------- | ------------------------------------------------------------------- |
| `bobCount`   | `number`   | `5`            | Number of bobs sweeping the screen (1-16)                           |
| `bobSize`    | `number`   | `5`            | Bob radius in cell widths (gaussian sigma, aspect-corrected)        |
| `trailDecay` | `number`   | `0.92`         | Per-step energy decay factor (0.5-0.995); lower fades trails faster |
| `speed`      | `number`   | `1`            | Path speed multiplier for the Lissajous orbits                      |
| `seed`       | `number`   | `2001`         | Seed for the per-bob orbit frequencies and phases                   |
| `chars`      | `string[]` | `' ·:;+=xX#█'` | Brightness ramp characters, dark to bright                          |
| `palette`    | `string[]` | black→purple→magenta→orange→white ramp | Gradient stops interpolated into a 256-entry energy→color table |
| `bgColor`    | `string`   | `'#000000'`    | Background color                                                    |

Use `clearShadebobsState()` to reset the shared simulation state, or `createAsciiShadebobsGenerator()` for an isolated instance.

#### Munching Squares

The PDP-1 / HAKMEM XOR display hack — nested expanding squares carved by `((x ^ y) + t) mod size`, with the thresholds sweeping across the pattern so the squares "munch":

```tsx
import { AnsiVirtualDisplay, generateAsciiMunchingSquaresFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiMunchingSquaresFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiMunchingSquaresOptions`):

| Option    | Type       | Default              | Description                                                     |
| --------- | ---------- | -------------------- | ---------------------------------------------------------------- |
| `speed`   | `number`   | `1`                  | Value-ring steps advanced per frame (may be fractional)          |
| `size`    | `number`   | `32`                 | Domain size of the XOR pattern, rounded to a power of two in [8, 128] |
| `chars`   | `string[]` | `' ░▒▓█'`            | Characters mapped over the value ring, low to high               |
| `palette` | `string[]` | 16-color EGA palette | Colors cycled over the value ring                                |
| `invert`  | `boolean`  | `false`              | Reverse the value ring (bright squares munch dark)               |
| `bgColor` | `string`   | `'#000000'`          | Background color                                                 |

#### Fireworks

A stateless fireworks display — rockets rise on a staggered deterministic schedule, burst into ring or chrysanthemum particle shells pulled down by gravity, and fade as embers, over an optional starfield sky:

```tsx
import { AnsiVirtualDisplay, generateAsciiFireworksFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiFireworksFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiFireworksOptions`):

| Option           | Type       | Default                     | Description                                              |
| ---------------- | ---------- | ---------------------------- | ---------------------------------------------------------- |
| `seed`           | `number`   | `1337`                      | Seed for deterministic launch schedule and particle hashes  |
| `launchInterval` | `number`   | `45`                        | Frames between rocket launches (before per-rocket jitter)   |
| `riseFrames`     | `number`   | `35`                        | Base frames a rocket spends ascending                       |
| `burstDuration`  | `number`   | `60`                        | Frames a burst takes to expand and fade out                 |
| `particleCount`  | `number`   | `60`                        | Base particles per burst (each rocket varies it ±30%)       |
| `gravity`        | `number`   | `0.006`                     | Downward acceleration on burst particles, world units/frame² |
| `hues`           | `string[]` | 8-color pyrotechnic palette | Hues rockets pick from                                      |
| `bgColor`        | `string`   | `'#000008'`                 | Background color                                            |
| `nightSky`       | `boolean`  | `true`                      | Sprinkle dim static stars into the sky                      |

#### Aquarium

An asciiquarium homage — fish swim across a depth-shaded water gradient with rising bubbles, swaying seaweed, a sandy floor, and surface shimmer:

```tsx
import { AnsiVirtualDisplay, generateAsciiAquariumFrame } from 'react-ansiart'

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={generateAsciiAquariumFrame}
			fps={30}
		/>
	)
}
```

**Options** (`AsciiAquariumOptions`):

| Option           | Type       | Default                      | Description                                                |
| ---------------- | ---------- | ----------------------------- | ------------------------------------------------------------ |
| `seed`           | `number`   | `24601`                      | Seed for deterministic fish, seaweed, rock, and bubble placement |
| `fishCount`      | `number`   | `7`                          | Number of fish                                               |
| `bubbleDensity`  | `number`   | `0.12`                       | Fraction of columns that emit bubbles (0-1)                  |
| `seaweedDensity` | `number`   | `0.16`                       | Fraction of columns growing seaweed (0-1)                    |
| `palette`        | `string[]` | 8-color tropical fish palette | Fish body colors                                             |
| `bgColor`        | `string`   | `'#0d3a66'`                  | Base water color at the surface; darkens toward the floor    |
| `swaySpeed`      | `number`   | `0.07`                       | Seaweed sway rate (radians/frame)                            |
| `speed`          | `number`   | `1`                          | Global animation speed multiplier                            |

### Post Effects

`composeAnsiEffects` wraps any `CharacterFrameGenerator` with one or more post-processing passes (CRT lens distortion, scanlines, VHS tracking glitches) that run over the generated `AnsiScreen` each frame:

```tsx
import { AnsiVirtualDisplay, composeAnsiEffects, createLensEffect, generateAsciiPerlinPlasmaFrame } from 'react-ansiart'

const frameGenerator = composeAnsiEffects(
	generateAsciiPerlinPlasmaFrame,
	createLensEffect({ radius: 10, magnification: 2.5 }),
)

function App() {
	return (
		<AnsiVirtualDisplay
			columns={80}
			rows={25}
			frameGenerator={frameGenerator}
			fps={30}
		/>
	)
}
```

`composeAnsiEffects` accepts effects as varargs, as arrays, or a mix, and the result drops straight into `AnsiVirtualDisplay` / `AnsiArt` as `frameGenerator` since it has the same `(frame, columns, rows) => AnsiScreen` signature. Metadata (`capabilities`, `setSpeed`, `seekToFrame`, etc.) is forwarded from the source generator when present.

**Effects**:

| Factory                    | Options type              | Description                                    |
| --------------------------- | -------------------------- | ------------------------------------------------ |
| `createLensEffect`          | `LensEffectOptions`         | Drifting magnifying-lens / CRT bulge distortion  |
| `createScanlineEffect`      | `ScanlineEffectOptions`      | Sweeping CRT scanline beam                       |
| `createVhsTrackingEffect`   | `VhsTrackingEffectOptions`   | Periodic VHS tracking glitch bands and noise     |
| `createPhosphorPersistenceEffect` | `PhosphorPersistenceEffectOptions` | CRT afterglow: departed glyphs linger and fade, leaving motion trails |
| `createChromaticAberrationEffect` | `ChromaticAberrationEffectOptions` | Red/blue channel fringing that grows toward the screen edges |
| `createKaleidoscopeEffect`  | `KaleidoscopeEffectOptions` | N-fold mirror fold around the screen center      |

`createPhosphorPersistenceEffect` is the one effect that keeps per-instance history between
frames (afterglow needs to know what was lit before): it is deterministic for a given
forward frame sequence and resets itself whenever the frame number rewinds or the screen
resizes. Like every effect instance, don't share one across two live composed generators.

### Transitions and Generator Cycling

`createAnsiTransition` hands the screen from one generator to another through an animated
per-cell transition, and `createAnsiGeneratorCycle` chains a whole list of generators into
an endless screensaver rotation. Both return an ordinary `CharacterFrameGenerator`, so the
result drops straight into `AnsiVirtualDisplay` and can itself be wrapped in
`composeAnsiEffects`:

```tsx
import {
	AnsiVirtualDisplay,
	createAnsiGeneratorCycle,
	createAnsiTransition,
	generateAsciiDonutFrame,
	generateAsciiFireFrame,
	generateAsciiMatrixRainFrame,
	generateAsciiPerlinPlasmaFrame,
} from 'react-ansiart'

// One-shot handoff: plasma for 300 frames, then dissolve into fire over 60 frames.
const intro = createAnsiTransition(
	generateAsciiPerlinPlasmaFrame,
	generateAsciiFireFrame,
	{ startFrame: 300, durationFrames: 60, kind: 'dissolve' },
)

// Endless screensaver: each generator holds for 360 frames, transitions run 48 frames,
// and the transition kinds rotate automatically (dissolve, wipes, block glitch).
const screensaver = createAnsiGeneratorCycle([
	generateAsciiDonutFrame,
	generateAsciiMatrixRainFrame,
	generateAsciiFireFrame,
	generateAsciiPerlinPlasmaFrame,
])

function App() {
	return <AnsiVirtualDisplay columns={80} rows={25} frameGenerator={screensaver} fps={30} />
}
```

**`AnsiTransitionOptions`**:

| Option           | Type             | Default      | Description                                        |
| ---------------- | ---------------- | ------------ | -------------------------------------------------- |
| `startFrame`     | `number`         | `0`          | Frame at which the transition begins               |
| `durationFrames` | `number`         | `60`         | Length of the transition window                    |
| `kind`           | `TransitionKind` | `'dissolve'` | `'dissolve'`, `'wipeRight'`, `'wipeLeft'`, `'wipeDown'`, `'wipeUp'`, or `'blocks'` |
| `seed`           | `number`         | `96337`      | Deterministic dissolve/dither/block ordering       |
| `softness`       | `number`         | `0.15`       | Dithered edge width on wipes (fraction of the wipe axis) |

**`AnsiGeneratorCycleOptions`**:

| Option             | Type                                 | Default   | Description                                  |
| ------------------ | ------------------------------------ | --------- | -------------------------------------------- |
| `holdFrames`       | `number`                             | `360`     | Frames each generator is shown               |
| `transitionFrames` | `number`                             | `48`      | Frames each handoff lasts                    |
| `kind`             | `TransitionKind \| TransitionKind[]` | all kinds | One kind for every handoff, or a list cycled per handoff |
| `seed`             | `number`                             | `96337`   | Base seed; each handoff derives its own      |
| `softness`         | `number`                             | `0.15`    | Dithered edge width on wipes                 |

During a hold only the visible generator runs; the incoming one is first invoked when its
handoff starts, seeing a normal frame jump that stateful simulations already absorb via
their capped catch-up.

### Custom Frame Generators

#### Character-Based Generators

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

#### Pixel-Based Generators

Pixel-based generators produce RGB pixel data that gets converted to ANSI:

```tsx
type FrameGenerator = (frame: number, width: number, height: number) => FrameData

type FrameData = {
	width: number
	height: number
	pixels: Uint8Array // RGB format: 3 bytes per pixel (r, g, b)
}
```

#### DisplayFrameGenerator Type

`AnsiVirtualDisplay` accepts either type:

```tsx
type DisplayFrameGenerator = CharacterFrameGenerator | PixelFrameGenerator
```

#### Generator Capabilities

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
			frameGenerator={gradientGenerator}
			fps={30}
		/>
	)
}
```

#### Sampler Functions

Each built-in generator also exports a sampler factory for viewport-based rendering:

```tsx
import { createAsciiPerlinPlasmaSampler } from 'react-ansiart'

// Returns a function (x, y) => AnsiCell for sampling at arbitrary coordinates
const sampler = createAsciiPerlinPlasmaSampler(frame, options)
const cell = sampler(x, y)
```

Available samplers: `createAsciiPerlinPlasmaSampler`, `createAsciiFireSampler`, `createAsciiSonarSampler`, `createAsciiDatamoshSampler`, `createAsciiMetaballsSampler`.

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

### Font Loading Utilities

```tsx
import {
	getEmbeddedVgaFont,
	loadBitmapFontFromUrl,
	loadRawBitmapFont,
	extractFontFromFON,
	renderGlyph,
	renderText,
	clearFontCache,
	type BitmapFont,
	type FontExtractionResult,
} from 'react-ansiart'
```

- **`getEmbeddedVgaFont()`** - Returns the embedded IBM VGA 8x16 bitmap font (CP437). Synchronous, works in browser, SSR, and Node
- **`loadBitmapFontFromUrl(url)`** - Load a bitmap font from a URL (supports .FON files and raw bitmap data)
- **`loadRawBitmapFont(url, width, height)`** - Load raw bitmap font data
- **`extractFontFromFON(url)`** - Extract font from Windows .FON file
- **`renderGlyph(ctx, font, charCode, x, y, fgColor, bgColor)`** - Render a single glyph to canvas
- **`renderText(ctx, font, text, x, y, fgColor, bgColor)`** - Render text to canvas
- **`clearFontCache(url?)`** - Clear font cache from localStorage (specific URL or all)

### ANSI Parser Utilities

```tsx
import {
	parseAnsi,
	parseAscii,
	parseSauce,
	detectAnimation,
	getSauceInfo,
	type AnsiCell,
	type AnsiScreen,
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
	generateAsciiFireFrame,
	generateAsciiSonarFrame,
	generateAsciiDatamoshFrame,
	generateAsciiMetaballsFrame,
	createAsciiPerlinPlasmaSampler,
	createAsciiFireSampler,
	createAsciiSonarSampler,
	createAsciiDatamoshSampler,
	createAsciiMetaballsSampler,
	clearFireState,
	clearDatamoshState,
	convertFrameDataToAnsi,
	type AnsiArtFrameGeneratorOptions,
	type AnsiFrameGeneratorOptions,
	type AsciiPerlinPlasmaOptions,
	type AsciiFireOptions,
	type AsciiSonarOptions,
	type AsciiDatamoshOptions,
	type AsciiMetaballsOptions,
} from 'react-ansiart'
```

- **`createAnsiArtFrameGenerator(options)`** - Create frame generator from ANSI art file
- **`createAnsiFrameGenerator(options)`** - Create frame generator with animation support
- **`convertFrameDataToAnsi(frameData, columns, rows, palette?)`** - Convert pixel frame data to ANSI screen
- **`clearFireState()`** - Reset fire simulation state
- **`clearDatamoshState()`** - Reset datamosh simulation state

### Performance Utilities

```tsx
import { drawPerformanceOverlay, type PerformanceStats } from 'react-ansiart'
```

- **`drawPerformanceOverlay(ctx, stats, x, y)`** - Draw performance overlay on canvas

## Animation and Modem Speed Simulation

When using `mode='animated'`, the component progressively renders ANSI sequences at a configurable byte rate. The `bytesPerSecond` prop controls the playback speed by simulating data transfer rates.

### Understanding Bytes Per Second vs Baud

**Important**: The `bytesPerSecond` prop uses bytes per second, not baud rate. Serial communication typically uses 8 data bits + 1 start bit + 1 stop bit = 10 bits per byte, so:

**bytes/sec = baud / 10**

For example:

- 1200 baud = 120 bytes/sec
- 9600 baud = 960 bytes/sec
- 56k baud = 5600 bytes/sec

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

The component supports Windows .FON (New Executable) font files containing raw 8x16 pixel bitmap fonts. The font extractor:

- Parses NE executable format
- Locates font resources in the resource table
- Extracts raw 8x16 bitmap data (4096 bytes for 256 characters)
- Automatically detects correct bitmap offset using heuristic validation

Alternatively, use the built-in embedded VGA font via `getEmbeddedVgaFont()` — no external file needed.

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

- ANSI files: `public/ansi/*.ans` -> accessible at `/ansi/*.ans`
- Font files: `public/ansi/fonts/*.FON` -> accessible at `/ansi/fonts/*.FON`

## Browser Compatibility

Requires:

- Modern browser with Canvas API support
- ES2020+ JavaScript features
- Fetch API for file loading

## License

MIT

## References

https://mrogalski.eu/ansi-art/
