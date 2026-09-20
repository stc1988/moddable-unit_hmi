import PollingInput, { type PollingInputOptions } from "hmi/polling";
import { callbackOrNull } from "hmi/util";
import type {
	Angle8AngleChangedCallback,
	Angle8ChangedCallback,
	Angle8Options,
	Angle8State,
	Angle8SwitchChangedCallback,
} from "unit/8angle";

const ANGLE_COUNT = 8;

function angleValue(state: Angle8State, angle: number): number {
	const value = state.angles[angle];
	if (value === undefined) throw new RangeError(`angles must contain ${ANGLE_COUNT} values`);
	return value;
}

export default class Angle8Input {
	#target: object;
	#polling: PollingInput<Angle8State>;
	#onChanged: Angle8ChangedCallback | null;
	#onAngleChanged: Angle8AngleChangedCallback | null;
	#onSwitchChanged: Angle8SwitchChangedCallback | null;
	#lastState: Angle8State | undefined;
	#deadband: number;
	#closed = false;

	constructor(target: object, source: { read(): Angle8State }, options: Angle8Options) {
		this.#target = target;
		this.#deadband = PollingInput.nonNegativeInteger(options.deadband ?? 0, "deadband");
		this.#onChanged = callbackOrNull(options.onChanged, "onChanged");
		this.#onAngleChanged = callbackOrNull(options.onAngleChanged, "onAngleChanged");
		this.#onSwitchChanged = callbackOrNull(options.onSwitchChanged, "onSwitchChanged");
		const pollingOptions: PollingInputOptions<Angle8State> = {
			changed: (state, previous) => this.#stateChanged(state, previous),
		};
		if (options.pollingInterval !== undefined) pollingOptions.pollingInterval = options.pollingInterval;
		this.#polling = new PollingInput(this, source, "8Angle", pollingOptions);
		this.#updatePollingState();
	}

	close(): void {
		if (this.#closed) return;
		this.#polling.close();
		this.#closed = true;
		this.#onChanged = null;
		this.#onAngleChanged = null;
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

	set deadband(value: number) {
		this.#deadband = PollingInput.nonNegativeInteger(value, "deadband");
	}

	get deadband(): number {
		return this.#deadband;
	}

	set onChanged(callback: Angle8ChangedCallback | null | undefined) {
		const next = callbackOrNull(callback, "onChanged");
		if (this.#closed && next) throw new Error("8angle input is closed");
		if (next !== this.#onChanged) this.#polling.onChanged = null;
		this.#onChanged = next;
		this.#updatePollingState();
	}

	get onChanged(): Angle8ChangedCallback | null {
		return this.#onChanged;
	}

	set onAngleChanged(callback: Angle8AngleChangedCallback | null | undefined) {
		const next = callbackOrNull(callback, "onAngleChanged");
		if (this.#closed && next) throw new Error("8angle input is closed");
		this.#onAngleChanged = next;
		this.#updatePollingState();
	}

	get onAngleChanged(): Angle8AngleChangedCallback | null {
		return this.#onAngleChanged;
	}

	set onSwitchChanged(callback: Angle8SwitchChangedCallback | null | undefined) {
		const next = callbackOrNull(callback, "onSwitchChanged");
		if (this.#closed && next) throw new Error("8angle input is closed");
		this.#onSwitchChanged = next;
		this.#updatePollingState();
	}

	get onSwitchChanged(): Angle8SwitchChangedCallback | null {
		return this.#onSwitchChanged;
	}

	#updatePollingState(): void {
		const callback = this.#onChanged || this.#onAngleChanged || this.#onSwitchChanged ? this.#handleChange : null;
		if (callback && !this.#polling.onChanged) this.#lastState = undefined;
		this.#polling.onChanged = callback;
	}

	#handleChange(state: Angle8State): void {
		const previous = this.#lastState;
		this.#onChanged?.call(this.#target, state);
		if (previous && this.#onAngleChanged) {
			for (let angle = 0; angle < ANGLE_COUNT; angle++) {
				const value = angleValue(state, angle);
				if (Math.abs(value - angleValue(previous, angle)) > this.#deadband)
					this.#onAngleChanged.call(this.#target, angle, value);
			}
		}
		if (previous && state.switchOn !== previous.switchOn) this.#onSwitchChanged?.call(this.#target, state.switchOn);
		this.#lastState = state;
	}

	#stateChanged(state: Angle8State, previous: Angle8State): boolean {
		if (state.switchOn !== previous.switchOn) return true;
		for (let angle = 0; angle < ANGLE_COUNT; angle++) {
			if (Math.abs(angleValue(state, angle) - angleValue(previous, angle)) > this.#deadband) return true;
		}
		return false;
	}
}
