# Mini JoyC HAT

The TypeScript driver in `src/drivers/m5hat-mini-joyc` supports the M5Stack Mini JoyC HAT. It reads the joystick and push button over I2C and controls the built-in RGB LED.

The defaults use the HAT I2C port on M5StickC Plus, address `0x54`, and a 200 kHz bus. Pass `data`, `clock`, `address`, or `hz` when using another compatible configuration. The `io` option accepts an SMBus-compatible constructor for alternate I/O providers or testing.

## Basic usage

```ts
import MiniJoyC from "hat/mini-joyc";

const joystick = new MiniJoyC({ deadband: 2, readMode: "pos8" });

joystick.onChange = ({ x, y, pressed }) => {
	trace(`x=${x}, y=${y}, pressed=${pressed}\n`);
};

joystick.onButtonChange = (pressed) => {
	joystick.setLed(0, pressed ? 128 : 0, pressed ? 255 : 0);
};
```

## Constructor options

- `address` sets the 7-bit I2C address and defaults to `0x54`.
- `data` and `clock` select the I2C pins. They default to `device.I2C.hat`.
- `hz` sets the I2C bus speed and defaults to `200_000`.
- `io` provides the SMBus-compatible I/O constructor.
- `readMode` selects `"adc"`, `"pos8"`, or `"pos10"` and defaults to `"pos8"`.
- `pollingInterval` sets the polling period in milliseconds and defaults to `30`.
- `deadband` suppresses axis notifications until either axis differs from the last notified state by more than this many native units. It defaults to `0`.
- `onChange` and `onButtonChange` install the initial callbacks and start polling automatically.

## Input

- `read()` returns the current `{ x, y, pressed }` state using `readMode`.
- `readXY(mode?)` returns `{ x, y }` using the supplied mode or the current `readMode`.
- `readADC()` returns the two raw ADC readings.
- `readPosition8Bit()` returns the two signed 8-bit position values.
- `readPosition10Bit()` returns the two signed 10-bit position values as JavaScript numbers.
- `isButtonPressed()` returns `true` while the joystick button is pressed.

Each method performs a new device read. In particular, `read()` reads the position and button separately. Use the returned state as a snapshot rather than assuming that both I2C transactions occurred atomically.

## Change callbacks

Assigning either callback starts the internal polling timer. Clearing both callbacks stops it.

- `onChange(state)` runs for the first sample, when either axis moves by more than `deadband`, or when the button state changes.
- `onButtonChange(pressed)` runs on pressed and released transitions after the initial sample.

The deadband comparison is made against the last state delivered to `onChange`, so several small movements accumulate. It is expressed in the native units of the selected `readMode`.

Use `read()` from an application-owned control loop when a state is required every frame or at a fixed rate. Change callbacks intentionally do not repeat while the joystick remains at the same position.

## RGB LED

`setLed(r, g, b)` sets the RGB LED. Each component must be an integer from `0` through `255`.

```ts
joystick.setLed(255, 0, 0);
```

## Calibration

`MiniJoyC.CALIBRATION` contains the six supported calibration indexes:

- `X_MIN`
- `X_MAX`
- `Y_MIN`
- `Y_MAX`
- `X_CENTER`
- `Y_CENTER`

Use `readCalibration(index)` and `writeCalibration(index, value)` for one value. Use `readCalibrationValues()` and `writeCalibrationValues(values)` for the complete `{ xMin, xMax, yMin, yMax, xCenter, yCenter }` set.

Calibration values must be integers from `0` through `4095`. A calibration write includes the device's required one-second delay, so it is a blocking operation.

## Device information and address

- `getFirmwareVersion()` reads the firmware version register.
- `getI2CAddress()` reads the configured I2C address.
- `setI2CAddress(address)` writes an address from `0x01` through `0x7f`, closes the old SMBus connection, and reconnects using the new address.

Changing the address modifies device configuration. Applications must use the new address when constructing later driver instances.

## Polling and lifetime

- `start()` starts polling explicitly.
- `stop()` stops polling without closing the SMBus connection.
- `close()` stops polling and releases the SMBus resource. It is safe to call more than once.

Polling failures are written to the Moddable debug channel and do not stop the timer. Calls made directly through the public read or write methods throw their I/O errors to the caller.

The built-in 200 mAh battery powers the HAT, but the published Mini JoyC I2C protocol has no battery-status register. The driver therefore does not expose battery telemetry.

## Exported types

The module exports `MiniJoyCOptions`, `MiniJoyCIO`, `MiniJoyCPosition`, `MiniJoyCState`, `MiniJoyCReadMode`,
`MiniJoyCCalibration`, `MiniJoyCCalibrationIndex`, `MiniJoyCChangeCallback`, and `MiniJoyCButtonChangeCallback` for
TypeScript applications.
