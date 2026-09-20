export interface InputSource<State> {
	read(): State;
}

export type InputChangedCallback<State> = (state: State) => void;
export type InputChangeDetector<State> = (state: State, previous: State) => boolean;

export interface PollingInputOptions<State> {
	pollingInterval?: number;
	onChanged?: InputChangedCallback<State>;
	changed?: InputChangeDetector<State>;
}

import Timer from "timer";

export default class PollingInput<State> {
	#source: InputSource<State>;
	#target: object;
	#name: string;
	#changed: InputChangeDetector<State>;
	#timer: ReturnType<typeof Timer.repeat> | undefined;
	#onChanged: InputChangedCallback<State> | null;
	#lastNotifiedState: State | undefined;
	#pollingInterval: number;
	#closed = false;

	constructor(target: object, source: InputSource<State>, name: string, options: PollingInputOptions<State> = {}) {
		this.#target = target;
		this.#source = source;
		this.#name = name;
		this.#pollingInterval = PollingInput.nonNegativeInteger(options.pollingInterval ?? 30, "pollingInterval", 1);
		this.#onChanged = PollingInput.callback(options.onChanged, "onChanged");
		this.#changed = options.changed ?? (() => true);
		if (typeof this.#changed !== "function") throw new TypeError("changed must be a function");
		this.#updatePollingState();
	}

	close(): void {
		if (this.#closed) return;
		this.stop();
		this.#closed = true;
		this.#onChanged = null;
		this.#lastNotifiedState = undefined;
	}

	start(): void {
		if (this.#closed) throw new Error(`${this.#name} input is closed`);
		if (this.#timer) return;
		this.#lastNotifiedState = undefined;
		this.#timer = Timer.repeat(() => {
			this.#pollTick();
		}, this.#pollingInterval);
	}

	stop(): void {
		if (!this.#timer) return;
		Timer.clear(this.#timer);
		this.#timer = undefined;
	}

	get running(): boolean {
		return this.#timer !== undefined;
	}

	set pollingInterval(value: number) {
		const pollingInterval = PollingInput.nonNegativeInteger(value, "pollingInterval", 1);
		if (pollingInterval === this.#pollingInterval) return;

		const wasRunning = this.#timer !== undefined;
		this.stop();
		this.#pollingInterval = pollingInterval;
		if (wasRunning) this.start();
	}

	get pollingInterval(): number {
		return this.#pollingInterval;
	}

	set onChanged(callback: InputChangedCallback<State> | null | undefined) {
		const next = PollingInput.callback(callback, "onChanged");
		if (this.#closed && next) throw new Error(`${this.#name} input is closed`);
		if (next !== this.#onChanged) this.#lastNotifiedState = undefined;
		this.#onChanged = next;
		this.#updatePollingState();
	}

	get onChanged(): InputChangedCallback<State> | null {
		return this.#onChanged;
	}

	#updatePollingState(): void {
		if (this.#onChanged) this.start();
		else this.stop();
	}

	#pollTick(): void {
		try {
			const state = this.#source.read();
			const previous = this.#lastNotifiedState;
			if (previous === undefined || this.#changed(state, previous)) {
				this.#onChanged?.call(this.#target, state);
				this.#lastNotifiedState = state;
			}
		} catch (error) {
			trace(`[${this.#name}][ERROR] poll failed: ${error instanceof Error ? error.message : String(error)}\n`);
		}
	}

	static callback<Callback>(value: Callback | null | undefined, name: string): Callback | null {
		if (value === undefined || value === null) return null;
		if (typeof value !== "function") throw new TypeError(`${name} must be a function`);
		return value;
	}

	static nonNegativeInteger(value: number, name: string, minimum = 0): number {
		if (!Number.isInteger(value) || value < minimum) throw new RangeError(`${name} must be an integer >= ${minimum}`);
		return value;
	}
}
