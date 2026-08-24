import PollingInput, { type PollingInputOptions } from "hmi/polling";
import { callbackOrNull } from "hmi/util";
import type {
	Encoder8ButtonChangeCallback,
	Encoder8ChangeCallback,
	Encoder8EncoderChangeCallback,
	Encoder8Options,
	Encoder8State,
	Encoder8SwitchChangeCallback,
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
	#onChange: Encoder8ChangeCallback | null;
	#onEncoderChange: Encoder8EncoderChangeCallback | null;
	#onButtonChange: Encoder8ButtonChangeCallback | null;
	#onSwitchChange: Encoder8SwitchChangeCallback | null;
	#lastState: Encoder8State | undefined;
	#closed = false;

	constructor(target: object, source: { read(): Encoder8State }, options: Encoder8Options) {
		this.#target = target;
		this.#onChange = callbackOrNull(options.onChange, "onChange");
		this.#onEncoderChange = callbackOrNull(options.onEncoderChange, "onEncoderChange");
		this.#onButtonChange = callbackOrNull(options.onButtonChange, "onButtonChange");
		this.#onSwitchChange = callbackOrNull(options.onSwitchChange, "onSwitchChange");
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
		this.#onChange = null;
		this.#onEncoderChange = null;
		this.#onButtonChange = null;
		this.#onSwitchChange = null;
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

	set onChange(callback: Encoder8ChangeCallback | null | undefined) {
		const next = callbackOrNull(callback, "onChange");
		if (this.#closed && next) throw new Error("8encoder input is closed");
		if (next !== this.#onChange) this.#polling.onChange = null;
		this.#onChange = next;
		this.#updatePollingState();
	}

	get onChange(): Encoder8ChangeCallback | null {
		return this.#onChange;
	}

	set onEncoderChange(callback: Encoder8EncoderChangeCallback | null | undefined) {
		const next = callbackOrNull(callback, "onEncoderChange");
		if (this.#closed && next) throw new Error("8encoder input is closed");
		this.#onEncoderChange = next;
		this.#updatePollingState();
	}

	get onEncoderChange(): Encoder8EncoderChangeCallback | null {
		return this.#onEncoderChange;
	}

	set onButtonChange(callback: Encoder8ButtonChangeCallback | null | undefined) {
		const next = callbackOrNull(callback, "onButtonChange");
		if (this.#closed && next) throw new Error("8encoder input is closed");
		this.#onButtonChange = next;
		this.#updatePollingState();
	}

	get onButtonChange(): Encoder8ButtonChangeCallback | null {
		return this.#onButtonChange;
	}

	set onSwitchChange(callback: Encoder8SwitchChangeCallback | null | undefined) {
		const next = callbackOrNull(callback, "onSwitchChange");
		if (this.#closed && next) throw new Error("8encoder input is closed");
		this.#onSwitchChange = next;
		this.#updatePollingState();
	}

	get onSwitchChange(): Encoder8SwitchChangeCallback | null {
		return this.#onSwitchChange;
	}

	#updatePollingState(): void {
		const callback =
			this.#onChange || this.#onEncoderChange || this.#onButtonChange || this.#onSwitchChange
				? this.#handleChange
				: null;
		if (callback && !this.#polling.onChange) this.#lastState = undefined;
		this.#polling.onChange = callback;
	}

	#handleChange(state: Encoder8State): void {
		const previous = this.#lastState;
		this.#onChange?.call(this.#target, state);
		if (previous) {
			if (this.#onEncoderChange) {
				for (let encoder = 0; encoder < ENCODER_COUNT; encoder++) {
					const value = encoderValue(state, encoder);
					if (value !== encoderValue(previous, encoder)) this.#onEncoderChange.call(this.#target, encoder, value);
				}
			}

			const changedButtons = state.buttons ^ previous.buttons;
			if (changedButtons && this.#onButtonChange) {
				for (let button = 0; button < BUTTON_COUNT; button++) {
					const bit = 1 << button;
					if (changedButtons & bit) this.#onButtonChange.call(this.#target, button, Boolean(state.buttons & bit));
				}
			}

			if (state.switchOn !== previous.switchOn) this.#onSwitchChange?.call(this.#target, state.switchOn);
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
