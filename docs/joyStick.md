# Unit Joystick v1.1

The TypeScript driver in `src/drivers/joyStick` supports the M5Stack Unit Joystick v1.1 (U024-C). It reads the X/Y axes and push button over I2C at the device's fixed address, `0x52`.

The defaults use Port A on the selected Moddable device. Pass `data` and `clock` to the constructor when using another I2C
port. `io` can inject a compatible I2C constructor for another provider or for testing.

## API

- `read()` performs one three-byte I2C transaction and returns `{ x, y, pressed }`. Axis values range from `0` through `255`; `pressed` is `true` while the stick is pushed.
- `readXY()` returns `{ x, y }` from a new device reading.
- `isButtonPressed()` returns the button state from a new device reading.
- `onChange` receives `{ x, y, pressed }` for the first sample, when either axis moves by more than `deadband`, or when the button state changes.
- `onButtonChange` receives `true` or `false` when the button state changes after the initial sample.
- Assigning either callback starts polling. Clearing both callbacks stops it.
- `pollingInterval` controls the polling period in milliseconds and defaults to `30`.
- `deadband` controls axis change suppression in native axis units and defaults to `0`.
- `start()`, `stop()`, and `close()` control polling and the I2C resource explicitly.

```ts
import JoyStick from "joyStick";

const joystick = new JoyStick({ deadband: 2 });

joystick.onChange = ({ x, y, pressed }) => {
	trace(`x=${x}, y=${y}, pressed=${pressed}\n`);
};

joystick.onButtonChange = (pressed) => {
	trace(`pressed=${pressed}\n`);
};
```
