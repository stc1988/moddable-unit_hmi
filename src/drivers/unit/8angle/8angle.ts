import Led, { LedCollection } from "hmi/led";
import { assertOpen, ownResource } from "hmi/peripheral";
import {
	busFor,
	changeAddress,
	readAddress,
	SMBusDevice,
	type SMBusDeviceOptions,
	type SMBusInstance,
	type SMBusIO,
} from "hmi/smbus";
import { integerInRange, type RGBColor } from "hmi/util";

export interface Angle8IOInstance extends SMBusInstance {
	readUint8(register: number): number;
	writeUint8(register: number, value: number): void;
	readBuffer(register: number, byteLength: number): ArrayBuffer;
	writeBuffer(register: number, buffer: ByteBuffer): void;
}

export type Angle8IO = SMBusIO<Angle8IOInstance>;

export interface Angle8State {
	/** Raw 12-bit ADC values for potentiometers 0 through 7. */
	angles: readonly number[];
	/** State of the physical toggle switch. */
	switchOn: boolean;
}

export interface Angle8Color extends RGBColor {
	brightness: number;
}

export type Angle8Resolution = 8 | 12;

export interface Angle8Options extends SMBusDeviceOptions<Angle8IO> {}

// https://docs.m5stack.com/en/unit/8Angle
export default class Angle8 extends SMBusDevice<Angle8IOInstance> {
	readonly leds = new LedCollection(
		Array.from(
			{ length: 9 },
			(_, index) =>
				new Led({
					write: (color, brightness) => {
						this.setLed(index, color, Math.round((brightness * 100) / 255));
					},
				}),
		),
	);

	static readonly DEFAULT_ADDRESS = 0x43;
	static readonly DEFAULT_HZ = 400_000;
	static readonly ANGLE_COUNT = 8;
	static readonly LED_COUNT = 9;
	static readonly SWITCH_LED = 8;

	static readonly REGISTER = {
		ANALOG_12BIT: 0x00,
		ANALOG_8BIT: 0x10,
		SWITCH: 0x20,
		RGB_LED: 0x30,
		FIRMWARE_VERSION: 0xfe,
		I2C_ADDRESS: 0xff,
	} as const;

	constructor(options: Angle8Options) {
		super(options, { address: Angle8.DEFAULT_ADDRESS, hz: Angle8.DEFAULT_HZ, name: "Angle8" });
		try {
			ownResource(this, this.leds);
			this.leds.color = { r: 0, g: 0, b: 0 };
			this.read();
		} catch (error) {
			this.close();
			throw error;
		}
	}

	sample(): Angle8State & { time: number } {
		assertOpen(this);
		return { ...this.read(), time: Date.now() };
	}

	read(): Angle8State {
		assertOpen(this);
		return {
			angles: this.readAngles(),
			switchOn: this.isSwitchOn(),
		};
	}

	readAngles(resolution: Angle8Resolution = 12): number[] {
		assertOpen(this);
		Angle8.#resolution(resolution);
		if (resolution === 8)
			return Array.from(new Uint8Array(busFor(this).readBuffer(Angle8.REGISTER.ANALOG_8BIT, Angle8.ANGLE_COUNT)));

		const data = new DataView(busFor(this).readBuffer(Angle8.REGISTER.ANALOG_12BIT, Angle8.ANGLE_COUNT * 2));
		const angles = new Array<number>(Angle8.ANGLE_COUNT);
		for (let angle = 0; angle < Angle8.ANGLE_COUNT; angle++) angles[angle] = data.getUint16(angle * 2, true) & 0x0fff;
		return angles;
	}

	readAngle(angle: number, resolution: Angle8Resolution = 12): number {
		assertOpen(this);
		const index = Angle8.#angleIndex(angle);
		Angle8.#resolution(resolution);
		if (resolution === 8) return busFor(this).readUint8(Angle8.REGISTER.ANALOG_8BIT + index) & 0xff;

		const data = new DataView(busFor(this).readBuffer(Angle8.REGISTER.ANALOG_12BIT + index * 2, 2));
		return data.getUint16(0, true) & 0x0fff;
	}

	isSwitchOn(): boolean {
		assertOpen(this);
		return busFor(this).readUint8(Angle8.REGISTER.SWITCH) !== 0;
	}

	setLed(led: number, color: RGBColor, brightness = 100): void {
		assertOpen(this);
		busFor(this).writeBuffer(
			Angle8.REGISTER.RGB_LED + Angle8.#ledIndex(led) * 4,
			Uint8Array.of(
				Angle8.#byte(color.r, "r"),
				Angle8.#byte(color.g, "g"),
				Angle8.#byte(color.b, "b"),
				integerInRange(brightness, "brightness", 0, 100),
			),
		);
	}

	getLed(led: number): Angle8Color {
		assertOpen(this);
		const data = new DataView(busFor(this).readBuffer(Angle8.REGISTER.RGB_LED + Angle8.#ledIndex(led) * 4, 4));
		return {
			r: data.getUint8(0),
			g: data.getUint8(1),
			b: data.getUint8(2),
			brightness: data.getUint8(3),
		};
	}

	getFirmwareVersion(): number {
		assertOpen(this);
		return busFor(this).readUint8(Angle8.REGISTER.FIRMWARE_VERSION) & 0xff;
	}

	getI2CAddress(): number {
		assertOpen(this);
		return readAddress(this, Angle8.REGISTER.I2C_ADDRESS);
	}

	setI2CAddress(address: number): void {
		assertOpen(this);
		changeAddress(this, Angle8.REGISTER.I2C_ADDRESS, address);
	}

	static #angleIndex(value: number): number {
		return integerInRange(value, "angle", 0, Angle8.ANGLE_COUNT - 1);
	}

	static #ledIndex(value: number): number {
		return integerInRange(value, "led", 0, Angle8.LED_COUNT - 1);
	}

	static #resolution(value: number): void {
		if (value !== 8 && value !== 12) throw new RangeError("resolution must be 8 or 12");
	}

	static #byte(value: number, name: string): number {
		return integerInRange(value, name, 0, 0xff);
	}
}
