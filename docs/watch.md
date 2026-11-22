# Watching input changes

`hmi/watch` is an optional application helper. It polls any driver exposing `sample()` and reports meaningful changes.
The drivers retain their ECMA-419 sensor API; applications can use this helper or write their own control loop.

## Basic usage

```ts
import watchInput from "hmi/watch";
import JoyStick from "unit/joystick";

const joystick = new JoyStick({});
const watcher = watchInput(joystick, {
	deadband: 2,
	onChanged({ x, y, pressed }) {
		trace(`x=${x}, y=${y}, pressed=${pressed}\n`);
	},
});

// When finished:
// watcher.close();
// joystick.close();
```

Include `src/hmi/watch` alongside the product's manifest in your application or mod. Paths in manifests are relative to
the manifest containing the include; see the hardware examples. Product manifests do not include the helper automatically.

The first notification occurs on the first successful timer tick. Construction does not call user callbacks. The default
interval is 30 milliseconds. `undefined` samples are skipped. Each watcher uses one timer, and callbacks run with `this`
set to the source driver. Constructor options and callback functions are copied rather than retaining the options object.

## Options

| Option                        | Default             | Meaning                                                                                                   |
| ----------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------- |
| `onChanged(sample, previous)` | required            | Receives the current sample and the last successfully notified sample; `previous` is undefined initially. |
| `interval`                    | `30`                | Polling period in milliseconds; a positive integer.                                                       |
| `deadband`                    | `0`                 | Required numeric difference from the last notification; a non-negative finite number.                     |
| `changed(sample, previous)`   | built-in comparison | Custom predicate returning true to notify; the first sample always notifies.                              |
| `onError(error)`              | debug trace         | Handles sample, comparison, or notification failures asynchronously on the timer tick.                    |
| `closeSource`                 | `false`             | Also closes the source when the watcher is closed. Requires a source `close()` method.                    |

The built-in comparator handles the samples returned by every product in this repository:

- Ignore capture metadata named `time` or `ticks`.
- Compare numeric values and array entries using a strict difference greater than `deadband`.
- Compare button/switch bit masks (`buttons`, `switches`), booleans, and other nonnumeric values exactly, regardless of
  deadband. Button transitions therefore still notify while the axes remain inside the deadband.
- For analog samples containing `raw`, ignore derived `position` when detecting changes, so deadband uses ADC units.

The baseline advances only after `onChanged` returns successfully. Small movements accumulate relative to the last
notification. Samples and the comparison baseline are copied as plain data so reused source buffers and mutations in a
callback cannot corrupt the private baseline. Samples must be acyclic plain objects/arrays containing data values.

Use `changed` when a different policy is needed. For example, to ignore button changes and report only joystick motion:

```ts
const watcher = watchInput(joystick, {
	changed: (current, previous) => Math.abs(current.x - previous.x) > 4 || Math.abs(current.y - previous.y) > 4,
	onChanged(sample) {
		trace(`x=${sample.x}, y=${sample.y}\n`);
	},
});
```

## Button transitions

No extra polling loop or stored previous state is needed:

```ts
watchInput(joystick, {
	deadband: 2,
	onChanged(sample, previous) {
		if (previous && sample.pressed !== previous.pressed) trace(sample.pressed ? "pressed\n" : "released\n");
	},
});
```

For ByteButton or 8Encoder, XOR `sample.buttons` and `previous.buttons` to find the changed button bits. Array entries in
8Angle and 8Encoder are available on the previous sample too. This helper does not claim hardware sample-ready support;
`driver.configuration.interrupt` remains false.

## Lifetime and errors

`stop()` cancels polling and `start()` resumes it. Restarting resets the baseline, so the next available sample notifies
with `previous === undefined`. Starting an already running watcher does nothing. `running` reports whether it is polling.

`close()` and its `[Symbol.dispose]` alias permanently stop watching, discard stored callbacks/samples, and are safe to
repeat. No further notifications or error callbacks run after close, including when close is called inside a callback.
Other watcher operations throw after close. By default the driver remains open for direct reads, LED operations, or
another watcher: close the watcher before closing that driver.

For a source dedicated to one watcher, enable shared cleanup explicitly:

```ts
const watcher = watchInput(new JoyStick({}), {
	closeSource: true,
	onChanged(sample) {
		trace(`${sample.x}, ${sample.y}\n`);
	},
});
// watcher.close() stops polling and closes the joystick, including its LED animations.
```

Invalid helper options throw before starting any timer and leave the caller's source open. After successful creation,
`closeSource: true` transfers cleanup responsibility to the watcher. It does not close the source when merely stopped.

Read or callback failures are sent to `onError`, or logged through the Moddable debug channel when no handler is supplied.
Polling continues and the last successful baseline is preserved. If `onError` itself throws, the exception propagates from
the timer callback; the watcher does not catch that application error.
