import PollingInput from "hmi/polling";

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
	onChange?: JoystickChangeCallback<State>;
	onButtonChange?: JoystickButtonChangeCallback;
}

export type JoystickChangeCallback<State extends JoystickState = JoystickState> = (state: State) => void;
export type JoystickButtonChangeCallback = (pressed: boolean) => void;

export default class JoystickInput<State extends JoystickState = JoystickState> {
	#target: object;
	#polling: PollingInput<State>;
	#onChange: JoystickChangeCallback<State> | null;
	#onButtonChange: JoystickButtonChangeCallback | null;
	#lastButtonState?: boolean;
	#deadband: number;
	#closed = false;

	constructor(target: object, source: JoystickSource<State>, name: string, options: JoystickInputOptions<State> = {}) {
		this.#target = target;
		this.#deadband = JoystickInput.#nonNegativeInteger(options.deadband ?? 0, "deadband");
		this.#onChange = JoystickInput.#callback(options.onChange, "onChange");
		this.#onButtonChange = JoystickInput.#callback(options.onButtonChange, "onButtonChange");
		this.#polling = new PollingInput(this, source, name, {
			pollingInterval: options.pollingInterval,
			changed: (state, previous) =>
				state.pressed !== previous.pressed ||
				Math.abs(state.x - previous.x) > this.#deadband ||
				Math.abs(state.y - previous.y) > this.#deadband,
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

	set deadband(value: number) {
		this.#deadband = JoystickInput.#nonNegativeInteger(value, "deadband");
	}

	get deadband(): number {
		return this.#deadband;
	}

	set onChange(callback: JoystickChangeCallback<State> | null | undefined) {
		const next = JoystickInput.#callback(callback, "onChange");
		if (next !== this.#onChange) this.#polling.onChange = null;
		this.#onChange = next;
		this.#updatePollingState();
	}

	get onChange(): JoystickChangeCallback<State> | null {
		return this.#onChange;
	}

	set onButtonChange(callback: JoystickButtonChangeCallback | null | undefined) {
		this.#onButtonChange = JoystickInput.#callback(callback, "onButtonChange");
		this.#updatePollingState();
	}

	get onButtonChange(): JoystickButtonChangeCallback | null {
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
