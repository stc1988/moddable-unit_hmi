import Analog from "embedded:io/analog";
import AnalogInput, {
	type AnalogInputChangeCallback,
	type AnalogInputEventOptions,
	AnalogInputEvents,
	type AnalogIO,
} from "hmi/input/analog";

export interface AngleSample {
	raw: number;
	position: number;
}

export interface AngleOptions extends AnalogInputEventOptions<AngleSample> {
	sensor?: {
		io?: AnalogIO;
		pin?: number;
	};
}

export type AngleChangeCallback = AnalogInputChangeCallback<AngleSample>;

// https://docs.m5stack.com/ja/unit/angle
export default class Angle {
	static readonly DEFAULT_ANALOG_PIN = 8;

	#sensor: AnalogInput;
	#input: AnalogInputEvents<AngleSample>;

	set onChange(callback: AngleChangeCallback | null | undefined) {
		this.#input.onChange = callback;
	}
	get onChange(): AngleChangeCallback | null {
		return this.#input.onChange;
	}
	set pollingInterval(value: number) {
		this.#input.pollingInterval = value;
	}
	get pollingInterval(): number {
		return this.#input.pollingInterval;
	}
	set deadband(value: number) {
		this.#input.deadband = value;
	}
	get deadband(): number {
		return this.#input.deadband;
	}
	start(): void {
		this.#input.start();
	}
	stop(): void {
		this.#input.stop();
	}

	constructor(options: AngleOptions = {}) {
		const sensor = new AnalogInput({
			io: options.sensor?.io ?? Analog,
			pin: options.sensor?.pin ?? Angle.DEFAULT_ANALOG_PIN,
		});
		try {
			this.#input = new AnalogInputEvents(this, sensor, "Angle", options);
			this.#sensor = sensor;
		} catch (error) {
			sensor.close();
			throw error;
		}
	}

	close(): void {
		this.#input.close();
		this.#sensor.close();
	}

	read(): number {
		return this.#sensor.readRaw();
	}

	readSample(): AngleSample {
		return this.#sensor.read();
	}
}
