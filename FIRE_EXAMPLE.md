# Fire Effect Example

## Basic Usage

```tsx
import { PlasmaBackgroundLayout } from 'react-ansiart'

function App() {
	return (
		<PlasmaBackgroundLayout
			generatorType='fire'
			bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON'
			mode='fixed'
			fps={30}
		>
			<div style={{ padding: '40px', color: '#fff' }}>
				<h1>Fire Effect Demo</h1>
				<p>This content appears over an animated fire background.</p>
			</div>
		</PlasmaBackgroundLayout>
	)
}
```

## With Custom Options

```tsx
import { PlasmaBackgroundLayout } from 'react-ansiart'

function App() {
	return (
		<PlasmaBackgroundLayout
			generatorType='fire'
			bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON'
			mode='fixed'
			fps={30}
			darkenAmount={3}
			sparkRange={[180, 255]}
			chars={[' ', '.', ':', '*', '#', '@']}
			seed={42}
			showPerformanceOverlay={true}
		>
			<div style={{ padding: '40px', color: '#fff' }}>
				<h1>Custom Fire Effect</h1>
			</div>
		</PlasmaBackgroundLayout>
	)
}
```

## Debugging

Open your browser console. You should see:

1. `🌈 PlasmaBackgroundLayout rendered with generatorType: fire`
2. `🎮 Frame generator called: generatorType=fire, frame=0`
3. `🔥 Fire generator called: frame=0, columns=..., rows=...`

If you don't see these logs, the component may not be properly imported or used.

## Common Issues

### Issue: Not seeing fire effect

**Solution**: Make sure `generatorType="fire"` is set. The default is `"plasma"`.

### Issue: No logs in console

**Solution**: The component may not be rendering. Check:

- Is the component actually being used?
- Is the font file loading correctly?
- Are there any errors in the console?

### Issue: Black screen

**Solution**: Check that:

- `bitmapFontUrl` points to a valid .FON file
- The font file is accessible (check network tab)
- There are no console errors

## Switching Between Plasma and Fire

```tsx
import { PlasmaBackgroundLayout } from 'react-ansiart'
import { useState } from 'react'

function App() {
	const [effectType, setEffectType] = useState<'plasma' | 'fire'>('fire')

	return (
		<div>
			<button onClick={() => setEffectType(effectType === 'fire' ? 'plasma' : 'fire')}>
				Toggle Effect (Current: {effectType})
			</button>

			<PlasmaBackgroundLayout
				generatorType={effectType}
				bitmapFontUrl='/fonts/Bm437_IBM_VGA_8x16.FON'
				mode='fixed'
				fps={30}
			>
				<div style={{ padding: '40px', color: '#fff' }}>
					<h1>{effectType === 'fire' ? 'Fire' : 'Plasma'} Effect</h1>
				</div>
			</PlasmaBackgroundLayout>
		</div>
	)
}
```
