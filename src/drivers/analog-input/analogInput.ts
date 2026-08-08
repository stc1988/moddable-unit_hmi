export interface AnalogInputSample {
	raw: number;
	position: number;
}

export interface AnalogIOOptions {
	pin: number;
	resolution?: number;
	format?: "number";
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

export default class AnalogInput {
	#io?: AnalogIOInstance;
	#invert: boolean;

	constructor(options: AnalogInputOptions) {
		if (typeof options.io !== "function") throw new TypeError("io must be a constructor");
		this.#invert = options.invert ?? false;
		const ioOptions: AnalogIOOptions = { pin: options.pin };
		if (options.resolution !== undefined) ioOptions.resolution = options.resolution;
		if (options.format !== undefined) ioOptions.format = options.format;
		this.#io = new options.io(ioOptions);
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
