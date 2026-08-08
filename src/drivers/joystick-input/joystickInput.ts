import Timer from "timer";

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
	#source: JoystickSource<State>;
	#target: object;
	#name: string;
	#timer?: ReturnType<typeof Timer.repeat>;
	#onChange: JoystickChangeCallback<State> | null;
	#onButtonChange: JoystickButtonChangeCallback | null;
	#lastNotifiedState?: State;
	#lastButtonState?: boolean;
	#pollingInterval: number;
	#deadband: number;
	#closed = false;

	constructor(target: object, source: JoystickSource<State>, name: string, options: JoystickInputOptions<State> = {}) {
		this.#target = target;
		this.#source = source;
		this.#name = name;
		this.#pollingInterval = JoystickInput.#nonNegativeInteger(options.pollingInterval ?? 30, "pollingInterval", 1);
		this.#deadband = JoystickInput.#nonNegativeInteger(options.deadband ?? 0, "deadband");
		this.#onChange = JoystickInput.#callback(options.onChange, "onChange");
		this.#onButtonChange = JoystickInput.#callback(options.onButtonChange, "onButtonChange");
		this.#updatePollingState();
	}

	close(): void {
		if (this.#closed) return;
		this.stop();
		this.#closed = true;
		this.#onChange = null;
		this.#onButtonChange = null;
	}

	start(): void {
		if (this.#closed) throw new Error("joystick input is closed");
		if (this.#timer) return;
		this.#lastNotifiedState = undefined;
		this.#lastButtonState = undefined;
		this.#timer = Timer.repeat(() => {
			this.#pollTick();
		}, this.#pollingInterval);
	}

	stop(): void {
		if (!this.#timer) return;
		Timer.clear(this.#timer);
		this.#timer = undefined;
	}

	set pollingInterval(value: number) {
		const pollingInterval = JoystickInput.#nonNegativeInteger(value, "pollingInterval", 1);
		if (pollingInterval === this.#pollingInterval) return;

		const wasRunning = this.#timer !== undefined;
		this.stop();
		this.#pollingInterval = pollingInterval;
		if (wasRunning) this.start();
	}

	get pollingInterval(): number {
		return this.#pollingInterval;
	}

	set deadband(value: number) {
		this.#deadband = JoystickInput.#nonNegativeInteger(value, "deadband");
	}

	get deadband(): number {
		return this.#deadband;
	}

	set onChange(callback: JoystickChangeCallback<State> | null | undefined) {
		const next = JoystickInput.#callback(callback, "onChange");
		if (next !== this.#onChange) this.#lastNotifiedState = undefined;
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
		if (this.#onChange || this.#onButtonChange) this.start();
		else this.stop();
	}

	#pollTick(): void {
		try {
			const state = this.#source.read();
			const buttonChanged = this.#lastButtonState !== undefined && state.pressed !== this.#lastButtonState;
			const inputChanged = buttonChanged || this.#positionChanged(state);

			if (this.#onChange && inputChanged) {
				this.#lastNotifiedState = state;
				this.#onChange.call(this.#target, state);
			}
			if (this.#onButtonChange && buttonChanged) this.#onButtonChange.call(this.#target, state.pressed);

			this.#lastButtonState = state.pressed;
		} catch (error) {
			trace(`[${this.#name}][ERROR] poll failed: ${error instanceof Error ? error.message : String(error)}\n`);
		}
	}

	#positionChanged(state: State): boolean {
		const previous = this.#lastNotifiedState;
		if (!previous) return true;
		return Math.abs(state.x - previous.x) > this.#deadband || Math.abs(state.y - previous.y) > this.#deadband;
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
