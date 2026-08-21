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

export interface SMBusInstance {
	close(): void;
}

export type SMBusConstructor<Bus extends SMBusInstance, Options extends { address: number }> = new (
	options: Options,
) => Bus;

export class SMBusDevice<Bus extends SMBusInstance, Options extends { address: number }> {
	#IO: SMBusConstructor<Bus, Options>;
	#options: Omit<Options, "address">;
	#bus?: Bus;
	#name: string;

	protected constructor(
		IO: SMBusConstructor<Bus, Options>,
		options: Omit<Options, "address">,
		address: number,
		name: string,
	) {
		this.#IO = IO;
		this.#options = options;
		this.#name = name;
		this.reconnect(address);
	}

	protected reconnect(address: number): void {
		this.close();
		this.#bus = new this.#IO({ ...this.#options, address } as Options);
	}

	protected get activeBus(): Bus {
		if (!this.#bus) throw new Error(`${this.#name} bus is closed`);
		return this.#bus;
	}

	public close(): void {
		this.#bus?.close();
		this.#bus = undefined;
	}
}
