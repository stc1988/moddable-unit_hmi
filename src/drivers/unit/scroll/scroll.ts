import EncoderInput, {
	type EncoderButtonChangeCallback as InputButtonChangeCallback,
	type EncoderChangeCallback as InputChangeCallback,
	type EncoderInputOptions,
} from "encoder/input";
import { SMBusDevice, type SMBusDeviceOptions, type SMBusIO, type SMBusInstance } from "hmi/smbus";
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

export type ScrollColor = RGBColor;

export interface ScrollOptions extends EncoderInputOptions<ScrollState>, SMBusDeviceOptions<ScrollIO> {}

export type ScrollChangeCallback = InputChangeCallback<ScrollState>;
export type ScrollButtonChangeCallback = InputButtonChangeCallback;

// https://docs.m5stack.com/ja/unit/UNIT-Scroll
export default class Scroll extends SMBusDevice<ScrollIOInstance> {
	static readonly DEFAULT_ADDRESS = 0x40;
	static readonly DEFAULT_HZ = 400_000;

	static readonly REGISTER = {
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

	readonly input: EncoderInput<ScrollState>;

	constructor(options: ScrollOptions = {}) {
		super(options, { address: Scroll.DEFAULT_ADDRESS, hz: Scroll.DEFAULT_HZ, name: "scroll" });
		try {
			this.input = new EncoderInput(this, this, "Scroll", options);
		} catch (error) {
			super.close();
			throw error;
		}
	}

	close(): void {
		this.input.close();
		super.close();
	}

	read(): ScrollState {
		return {
			value: this.readEncoder(),
			pressed: this.isButtonPressed(),
		};
	}

	readEncoder(): number {
		return signed16(this.activeBus.readUint16(Scroll.REGISTER.ENCODER, false));
	}

	readIncrement(): number {
		return signed16(this.activeBus.readUint16(Scroll.REGISTER.INCREMENT, false));
	}

	isButtonPressed(): boolean {
		return this.activeBus.readUint8(Scroll.REGISTER.BUTTON) === 0;
	}

	setEncoder(value: number): void {
		const encoder = integerInRange(value, "value", -0x8000, 0x7fff);
		this.activeBus.writeUint16(Scroll.REGISTER.ENCODER, encoder & 0xffff, false);
	}

	resetEncoder(): void {
		this.activeBus.writeUint8(Scroll.REGISTER.RESET, 1);
	}

	setLed(color: RGBColor): void {
		this.activeBus.writeBuffer(
			Scroll.REGISTER.RGB_LED,
			Uint8Array.of(
				0,
				integerInRange(color.r, "r", 0, 0xff),
				integerInRange(color.g, "g", 0, 0xff),
				integerInRange(color.b, "b", 0, 0xff),
			),
		);
	}

	getLed(): ScrollColor {
		const data = new Uint8Array(this.activeBus.readBuffer(Scroll.REGISTER.RGB_LED, 4));
		return { r: data[1], g: data[2], b: data[3] };
	}

	getBootloaderVersion(): number {
		return this.activeBus.readUint8(Scroll.REGISTER.BOOTLOADER_VERSION) & 0xff;
	}

	getFirmwareVersion(): number {
		return this.activeBus.readUint8(Scroll.REGISTER.FIRMWARE_VERSION) & 0xff;
	}

	getI2CAddress(): number {
		return this.readAddress(Scroll.REGISTER.I2C_ADDRESS);
	}

	setI2CAddress(address: number): void {
		this.changeAddress(Scroll.REGISTER.I2C_ADDRESS, address);
	}

	enterBootloader(): void {
		this.input.stop();
		this.activeBus.writeUint8(Scroll.REGISTER.JUMP_TO_BOOTLOADER, 1);
	}
}
