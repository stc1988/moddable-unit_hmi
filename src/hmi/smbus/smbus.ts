import type I2C from "embedded:io/i2c";
import SMBus from "embedded:io/smbus";
import { integerInRange } from "hmi/util";
import Timer from "timer";

export interface SMBusInstance {
	close(): void;
}

export type I2COptions = ConstructorParameters<typeof I2C>[0];
export type SMBusOptions = I2COptions & { stop?: boolean };
export type SMBusIO<Bus extends SMBusInstance = SMBusInstance> = new (options: SMBusOptions) => Bus;

export interface SMBusPortOptions<IO extends SMBusIO = SMBusIO> {
	data?: I2COptions["data"];
	clock?: I2COptions["clock"];
	io?: IO;
}

export interface SMBusDeviceOptions<IO extends SMBusIO = SMBusIO> extends SMBusPortOptions<IO> {
	address?: number;
	hz?: number;
}

export interface SMBusDeviceDefaults {
	address: number;
	hz: number;
	name: string;
	data?: I2COptions["data"];
	clock?: I2COptions["clock"];
}

interface SMBusRegisterIO {
	readUint8(register: number): number;
	writeUint8(register: number, value: number): void;
}

// @moddable/typings 8.3.1 declares the SMBus options as a tuple intersection.
// Narrow the constructor to the object accepted by the runtime implementation.
const SMBusConstructor = SMBus as unknown as SMBusIO;

export class SMBusDevice<Bus extends SMBusInstance> {
	#IO: SMBusIO<Bus>;
	#options: Omit<SMBusOptions, "address">;
	#bus?: Bus;
	#name: string;
	#address: number;

	protected constructor(options: SMBusDeviceOptions<SMBusIO<Bus>>, defaults: SMBusDeviceDefaults) {
		this.#IO = options.io ?? (SMBusConstructor as SMBusIO<Bus>);
		this.#options = {
			data: options.data ?? defaults.data ?? device.I2C.default.data,
			clock: options.clock ?? defaults.clock ?? device.I2C.default.clock,
			hz: integerInRange(options.hz ?? defaults.hz, "hz", 1, Number.MAX_SAFE_INTEGER),
		};
		this.#name = defaults.name;
		this.#address = integerInRange(options.address ?? defaults.address, "address", 1, 0x7f);
		this.reconnect(this.#address);
	}

	protected reconnect(address: number): void {
		this.#bus?.close();
		this.#bus = undefined;
		this.#bus = new this.#IO({ ...this.#options, address } as SMBusOptions);
		this.#address = address;
	}

	protected get activeBus(): Bus {
		if (!this.#bus) throw new Error(`${this.#name} bus is closed`);
		return this.#bus;
	}

	protected readAddress(register: number): number {
		return (this.activeBus as Bus & SMBusRegisterIO).readUint8(register) & 0x7f;
	}

	protected changeAddress(register: number, address: number, delay = 10): void {
		const nextAddress = integerInRange(address, "address", 1, 0x7f);
		if (nextAddress === this.#address) return;

		(this.activeBus as Bus & SMBusRegisterIO).writeUint8(register, nextAddress);
		this.reconnect(nextAddress);
		Timer.delay(delay);
	}

	public close(): void {
		this.#bus?.close();
		this.#bus = undefined;
	}
}
