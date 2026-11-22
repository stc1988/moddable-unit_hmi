# Unit 8Encoder

The TypeScript driver in `src/drivers/unit/8encoder` supports the M5Stack Unit 8Encoder's eight rotary encoders, eight
push buttons, physical toggle switch, and nine RGB LEDs over I2C.

Pass an explicit `sensor` IO constructor and connection options. The device address defaults to `0x41` and
bus frequency to `100_000` Hz; `sensor.address` and `sensor.hz` override them. Pins and the I/O constructor have no defaults.
Additional IO options such as `port`, `stop`, and `timeout` are forwarded to `sensor.io`.

## Basic usage

```ts
import SMBus from "embedded:io/smbus";
import Encoder8 from "unit/8encoder";
import Timer from "timer";

const input = new Encoder8({ sensor: { io: SMBus, data: 2, clock: 1 } });
const timer = Timer.repeat(() => {
	const sample = input.sample();
	trace(`${JSON.stringify(sample)}\n`);
}, 30);

// When finished, clear the application's timer before releasing the driver:
// Timer.clear(timer);
// input.close(); // or input[Symbol.dispose]()
```

## Common sensor API

`sample()` returns a fresh `{ encoders, buttons, switchOn, time }` object. `time` records host capture time in milliseconds since the Unix
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

There are currently no sensor configuration properties. `configure({})` is valid; unknown properties are ignored. Construction resets all encoder counters and clears the LEDs.

## Counters

- `setEncoder(encoder, value)` sets one signed 32-bit counter.
- `resetEncoder(encoder)` resets one counter.
- `resetEncoders()` resets all eight counters in one transaction.

Encoder and button indices range from `0` through `7`.

## RGB LEDs

LED indices `0` through `7` correspond to the rotary encoders. LED `Encoder8.SWITCH_LED` (`8`) corresponds to the toggle
switch.

- `setLed(led, { r, g, b })` sets one LED.
- `getLed(led)` returns `{ r, g, b }`.
- `setAllLeds({ r, g, b })` sets all nine LEDs in one transaction.

RGB components accept `0` through `255`.

## Device settings

- `getFirmwareVersion()` reads the firmware version.
- `getI2CAddress()` reads the configured address.
- `setI2CAddress(address)` accepts `0x01` through `0x7f`, changes the device address, and programs the device address.

The IO connection itself is fixed for the lifetime of an instance. After `setI2CAddress`, call `close()` and create a new
instance with `sensor.address` set to the new address before making further device calls.

## Common LED objects

See [Common LED interface](../led.md) for `leds[index]`: `color`, `on`, `brightness`, `rainbow()`, and lifecycle behavior.

`encoders` contains eight signed 32-bit counts. Bit n of `buttons` is one while button n is pressed.
