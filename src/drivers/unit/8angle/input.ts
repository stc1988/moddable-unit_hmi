import PollingInput from "hmi/polling";
import { callbackOrNull } from "hmi/util";
import type {
	Angle8AngleChangeCallback,
	Angle8ChangeCallback,
	Angle8Options,
	Angle8State,
	Angle8SwitchChangeCallback,
} from "unit/8angle";

const ANGLE_COUNT = 8;

export default class Angle8Input {
	#target: object;
	#polling: PollingInput<Angle8State>;
	#onChange: Angle8ChangeCallback | null;
	#onAngleChange: Angle8AngleChangeCallback | null;
	#onSwitchChange: Angle8SwitchChangeCallback | null;
	#lastState?: Angle8State;
	#deadband: number;
	#closed = false;

	constructor(target: object, source: { read(): Angle8State }, options: Angle8Options) {
		this.#target = target;
		this.#deadband = PollingInput.nonNegativeInteger(options.deadband ?? 0, "deadband");
		this.#onChange = callbackOrNull(options.onChange, "onChange");
		this.#onAngleChange = callbackOrNull(options.onAngleChange, "onAngleChange");
		this.#onSwitchChange = callbackOrNull(options.onSwitchChange, "onSwitchChange");
		this.#polling = new PollingInput(this, source, "8Angle", {
			pollingInterval: options.pollingInterval,
			changed: (state, previous) => this.#stateChanged(state, previous),
		});
		this.#updatePollingState();
	}

	close(): void {
		if (this.#closed) return;
		this.#polling.close();
		this.#closed = true;
		this.#onChange = null;
		this.#onAngleChange = null;
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

	set deadband(value: number) {
		this.#deadband = PollingInput.nonNegativeInteger(value, "deadband");
	}

	get deadband(): number {
		return this.#deadband;
	}

	set onChange(callback: Angle8ChangeCallback | null | undefined) {
		const next = callbackOrNull(callback, "onChange");
		if (this.#closed && next) throw new Error("8angle input is closed");
		if (next !== this.#onChange) this.#polling.onChange = null;
		this.#onChange = next;
		this.#updatePollingState();
	}

	get onChange(): Angle8ChangeCallback | null {
		return this.#onChange;
	}

	set onAngleChange(callback: Angle8AngleChangeCallback | null | undefined) {
		const next = callbackOrNull(callback, "onAngleChange");
		if (this.#closed && next) throw new Error("8angle input is closed");
		this.#onAngleChange = next;
		this.#updatePollingState();
	}

	get onAngleChange(): Angle8AngleChangeCallback | null {
		return this.#onAngleChange;
	}

	set onSwitchChange(callback: Angle8SwitchChangeCallback | null | undefined) {
		const next = callbackOrNull(callback, "onSwitchChange");
		if (this.#closed && next) throw new Error("8angle input is closed");
		this.#onSwitchChange = next;
		this.#updatePollingState();
	}

	get onSwitchChange(): Angle8SwitchChangeCallback | null {
		return this.#onSwitchChange;
	}

	#updatePollingState(): void {
		const callback = this.#onChange || this.#onAngleChange || this.#onSwitchChange ? this.#handleChange : null;
		if (callback && !this.#polling.onChange) this.#lastState = undefined;
		this.#polling.onChange = callback;
	}

	#handleChange(state: Angle8State): void {
		const previous = this.#lastState;
		this.#onChange?.call(this.#target, state);
		if (previous && this.#onAngleChange) {
			for (let angle = 0; angle < ANGLE_COUNT; angle++) {
				if (Math.abs(state.angles[angle] - previous.angles[angle]) > this.#deadband)
					this.#onAngleChange.call(this.#target, angle, state.angles[angle]);
			}
		}
		if (previous && state.switchOn !== previous.switchOn) this.#onSwitchChange?.call(this.#target, state.switchOn);
		this.#lastState = state;
	}

	#stateChanged(state: Angle8State, previous: Angle8State): boolean {
		if (state.switchOn !== previous.switchOn) return true;
		for (let angle = 0; angle < ANGLE_COUNT; angle++) {
			if (Math.abs(state.angles[angle] - previous.angles[angle]) > this.#deadband) return true;
		}
		return false;
	}
}
