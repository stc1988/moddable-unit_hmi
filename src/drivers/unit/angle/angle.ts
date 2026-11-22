import AnalogInput, { type AnalogSensorOptions } from "hmi/input/analog";
import Peripheral, { assertOpen, ownResource, type PeripheralOptions } from "hmi/peripheral";
export interface AngleSample {
	raw: number;
	position: number;
	time: number;
}
export interface AngleOptions extends PeripheralOptions {
	sensor?: AnalogSensorOptions;
}
export default class Angle extends Peripheral {
	#sensor: AnalogInput;
	constructor(options: AngleOptions) {
		super(options);
		try {
			this.#sensor = ownResource(this, new AnalogInput(options.sensor));
			this.#sensor.read();
		} catch (error) {
			this.close();
			throw error;
		}
	}
	sample(): AngleSample {
		assertOpen(this);
		return { ...this.#sensor.read(), time: Date.now() };
	}
	read(): number {
		assertOpen(this);
		return this.#sensor.readRaw();
	}
	readSample(): AngleSample {
		return this.sample();
	}
}
