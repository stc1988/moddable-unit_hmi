# moddable-unit_hmi (Developer/AI Guide)

This document is a developer- and AI-oriented overview of the repository. It summarizes current structure and runtime behavior based on the implementation in this repo.

## Overview

This repository provides TypeScript drivers and examples for M5Stack Unit and HAT human-interface devices. The common
core follows Moddable's `guides/implement419` Base, Peripheral, and polled Sensor patterns. Device-specific protocols,
sample fields, LEDs, calibration, and maintenance operations extend that core.

## Repository Structure

- `src/hmi/peripheral`: shared lifecycle, target, configuration, resource ownership, and disposal.
- `src/hmi/smbus`: injected bus ownership and internal connection helpers.
- `src/hmi/input/analog`: internal analog normalization adapter.
- `src/hmi/led` and `src/hmi/util`: logical LED extensions and utilities.
- `src/drivers`: product protocols grouped by Unit and HAT form factor.
- `examples`: shared mod host and caller-owned polling examples with explicit board IO wiring.
- `docs`: public API, architecture, and breaking migration instructions.
- `tests`: hardware-independent regression tests with injected IO.

## Architecture and lifecycle

Every product requires an options object and injected IO. SMBus products take `sensor: { io, data, clock, ... }`;
Angle and Fader take analog `sensor: { io, pin }`, and Fader also takes `leds: { io, pin }`. Drivers never import concrete
IO constructors or resolve board pins from `device`; the application/provider supplies those choices.

`sample()` returns a fresh object with a host capture `time`. `configure()` changes only known properties present in its
options object, and `configuration` reports current settings and `interrupt: false`. Drivers do not synthesize sample
callbacks through polling. The application owns polling, deadband, and change detection. Product `read()` and register
operations remain explicit extensions. Consult `docs/architecture.md` for the standard/extension boundary.

Construction probes hardware and restores runtime defaults; any failure releases acquired resources. Close releases
logical LEDs before hardware, cancels LED animations, and is idempotent. `[Symbol.dispose]` aliases close. Other driver
operations throw after close. Internal state and shared helpers must not become public instance members; TypeScript
`protected` does not hide methods at runtime. Address programming requires close/reopen at the new address rather than
replacing a live connection. Persistent MiniJoyC calibration is preserved.

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

| Product category | `<device>`             |
| ---------------- | ---------------------- |
| Unit             | `esp32/m5stack_cores3` |
| HAT              | `esp32/m5stick_cplus`  |

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
