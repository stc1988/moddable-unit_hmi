# moddable-unit_hmi

## Supported Drivers

| Product | Category | Interface | Documentation | Features |
| --- | --- | --- | --- | --- |
| M5Stack Unit Angle | Unit | Analog | [Driver](docs/angle.md) / [M5Stack](https://docs.m5stack.com/ja/unit/angle) | 10 kΩ rotary potentiometer |
| M5Stack Unit Fader | Unit | Analog / RGB data | [Driver](docs/fader.md) / [M5Stack](https://docs.m5stack.com/ja/unit/fader) | 35 mm slider, 14x SK6812 RGB LED |
| M5Stack Unit Joystick v1.1 | Unit | I2C | [Driver](docs/joyStick.md) / [M5Stack](https://docs.m5stack.com/ja/unit/joystick_1.1) | Joystick (X/Y), Button |
| M5Stack Unit JoyStick2 | Unit | I2C / SMBus | [Driver](docs/joyStick2.md) / [M5Stack](https://docs.m5stack.com/ja/unit/Unit-JoyStick2) | Hall-effect joystick (X/Y), Button, RGB LED |
| M5Stack Mini JoyC HAT | HAT | I2C / SMBus | [Driver](docs/m5hat-mini-joyc.md) / [M5Stack](https://docs.m5stack.com/en/hat/MiniJoyC) | Joystick (X/Y), Button, RGB LED, Battery |


## Setup

Build and install the shared mod host from the `examples` directory. Use the target that matches the product category:

```sh
cd examples

# Unit products
mcconfig -d -m -p esp32/m5stack_cores3 -t deploy

# HAT products
mcconfig -d -m -p esp32/m5stick_cplus -t deploy
```

Then build and run an example as a mod. Unit products use the CoreS3 target, while HAT products use the M5StickC Plus target:

```sh
cd fader
mcrun -dl -m -p esp32/m5stack_cores3

cd ../m5hat-mini-joyc
mcrun -dl -m -p esp32/m5stick_cplus
```

## Minimal Usage

```js
import MiniJoyC from "miniJoyC";

const joystick = new MiniJoyC({ pollingInterval: 30, deadband: 2, readMode: "pos8" });

joystick.onChange = ({ x, y, pressed }) => {
	trace(`x=${x}\ty=${y}\tpressed=${pressed}\n`);
};

joystick.onButtonChange = (pressed) => {
	joystick.setLed(0, pressed ? 128 : 0, pressed ? 255 : 0);
};
```

## Event Model

All joystick drivers expose the same state and callback model. `read()` always returns the current `{ x, y, pressed }` state. Assigning `onChange` or `onButtonChange` starts polling automatically. Polling stops when both callbacks are cleared, and can also be controlled explicitly with `start()` and `stop()`.

- `onChange(state)` runs for the first sample, when either axis moves by more than `deadband`, or when the button state changes.
- `onButtonChange(pressed)` runs on pressed and released transitions after the initial sample.
- `deadband` is measured in each device's native axis units and defaults to `0`.

Polling errors are reported through the Moddable debug channel without stopping the timer.

Angle and Fader use the same event lifecycle. Their normalized samples are supplied by a shared analog-input layer,
while all input drivers use the same polling layer. See [Driver architecture](docs/architecture.md) for the boundaries and
extension points.

## API

### MiniJoyC

See [Mini JoyC HAT](docs/m5hat-mini-joyc.md) for the complete API reference.

`new MiniJoyC(options)` accepts `address`, `data`, `clock`, `hz`, `pollingInterval`, `deadband`, `readMode`, `onChange`, and `onButtonChange`. The M5StickC Plus HAT pins, I2C address `0x54`, 200 kHz bus speed, 30 ms polling, zero deadband, and `pos8` mode are used by default.

- `read()` reads and returns `{ x, y, pressed }` using the selected position mode.
- `readXY(mode?)` reads both axes using `adc`, `pos8`, or `pos10` mode.
- `readADC()`, `readPosition8Bit()`, and `readPosition10Bit()` read a specific representation. Position readings are returned as signed values.
- `isButtonPressed()` returns the current button state.
- `setLed(r, g, b)` sets the RGB LED; each component is an integer from 0 to 255.
- `readCalibration(index)` and `writeCalibration(index, value)` access one calibration value. Use `MiniJoyC.CALIBRATION` for the six indexes.
- `readCalibrationValues()` and `writeCalibrationValues(values)` access all X/Y minimum, maximum, and center calibration values.
- `getFirmwareVersion()` reads the controller firmware version.
- `getI2CAddress()` and `setI2CAddress(address)` read or change the device address.
- `start()`, `stop()`, and `close()` control the polling timer and I2C resource lifetime.

The built-in 200 mAh battery powers the HAT but has no battery-status register in the published Mini JoyC I2C protocol, so the driver does not expose battery telemetry.

## Examples

- [Unit Angle](examples/angle) — reports the raw ADC value and normalized knob position.
- [Unit Fader](examples/fader) — reads the slider and displays its position on the 14 RGB LEDs.
- [Unit Joystick v1.1](examples/joyStick) — reports joystick and button changes over I2C.
- [Unit JoyStick2](examples/joyStick2) — reports joystick and button changes and controls its RGB LED.
- [M5Stack Mini JoyC HAT](examples/m5hat-mini-joyc) — reports joystick and button changes and toggles its RGB LED.

## Development

Format and lint:

```sh
npm run format
npm run lint
```

## License

MIT
