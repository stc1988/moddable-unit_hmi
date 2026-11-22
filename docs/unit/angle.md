# Angle

The TypeScript driver in `src/drivers/unit/angle` supports the M5Stack Unit Angle (U005), a 10 kΩ rotary
potentiometer with a 0–2500 mV analog output.

IO and pin overrides are optional. With `{}`, analog input uses `device.io.Analog` on GPIO 8
(the CoreS3 example wiring). Pass `sensor: { io?, pin?, ... }` to override only the fields needed.
Other analog IO settings are forwarded unchanged.

## Basic usage

```ts
import Angle from "unit/angle";
import Timer from "timer";

const input = new Angle({});
const timer = Timer.repeat(() => {
	const sample = input.sample();
	trace(`${JSON.stringify(sample)}\n`);
}, 30);

// When finished, clear the application's timer before releasing the driver:
// Timer.clear(timer);
// input.close(); // or input[Symbol.dispose]()
```

## Common sensor API

`sample()` returns a fresh `{ raw, position, time }` object. `time` records host capture time in milliseconds since the Unix
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

- `read()`: returns `number`.
- `readSample()`: returns `AngleSample`.

`position` is the raw value divided by the maximum for the IO resolution.
