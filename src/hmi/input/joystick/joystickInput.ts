import PollingInput, { type PollingInputOptions } from "hmi/polling";

export interface JoystickPosition {
	x: number;
	y: number;
}

export interface JoystickState extends JoystickPosition {
	pressed: boolean;
}

export interface JoystickSource<State extends JoystickState = JoystickState> {
	read(): State;
}

export interface JoystickInputOptions<State extends JoystickState = JoystickState> {
	pollingInterval?: number;
	deadband?: number;
	onChanged?: JoystickChangedCallback<State>;
	onButtonChanged?: JoystickButtonChangedCallback;
}

export type JoystickChangedCallback<State extends JoystickState = JoystickState> = (state: State) => void;
export type JoystickButtonChangedCallback = (pressed: boolean) => void;

export default class JoystickInput<State extends JoystickState = JoystickState> {
	#target: object;
	#polling: PollingInput<State>;
	#onChanged: JoystickChangedCallback<State> | null;
	#onButtonChanged: JoystickButtonChangedCallback | null;
	#lastButtonState: boolean | undefined;
	#deadband: number;
	#closed = false;

	constructor(target: object, source: JoystickSource<State>, name: string, options: JoystickInputOptions<State> = {}) {
		this.#target = target;
		this.#deadband = JoystickInput.#nonNegativeInteger(options.deadband ?? 0, "deadband");
		this.#onChanged = JoystickInput.#callback(options.onChanged, "onChanged");
		this.#onButtonChanged = JoystickInput.#callback(options.onButtonChanged, "onButtonChanged");
		const pollingOptions: PollingInputOptions<State> = {
			changed: (state, previous) =>
				state.pressed !== previous.pressed ||
				Math.abs(state.x - previous.x) > this.#deadband ||
				Math.abs(state.y - previous.y) > this.#deadband,
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

	set deadband(value: number) {
		this.#deadband = JoystickInput.#nonNegativeInteger(value, "deadband");
	}

	get deadband(): number {
		return this.#deadband;
	}

	set onChanged(callback: JoystickChangedCallback<State> | null | undefined) {
		const next = JoystickInput.#callback(callback, "onChanged");
		if (next !== this.#onChanged) this.#polling.onChanged = null;
		this.#onChanged = next;
		this.#updatePollingState();
	}

	get onChanged(): JoystickChangedCallback<State> | null {
		return this.#onChanged;
	}

	set onButtonChanged(callback: JoystickButtonChangedCallback | null | undefined) {
		this.#onButtonChanged = JoystickInput.#callback(callback, "onButtonChanged");
		this.#updatePollingState();
	}

	get onButtonChanged(): JoystickButtonChangedCallback | null {
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

	static #callback<Callback>(value: Callback | null | undefined, name: string): Callback | null {
		if (value === undefined || value === null) return null;
		if (typeof value !== "function") throw new TypeError(`${name} must be a function`);
		return value;
	}

	static #nonNegativeInteger(value: number, name: string, minimum = 0): number {
		if (!Number.isInteger(value) || value < minimum) throw new RangeError(`${name} must be an integer >= ${minimum}`);
		return value;
	}
}
