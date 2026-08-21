export interface RGBColor {
	r: number;
	g: number;
	b: number;
}

export function integerInRange(value: number, name: string, minimum: number, maximum: number): number {
	if (!Number.isInteger(value) || value < minimum || value > maximum)
		throw new RangeError(`${name} must be an integer from ${minimum} to ${maximum}`);
	return value;
}

export function callbackOrNull<Callback>(value: Callback | null | undefined, name: string): Callback | null {
	if (value === undefined || value === null) return null;
	if (typeof value !== "function") throw new TypeError(`${name} must be a function`);
	return value;
}

export function signed8(value: number): number {
	return value & 0x80 ? value - 0x100 : value;
}

export function signed16(value: number): number {
	const word = value & 0xffff;
	return word & 0x8000 ? word - 0x1_0000 : word;
}

export function signed32(data: Uint8Array, offset: number): number {
	return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24);
}

export function signed32ToLittleEndian(value: number, name: string): Uint8Array {
	const integer = integerInRange(value, name, -0x8000_0000, 0x7fff_ffff);
	return Uint8Array.of(integer & 0xff, (integer >>> 8) & 0xff, (integer >>> 16) & 0xff, (integer >>> 24) & 0xff);
}

export interface I2CBusInstance {
	close(): void;
}

export type I2CBusConstructor<Bus extends I2CBusInstance, Options extends { address: number }> = new (
	options: Options,
) => Bus;

export class I2CBusResource<Bus extends I2CBusInstance, Options extends { address: number }> {
	#IO: I2CBusConstructor<Bus, Options>;
	#options: Omit<Options, "address">;
	#bus?: Bus;
	#name: string;

	constructor(IO: I2CBusConstructor<Bus, Options>, options: Omit<Options, "address">, address: number, name: string) {
		this.#IO = IO;
		this.#options = options;
		this.#name = name;
		this.open(address);
	}

	open(address: number): void {
		this.close();
		this.#bus = new this.#IO({ ...this.#options, address } as Options);
	}

	get active(): Bus {
		if (!this.#bus) throw new Error(`${this.#name} bus is closed`);
		return this.#bus;
	}

	close(): void {
		this.#bus?.close();
		this.#bus = undefined;
	}
}
