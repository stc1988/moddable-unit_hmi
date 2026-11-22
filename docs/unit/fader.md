# Fader

The TypeScript driver in `src/drivers/unit/fader` supports the M5Stack Unit Fader (U123): its analog slider input and the two columns of seven SK6812 RGB LEDs.

IO and pin overrides are optional. With `{}`, analog input uses `device.io.Analog` on GPIO 8
(the CoreS3 example wiring). Pass `sensor: { io?, pin?, ... }` to override only the fields needed.
Other analog IO settings are forwarded unchanged.

The LED output defaults to SDK NeoPixel on GPIO 9. Pass `leds: { io?, pin? }` to override either or both.

## Basic usage

```ts
import Fader from "unit/fader";
import watchInput from "hmi/watch";

const input = new Fader({});
const watcher = watchInput(input, {
	onChanged(sample) {
		trace(`${JSON.stringify(sample)}\n`);
	},
});

// When finished, stop watching before releasing the driver:
// watcher.close();
// input.close(); // or input[Symbol.dispose]()
```

## Common sensor API

`sample()` returns a fresh `{ raw, position, time }` object. `time` records host capture time in milliseconds since the Unix
epoch. Values are read when requested; there is no cached sample or internal polling timer. Multiple register reads in a
sample are sequential, so the snapshot is not a hardware-atomic transaction.

`configure(options)` changes only recognized properties present at the root of `options`. Unknown properties are ignored;
omitted properties are preserved. `configuration` returns a fresh report including `interrupt: false`, since these drivers
provide no hardware sample-ready notifications. An `onSample` option is therefore not retained or called. Polling, deadband,
and change detection belong to the caller; [watchInput](../watch.md) provides a helper. Include its manifest when using the example. See [architecture and migration](../architecture.md).

`target` is copied from the constructor options when present and remains an ordinary, writable/deletable property.
`close()` and its `[Symbol.dispose]` alias release resources once. Other driver operations throw after close. IO errors
from construction, reads, and configuration propagate synchronously.

## Configuration and initialization

`configure({ brightness })` sets hardware brightness to an integer from `0` through `255`. `configuration.brightness` and the `brightness` accessor report it. Construction sets brightness to `128` and clears the LEDs. Out-of-range or fractional components throw instead of being clamped or rounded.

## Product extensions

- `read()`: returns `number`.
- `readSample()`: returns `FaderSample`.
- `setLed(column: FaderLedColumn, level: number, color: RGBColor, update = true)`: returns `void`.
- `setLevel(level: number, color: RGBColor, update = true)`: returns `void`.
- `fillColumn(column: FaderLedColumn, color: RGBColor, update = true)`: returns `void`.
- `setPixel(index: number, color: RGBColor, update = true)`: returns `void`.
- `fill(color: RGBColor)`: returns `void`.
- `show()`: returns `void`.

`position` is inverted so it increases from the physical low end to the high end. LED indices run from 0 through 13; each column has 7 levels.

## Common LED objects

See [Common LED interface](../led.md) for `leds[index]`: `color`, `on`, `brightness`, `rainbow()`, and lifecycle behavior.

The shared mod host includes the native NeoPixel module. Build that host before running the Fader mod.
The serial chain runs up the right column and back down the left column. `Fader.ledIndex(column, level)` maps right
levels 0–6 to indices 0–6, and left levels 0–6 to indices 13–7. `level = 0` is the `position = 0` end. Pass `update = false`
to accumulate changes with `setLed`, `setLevel`, `fillColumn`, or `setPixel`, then call `show()` once.
