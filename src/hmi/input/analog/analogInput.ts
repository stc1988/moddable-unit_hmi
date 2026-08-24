import PollingInput, { type InputSource, type PollingInputOptions } from "hmi/polling";

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

export interface AnalogInputEventOptions<State extends AnalogInputSample = AnalogInputSample> {
	pollingInterval?: number;
	deadband?: number;
	onChange?: AnalogInputChangeCallback<State>;
}

export type AnalogInputChangeCallback<State extends AnalogInputSample = AnalogInputSample> = (sample: State) => void;

export default class AnalogInput {
	#io: AnalogIOInstance | undefined;
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

export class AnalogInputEvents<State extends AnalogInputSample = AnalogInputSample> {
	#polling: PollingInput<State>;
	#deadband: number;

	constructor(target: object, source: InputSource<State>, name: string, options: AnalogInputEventOptions<State> = {}) {
		this.#deadband = PollingInput.nonNegativeInteger(options.deadband ?? 0, "deadband");
		const pollingOptions: PollingInputOptions<State> = {
			changed: (sample, previous) => Math.abs(sample.raw - previous.raw) > this.#deadband,
		};
		if (options.pollingInterval !== undefined) pollingOptions.pollingInterval = options.pollingInterval;
		if (options.onChange !== undefined) pollingOptions.onChange = options.onChange;
		this.#polling = new PollingInput(target, source, name, pollingOptions);
	}

	close(): void {
		this.#polling.close();
	}

	start(): void {
		this.#polling.start();
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

	set onChange(callback: AnalogInputChangeCallback<State> | null | undefined) {
		this.#polling.onChange = callback;
	}

	get onChange(): AnalogInputChangeCallback<State> | null {
		return this.#polling.onChange;
	}
}
