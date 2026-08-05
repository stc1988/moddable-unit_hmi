# moddable-M5Hat-Mini-JoyC (Developer/AI Guide)

This document is a developer- and AI-oriented overview of the repository. It summarizes current structure and runtime behavior based on the implementation in this repo.

## Overview

## Key Features


## Repository Structure

### Device Protocol PDFs

## Architecture Summary


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
