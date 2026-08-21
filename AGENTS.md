# moddable-M5Hat-Mini-JoyC (Developer/AI Guide)

This document is a developer- and AI-oriented overview of the repository. It summarizes current structure and runtime behavior based on the implementation in this repo.

## Overview

## Key Features


## Repository Structure

### Device Protocol PDFs

## Architecture Summary

Input behavior is shared by responsibility rather than by product family or hardware bus. `PollingInput<State>` owns the
timer and callback lifecycle for every input driver. `JoystickInput` adds joystick-specific state comparison and button
semantics. `AnalogInput` supplies normalized samples to Angle and Fader. Register maps, calibration, LED protocols, and
other device-specific behavior remain in each product driver. See `docs/architecture.md` for the layer boundaries and I/O
injection points.

### Event Model

All joystick drivers must expose the same state and callback model. `read()` returns the current `{ x, y, pressed }` state.
Polling controls and callbacks live on the driver's public `input` object. Assigning `input.onChange` or
`input.onButtonChange` starts polling automatically. Polling stops when both callbacks are cleared, and can also be
controlled explicitly with `input.start()` and `input.stop()`.

- `input.onChange(state)` runs for the first sample, when either axis moves by more than `input.deadband`, or when the
  button state changes.
- `input.onButtonChange(pressed)` runs on pressed and released transitions after the initial sample.
- `input.deadband` is measured in each device's native axis units and defaults to `0`.

Polling errors are reported through the Moddable debug channel without stopping the timer. Angle and Fader use the same
callback lifecycle; their change comparison operates on the raw analog value supplied by `AnalogInput`.

## Sequences

## Hardware Verification

このリポジトリのdriverは追加のNativeコードに依存せず実装できるため、動作確認には対応する`examples`をmodとして使用します。

最初に、対象デバイスへHostをビルドして書き込みます。

```sh
mcconfig -d -m -p <device> -t deploy
```

次に、対応するexampleのディレクトリからmodをビルドして実行します。`-dl`を指定すると、GDBライクなCLIデバッガー`xsdb`で動作を確認できます。

```sh
mcrun -dl -m -p <device>
```

`<device>`には製品形状に応じて次のプラットフォームを指定します。

| Product category | `<device>` |
| --- | --- |
| Unit | `esp32/m5stack_cores3` |
| HAT | `esp32/m5stick_cplus` |

動作しない場合は、必要に応じて一時的なログを追加し、初期化、バス通信、レジスタ読み書き、イベント通知などのどこまで動作しているかを段階的に切り分けてください。

## Implementation Requests

When asking for changes, the following expectations apply:

- Refactors are welcome.
- Please commit and report in clean, sensible units.
- Breaking API changes are acceptable.
- If code changes, update documentation accordingly.
- For implementation changes, run `npm run format` and `npm run lint`, then address reported lint findings.
- Run `npx biome check .`, fix any reported issues, and rerun it to verify the changes.
