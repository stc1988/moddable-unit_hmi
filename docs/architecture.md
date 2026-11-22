# Driver architecture

Every product implements the ECMA-419 Base, Peripheral, and polled Sensor patterns described in the installed SDK's
`guides/implement419`. Product-specific registers, sample fields, LED protocols, calibration, and maintenance operations
extend that common surface. These extensions are not standardized ECMA-419 sensor classifications.

## Common core

`hmi/peripheral` owns the lifecycle shared by all products. Construction requires an options object, accepts immutable
options, and copies `target` only when present. Resource registration and lifecycle assertions are module functions;
internal state is held in module-private weak maps, never on the instance surface. Mutable registries and LED animation sets are allocated lazily at runtime so the preload image never contains collections
that must later be mutated. An active-instance set keeps opened
peripherals alive until explicitly closed. Successful `close()` releases resources in reverse registration order, closes
logical LEDs before their hardware, clears ownership, and is safe to repeat. It also attempts the remaining releases if
one release throws, then propagates the first error. `[Symbol.dispose]` aliases the same close method. All other driver
methods and configuration accessors reject use after close.

`hmi/smbus` extends this core with injected SMBus ownership. The optional `sensor` object overrides IO or wiring
individually. Missing IO uses `device.io.SMBus`; missing pins come from `device.i2c.default`, or `device.i2c.hat` for MiniJoyC.
Address and frequency retain their product defaults unless overridden. Other IO options are forwarded. A fully injected
connection does not access `device`, including MiniJoyC on a board with no HAT provider. Bus access and address helpers
remain internal module exports rather than instance methods.

`hmi/input/analog` defaults to `device.io.Analog` on GPIO 8 and allows partial `sensor` overrides. Fader additionally
defaults its LED output to SDK NeoPixel on GPIO 9, with partial `leds` overrides. These convenience defaults extend the
strict constructor-injection guide at the user's request; the common lifecycle and polled Sensor surface are unchanged.
An options object is still required, so use `new Encoder({})` to select defaults. The host must provide the omitted IO
and I2C wiring, or the caller must supply them. Board configuration is resolved only during construction, never preload.

Product constructors probe their hardware and initialize exposed runtime settings. A failure releases all resources
opened so far. Encoder/Scroll counters reset on construction; RGB LEDs start black. ByteButton/ByteSwitch also restore
manual LED mode, brightness 255, black input-off colors, and white input-on colors without saving to flash. MiniJoyC
preserves persistent calibration as provisioning data. A successful analog read verifies the IO path, but cannot prove
that the expected passive potentiometer is physically connected.

## Samples and configuration

`sample()` performs a fresh synchronous read and returns a new object, including host capture `time` in milliseconds
since the Unix epoch. Composite register reads are sequential rather than hardware-atomic. These devices expose current
values without a sample-ready flag; no cached old sample is returned. Future drivers with a ready flag must return
`undefined` when no new sample is available.

`configure(options)` modifies only recognized properties present at the root of its options object; missing values keep
their current setting and unknown options are ignored. Invalid recognized values throw. The options object is never
modified or retained. `configuration` returns a new report. Current extensions are Encoder `mode`, MiniJoyC `readMode`,
Fader `brightness`, and ByteButton/ByteSwitch `ledMode`. Existing setting accessors/methods delegate to this path.

These products have no implemented hardware sample-ready interrupt, so `configuration.interrupt` is always false.
`onSample` is accepted but not stored or invoked. There are no synthetic sample notifications or polling timers in the
drivers. All failures occur synchronously and throw; there is no asynchronous failure source requiring `onError`.
If notification-capable hardware is added later, callbacks must be copied privately from constructor options, invoked
asynchronously with `this` set to the product, and canceled by close.

## Product extensions

`read()`, per-channel reads, encoder writes/resets, firmware queries, calibration, and RGB methods are explicit product
extensions. ByteButton and ByteSwitch share the BytePanel register protocol; their input-polarity and LED-map helpers are
module functions, not publicly callable instance internals. Register layouts stay in product implementations.

`setI2CAddress` programs the peripheral's address register without changing the current host IO connection. The caller
must close the instance and open another with the new `sensor.address` before further access. Hardware communication
settings are fixed at construction and cannot be changed through configure.

`hmi/led` is a logical LED convenience extension, not an ECMA-419 sensor or IO implementation. It supports synchronized
collections, colors, brightness, and a shared animation timer. Products own and close these objects before the underlying
hardware. Fader batches pixel updates through one flush per output. See [LED API](led.md).

## Migration from the polling API

This is a breaking API change:

- Pass an options object: `new Encoder({})` uses the standard IO and product wiring. Partial `sensor` overrides remain supported.
- Analog products accept optional `sensor: { io?, pin? }`; Fader also accepts optional `leds: { io?, pin? }`.
- Use `sample()` for common input access. Product `read()` methods remain available with their existing data shape.
- Replace driver callbacks, `start`, `stop`, `pollingInterval`, and `deadband` with an application-owned polling loop and
  change comparison. Internal polling/input-controller modules and their callback types have been removed.
- Move MiniJoyC `readMode` and Fader `brightness` constructor settings to `configure()` after construction.
- Clear application-owned timers before closing the driver. Close cancels product-owned LED animation timers only.
- Address changes require close/reopen. Fader color components and hardware brightness now require integers in 0–255.

Each hardware example uses default wiring and places its change-detecting loop in the application. For analog deadband, compare
`Math.abs(sample.raw - previous.raw)`; for joystick deadband, compare each axis and the button. Keep the last delivered
sample as the baseline so small movements accumulate. Ignore `time` when comparing input values.

## Validation

`npm run check` covers formatting/lint, TypeScript, all-driver mock conformance, failure cleanup, native sample encodings,
and logical LEDs. `tests/sdk` is a separate smoke app that compiles the real driver manifests, preloads the classes,
constructs all eleven products with mock IO, samples them, starts/stops LED animations, and disposes them under XS:

```sh
mkdir -p /tmp/unit-hmi-sdk-check
mcconfig -dl -m -p sim -o /tmp/unit-hmi-sdk-check tests/sdk/manifest.json
```

Look for `ECMA-419 smoke test: 11 drivers PASS`, then enter `quit` in xsdb. This verifies XS/preload behavior but does not
verify electrical protocols or the real products. Build each hardware example with `mcrun -d -m -p <device> -t build`
before deploying the corresponding host/mod for hardware verification.

## Optional IO overrides

```ts
// Normal use: product defaults.
const joystick = new JoyStick({});

// Different pins, standard SMBus implementation.
const otherPort = new JoyStick({ sensor: { data: 32, clock: 33 } });

// Test or alternate IO: explicit connection, no board-provider dependency.
const testJoystick = new JoyStick({ sensor: { io: MockSMBus, data: 1, clock: 2 } });
```

Close one instance before reusing the same address/pins for another. `MockSMBus` above is an application-supplied constructor.
