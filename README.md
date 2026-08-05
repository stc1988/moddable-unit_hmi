# moddable-unit_hmi

## Supported Drivers

| Product | Category | Interface | Documentation | Features |
| --- | --- | --- | --- | --- |
| M5Stack Unit Angle | Unit | Analog | [M5Stack documentation](https://docs.m5stack.com/ja/unit/angle) | 10 kΩ rotary potentiometer |
| M5Stack Unit Fader | Unit | Analog / RGB data | [M5Stack documentation](https://docs.m5stack.com/ja/unit/fader) | 35 mm slider, 14x SK6812 RGB LED |
| M5Stack Unit Joystick v1.1 | Unit | I2C | [M5Stack documentation](https://docs.m5stack.com/ja/unit/joystick_1.1) | Joystick (X/Y), Button |
| M5Stack Unit JoyStick2 | Unit | I2C / SMBus | [M5Stack documentation](https://docs.m5stack.com/ja/unit/Unit-JoyStick2) | Hall-effect joystick (X/Y), Button, RGB LED |
| M5Stack Mini JoyC HAT | HAT | I2C / SMBus | [M5Stack documentation](https://docs.m5stack.com/en/hat/MiniJoyC) | Joystick (X/Y), Button, RGB LED, Battery |


## Setup

Build and install the shared mod host from the `examples` directory. Unit products use the CoreS3 target:

```sh
cd examples
mcconfig -d -m -p esp32/m5stack_cores3 -t deploy
```

Then build and run an example as a mod:

```sh
cd fader
mcrun -dl -m -p esp32/m5stack_cores3
```

## Minimal Usage

```js

```

## Event Model

## API


## Examples

- [Unit Angle](examples/angle) — reports the raw ADC value and normalized knob position.
- [Unit Fader](examples/fader) — reads the slider and displays its position on the 14 RGB LEDs.
- [Unit Joystick v1.1](examples/unitJoystick) — reports joystick and button changes over I2C.
- [Unit JoyStick2](examples/joyStick2) — reports joystick and button changes and controls its RGB LED.

## Development

Format and lint:

```sh
npm run format
npm run lint
```

## License

MIT
