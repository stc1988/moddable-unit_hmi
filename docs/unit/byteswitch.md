# Unit ByteSwitch

The TypeScript driver in `src/drivers/unit/byteswitch` supports the M5Stack Unit ByteSwitch's eight toggle switches and
nine RGB LEDs over I2C.

The defaults use Port A on the selected Moddable device, address `0x46`, and a 400 kHz bus. Pass `data`, `clock`,
`address`, or `hz` for another compatible configuration. The `io` option accepts an I2C-compatible constructor for
alternate I/O providers or testing.

## Basic usage

```ts
import ByteSwitch from "unit/byteswitch";

const byteSwitch = new ByteSwitch();

byteSwitch.onChange = ({ switches }) => {
	trace(`switch mask: 0x${switches.toString(16)}\n`);
};

byteSwitch.onSwitchChange = (switchIndex, on) => {
	byteSwitch.setLed(switchIndex, { r: on ? 255 : 0, g: on ? 128 : 0, b: 0 });
};
```

## Switches and callbacks

- `read()` returns `{ switches }`, where bit 0 through bit 7 represent switches 0 through 7. A set bit means that the
  corresponding switch is on.
- `readSwitches()` returns the switch bit mask directly.
- `readSwitch(switchIndex)` reads an individual switch register and returns its on/off state.
- `onChange(state)` runs for the first sample and whenever the switch mask changes.
- `onSwitchChange(switchIndex, on)` runs once for each transition after the initial sample. If several switches change in
  one sample, callbacks run in ascending switch order.

Assigning either callback starts polling automatically. Clearing both callbacks stops it. `input.pollingInterval` defaults to
`30` milliseconds. `input.start()` and `input.stop()` control polling explicitly, and idempotent `close()` stops polling and releases
the I2C resource.

## RGB LEDs

LED indices are `0` through `8`; LEDs 0 through 7 correspond to the switches and LED 8 is the center status LED.

- `setLedBrightness(led, brightness)` and `getLedBrightness(led)` access the per-LED brightness from `0` through `255`.
- `setLed(led, { r, g, b })` and `getLed(led)` access full RGB888 colors in manual mode.
- `setLedCompact(led, { r, g, b })` writes the protocol's compact RGB233 representation.
- `setLedMode(ByteSwitch.LED_MODE.MANUAL)` displays the colors set with `setLed` or `setLedCompact`.
- `setLedMode(ByteSwitch.LED_MODE.SWITCH)` lets the device select colors from each switch's state.
- `setSwitchLed(switchIndex, on, { r, g, b })` and `getSwitchLed(switchIndex, on)` configure those automatic colors.

## Device settings

- `setIrqEnabled(enabled)` and `getIrqEnabled()` access the firmware's IRQ setting. The setting takes effect after the
  ByteSwitch restarts. With IRQ enabled, the firmware drives its IRQ pad low on a switch change and releases it after the
  combined switch register is read. Polling works without enabling IRQ.
- `saveSettings()` writes the supported brightness, mode, automatic colors, IRQ, and address configuration to flash.
  Call it only when persistence is intended to avoid unnecessary flash writes.
- `getFirmwareVersion()` reads the firmware version.
- `getI2CAddress()` reads the configured address. `setI2CAddress(address)` accepts `0x01` through `0x7f` and reconnects
  the driver at the new address. Use `saveSettings()` if the new address must survive a restart.

Polling failures are written to the Moddable debug channel without stopping the timer. Direct method calls propagate I/O
errors to the caller.

## Exported types

The module exports `ByteSwitchInput`, `ByteSwitchOptions`, `ByteSwitchIO`, `ByteSwitchIOInstance`, `ByteSwitchState`,
`ByteSwitchLedMode`, `ByteSwitchChangeCallback`, and `ByteSwitchSwitchChangeCallback` for TypeScript applications.
