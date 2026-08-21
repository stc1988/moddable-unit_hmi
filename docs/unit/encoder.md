# Unit Encoder

The TypeScript driver in `src/drivers/unit/encoder` supports the M5Stack Unit Encoder's rotary encoder, push button, and
two RGB LEDs over I2C.

The defaults use Port A on the selected Moddable device, address `0x40`, and a 200 kHz bus. Pass `data`, `clock`,
`address`, or `hz` for another compatible configuration. The `io` option accepts an I2C-compatible constructor for
alternate I/O providers or testing.

## Basic usage

```ts
import Encoder from "unit/encoder";

const encoder = new Encoder();

encoder.onChange = ({ value, pressed }) => {
	trace(`value=${value}, pressed=${pressed}\n`);
};

encoder.onButtonChange = (pressed) => {
	encoder.setLed(1, pressed ? 255 : 0, 0, pressed ? 0 : 64);
};
```

## Input and callbacks

- `read()` returns the current `{ value, pressed }` state. The signed 16-bit encoder value and active-high button are read
  in separate I2C transactions.
- `readEncoder()` returns the signed 16-bit accumulated encoder value.
- `isButtonPressed()` returns `true` while the knob is pressed.
- `onChange(state)` runs for the first sample and whenever the encoder value or button state changes.
- `onButtonChange(pressed)` runs on pressed and released transitions after the initial sample.

Assigning either callback starts polling automatically. Clearing both callbacks stops it. `pollingInterval` defaults to
`30` milliseconds. `start()` and `stop()` control polling explicitly, and idempotent `close()` stops polling and releases
the I2C resource.

## Encoder mode and value

- `setMode(Encoder.MODE.PULSE)` selects the default pulse-counting mode.
- `setMode(Encoder.MODE.AB)` selects AB mode.
- `setEncoder(value)` writes a signed 16-bit accumulated value.
- `resetEncoder()` uses the dedicated firmware reset command.

Counter writes and the reset command are documented by M5Stack's firmware 1.1 register map. Upgrade older units with the
official firmware if these operations are not available.

## RGB LEDs

The public LED indices are `0` and `1`; the driver translates them to the protocol's LED selectors `1` and `2`.

- `setLed(led, r, g, b)` sets one LED.
- `setAllLeds(r, g, b)` sets both LEDs in one command.

RGB components accept integers from `0` through `255`.

Polling failures are written to the Moddable debug channel without stopping the timer. Direct method calls propagate I/O
errors to the caller.

## Exported types

The module exports `EncoderOptions`, `EncoderIO`, `EncoderIOInstance`, `EncoderState`, `EncoderMode`,
`EncoderChangeCallback`, and `EncoderButtonChangeCallback` for TypeScript applications.
