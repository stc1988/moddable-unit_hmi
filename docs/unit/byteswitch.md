# Unit ByteSwitch

The TypeScript driver in `src/drivers/unit/byteswitch` supports the M5Stack Unit ByteSwitch's eight toggle switches and
nine RGB LEDs over I2C.

IO and wiring overrides are optional. With `{}`, the driver uses `device.io.SMBus` and
`device.i2c.default` pins. Address defaults to `0x46` and frequency to `400_000` Hz.
Pass `sensor: { io?, data?, clock?, address?, hz?, ... }` to override only the fields needed.
Other IO options, including `port`, `stop`, and `timeout`, are forwarded unchanged.

## Basic usage

```ts
import ByteSwitch from "unit/byteswitch";
import watchInput from "hmi/watch";

const input = new ByteSwitch({});
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

`sample()` returns a fresh `{ switches, time }` object. `time` records host capture time in milliseconds since the Unix
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

`configure({ ledMode: 0 | 1 })` selects manual or input-linked LED mode; `configuration.ledMode` reports the hardware setting. Construction restores manual mode, brightness `255`, black LEDs, black input-off colors, and white input-on colors. This does not save settings to flash.

## RGB LEDs

LED indices are `0` through `8`; LEDs 0 through 7 correspond to the switches and LED 8 is the center status LED.

- `setLedBrightness(led, brightness)` and `getLedBrightness(led)` access the per-LED brightness from `0` through `255`.
- `setLed(led, { r, g, b })` and `getLed(led)` access full RGB888 colors in manual mode.
- `setLedCompact(led, { r, g, b })` writes the protocol's compact RGB233 representation.
- `setLedMode(ByteSwitch.LED_MODE.MANUAL)` displays the colors set with `setLed` or `setLedCompact`.
- `setLedMode(ByteSwitch.LED_MODE.SWITCH)` lets the device select colors from each switch's state.
- `setSwitchLed(switchIndex, on, { r, g, b })` and `getSwitchLed(switchIndex, on)` configure those automatic colors.

## Device settings

- The firmware protocol defines an IRQ mode that repurposes the STM32's SWDIO (PA13) programming signal. SWDIO is
  available only on the internal SWD programming pads and is not routed to either Grove connector. The driver therefore
  does not expose IRQ configuration; the application polls for switch changes.
- `saveSettings()` writes the supported brightness, mode, automatic colors, and address configuration to flash.
  Call it only when persistence is intended to avoid unnecessary flash writes.
- `getFirmwareVersion()` reads the firmware version.
- `getI2CAddress()` reads the configured address. `setI2CAddress(address)` accepts `0x01` through `0x7f` and programs the device address. Use `saveSettings()` if the new address must survive a restart.

The IO connection itself is fixed for the lifetime of an instance. After `setI2CAddress`, call `close()` and create a new
instance with `sensor.address` set to the new address before making further device calls.

## Common LED objects

See [Common LED interface](../led.md) for `leds[index]`: `color`, `on`, `brightness`, `rainbow()`, and lifecycle behavior.
