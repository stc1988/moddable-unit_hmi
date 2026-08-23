# moddable-unit_hmi

## Supported Drivers

| Product | Category | Interface | Documentation | Features |
| --- | --- | --- | --- | --- |
| M5Stack Unit 8Angle | Unit | I2C | [Driver](docs/unit/8angle.md) / [M5Stack](https://docs.m5stack.com/en/unit/8Angle) | • 8 potentiometers<br>• Toggle switch<br>• 9 RGB LEDs |
| M5Stack Unit 8Encoder | Unit | I2C | [Driver](docs/unit/8encoder.md) / [M5Stack](https://docs.m5stack.com/en/unit/8Encoder) | • 8 rotary encoders<br>• 8 push buttons<br>• Toggle switch<br>• 9 RGB LEDs |
| M5Stack Unit Angle | Unit | Analog | [Driver](docs/unit/angle.md) / [M5Stack](https://docs.m5stack.com/ja/unit/angle) | • 10 kΩ rotary potentiometer |
| M5Stack Unit ByteButton | Unit | I2C | [Driver](docs/unit/bytebutton.md) / [M5Stack](https://docs.m5stack.com/ja/unit/Unit%20ByteButton) | • 8 capacitive buttons<br>• 9 RGB LEDs |
| M5Stack Unit ByteSwitch | Unit | I2C | [Driver](docs/unit/byteswitch.md) / [M5Stack](https://docs.m5stack.com/en/unit/Unit%20ByteSwitch) | • 8 toggle switches<br>• 9 RGB LEDs |
| M5Stack Unit Encoder | Unit | I2C | [Driver](docs/unit/encoder.md) / [M5Stack](https://docs.m5stack.com/en/unit/encoder) | • Rotary encoder<br>• Push button<br>• 2 RGB LEDs |
| M5Stack Unit Fader | Unit | Analog / NeoPixel | [Driver](docs/unit/fader.md) / [M5Stack](https://docs.m5stack.com/ja/unit/fader) | • 35 mm slider<br>• 14x SK6812 RGB LEDs |
| M5Stack Unit Joystick v1.1 | Unit | I2C | [Driver](docs/unit/joystick.md) / [M5Stack](https://docs.m5stack.com/ja/unit/joystick_1.1) | • Joystick (X/Y)<br>• Button |
| M5Stack Unit JoyStick2 | Unit | I2C | [Driver](docs/unit/joystick2.md) / [M5Stack](https://docs.m5stack.com/ja/unit/Unit-JoyStick2) | • Hall-effect joystick (X/Y)<br>• Button<br>• RGB LED |
| M5Stack Unit Scroll | Unit | I2C | [Driver](docs/unit/scroll.md) / [M5Stack](https://docs.m5stack.com/ja/unit/UNIT-Scroll) | • Rotary encoder<br>• Button<br>• RGB LED |
| M5Stack HAT Mini JoyC | HAT | I2C | [Driver](docs/hat/mini-joyc.md) / [M5Stack](https://docs.m5stack.com/en/hat/MiniJoyC) | • Joystick (X/Y)<br>• Button<br>• RGB LED<br>• Battery |


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

- [Unit 8Angle](examples/unit/8angle) — reports eight potentiometers and the toggle switch with RGB feedback.
- [Unit 8Encoder](examples/unit/8encoder) — reports eight rotary encoders, push buttons, and the toggle switch with RGB feedback.
- [Unit Angle](examples/unit/angle) — reports the raw ADC value and normalized knob position.
- [Unit ByteButton](examples/unit/bytebutton) — reports eight-button changes and provides RGB feedback.
- [Unit ByteSwitch](examples/unit/byteswitch) — reports eight-switch changes and provides RGB feedback.
- [Unit Encoder](examples/unit/encoder) — reports encoder and push-button changes and controls both RGB LEDs.
- [Unit Fader](examples/unit/fader) — reads the slider and displays its position on the 14 RGB LEDs.
- [Unit Joystick v1.1](examples/unit/joystick) — reports joystick and button changes over I2C.
- [Unit JoyStick2](examples/unit/joystick2) — reports joystick and button changes and controls its RGB LED.
- [Unit Scroll](examples/unit/scroll) — reports encoder and button changes and controls its RGB LED.
- [M5Stack HAT Mini JoyC](examples/hat/mini-joyc) — reports joystick and button changes and toggles its RGB LED.

## Input events

Each driver exposes a readonly `input` object for change callbacks and polling controls. Assigning an input callback starts
polling automatically; clearing all callbacks stops it. Use `driver.input.start()` and `driver.input.stop()` for explicit
control. Device reads, LEDs, settings, and `close()` remain on the product driver.

## Development

Format and lint:

```sh
npm run format
npm run lint
```

## License

MIT
