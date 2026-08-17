# Driver architecture

The input drivers share behavior by responsibility instead of by bus or product family. Product drivers live under
`src/drivers/unit` or `src/drivers/hat`; reusable input infrastructure lives separately under `src/input`.

```text
Product driver       Angle / Fader    Scroll / ByteButton / ByteSwitch    Joystick / JoyStick2 / MiniJoyC
                            |                       |                                |
Input semantics      AnalogInput                   |                          JoystickInput
                            |                       |                                |
Polling lifecycle    +----------------------- PollingInput<State> ------------------------+
                            |                       |                                |
Hardware I/O         embedded:io/analog       embedded:io/smbus                 embedded:io/smbus
```

## PollingInput

`input/polling` owns the polling timer, callback lifecycle, error reporting, polling-interval validation, and comparison
against the last notified state. A product supplies a synchronous `read()` source and a `changed(current, previous)`
function. Assigning a callback starts polling automatically; clearing it stops polling. `close()` is idempotent and stops
callbacks before the hardware layer is closed.

`JoystickInput` adds joystick-specific axis deadband and button-transition semantics on top of this layer. The three I2C
joystick drivers therefore share event behavior without attempting to merge their different registers or wire protocols.

## AnalogInput

`input/analog` wraps a constructor-injected analog I/O implementation. It exposes a raw read and a normalized
`{ raw, position }` sample, with optional direction inversion. Angle uses the normal direction; Fader uses the inverted
direction. Both use `PollingInput` for event delivery.

Angle accepts `sensor: { io, pin }`. Fader accepts the same `sensor` option and `leds: { io, pin }`. Joystick v1.1,
JoyStick2, Scroll, ByteButton, ByteSwitch, and Mini JoyC accept an `io` bus constructor. These entries are constructors
compatible with the required operation subset, so tests and other boards can inject alternative I/O without changing
product logic. The corresponding Moddable I/O implementations remain the defaults.

Scroll, ByteButton, and ByteSwitch use `PollingInput` directly because their state is not a two-axis joystick. They
provide the same automatic callback lifecycle and separate input-transition callbacks without introducing joystick axis
semantics.

## Deliberate boundaries

Register maps, encoding, calibration, and LED protocols remain in product drivers. Those details differ substantially and
sharing them would couple otherwise independent devices. New drivers should reuse the polling or analog layer only when
their behavior matches those contracts; a bus transport abstraction can be added separately when multiple devices truly
share transaction behavior.
