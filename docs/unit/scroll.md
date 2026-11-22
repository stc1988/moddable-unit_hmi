# Unit Scroll

The TypeScript driver in `src/drivers/unit/scroll` supports the M5Stack Unit Scroll rotary encoder, push button, and RGB
LED over I2C.

IO and wiring overrides are optional. With `{}`, the driver uses `device.io.SMBus` and
`device.i2c.default` pins. Address defaults to `0x40` and frequency to `400_000` Hz.
Pass `sensor: { io?, data?, clock?, address?, hz?, ... }` to override only the fields needed.
Other IO options, including `port`, `stop`, and `timeout`, are forwarded unchanged.

## Basic usage

```ts
import Scroll from "unit/scroll";
import watchInput from "hmi/watch";

const input = new Scroll({});
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

`sample()` returns a fresh `{ value, pressed, time }` object. `time` records host capture time in milliseconds since the Unix
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

There are currently no sensor configuration properties. `configure({})` is valid; unknown properties are ignored. Construction resets the counter and clears the LED.

## Encoder and RGB LED

- `setEncoder(value)` writes a signed 16-bit accumulated encoder value.
- `resetEncoder()` resets the accumulated encoder value.
- `setLed({ r, g, b })` sets the built-in LED. Each component must be an integer from `0` through `255`.
- `getLed()` returns the current `{ r, g, b }` LED value.

## Device information and address

- `getFirmwareVersion()` and `getBootloaderVersion()` read the corresponding version registers.
- `getI2CAddress()` reads the configured address.
- `setI2CAddress(address)` accepts `0x01` through `0x7f`, writes the device configuration, and programs the device address. Applications must use that address for later driver instances.
- `enterBootloader()` requests the device bootloader. Stop the application polling loop before calling it. It is intended only for firmware maintenance.

The IO connection itself is fixed for the lifetime of an instance. After `setI2CAddress`, call `close()` and create a new
instance with `sensor.address` set to the new address before making further device calls.

## Common LED objects

See [Common LED interface](../led.md) for `led`: `color`, `on`, `brightness`, `rainbow()`, and lifecycle behavior.

The counter and increment are signed 16-bit; the button is active-low.
