# Common LED interface

Mini JoyC, JoyStick2, and Scroll expose `driver.led`. Encoder, 8Encoder, 8Angle,
ByteButton, ByteSwitch, and Fader expose a fixed, iterable `driver.leds` collection in existing
zero-based LED order. Fader indices can be obtained with `Fader.ledIndex(column, level)`.

## All LEDs at once

```ts
encoder.leds.color = { r: 255, g: 0, b: 0 };
encoder.leds.brightness = 128;
encoder.leds.on = 0;
encoder.leds.rainbow({ step: 3 });
encoder.leds.rainbow(0);
```

Collection assignments update every member's logical state as well as hardware.
`leds[index]`, `leds.length`, and `for...of` remain available; the collection is not
an Array and does not expose mutating array methods. Individual LED changes are
reflected in collection getters: `color`, `brightness`, and `on` return the shared
value when all members agree, or `undefined` when that property differs.
Reading `color` returns a copy.

Group color changes retain each member's brightness; group brightness changes
retain each member's color. Group animations start in phase and keep the same
manual-write/stop behavior as individual animations. `leds.close()` closes all
members without closing the product's input or shared hardware.

Fader flushes once per group assignment. I2C products currently write each LED
individually; group assignment is not an atomic hardware transaction. Invalid colors,
brightness, and closed members are checked before writes start. A hardware error can
leave an earlier portion updated; retry the assignment after resolving the error.

Each LED follows the Moddable LED peripheral's property and animation model:

```ts
joystick.led.color = { r: 255, g: 0, b: 0 };
joystick.led.brightness = 128;
joystick.led.rainbow({ step: 3 });
joystick.led.rainbow(0); // stop and turn off
```

- `color`: requested RGB color; getter returns a copy. Components are integers 0–255.
- `on`: setting 0–1 sets black through white, replacing the previous color. Values
  are clamped and converted to the nearest RGB byte. Reading returns integer luma
  `(3*r + 4*g + b) >> 3`, divided by 255, independently of brightness.
- `brightness`: integer 0–255, initially 255. Changes output without losing the
  requested color. Software scaling is used unless the product has per-LED brightness.
  8Angle converts to 0–100 with rounding; Byte panels use their 0–255 registers.
  Fader's existing global `brightness` additionally scales every pixel.
- `rainbow(options?)`: repeats the SDK's eight color phases every 33 ms. `step`
  defaults to 3 and must be an integer 1–255. Restarting resets the sequence.
  Setting `color` or `on` does not stop the animation; call `rainbow(0)` first.
- `close()`: idempotently stops this LED's animation and rejects later writes. It
  leaves the displayed color and shared bus intact. Use `on = 0` before closing
  when explicit blackout is required. Product `close()` closes all its LEDs.

All animations share one timer. Fader flushes animated pixels once per timer tick.
An animation write failure stops that LED and is reported through `trace`.

Construction does not write to hardware. Logical color starts at black; the first
property assignment applies it. Getters describe requested state, not a hardware read.
This differs from the SDK NeoPixel wrapper, which clears its owned strip on construction.

## Device modes and existing operations

ByteButton/ByteSwitch require explicit `setLedMode(Class.LED_MODE.MANUAL)` for
manual colors and animations. The library does not change the device-wide mode
implicitly. State-dependent colors remain available through `setButtonLed` and
`setSwitchLed` in automatic mode.

Existing `setLed`, `getLed`, brightness register access, compact colors, bulk writes,
and Fader coordinate/buffer methods remain direct hardware operations. They do not
update the logical LED object's cached color or brightness. Prefer one API for a
particular LED; a later logical assignment overwrites direct hardware changes.
Hardware getters continue to report device values, including brightness scaling.

Fader's `setLevel`, `fillColumn`, `fill`, `setPixel`, and `show` remain useful for
batched position displays. Individual `leds[index].color` assignments update immediately.

## Validation

Run `node tests/led.mjs` for host-side state and timer regression tests. These use
a fake timer and output sink; real I2C/NeoPixel behavior requires device verification.
