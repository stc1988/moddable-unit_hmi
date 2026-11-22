import { optionsObject } from "hmi/peripheral";
export interface AnalogInputSample {
	raw: number;
	position: number;
}

export interface AnalogIOOptions {
	pin: number;
	resolution?: number;
	format?: "number";
	[key: string]: unknown;
}

export interface AnalogIOInstance {
	readonly resolution: number;
	read(): number;
	close(): void;
}

export type AnalogIO = new (options: AnalogIOOptions) => AnalogIOInstance;

export interface AnalogInputOptions extends AnalogIOOptions {
	io: AnalogIO;
	invert?: boolean;
}

/** Public connection overrides; defaults are resolved only when a field is omitted. */
export type AnalogSensorOptions = Partial<AnalogInputOptions>;

export default class AnalogInput {
	#io: AnalogIOInstance | undefined;
	#invert: boolean;

	constructor(options: AnalogSensorOptions = {}) {
		optionsObject(options);
		const IO =
			options.io === undefined
				? (globalThis as { device?: { io?: { Analog?: AnalogIO } } }).device?.io?.Analog
				: options.io;
		if (typeof IO !== "function") throw new TypeError("sensor.io or device.io.Analog must be a constructor");
		this.#invert = options.invert ?? false;
		const ioOptions: AnalogIOOptions = { ...options, pin: options.pin ?? 8 };
		if (options.resolution !== undefined) ioOptions.resolution = options.resolution;
		if (options.format !== undefined) ioOptions.format = options.format;
		this.#io = new IO(ioOptions);
	}

	close(): void {
		this.#io?.close();
		this.#io = undefined;
	}

	readRaw(): number {
		const io = this.#io;
		if (!io) throw new Error("analog input is closed");
		return io.read();
	}

	read(): AnalogInputSample {
		const io = this.#io;
		if (!io) throw new Error("analog input is closed");

		const raw = io.read();
		const maximum = 2 ** io.resolution - 1;
		const position = raw / maximum;
		return { raw, position: this.#invert ? 1 - position : position };
	}
}
