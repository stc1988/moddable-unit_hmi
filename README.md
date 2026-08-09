# moddable-unit_hmi

## Supported Drivers

| Product | Category | Interface | Documentation | Features |
| --- | --- | --- | --- | --- |
| M5Stack Unit Angle | Unit | Analog | [Driver](docs/unit/angle.md) / [M5Stack](https://docs.m5stack.com/ja/unit/angle) | 10 kΩ rotary potentiometer |
| M5Stack Unit Fader | Unit | Analog / RGB data | [Driver](docs/unit/fader.md) / [M5Stack](https://docs.m5stack.com/ja/unit/fader) | 35 mm slider, 14x SK6812 RGB LED |
| M5Stack Unit Joystick v1.1 | Unit | I2C | [Driver](docs/unit/joystick.md) / [M5Stack](https://docs.m5stack.com/ja/unit/joystick_1.1) | Joystick (X/Y), Button |
| M5Stack Unit JoyStick2 | Unit | I2C / SMBus | [Driver](docs/unit/joystick2.md) / [M5Stack](https://docs.m5stack.com/ja/unit/Unit-JoyStick2) | Hall-effect joystick (X/Y), Button, RGB LED |
| M5Stack Mini JoyC HAT | HAT | I2C / SMBus | [Driver](docs/hat/mini-joyc.md) / [M5Stack](https://docs.m5stack.com/en/hat/MiniJoyC) | Joystick (X/Y), Button, RGB LED, Battery |


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
cd unit/fader
mcrun -dl -m -p esp32/m5stack_cores3

cd ../../hat/mini-joyc
mcrun -dl -m -p esp32/m5stick_cplus
```

## Examples

- [Unit Angle](examples/unit/angle) — reports the raw ADC value and normalized knob position.
- [Unit Fader](examples/unit/fader) — reads the slider and displays its position on the 14 RGB LEDs.
- [Unit Joystick v1.1](examples/unit/joystick) — reports joystick and button changes over I2C.
- [Unit JoyStick2](examples/unit/joystick2) — reports joystick and button changes and controls its RGB LED.
- [M5Stack Mini JoyC HAT](examples/hat/mini-joyc) — reports joystick and button changes and toggles its RGB LED.

## Development

Format and lint:

```sh
npm run format
npm run lint
```

## License

MIT
