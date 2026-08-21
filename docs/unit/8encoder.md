# Unit 8Encoder

The TypeScript driver in `src/drivers/unit/8encoder` supports the M5Stack Unit 8Encoder's eight rotary encoders, eight
push buttons, physical toggle switch, and nine RGB LEDs over I2C.

The defaults use Port A on the selected Moddable device, address `0x41`, and a 100 kHz bus. Pass `data`, `clock`,
`address`, or `hz` for another compatible configuration. The `io` option accepts an I2C-compatible constructor for
alternate I/O providers or testing.

## Basic usage

```ts
import Encoder8 from "unit/8encoder";

const encoder8 = new Encoder8();

encoder8.onChange = ({ encoders, buttons, switchOn }) => {
	trace(`values=${encoders.join(",")} buttons=0x${buttons.toString(16)} switch=${switchOn}\n`);
};

encoder8.onEncoderChange = (encoder, value) => {
	encoder8.setLed(encoder, { r: value < 0 ? 64 : 0, g: value > 0 ? 64 : 0, b: 0 });
};
```

## Inputs and callbacks

- `read()` returns `{ encoders, buttons, switchOn }`. `encoders` contains the eight signed 32-bit counter values and bit
  `n` of `buttons` is set while encoder button `n` is pressed.
- `readEncoders()` and `readEncoder(encoder)` read counter values.
- `readIncrements()` and `readIncrement(encoder)` read the firmware's signed increment values. Reading an increment resets
  the value reported by that register.
- `readEncoderChangeFlags()` returns a bit mask of encoders changed since the register's previous read and clears those
  flags.
- `readButtons()` returns the pressed-button bit mask; `isButtonPressed(button)` reads one button.
- `readButtonToggleCounts()` returns the eight button toggle counts and resets them.
- `isSwitchOn()` reads the physical toggle switch.
- `onChange(state)` runs for the first sample and whenever an encoder, button, or toggle switch changes.
- `onEncoderChange(encoder, value)`, `onButtonChange(button, pressed)`, and `onSwitchChange(on)` report individual
  transitions after the initial sample.

If multiple inputs change in one sample, individual callbacks run in ascending channel order. Assigning any callback
starts polling automatically. Clearing all callbacks stops it. `pollingInterval` defaults to `30` milliseconds. `start()`
and `stop()` control polling explicitly, and idempotent `close()` stops polling and releases the I2C resource.

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
- `setI2CAddress(address)` accepts `0x01` through `0x7f`, changes the device address, and reconnects the driver.

Polling failures are written to the Moddable debug channel without stopping the timer. Direct method calls propagate I/O
errors to the caller.

## Exported types

The module exports `Encoder8Options`, `Encoder8IO`, `Encoder8IOInstance`, `Encoder8State`, `Encoder8Color`,
`Encoder8ChangeCallback`, `Encoder8EncoderChangeCallback`, `Encoder8ButtonChangeCallback`, and
`Encoder8SwitchChangeCallback` for TypeScript applications.
