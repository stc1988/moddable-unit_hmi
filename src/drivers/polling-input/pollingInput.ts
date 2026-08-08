export interface InputSource<State> {
	read(): State;
}

export type InputChangeCallback<State> = (state: State) => void;
export type InputChangeDetector<State> = (state: State, previous: State) => boolean;

export interface PollingInputOptions<State> {
	pollingInterval?: number;
	onChange?: InputChangeCallback<State>;
	changed?: InputChangeDetector<State>;
}

import Timer from "timer";

export default class PollingInput<State> {
	#source: InputSource<State>;
	#target: object;
	#name: string;
	#changed: InputChangeDetector<State>;
	#timer?: ReturnType<typeof Timer.repeat>;
	#onChange: InputChangeCallback<State> | null;
	#lastNotifiedState?: State;
	#pollingInterval: number;
	#closed = false;

	constructor(target: object, source: InputSource<State>, name: string, options: PollingInputOptions<State> = {}) {
		this.#target = target;
		this.#source = source;
		this.#name = name;
		this.#pollingInterval = PollingInput.nonNegativeInteger(options.pollingInterval ?? 30, "pollingInterval", 1);
		this.#onChange = PollingInput.callback(options.onChange, "onChange");
		this.#changed = options.changed ?? (() => true);
		if (typeof this.#changed !== "function") throw new TypeError("changed must be a function");
		this.#updatePollingState();
	}

	close(): void {
		if (this.#closed) return;
		this.stop();
		this.#closed = true;
		this.#onChange = null;
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

	set onChange(callback: InputChangeCallback<State> | null | undefined) {
		const next = PollingInput.callback(callback, "onChange");
		if (this.#closed && next) throw new Error(`${this.#name} input is closed`);
		if (next !== this.#onChange) this.#lastNotifiedState = undefined;
		this.#onChange = next;
		this.#updatePollingState();
	}

	get onChange(): InputChangeCallback<State> | null {
		return this.#onChange;
	}

	#updatePollingState(): void {
		if (this.#onChange) this.start();
		else this.stop();
	}

	#pollTick(): void {
		try {
			const state = this.#source.read();
			const previous = this.#lastNotifiedState;
			if (previous === undefined || this.#changed(state, previous)) {
				this.#lastNotifiedState = state;
				this.#onChange?.call(this.#target, state);
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
