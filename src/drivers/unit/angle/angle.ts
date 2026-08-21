import Analog from "embedded:io/analog";
import AnalogInput, {
	type AnalogInputChangeCallback,
	AnalogInputEvents,
	type AnalogInputEventOptions,
	type AnalogIO,
} from "input/analog";

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
	readonly input: AnalogInputEvents<AngleSample>;

	constructor(options: AngleOptions = {}) {
		const sensor = new AnalogInput({
			io: options.sensor?.io ?? Analog,
			pin: options.sensor?.pin ?? Angle.DEFAULT_ANALOG_PIN,
		});
		try {
			this.input = new AnalogInputEvents(this, sensor, "Angle", options);
			this.#sensor = sensor;
		} catch (error) {
			sensor.close();
			throw error;
		}
	}

	close(): void {
		this.input.close();
		this.#sensor.close();
	}

	read(): number {
		return this.#sensor.readRaw();
	}

	readSample(): AngleSample {
		return this.#sensor.read();
	}
}
