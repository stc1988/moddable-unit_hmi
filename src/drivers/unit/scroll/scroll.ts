import EncoderInput, {
	type EncoderInputOptions,
	type EncoderButtonChangeCallback as InputButtonChangeCallback,
	type EncoderChangeCallback as InputChangeCallback,
} from "hmi/input/encoder";
import { SMBusDevice, type SMBusDeviceOptions, type SMBusInstance, type SMBusIO } from "hmi/smbus";
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

export interface ScrollOptions extends EncoderInputOptions<ScrollState>, SMBusDeviceOptions<ScrollIO> {}

export type ScrollChangeCallback = InputChangeCallback<ScrollState>;
export type ScrollButtonChangeCallback = InputButtonChangeCallback;

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
	static readonly DEFAULT_ADDRESS = 0x40;
	static readonly DEFAULT_HZ = 400_000;

	#input: EncoderInput<ScrollState>;

	set onChange(callback: ScrollChangeCallback | null | undefined) {
		this.#input.onChange = callback;
	}
	get onChange(): ScrollChangeCallback | null {
		return this.#input.onChange;
	}
	set onButtonChange(callback: ScrollButtonChangeCallback | null | undefined) {
		this.#input.onButtonChange = callback;
	}
	get onButtonChange(): ScrollButtonChangeCallback | null {
		return this.#input.onButtonChange;
	}
	set pollingInterval(value: number) {
		this.#input.pollingInterval = value;
	}
	get pollingInterval(): number {
		return this.#input.pollingInterval;
	}
	start(): void {
		this.#input.start();
	}
	stop(): void {
		this.#input.stop();
	}

	constructor(options: ScrollOptions = {}) {
		super(options, { address: Scroll.DEFAULT_ADDRESS, hz: Scroll.DEFAULT_HZ, name: "scroll" });
		try {
			this.#input = new EncoderInput(this, this, "Scroll", options);
		} catch (error) {
			super.close();
			throw error;
		}
	}

	close(): void {
		this.#input.close();
		super.close();
	}

	read(): ScrollState {
		return {
			value: this.readEncoder(),
			pressed: this.isButtonPressed(),
		};
	}

	readEncoder(): number {
		return signed16(this.activeBus.readUint16(REGISTER.ENCODER, false));
	}

	readIncrement(): number {
		return signed16(this.activeBus.readUint16(REGISTER.INCREMENT, false));
	}

	isButtonPressed(): boolean {
		return this.activeBus.readUint8(REGISTER.BUTTON) === 0;
	}

	setEncoder(value: number): void {
		const encoder = integerInRange(value, "value", -0x8000, 0x7fff);
		this.activeBus.writeUint16(REGISTER.ENCODER, encoder & 0xffff, false);
	}

	resetEncoder(): void {
		this.activeBus.writeUint8(REGISTER.RESET, 1);
	}

	setLed(color: RGBColor): void {
		this.activeBus.writeBuffer(
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
		const data = new Uint8Array(this.activeBus.readBuffer(REGISTER.RGB_LED, 4));
		return { r: data[1], g: data[2], b: data[3] };
	}

	getBootloaderVersion(): number {
		return this.activeBus.readUint8(REGISTER.BOOTLOADER_VERSION) & 0xff;
	}

	getFirmwareVersion(): number {
		return this.activeBus.readUint8(REGISTER.FIRMWARE_VERSION) & 0xff;
	}

	getI2CAddress(): number {
		return this.readAddress(REGISTER.I2C_ADDRESS);
	}

	setI2CAddress(address: number): void {
		this.changeAddress(REGISTER.I2C_ADDRESS, address);
	}

	enterBootloader(): void {
		this.#input.stop();
		this.activeBus.writeUint8(REGISTER.JUMP_TO_BOOTLOADER, 1);
	}
}
