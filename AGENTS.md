# moddable-unit_hmi (Developer/AI Guide)

This document is a developer- and AI-oriented overview of the repository. It summarizes current structure and runtime behavior based on the implementation in this repo.

## Overview

This repository provides TypeScript drivers and examples for M5Stack Unit and HAT human-interface devices. Drivers use
Moddable's ECMA-419 I/O implementations by default and accept injected I/O constructors for testing and alternate boards.

## Key Features

- Consistent polling, callback, and lifecycle behavior across joystick, encoder, switch, button, and analog inputs.
- Shared logical LED API for single LEDs and synchronized LED collections.
- Constructor-injected analog and SMBus I/O with product-specific protocols kept in each driver.
- Mod examples for CoreS3 Unit products and M5StickC Plus HAT products.

## Repository Structure

- `src/hmi`: shared polling, input, LED, SMBus, and utility layers.
- `src/drivers`: product drivers grouped by Unit and HAT form factor.
- `examples`: the shared mod host and one hardware example per product.
- `docs`: public driver API and architecture documentation.
- `tests`: headless regression tests for hardware-independent behavior.

## Architecture Summary

Input behavior is shared by responsibility rather than by product family or hardware bus. `PollingInput<State>` owns the
timer and callback lifecycle for every input driver. `JoystickInput` adds joystick-specific state comparison and button
semantics. `AnalogInput` supplies normalized samples to Angle and Fader. Register maps, calibration, LED protocols, and
other device-specific behavior remain in each product driver. See `docs/architecture.md` for the layer boundaries and I/O
injection points.

### Event Model

All joystick drivers must expose the same state and callback model. `read()` returns the current `{ x, y, pressed }` state.
Polling controls and callbacks live directly on the product driver. Assigning `onChanged` or `onButtonChanged` starts
polling automatically. Polling stops when both callbacks are cleared, and can also be controlled explicitly with
`start()` and `stop()`.

- `onChanged(state)` runs for the first sample, when either axis moves by more than `deadband`, or when the
  button state changes.
- `onButtonChanged(pressed)` runs on pressed and released transitions after the initial sample.
- `deadband` is measured in each device's native axis units and defaults to `0`.

Polling errors are reported through the Moddable debug channel without stopping the timer. Angle and Fader use the same
callback lifecycle; their change comparison operates on the raw analog value supplied by `AnalogInput`.

## Sequences

Construction opens the hardware resource and creates the product's input controller. Assigning the first callback starts
the shared polling timer. Each successful notification becomes the comparison baseline; a read or callback failure is
logged and retried without advancing that baseline. Clearing the last callback stops the timer. `close()` stops polling,
closes logical LEDs, and finally releases the hardware resource; repeated closes are safe.

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

## Commits and Pull Requests

- Keep each commit focused on one coherent change. Run the relevant validation before committing, and report the commit
  hash together with the checks that passed and any hardware or behavior that was not verified.
- Do not include a package version bump in an ordinary feature or fix commit. Release version changes are created by
  the release workflow described below.
- Pull requests should summarize user-visible behavior, list validation performed, and call out breaking changes or
  unverified hardware behavior explicitly.
- Give each pull request one primary release-note label. Prefer `breaking-change`, `driver`, `enhancement`, `bug`,
  `documentation`, `dependencies`, or `maintenance`; `.github/release.yml` defines the accepted aliases and category
  order. Use `no-release-notes` or `skip-changelog` only when the merged change should be omitted from the generated
  release notes. Unlabeled pull requests appear under `Other Changes`.

## Releases

- Create releases only from the default branch after the intended changes are merged and their required validation has
  passed. The repository Actions settings must allow `GITHUB_TOKEN` write access, and branch protection must allow the
  release workflow to push its version commit and tag.
- Use the `Create GitHub Release` workflow in `.github/workflows/release.yml` through the Actions UI or a
  `workflow_dispatch` API client. With GitHub CLI, run `gh workflow run release.yml --ref main -f version=1.2.3`.
  Supply an explicit npm-compatible version without the `v` prefix; the workflow creates the `v<version>` tag.
- Do not manually edit `package.json` or `package-lock.json`, create the release commit or tag, or publish the GitHub
  Release unless recovery from a failed workflow has been explicitly authorized. The workflow performs these steps,
  verifies both version files, confirms the tagged commit contains the requested package version, and atomically pushes
  the default branch and annotated tag before publishing the release.
- The workflow uses GitHub's generated Release Notes with `.github/release.yml`. After dispatch, wait for the workflow
  to complete and verify that the release tag, the `package.json` version at that tag, and the published release version
  all match before reporting success.
- The current workflow publishes a normal release. Do not use it for a prerelease or draft release without first
  updating the workflow to represent that release type explicitly.
