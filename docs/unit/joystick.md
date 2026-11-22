# Unit Joystick v1.1

The TypeScript driver in `src/drivers/unit/joystick` supports the M5Stack Unit Joystick v1.1 (U024-C). It reads the X/Y axes and push button over I2C at the device's fixed address, `0x52`.

IO and wiring overrides are optional. With `{}`, the driver uses `device.io.SMBus` and
`device.i2c.default` pins. Address defaults to `0x52` and frequency to `400_000` Hz.
Pass `sensor: { io?, data?, clock?, address?, hz?, ... }` to override only the fields needed.
Other IO options, including `port`, `stop`, and `timeout`, are forwarded unchanged.

## Basic usage

```ts
import JoyStick from "unit/joystick";
import watchInput from "hmi/watch";

const input = new JoyStick({});
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

`sample()` returns a fresh `{ x, y, pressed, time }` object. `time` records host capture time in milliseconds since the Unix
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

There are currently no sensor configuration properties. `configure({})` is valid; unknown properties are ignored.

## Product extensions

- `read()`: returns `JoyStickState`.
- `readXY()`: returns `JoyStickPosition`.
- `isButtonPressed()`: returns `boolean`.

Axes are unsigned 8-bit values; position and button arrive in a single three-byte transaction.
