# JoyStick2

The driver is implemented in TypeScript under `src/drivers/joyStick2` and exports `JoyStick2Options`, `JoyStick2Position`, `JoyStick2PollCallback`, and `JoyStick2PushCallback` for typed applications.

The `examples/joyStick2` application is also written in TypeScript and demonstrates typed polling, button events, and LED updates.

`JoyStick2#readXY()` reads the calibrated signed 8-bit coordinates from registers `0x60` and `0x61`. Both `x` and `y` use the device's native axis directions and return values in the range documented by M5Stack (`-127` to `127`).

`JoyStick2#setLed(r, g, b)` accepts RGB component values even though the device stores them in BGR register order: blue at `0x30`, green at `0x31`, and red at `0x32`.
