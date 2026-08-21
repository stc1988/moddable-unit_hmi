# Unit 8Angle

The TypeScript driver in `src/drivers/unit/8angle` supports the M5Stack Unit 8Angle's eight potentiometers, physical
toggle switch, and nine RGB LEDs over I2C.

The defaults use Port A on the selected Moddable device, address `0x43`, and a 400 kHz bus. Pass `data`, `clock`,
`address`, or `hz` for another compatible configuration. The `io` option accepts an I2C-compatible constructor for
alternate I/O providers or testing.

## Basic usage

```ts
import Angle8 from "unit/8angle";

const angle8 = new Angle8({ deadband: 8 });

angle8.input.onChange = ({ angles, switchOn }) => {
	trace(`angles=${angles.join(",")} switch=${switchOn}\n`);
};

angle8.input.onAngleChange = (angle, value) => {
	angle8.setLed(angle, value >> 4, 255 - (value >> 4), 0, 30);
};
```

## Inputs and callbacks

- `read()` returns `{ angles, switchOn }`. `angles` contains the raw 12-bit values for potentiometers 0 through 7.
- `readAngles()` reads all eight potentiometers. Pass `8` to return the device's 8-bit values instead.
- `readAngle(angle)` reads one potentiometer. Pass `8` as the second argument for its 8-bit value.
- `isSwitchOn()` reads the physical toggle switch.
- `input.onChange(state)` runs for the first sample, when any potentiometer moves by more than `input.deadband`, or when the switch
  changes.
- `input.onAngleChange(angle, value)` runs for each potentiometer transition after the initial sample.
- `input.onSwitchChange(on)` runs when the switch changes after the initial sample.

If multiple potentiometers change in one sample, `input.onAngleChange` runs in ascending channel order. `input.deadband` uses native
12-bit ADC units and defaults to `0`.

Assigning any input callback starts polling automatically. Clearing all callbacks stops it. `input.pollingInterval` defaults to `30`
milliseconds. `input.start()` and `input.stop()` control polling explicitly, and idempotent `close()` stops polling and releases the
I2C resource.

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
- `setI2CAddress(address)` accepts `0x01` through `0x7f`, changes the device address, and reconnects the driver.

Polling failures are written to the Moddable debug channel without stopping the timer. Direct method calls propagate I/O
errors to the caller.

## Exported types

The module exports `Angle8Input`, `Angle8Options`, `Angle8IO`, `Angle8IOInstance`, `Angle8State`, `Angle8Color`, `Angle8Resolution`,
`Angle8ChangeCallback`, `Angle8AngleChangeCallback`, and `Angle8SwitchChangeCallback` for TypeScript applications.
