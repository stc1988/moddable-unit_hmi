# JoyStick2

The driver is implemented in TypeScript under `src/drivers/joyStick2` and exports `JoyStick2Options`, `JoyStick2Position`, `JoyStick2State`, `JoyStick2ChangeCallback`, and `JoyStick2ButtonChangeCallback` for typed applications.

The `examples/joyStick2` application is also written in TypeScript and demonstrates typed polling, button events, and LED updates.

- `read()` returns the current `{ x, y, pressed }` state. It performs separate coordinate and button register reads.
- `readXY()` reads the calibrated signed 8-bit coordinates from registers `0x60` and `0x61`. Both axes use the device's native directions and return values in the range documented by M5Stack (`-127` to `127`).
- `isButtonPressed()` returns the current active-low button state.
- `onChange` receives the complete state for the first sample, when either axis moves by more than `deadband`, or when the button state changes.
- `onButtonChange` receives the new button state on transitions after the initial sample.
- `pollingInterval` defaults to `30` milliseconds and `deadband` defaults to `0` native axis units.
- Assigning either callback starts polling. Clearing both callbacks stops it.

`JoyStick2#setLed(r, g, b)` accepts RGB component values even though the device stores them in BGR register order: blue at `0x30`, green at `0x31`, and red at `0x32`.

```ts
import JoyStick2 from "joyStick2";

const joystick = new JoyStick2({ deadband: 2 });

joystick.onChange = ({ x, y, pressed }) => {
	trace(`x=${x}, y=${y}, pressed=${pressed}\n`);
};

joystick.onButtonChange = (pressed) => {
	joystick.setLed(pressed ? 255 : 0, 0, pressed ? 0 : 255);
};
```
