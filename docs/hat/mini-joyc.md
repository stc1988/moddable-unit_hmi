# M5Stack HAT Mini JoyC

The TypeScript driver in `src/drivers/hat/mini-joyc` supports the M5Stack HAT Mini JoyC. It reads the joystick and push button over I2C and controls the built-in RGB LED.

IO and wiring overrides are optional. With `{}`, the driver uses `device.io.SMBus` and
`device.i2c.hat` pins. Address defaults to `0x54` and frequency to `200_000` Hz.
Pass `sensor: { io?, data?, clock?, address?, hz?, ... }` to override only the fields needed.
Other IO options, including `port`, `stop`, and `timeout`, are forwarded unchanged.

## Basic usage

```ts
import MiniJoyC from "hat/mini-joyc";
import watchInput from "hmi/watch";

const input = new MiniJoyC({});
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

`sample()` returns a fresh `{ x, y, pressed, time }` object. `time` records host capture time in milliseconds since the Unix
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

`configure({ readMode: "adc" | "pos8" | "pos10" })` selects the sample representation. `configuration.readMode` reports the setting; the `readMode` accessor delegates to the same configuration. Construction defaults to `"pos8"`. Persistent calibration is device provisioning data and is preserved. Construction also clears the LED.

## Product extensions

- `read()`: returns `MiniJoyCState`.
- `readXY(mode: MiniJoyCReadMode = this.readMode)`: returns `MiniJoyCPosition`.
- `readADC()`: returns `MiniJoyCPosition`.
- `readPosition8Bit()`: returns `MiniJoyCPosition`.
- `readPosition10Bit()`: returns `MiniJoyCPosition`.
- `isButtonPressed()`: returns `boolean`.
- `setLed(color: RGBColor)`: returns `void`.
- `readCalibration(index: MiniJoyCCalibrationIndex)`: returns `number`.
- `readCalibrationValues()`: returns `MiniJoyCCalibration`.
- `writeCalibration(index: MiniJoyCCalibrationIndex, value: number)`: returns `void`.
- `writeCalibrationValues(values: MiniJoyCCalibration)`: returns `void`.
- `getFirmwareVersion()`: returns `number`.
- `getI2CAddress()`: returns `number`.
- `setI2CAddress(address: number)`: returns `void`.

## RGB LED

`setLed({ r, g, b })` sets the RGB LED. Each component must be an integer from `0` through `255`.

```ts
joystick.setLed({ r: 255, g: 0, b: 0 });
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
- `setI2CAddress(address)` writes an address from `0x01` through `0x7f`, then requires the caller to close this instance and construct another at the new address.

Changing the address modifies device configuration. Applications must use the new address when constructing later driver instances.

The IO connection itself is fixed for the lifetime of an instance. After `setI2CAddress`, call `close()` and create a new
instance with `sensor.address` set to the new address before making further device calls.

## Common LED objects

See [Common LED interface](../led.md) for `led`: `color`, `on`, `brightness`, `rainbow()`, and lifecycle behavior.

`readADC()` returns raw ADC values. `readPosition8Bit()` returns signed 8-bit positions, while
`readPosition10Bit()` returns signed 10-bit positions decoded from little-endian 16-bit registers.
The built-in battery has no published status register; battery telemetry is not exposed.
