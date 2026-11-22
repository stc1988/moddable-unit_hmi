import type I2C from "embedded:io/i2c";
import type SMBus from "embedded:io/smbus";
import Peripheral, { assertOpen, ownResource, type PeripheralOptions } from "hmi/peripheral";
import { integerInRange } from "hmi/util";
import Timer from "timer";
export interface SMBusInstance {
	close(): void;
}
export type I2COptions = ConstructorParameters<typeof I2C>[0];
type SMBusOptions = ConstructorParameters<typeof SMBus>[0];
export type SMBusIO<Bus extends SMBusInstance = SMBusInstance> = new (options: SMBusOptions) => Bus;
export interface SMBusPortOptions<IO extends SMBusIO = SMBusIO> extends PeripheralOptions {
	sensor: Omit<SMBusOptions, "address" | "hz"> & { io: IO; address?: number; hz?: number };
}
export interface SMBusDeviceOptions<IO extends SMBusIO = SMBusIO> extends SMBusPortOptions<IO> {}
export interface SMBusDeviceDefaults {
	address: number;
	hz: number;
	name: string;
}
interface Connection {
	bus: SMBusInstance | undefined;
	address: number;
}
let connections: WeakMap<object, Connection> | undefined;
export function busFor<Bus extends SMBusInstance>(instance: SMBusDevice<Bus>): Bus {
	assertOpen(instance);
	const bus = connections?.get(instance)?.bus;
	if (!bus) throw new Error("bus is closed");
	return bus as Bus;
}
export function readAddress(instance: object, register: number): number {
	assertOpen(instance);
	const bus = connections?.get(instance)?.bus as SMBusInstance & { readUint8(register: number): number };
	return bus.readUint8(register) & 0x7f;
}
// Updating the device register is a product extension. The current IO connection stays fixed.
// Close this instance and construct a new one at the new address after this operation.
export function changeAddress(instance: object, register: number, address: number, delay = 10): void {
	assertOpen(instance);
	const next = integerInRange(address, "address", 1, 0x7f);
	const connection = connections?.get(instance);
	if (!connection?.bus) throw new Error("bus is closed");
	if (next === connection.address) return;
	(connection.bus as SMBusInstance & { writeUint8(register: number, value: number): void }).writeUint8(register, next);
	Timer.delay(delay);
}
export class SMBusDevice<Bus extends SMBusInstance> extends Peripheral {
	// Type-only brand preserves the injected bus type without exposing it at runtime.
	declare private busType: Bus;
	protected constructor(options: SMBusDeviceOptions<SMBusIO<Bus>>, defaults: SMBusDeviceDefaults) {
		super(options);
		try {
			const sensor = options.sensor;
			if (!sensor || typeof sensor.io !== "function") throw new TypeError("sensor.io must be a constructor");
			const address = integerInRange(sensor.address ?? defaults.address, "address", 1, 0x7f);
			const hz = integerInRange(sensor.hz ?? defaults.hz, "hz", 1, Number.MAX_SAFE_INTEGER);
			const connection: Connection = { bus: undefined, address };
			connections ??= new WeakMap();
			connections.set(this, connection);
			connection.bus = new sensor.io({ ...sensor, address, hz });
			ownResource(this, {
				close() {
					const bus = connection.bus;
					connection.bus = undefined;
					bus?.close();
				},
			});
		} catch (error) {
			this.close();
			throw error;
		}
	}
}
