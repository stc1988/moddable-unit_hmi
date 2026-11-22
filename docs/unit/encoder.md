# Unit Encoder

The TypeScript driver in `src/drivers/unit/encoder` supports the M5Stack Unit Encoder's rotary encoder, push button, and
two RGB LEDs over I2C.

IO and wiring overrides are optional. With `{}`, the driver uses `device.io.SMBus` and
`device.i2c.default` pins. Address defaults to `0x40` and frequency to `200_000` Hz.
Pass `sensor: { io?, data?, clock?, address?, hz?, ... }` to override only the fields needed.
Other IO options, including `port`, `stop`, and `timeout`, are forwarded unchanged.

## Basic usage

```ts
import Encoder from "unit/encoder";
import Timer from "timer";

const input = new Encoder({});
const timer = Timer.repeat(() => {
	const sample = input.sample();
	trace(`${JSON.stringify(sample)}\n`);
}, 30);

// When finished, clear the application's timer before releasing the driver:
// Timer.clear(timer);
// input.close(); // or input[Symbol.dispose]()
```

## Common sensor API

`sample()` returns a fresh `{ value, pressed, time }` object. `time` records host capture time in milliseconds since the Unix
epoch. Values are read when requested; there is no cached sample or internal polling timer. Multiple register reads in a
sample are sequential, so the snapshot is not a hardware-atomic transaction.

`configure(options)` changes only recognized properties present at the root of `options`. Unknown properties are ignored;
omitted properties are preserved. `configuration` returns a fresh report including `interrupt: false`, since these drivers
provide no hardware sample-ready notifications. An `onSample` option is therefore not retained or called. Polling, deadband,
and change detection belong to the caller. See [architecture and migration](../architecture.md).

`target` is copied from the constructor options when present and remains an ordinary, writable/deletable property.
`close()` and its `[Symbol.dispose]` alias release resources once. Other driver operations throw after close. IO errors
from construction, reads, and configuration propagate synchronously.

## Configuration and initialization

`configure({ mode: 0 | 1 })` selects pulse or AB mode. `configuration.mode` reports the setting. Construction restores pulse mode and resets the counter.

## Encoder mode and value

- `setMode(Encoder.MODE.PULSE)` selects the default pulse-counting mode.
- `setMode(Encoder.MODE.AB)` selects AB mode.
- `setEncoder(value)` writes a signed 16-bit accumulated value.
- `resetEncoder()` uses the dedicated firmware reset command.

Counter writes and the reset command are documented by M5Stack's firmware 1.1 register map. Upgrade older units with the
official firmware if these operations are not available.

## RGB LEDs

The public LED indices are `0` and `1`; the driver translates them to the protocol's LED selectors `1` and `2`.

- `setLed(led, { r, g, b })` sets one LED.
- `setAllLeds({ r, g, b })` sets both LEDs in one command.

RGB components accept integers from `0` through `255`.

## Common LED objects

See [Common LED interface](../led.md) for `leds[index]`: `color`, `on`, `brightness`, `rainbow()`, and lifecycle behavior.

The counter is signed 16-bit and the button is active-high. `readEncoder()` and `isButtonPressed()` remain product extensions.
