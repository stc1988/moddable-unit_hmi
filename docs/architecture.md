# Driver architecture

The input drivers share behavior by responsibility instead of by bus or product family. Product drivers live under
`src/drivers/unit` or `src/drivers/hat`; reusable input infrastructure lives under `src/hmi/input`. Every product exposes
its polling lifecycle, callback properties, and comparison settings through a readonly `input` object.

```text
Product driver       Angle / Fader    8Angle / 8Encoder / Encoder / Scroll / ByteButton / ByteSwitch    Joystick / JoyStick2 / MiniJoyC
                            |                           |                                    |
Input semantics      AnalogInputEvents             product input controllers                    JoystickInput
                            |                           |                                    |
Polling lifecycle    +--------------------------- PollingInput<State> ----------------------------+
                            |                           |                                    |
Hardware I/O         embedded:io/analog           embedded:io/i2c                       embedded:io/i2c
```

## PollingInput

`hmi/polling` owns the polling timer, callback lifecycle, error reporting, polling-interval validation, and comparison
against the last notified state. A product supplies a synchronous `read()` source and a `changed(current, previous)`
function. Assigning a callback on the public `input` object starts polling automatically; clearing all input callbacks
stops polling. A product's `close()` closes its input controller before releasing hardware resources.

`JoystickInput` adds joystick-specific axis deadband and button-transition semantics on top of this layer. The three I2C
joystick drivers therefore share event behavior without attempting to merge their different registers or wire protocols.
`EncoderInput` similarly owns `{ value, pressed }` comparison and button transitions for Encoder and Scroll.

ByteButton and ByteSwitch share the same register layout and LED/configuration protocol. Their `BytePanel` base keeps
that product-family protocol in one place while the public drivers retain button- and switch-specific names, input
polarity, state, and callbacks.

## AnalogInput

`hmi/input/analog` wraps a constructor-injected analog I/O implementation. It exposes a raw read and a normalized
`{ raw, position }` sample, with optional direction inversion. `AnalogInputEvents` owns polling and deadband comparison.
Angle uses the normal direction; Fader uses the inverted direction.

Angle accepts `sensor: { io, pin }`. Fader accepts the same `sensor` option and `leds: { io, pin }`. 8Angle, 8Encoder,
Encoder, Joystick v1.1, JoyStick2, Scroll, ByteButton, ByteSwitch, and HAT Mini JoyC accept an `io` bus constructor. These
entries are constructors compatible with the required operation subset, so tests and other boards can inject alternative
I/O without changing product logic. The corresponding Moddable I/O implementations remain the defaults. `hmi/smbus`
provides `SMBusDevice` as the base class for resolving bus pins, frequency, address, and injected I/O; it also owns
connection replacement, active-resource access, address changes, and close handling across the I2C drivers.
Its `SMBusOptions` type is derived directly from the `embedded:io/smbus` constructor in `@moddable/typings`.

8Angle and 8Encoder expose product-specific input controllers for their multi-channel transitions. ByteButton and
ByteSwitch adapt the shared BytePanel bit-field input controller to product-specific callback names. These controllers
compose `PollingInput` without adding polling or callback forwarding methods to the hardware-facing product classes.
The multi-channel controllers live in each product's `input` module, keeping the main driver focused on registers and
device operations. MiniJoyC keeps its public types, validation, and little-endian calibration encoding with its product
driver, consistent with the other single-product I2C drivers.

## Deliberate boundaries

Register maps, encoding, calibration, and LED protocols remain in product drivers unless multiple products implement the
same protocol, as ByteButton and ByteSwitch do. New drivers should reuse the polling or analog layer only when their
behavior matches those contracts; product-family protocol sharing stays separate from generic bus resource management.
