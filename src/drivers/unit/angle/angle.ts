import Analog from "embedded:io/analog";
import PollingInput from "hmi/polling";
import AnalogInput, { type AnalogIO } from "input/analog";

export interface AngleSample {
	raw: number;
	position: number;
}

export interface AngleOptions {
	sensor?: {
		io?: AnalogIO;
		pin?: number;
	};
	pollingInterval?: number;
	deadband?: number;
	onChange?: AngleChangeCallback;
}

export type AngleChangeCallback = (sample: AngleSample) => void;

// https://docs.m5stack.com/ja/unit/angle
export default class Angle {
	static readonly DEFAULT_ANALOG_PIN = 8;

	#sensor: AnalogInput;
	#polling: PollingInput<AngleSample>;
	#deadband: number;

	constructor(options: AngleOptions = {}) {
		this.#deadband = PollingInput.nonNegativeInteger(options.deadband ?? 0, "deadband");
		const sensor = new AnalogInput({
			io: options.sensor?.io ?? Analog,
			pin: options.sensor?.pin ?? Angle.DEFAULT_ANALOG_PIN,
		});
		try {
			this.#polling = new PollingInput(this, sensor, "Angle", {
				pollingInterval: options.pollingInterval,
				onChange: options.onChange,
				changed: (sample, previous) => Math.abs(sample.raw - previous.raw) > this.#deadband,
			});
			this.#sensor = sensor;
		} catch (error) {
			sensor.close();
			throw error;
		}
	}

	close(): void {
		this.#polling.close();
		this.#sensor.close();
	}

	start(): void {
		this.#polling.start();
	}

	stop(): void {
		this.#polling.stop();
	}

	set onChange(callback: AngleChangeCallback | null | undefined) {
		this.#polling.onChange = callback;
	}

	get onChange(): AngleChangeCallback | null {
		return this.#polling.onChange;
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

	read(): number {
		return this.#sensor.readRaw();
	}

	readSample(): AngleSample {
		return this.#sensor.read();
	}
}
