import PollingInput from "hmi/polling";
import { callbackOrNull } from "hmi/util";

export interface EncoderState {
	value: number;
	pressed: boolean;
}

export interface EncoderSource<State extends EncoderState = EncoderState> {
	read(): State;
}

export interface EncoderInputOptions<State extends EncoderState = EncoderState> {
	pollingInterval?: number;
	onChange?: EncoderChangeCallback<State>;
	onButtonChange?: EncoderButtonChangeCallback;
}

export type EncoderChangeCallback<State extends EncoderState = EncoderState> = (state: State) => void;
export type EncoderButtonChangeCallback = (pressed: boolean) => void;

export default class EncoderInput<State extends EncoderState = EncoderState> {
	#target: object;
	#polling: PollingInput<State>;
	#onChange: EncoderChangeCallback<State> | null;
	#onButtonChange: EncoderButtonChangeCallback | null;
	#lastButtonState?: boolean;
	#closed = false;

	constructor(target: object, source: EncoderSource<State>, name: string, options: EncoderInputOptions<State> = {}) {
		this.#target = target;
		this.#onChange = callbackOrNull(options.onChange, "onChange");
		this.#onButtonChange = callbackOrNull(options.onButtonChange, "onButtonChange");
		this.#polling = new PollingInput(this, source, name, {
			pollingInterval: options.pollingInterval,
			changed: (state, previous) => state.value !== previous.value || state.pressed !== previous.pressed,
		});
		this.#updatePollingState();
	}

	close(): void {
		if (this.#closed) return;
		this.#polling.close();
		this.#closed = true;
		this.#onChange = null;
		this.#onButtonChange = null;
	}

	start(): void {
		const wasRunning = this.#polling.running;
		this.#polling.start();
		if (!wasRunning) this.#lastButtonState = undefined;
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

	set onChange(callback: EncoderChangeCallback<State> | null | undefined) {
		const next = callbackOrNull(callback, "onChange");
		if (this.#closed && next) throw new Error("encoder input is closed");
		if (next !== this.#onChange) this.#polling.onChange = null;
		this.#onChange = next;
		this.#updatePollingState();
	}

	get onChange(): EncoderChangeCallback<State> | null {
		return this.#onChange;
	}

	set onButtonChange(callback: EncoderButtonChangeCallback | null | undefined) {
		const next = callbackOrNull(callback, "onButtonChange");
		if (this.#closed && next) throw new Error("encoder input is closed");
		this.#onButtonChange = next;
		this.#updatePollingState();
	}

	get onButtonChange(): EncoderButtonChangeCallback | null {
		return this.#onButtonChange;
	}

	#updatePollingState(): void {
		const callback = this.#onChange || this.#onButtonChange ? this.#handleChange : null;
		if (callback && !this.#polling.onChange) this.#lastButtonState = undefined;
		this.#polling.onChange = callback;
	}

	#handleChange(state: State): void {
		const buttonChanged = this.#lastButtonState !== undefined && state.pressed !== this.#lastButtonState;
		this.#onChange?.call(this.#target, state);
		if (buttonChanged) this.#onButtonChange?.call(this.#target, state.pressed);
		this.#lastButtonState = state.pressed;
	}
}
