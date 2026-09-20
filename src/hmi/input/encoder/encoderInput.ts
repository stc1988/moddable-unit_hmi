import PollingInput, { type PollingInputOptions } from "hmi/polling";
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
	onChanged?: EncoderChangedCallback<State>;
	onButtonChanged?: EncoderButtonChangedCallback;
}

export type EncoderChangedCallback<State extends EncoderState = EncoderState> = (state: State) => void;
export type EncoderButtonChangedCallback = (pressed: boolean) => void;

export default class EncoderInput<State extends EncoderState = EncoderState> {
	#target: object;
	#polling: PollingInput<State>;
	#onChanged: EncoderChangedCallback<State> | null;
	#onButtonChanged: EncoderButtonChangedCallback | null;
	#lastButtonState: boolean | undefined;
	#closed = false;

	constructor(target: object, source: EncoderSource<State>, name: string, options: EncoderInputOptions<State> = {}) {
		this.#target = target;
		this.#onChanged = callbackOrNull(options.onChanged, "onChanged");
		this.#onButtonChanged = callbackOrNull(options.onButtonChanged, "onButtonChanged");
		const pollingOptions: PollingInputOptions<State> = {
			changed: (state, previous) => state.value !== previous.value || state.pressed !== previous.pressed,
		};
		if (options.pollingInterval !== undefined) pollingOptions.pollingInterval = options.pollingInterval;
		this.#polling = new PollingInput(this, source, name, pollingOptions);
		this.#updatePollingState();
	}

	close(): void {
		if (this.#closed) return;
		this.#polling.close();
		this.#closed = true;
		this.#onChanged = null;
		this.#onButtonChanged = null;
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

	set onChanged(callback: EncoderChangedCallback<State> | null | undefined) {
		const next = callbackOrNull(callback, "onChanged");
		if (this.#closed && next) throw new Error("encoder input is closed");
		if (next !== this.#onChanged) this.#polling.onChanged = null;
		this.#onChanged = next;
		this.#updatePollingState();
	}

	get onChanged(): EncoderChangedCallback<State> | null {
		return this.#onChanged;
	}

	set onButtonChanged(callback: EncoderButtonChangedCallback | null | undefined) {
		const next = callbackOrNull(callback, "onButtonChanged");
		if (this.#closed && next) throw new Error("encoder input is closed");
		this.#onButtonChanged = next;
		this.#updatePollingState();
	}

	get onButtonChanged(): EncoderButtonChangedCallback | null {
		return this.#onButtonChanged;
	}

	#updatePollingState(): void {
		const callback = this.#onChanged || this.#onButtonChanged ? this.#handleChange : null;
		if (callback && !this.#polling.onChanged) this.#lastButtonState = undefined;
		this.#polling.onChanged = callback;
	}

	#handleChange(state: State): void {
		const buttonChanged = this.#lastButtonState !== undefined && state.pressed !== this.#lastButtonState;
		this.#onChanged?.call(this.#target, state);
		if (buttonChanged) this.#onButtonChanged?.call(this.#target, state.pressed);
		this.#lastButtonState = state.pressed;
	}
}
