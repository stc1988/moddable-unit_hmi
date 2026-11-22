# JoyStick2

The driver is implemented in TypeScript under `src/drivers/unit/joystick2` and exports `JoyStick2Options`, `JoyStick2IO`,
`JoyStick2Position` and `JoyStick2State` for typed applications.

IO and wiring overrides are optional. With `{}`, the driver uses `device.io.SMBus` and
`device.i2c.default` pins. Address defaults to `0x63` and frequency to `400_000` Hz.
Pass `sensor: { io?, data?, clock?, address?, hz?, ... }` to override only the fields needed.
Other IO options, including `port`, `stop`, and `timeout`, are forwarded unchanged.

## Basic usage

```ts
import JoyStick2 from "unit/joystick2";
import Timer from "timer";

const input = new JoyStick2({});
const timer = Timer.repeat(() => {
	const sample = input.sample();
	trace(`${JSON.stringify(sample)}\n`);
}, 30);

// When finished, clear the application's timer before releasing the driver:
// Timer.clear(timer);
// input.close(); // or input[Symbol.dispose]()
```

## Common sensor API

`sample()` returns a fresh `{ x, y, pressed, time }` object. `time` records host capture time in milliseconds since the Unix
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

There are currently no sensor configuration properties. `configure({})` is valid; unknown properties are ignored. Construction clears the LEDs.

## Product extensions

- `read()`: returns `JoyStick2State`.
- `readXY()`: returns `JoyStick2Position`.
- `isButtonPressed()`: returns `boolean`.
- `setLed(color: RGBColor)`: returns `void`.

## Common LED objects

See [Common LED interface](../led.md) for `led`: `color`, `on`, `brightness`, `rainbow()`, and lifecycle behavior.

Axes are signed 8-bit mapped values from the offset registers. The button is active-low.

`setLed` accepts RGB bytes and writes the device's BGR register order (blue at 0x30, green at 0x31, red at 0x32).
