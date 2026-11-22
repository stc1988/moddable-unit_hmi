# Unit Joystick v1.1

The TypeScript driver in `src/drivers/unit/joystick` supports the M5Stack Unit Joystick v1.1 (U024-C). It reads the X/Y axes and push button over I2C at the device's fixed address, `0x52`.

Pass an explicit `sensor` IO constructor and connection options. The device address defaults to `0x52` and
bus frequency to `400_000` Hz; `sensor.address` and `sensor.hz` override them. Pins and the I/O constructor have no defaults.
Additional IO options such as `port`, `stop`, and `timeout` are forwarded to `sensor.io`.

## Basic usage

```ts
import SMBus from "embedded:io/smbus";
import JoyStick from "unit/joystick";
import Timer from "timer";

const input = new JoyStick({ sensor: { io: SMBus, data: 2, clock: 1 } });
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

There are currently no sensor configuration properties. `configure({})` is valid; unknown properties are ignored.

## Product extensions

- `read()`: returns `JoyStickState`.
- `readXY()`: returns `JoyStickPosition`.
- `isButtonPressed()`: returns `boolean`.

Axes are unsigned 8-bit values; position and button arrive in a single three-byte transaction.
