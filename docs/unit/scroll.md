# Unit Scroll

The TypeScript driver in `src/drivers/unit/scroll` supports the M5Stack Unit Scroll rotary encoder, push button, and RGB
LED over I2C.

The defaults use Port A on the selected Moddable device, address `0x40`, and a 400 kHz bus. Pass `data`, `clock`,
`address`, or `hz` for another compatible configuration. The `io` option accepts an I2C-compatible constructor for
alternate I/O providers or testing.

## Basic usage

```ts
import Scroll from "unit/scroll";

const scroll = new Scroll();

scroll.onChange = ({ value, pressed }) => {
	trace(`value=${value}, pressed=${pressed}\n`);
};

scroll.onButtonChange = (pressed) => {
	scroll.setLed(pressed ? 255 : 0, 0, pressed ? 0 : 64);
};
```

## Input and callbacks

- `read()` returns the current `{ value, pressed }` state. The signed 16-bit encoder value and active-low button are read
  in separate I2C transactions.
- `readEncoder()` returns the signed 16-bit accumulated encoder value.
- `readIncrement()` returns the signed 16-bit increment register.
- `isButtonPressed()` returns `true` while the wheel is pressed.
- `onChange(state)` runs for the first sample and whenever the encoder value or button state changes.
- `onButtonChange(pressed)` runs on pressed and released transitions after the initial sample.

Assigning either callback starts polling automatically. Clearing both callbacks stops it. `pollingInterval` defaults to
`30` milliseconds. `start()` and `stop()` control polling explicitly, and idempotent `close()` stops polling and releases
the I2C resource.

## Encoder and RGB LED

- `setEncoder(value)` writes a signed 16-bit accumulated encoder value.
- `resetEncoder()` resets the accumulated encoder value.
- `setLed(r, g, b)` sets the built-in LED. Each component must be an integer from `0` through `255`.
- `getLed()` returns the current `{ r, g, b }` LED value.

## Device information and address

- `getFirmwareVersion()` and `getBootloaderVersion()` read the corresponding version registers.
- `getI2CAddress()` reads the configured address.
- `setI2CAddress(address)` accepts `0x01` through `0x7f`, writes the device configuration, and reconnects at the new
  address. Applications must use that address for later driver instances.
- `enterBootloader()` stops polling and requests the device bootloader. It is intended only for firmware maintenance.

Polling failures are written to the Moddable debug channel without stopping the timer. Direct method calls propagate I/O
errors to the caller.

## Exported types

The module exports `ScrollOptions`, `ScrollIO`, `ScrollIOInstance`, `ScrollState`, `ScrollColor`, `ScrollChangeCallback`,
and `ScrollButtonChangeCallback` for TypeScript applications.
