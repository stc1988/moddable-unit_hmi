# Fader

The TypeScript driver in `src/drivers/fader` supports the M5Stack Unit Fader (U123): its analog slider input and the two columns of seven SK6812 RGB LEDs.

The defaults target Port B on M5Stack CoreS3:

| Signal | CoreS3 GPIO |
| --- | --- |
| RGB data (yellow wire) | 9 |
| Analog input (white wire) | 8 |

Pass `sensor: { pin }` and `leds: { pin }` to the constructor when using another controller. For example, the original
M5Stack Core uses GPIO 36 and GPIO 26 respectively. `sensor.io` and `leds.io` can inject compatible I/O constructors;
Moddable's Analog and NeoPixel implementations are the defaults.

The shared host in `examples/manifest.json` includes the Moddable SDK NeoPixel native module. Build that host before running `examples/fader` as a mod; no project-specific native code is required.

## API

- `read()` returns the raw ADC value.
- `readSample()` returns `{ raw, position }`, where `position` is normalized in the direction opposite to the ADC value: the ADC maximum is `0` and the ADC minimum is `1`.
- `onChange` receives the same sample when the raw value changes by more than `deadband`. Assigning a callback starts polling; assigning `null` stops it.
- `setLed(column, level, r, g, b, update = true)` changes one LED using its physical column (`"left"` or `"right"`) and level (`0` through `6`). Level `0` is the `position = 0` end of the fader. Pass `false` to defer the hardware update while changing multiple LEDs.
- `setLevel(level, r, g, b, update = true)` changes the left and right LEDs at the same level together.
- `fillColumn(column, r, g, b, update = true)` changes all seven LEDs in one column.
- `setPixel(index, r, g, b, update = true)` provides low-level access using the SK6812 serial index (`0` through `13`).
- `Fader.ledIndex(column, level)` converts a physical coordinate to its serial index.
- `fill(r, g, b)` updates all LEDs.
- `show()` sends deferred LED changes to the hardware.
- `brightness` gets or sets the global LED brightness in the range `0` through `255`.
- `start()`, `stop()`, and `close()` control polling and hardware resources explicitly.

The serial chain runs up the right column and back down the left column. The coordinate mapping hides this reversal:

| Level | Right index | Left index |
| --- | --- | --- |
| 0 | 0 | 13 |
| 1 | 1 | 12 |
| 2 | 2 | 11 |
| 3 | 3 | 10 |
| 4 | 4 | 9 |
| 5 | 5 | 8 |
| 6 | 6 | 7 |

```ts
import Fader from "unit/fader";

const fader = new Fader({ deadband: 4, brightness: 128 });

fader.onChange = ({ raw, position }) => {
	const lit = Math.round(position * Fader.LEVEL_COUNT);
	for (let level = 0; level < Fader.LEVEL_COUNT; level++) {
		fader.setLevel(level, 0, level < lit ? 128 : 0, level < lit ? 255 : 0, false);
	}
	fader.show();
	trace(`raw=${raw}, position=${position}\n`);
};
```
