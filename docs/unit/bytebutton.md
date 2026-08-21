# Unit ByteButton

The TypeScript driver in `src/drivers/unit/bytebutton` supports the M5Stack Unit ByteButton's eight capacitive buttons
and nine RGB LEDs over I2C.

The defaults use Port A on the selected Moddable device, address `0x47`, and a 400 kHz bus. Pass `data`, `clock`,
`address`, or `hz` for another compatible configuration. The `io` option accepts an I2C-compatible constructor for
alternate I/O providers or testing.

## Basic usage

```ts
import ByteButton from "unit/bytebutton";

const byteButton = new ByteButton();

byteButton.input.onChange = ({ buttons }) => {
	trace(`button mask: 0x${buttons.toString(16)}\n`);
};

byteButton.input.onButtonChange = (button, pressed) => {
	byteButton.setLed(button, { r: 0, g: pressed ? 255 : 0, b: 0 });
};
```

## Buttons and callbacks

- `read()` returns `{ buttons }`, where bit 0 through bit 7 represent buttons 0 through 7. The hardware's active-low
  values are normalized so that a set bit means pressed.
- `readButtons()` returns the button bit mask directly.
- `readButton(button)` reads an individual button register and returns its pressed state.
- `input.onChange(state)` runs for the first sample and whenever the button mask changes.
- `input.onButtonChange(button, pressed)` runs once for each pressed or released transition after the initial sample. If several
  buttons change in one sample, callbacks run in ascending button order.

Assigning either input callback starts polling automatically. Clearing both callbacks stops it. `input.pollingInterval` defaults to
`30` milliseconds. `input.start()` and `input.stop()` control polling explicitly, and idempotent `close()` stops polling and releases
the I2C resource.

## RGB LEDs

LED indices are `0` through `8`; LEDs 0 through 7 correspond to the buttons and LED 8 is the center status LED.

- `setLedBrightness(led, brightness)` and `getLedBrightness(led)` access the per-LED brightness from `0` through `255`.
- `setLed(led, { r, g, b })` and `getLed(led)` access full RGB888 colors in manual mode.
- `setLedCompact(led, { r, g, b })` writes the protocol's compact RGB233 representation.
- `setLedMode(ByteButton.LED_MODE.MANUAL)` displays the colors set with `setLed` or `setLedCompact`.
- `setLedMode(ByteButton.LED_MODE.BUTTON)` lets the device select colors from each button's pressed state.
- `setButtonLed(button, pressed, { r, g, b })` and `getButtonLed(button, pressed)` configure those automatic colors.

## Device settings

- `setIrqEnabled(enabled)` and `getIrqEnabled()` access the firmware's IRQ setting. The setting takes effect after the
  ByteButton restarts. With IRQ enabled, the firmware drives its IRQ pad low on a button change and releases it after the
  combined button register is read. Polling works without enabling IRQ.
- `saveSettings()` writes the supported brightness, mode, automatic colors, IRQ, and address configuration to flash.
  Call it only when persistence is intended to avoid unnecessary flash writes.
- `getFirmwareVersion()` reads the firmware version.
- `getI2CAddress()` reads the configured address. `setI2CAddress(address)` accepts `0x01` through `0x7f` and reconnects
  the driver at the new address. Use `saveSettings()` if the new address must survive a restart.

Polling failures are written to the Moddable debug channel without stopping the timer. Direct method calls propagate I/O
errors to the caller.

## Exported types

The module exports `ByteButtonInput`, `ByteButtonOptions`, `ByteButtonIO`, `ByteButtonIOInstance`, `ByteButtonState`,
`ByteButtonLedMode`, `ByteButtonChangeCallback`, and `ByteButtonButtonChangeCallback` for TypeScript applications.
