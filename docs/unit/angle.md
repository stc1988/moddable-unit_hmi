# Angle

The TypeScript driver in `src/drivers/unit/angle` supports the M5Stack Unit Angle (U005), a 10 kΩ rotary
potentiometer with a 0–2500 mV analog output.

The default targets the analog input on Port B of M5Stack CoreS3:

| Signal | CoreS3 GPIO |
| --- | --- |
| Analog output (white wire) | 8 |

Pass `sensor: { pin }` to the constructor when using another controller. The yellow wire is not connected by Unit Angle.
`sensor.io` can inject another analog I/O constructor; Moddable's `embedded:io/analog` implementation is the default.

## API

- `read()` returns the raw ADC value.
- `readSample()` returns `{ raw, position }`, where `position` normalizes the ADC value from `0` to `1`.
- `input.onChange` receives the same sample when the raw value changes by more than `input.deadband`. Assigning a callback starts
  polling; assigning `null` stops it.
- `input.pollingInterval` controls the polling period in milliseconds and defaults to `30`.
- `input.start()`, `input.stop()`, and `close()` control polling and the analog input resource explicitly.

```ts
import Angle from "unit/angle";

const angle = new Angle({ deadband: 4 });

angle.input.onChange = ({ raw, position }) => {
	trace(`raw=${raw}, position=${position}\n`);
};
```

For a different pin:

```ts
const angle = new Angle({ sensor: { pin: 36 } });
```
