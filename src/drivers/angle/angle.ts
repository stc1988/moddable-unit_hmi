import Analog from "embedded:io/analog";
import Timer from "timer";

export interface AngleSample {
	raw: number;
	position: number;
}

export interface AngleOptions {
	analogPin?: number;
	pollingInterval?: number;
	deadband?: number;
	onChange?: AngleChangeCallback;
}

export type AngleChangeCallback = (sample: AngleSample) => void;

// https://docs.m5stack.com/ja/unit/angle
export default class Angle {
	static readonly DEFAULT_ANALOG_PIN = 8;

	#analog: Analog;
	#timer?: ReturnType<typeof Timer.repeat>;
	#onChange: AngleChangeCallback | null;
	#lastRaw?: number;

	pollingInterval: number;
	deadband: number;

	constructor(options: AngleOptions = {}) {
		this.pollingInterval = Angle.#nonNegativeInteger(options.pollingInterval ?? 30, "pollingInterval", 1);
		this.deadband = Angle.#nonNegativeInteger(options.deadband ?? 0, "deadband");
		this.#analog = new Analog({ pin: options.analogPin ?? Angle.DEFAULT_ANALOG_PIN });
		this.#onChange = options.onChange ?? null;
		this.#updatePollingState();
	}

	close(): void {
		this.stop();
		this.#analog.close();
	}

	start(): void {
		if (this.#timer) return;
		this.#timer = Timer.repeat(() => {
			this.#pollTick();
		}, this.pollingInterval);
	}

	stop(): void {
		if (!this.#timer) return;
		Timer.clear(this.#timer);
		this.#timer = undefined;
	}

	set onChange(callback: AngleChangeCallback | null | undefined) {
		this.#onChange = typeof callback === "function" ? callback : null;
		this.#updatePollingState();
	}

	get onChange(): AngleChangeCallback | null {
		return this.#onChange;
	}

	read(): number {
		return this.#analog.read();
	}

	readSample(): AngleSample {
		const raw = this.read();
		const maximum = 2 ** this.#analog.resolution - 1;
		return { raw, position: raw / maximum };
	}

	#updatePollingState(): void {
		if (this.#onChange) this.start();
		else this.stop();
	}

	#pollTick(): void {
		try {
			const sample = this.readSample();
			if (this.#lastRaw === undefined || Math.abs(sample.raw - this.#lastRaw) > this.deadband) {
				this.#lastRaw = sample.raw;
				this.#onChange?.(sample);
			}
		} catch (error) {
			trace(`[Angle][ERROR] poll failed: ${error instanceof Error ? error.message : String(error)}\n`);
		}
	}

	static #nonNegativeInteger(value: number, name: string, minimum = 0): number {
		if (!Number.isInteger(value) || value < minimum) throw new RangeError(`${name} must be an integer >= ${minimum}`);
		return value;
	}
}
