# Unit 8Angle

The TypeScript driver in `src/drivers/unit/8angle` supports the M5Stack Unit 8Angle's eight potentiometers, physical
toggle switch, and nine RGB LEDs over I2C.

Pass an explicit `sensor` IO constructor and connection options. The device address defaults to `0x43` and
bus frequency to `400_000` Hz; `sensor.address` and `sensor.hz` override them. Pins and the I/O constructor have no defaults.
Additional IO options such as `port`, `stop`, and `timeout` are forwarded to `sensor.io`.

## Basic usage

```ts
import SMBus from "embedded:io/smbus";
import Angle8 from "unit/8angle";
import Timer from "timer";

const input = new Angle8({ sensor: { io: SMBus, data: 2, clock: 1 } });
const timer = Timer.repeat(() => {
	const sample = input.sample();
	trace(`${JSON.stringify(sample)}\n`);
}, 30);

// When finished, clear the application's timer before releasing the driver:
// Timer.clear(timer);
// input.close(); // or input[Symbol.dispose]()
```

## Common sensor API

`sample()` returns a fresh `{ angles, switchOn, time }` object. `time` records host capture time in milliseconds since the Unix
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

## RGB LEDs

LED indices `0` through `7` correspond to the potentiometers. LED `Angle8.SWITCH_LED` (`8`) corresponds to the toggle
switch.

- `setLed(led, { r, g, b }, brightness)` writes the LED color and brightness.
- `getLed(led)` returns `{ r, g, b, brightness }`.
- RGB components accept `0` through `255`; brightness accepts the protocol-defined range `0` through `100` and defaults
  to `100`.

## Device settings

- `getFirmwareVersion()` reads the firmware version.
- `getI2CAddress()` reads the configured address.
- `setI2CAddress(address)` accepts `0x01` through `0x7f`, changes the device address, and programs the device address.

The IO connection itself is fixed for the lifetime of an instance. After `setI2CAddress`, call `close()` and create a new
instance with `sensor.address` set to the new address before making further device calls.

## Common LED objects

See [Common LED interface](../led.md) for `leds[index]`: `color`, `on`, `brightness`, `rainbow()`, and lifecycle behavior.

`angles` contains eight raw 12-bit readings. `readAngle(index, resolution?)` and `readAngles(resolution?)` also accept 8-bit resolution.
