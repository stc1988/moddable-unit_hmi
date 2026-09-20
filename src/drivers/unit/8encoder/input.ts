import PollingInput, { type PollingInputOptions } from "hmi/polling";
import { callbackOrNull } from "hmi/util";
import type {
	Encoder8ButtonChangedCallback,
	Encoder8ChangedCallback,
	Encoder8EncoderChangedCallback,
	Encoder8Options,
	Encoder8State,
	Encoder8SwitchChangedCallback,
} from "unit/8encoder";

const ENCODER_COUNT = 8;
const BUTTON_COUNT = 8;

function encoderValue(state: Encoder8State, encoder: number): number {
	const value = state.encoders[encoder];
	if (value === undefined) throw new RangeError(`encoders must contain ${ENCODER_COUNT} values`);
	return value;
}

export default class Encoder8Input {
	#target: object;
	#polling: PollingInput<Encoder8State>;
	#onChanged: Encoder8ChangedCallback | null;
	#onEncoderChanged: Encoder8EncoderChangedCallback | null;
	#onButtonChanged: Encoder8ButtonChangedCallback | null;
	#onSwitchChanged: Encoder8SwitchChangedCallback | null;
	#lastState: Encoder8State | undefined;
	#closed = false;

	constructor(target: object, source: { read(): Encoder8State }, options: Encoder8Options) {
		this.#target = target;
		this.#onChanged = callbackOrNull(options.onChanged, "onChanged");
		this.#onEncoderChanged = callbackOrNull(options.onEncoderChanged, "onEncoderChanged");
		this.#onButtonChanged = callbackOrNull(options.onButtonChanged, "onButtonChanged");
		this.#onSwitchChanged = callbackOrNull(options.onSwitchChanged, "onSwitchChanged");
		const pollingOptions: PollingInputOptions<Encoder8State> = {
			changed: Encoder8Input.#stateChanged,
		};
		if (options.pollingInterval !== undefined) pollingOptions.pollingInterval = options.pollingInterval;
		this.#polling = new PollingInput(this, source, "8Encoder", pollingOptions);
		this.#updatePollingState();
	}

	close(): void {
		if (this.#closed) return;
		this.#polling.close();
		this.#closed = true;
		this.#onChanged = null;
		this.#onEncoderChanged = null;
		this.#onButtonChanged = null;
		this.#onSwitchChanged = null;
		this.#lastState = undefined;
	}

	start(): void {
		const wasRunning = this.#polling.running;
		this.#polling.start();
		if (!wasRunning) this.#lastState = undefined;
	}

	stop(): void {
		this.#polling.stop();
	}

	set pollingInterval(value: number) {
		this.#polling.pollingInterval = value;
	}

	get pollingInterval(): number {
		return this.#polling.pollingInterval;
	}

	set onChanged(callback: Encoder8ChangedCallback | null | undefined) {
		const next = callbackOrNull(callback, "onChanged");
		if (this.#closed && next) throw new Error("8encoder input is closed");
		if (next !== this.#onChanged) this.#polling.onChanged = null;
		this.#onChanged = next;
		this.#updatePollingState();
	}

	get onChanged(): Encoder8ChangedCallback | null {
		return this.#onChanged;
	}

	set onEncoderChanged(callback: Encoder8EncoderChangedCallback | null | undefined) {
		const next = callbackOrNull(callback, "onEncoderChanged");
		if (this.#closed && next) throw new Error("8encoder input is closed");
		this.#onEncoderChanged = next;
		this.#updatePollingState();
	}

	get onEncoderChanged(): Encoder8EncoderChangedCallback | null {
		return this.#onEncoderChanged;
	}

	set onButtonChanged(callback: Encoder8ButtonChangedCallback | null | undefined) {
		const next = callbackOrNull(callback, "onButtonChanged");
		if (this.#closed && next) throw new Error("8encoder input is closed");
		this.#onButtonChanged = next;
		this.#updatePollingState();
	}

	get onButtonChanged(): Encoder8ButtonChangedCallback | null {
		return this.#onButtonChanged;
	}

	set onSwitchChanged(callback: Encoder8SwitchChangedCallback | null | undefined) {
		const next = callbackOrNull(callback, "onSwitchChanged");
		if (this.#closed && next) throw new Error("8encoder input is closed");
		this.#onSwitchChanged = next;
		this.#updatePollingState();
	}

	get onSwitchChanged(): Encoder8SwitchChangedCallback | null {
		return this.#onSwitchChanged;
	}

	#updatePollingState(): void {
		const callback =
			this.#onChanged || this.#onEncoderChanged || this.#onButtonChanged || this.#onSwitchChanged
				? this.#handleChange
				: null;
		if (callback && !this.#polling.onChanged) this.#lastState = undefined;
		this.#polling.onChanged = callback;
	}

	#handleChange(state: Encoder8State): void {
		const previous = this.#lastState;
		this.#onChanged?.call(this.#target, state);
		if (previous) {
			if (this.#onEncoderChanged) {
				for (let encoder = 0; encoder < ENCODER_COUNT; encoder++) {
					const value = encoderValue(state, encoder);
					if (value !== encoderValue(previous, encoder)) this.#onEncoderChanged.call(this.#target, encoder, value);
				}
			}

			const changedButtons = state.buttons ^ previous.buttons;
			if (changedButtons && this.#onButtonChanged) {
				for (let button = 0; button < BUTTON_COUNT; button++) {
					const bit = 1 << button;
					if (changedButtons & bit) this.#onButtonChanged.call(this.#target, button, Boolean(state.buttons & bit));
				}
			}

			if (state.switchOn !== previous.switchOn) this.#onSwitchChanged?.call(this.#target, state.switchOn);
		}
		this.#lastState = state;
	}

	static #stateChanged(state: Encoder8State, previous: Encoder8State): boolean {
		if (state.buttons !== previous.buttons || state.switchOn !== previous.switchOn) return true;
		for (let encoder = 0; encoder < ENCODER_COUNT; encoder++) {
			if (encoderValue(state, encoder) !== encoderValue(previous, encoder)) return true;
		}
		return false;
	}
}
