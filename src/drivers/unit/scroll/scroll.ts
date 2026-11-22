import Led, { scaleColor } from "hmi/led";
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
import { integerInRange, type RGBColor, signed16 } from "hmi/util";

export interface ScrollIOInstance extends SMBusInstance {
	readUint8(register: number): number;
	writeUint8(register: number, value: number): void;
	readUint16(register: number, bigEndian?: boolean): number;
	writeUint16(register: number, value: number, bigEndian?: boolean): void;
	readBuffer(register: number, byteLength: number): ArrayBuffer;
	writeBuffer(register: number, buffer: ByteBuffer): void;
}

export type ScrollIO = SMBusIO<ScrollIOInstance>;

export interface ScrollState {
	value: number;
	pressed: boolean;
}

export interface ScrollOptions extends SMBusDeviceOptions<ScrollIO> {}

const REGISTER = {
	ENCODER: 0x10,
	BUTTON: 0x20,
	RGB_LED: 0x30,
	RESET: 0x40,
	INCREMENT: 0x50,
	BOOTLOADER_VERSION: 0xfc,
	JUMP_TO_BOOTLOADER: 0xfd,
	FIRMWARE_VERSION: 0xfe,
	I2C_ADDRESS: 0xff,
} as const;

// https://docs.m5stack.com/ja/unit/UNIT-Scroll
export default class Scroll extends SMBusDevice<ScrollIOInstance> {
	readonly led = new Led({ write: (color, brightness) => this.setLed(scaleColor(color, brightness)) });

	static readonly DEFAULT_ADDRESS = 0x40;
	static readonly DEFAULT_HZ = 400_000;

	constructor(options: ScrollOptions) {
		super(options, { address: Scroll.DEFAULT_ADDRESS, hz: Scroll.DEFAULT_HZ, name: "Scroll" });
		try {
			ownResource(this, this.led);
			this.resetEncoder();
			this.led.color = { r: 0, g: 0, b: 0 };
			this.read();
		} catch (error) {
			this.close();
			throw error;
		}
	}

	sample(): ScrollState & { time: number } {
		assertOpen(this);
		return { ...this.read(), time: Date.now() };
	}

	read(): ScrollState {
		assertOpen(this);
		return {
			value: this.readEncoder(),
			pressed: this.isButtonPressed(),
		};
	}

	readEncoder(): number {
		assertOpen(this);
		return signed16(busFor(this).readUint16(REGISTER.ENCODER, false));
	}

	readIncrement(): number {
		assertOpen(this);
		return signed16(busFor(this).readUint16(REGISTER.INCREMENT, false));
	}

	isButtonPressed(): boolean {
		assertOpen(this);
		return busFor(this).readUint8(REGISTER.BUTTON) === 0;
	}

	setEncoder(value: number): void {
		assertOpen(this);
		const encoder = integerInRange(value, "value", -0x8000, 0x7fff);
		busFor(this).writeUint16(REGISTER.ENCODER, encoder & 0xffff, false);
	}

	resetEncoder(): void {
		assertOpen(this);
		busFor(this).writeUint8(REGISTER.RESET, 1);
	}

	setLed(color: RGBColor): void {
		assertOpen(this);
		busFor(this).writeBuffer(
			REGISTER.RGB_LED,
			Uint8Array.of(
				0,
				integerInRange(color.r, "r", 0, 0xff),
				integerInRange(color.g, "g", 0, 0xff),
				integerInRange(color.b, "b", 0, 0xff),
			),
		);
	}

	getLed(): RGBColor {
		assertOpen(this);
		const data = new DataView(busFor(this).readBuffer(REGISTER.RGB_LED, 4));
		return { r: data.getUint8(1), g: data.getUint8(2), b: data.getUint8(3) };
	}

	getBootloaderVersion(): number {
		assertOpen(this);
		return busFor(this).readUint8(REGISTER.BOOTLOADER_VERSION) & 0xff;
	}

	getFirmwareVersion(): number {
		assertOpen(this);
		return busFor(this).readUint8(REGISTER.FIRMWARE_VERSION) & 0xff;
	}

	getI2CAddress(): number {
		assertOpen(this);
		return readAddress(this, REGISTER.I2C_ADDRESS);
	}

	setI2CAddress(address: number): void {
		assertOpen(this);
		changeAddress(this, REGISTER.I2C_ADDRESS, address);
	}

	enterBootloader(): void {
		assertOpen(this);
		busFor(this).writeUint8(REGISTER.JUMP_TO_BOOTLOADER, 1);
	}
}
