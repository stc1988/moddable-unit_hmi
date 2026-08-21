import type I2C from "embedded:io/i2c";
import SMBus from "embedded:io/smbus";
import EncoderInput, {
	type EncoderButtonChangeCallback as InputButtonChangeCallback,
	type EncoderChangeCallback as InputChangeCallback,
	type EncoderInputOptions,
} from "encoder/input";
import { SMBusDevice } from "hmi/smbus";
import { integerInRange, type RGBColor, signed16 } from "hmi/util";
import Timer from "timer";

type I2COptions = ConstructorParameters<typeof I2C>[0];
type SMBusOptions = I2COptions & { stop?: boolean };

export interface ScrollIOInstance {
	readUint8(register: number): number;
	writeUint8(register: number, value: number): void;
	readUint16(register: number, bigEndian?: boolean): number;
	writeUint16(register: number, value: number, bigEndian?: boolean): void;
	readBuffer(register: number, byteLength: number): ArrayBuffer;
	writeBuffer(register: number, buffer: ByteBuffer): void;
	close(): void;
}

export type ScrollIO = new (options: SMBusOptions) => ScrollIOInstance;

// @moddable/typings 8.3.1 declares the SMBus options as a tuple intersection.
// Narrow the constructor to the object accepted by the runtime implementation.
const SMBusConstructor = SMBus as unknown as ScrollIO;

export interface ScrollState {
	value: number;
	pressed: boolean;
}

export type ScrollColor = RGBColor;

export interface ScrollOptions extends EncoderInputOptions<ScrollState> {
	address?: number;
	data?: I2COptions["data"];
	clock?: I2COptions["clock"];
	hz?: number;
	io?: ScrollIO;
}

export type ScrollChangeCallback = InputChangeCallback<ScrollState>;
export type ScrollButtonChangeCallback = InputButtonChangeCallback;

// https://docs.m5stack.com/ja/unit/UNIT-Scroll
export default class Scroll extends SMBusDevice<ScrollIOInstance, SMBusOptions> {
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

	#address: number;
	#input: EncoderInput<ScrollState>;

	constructor(options: ScrollOptions = {}) {
		super(
			options.io ?? SMBusConstructor,
			{
				data: options.data ?? device.I2C.default.data,
				clock: options.clock ?? device.I2C.default.clock,
				hz: integerInRange(options.hz ?? Scroll.DEFAULT_HZ, "hz", 1, Number.MAX_SAFE_INTEGER),
			},
			integerInRange(options.address ?? Scroll.DEFAULT_ADDRESS, "address", 1, 0x7f),
			"scroll",
		);
		this.#address = integerInRange(options.address ?? Scroll.DEFAULT_ADDRESS, "address", 1, 0x7f);
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

	start(): void {
		this.#input.start();
	}

	stop(): void {
		this.#input.stop();
	}

	set pollingInterval(value: number) {
		this.#input.pollingInterval = value;
	}

	get pollingInterval(): number {
		return this.#input.pollingInterval;
	}

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

	read(): ScrollState {
		return {
			value: this.readEncoder(),
			pressed: this.isButtonPressed(),
		};
	}

	readEncoder(): number {
		return signed16(this.#activeBus.readUint16(Scroll.REGISTER.ENCODER, false));
	}

	readIncrement(): number {
		return signed16(this.#activeBus.readUint16(Scroll.REGISTER.INCREMENT, false));
	}

	isButtonPressed(): boolean {
		return this.#activeBus.readUint8(Scroll.REGISTER.BUTTON) === 0;
	}

	setEncoder(value: number): void {
		const encoder = integerInRange(value, "value", -0x8000, 0x7fff);
		this.#activeBus.writeUint16(Scroll.REGISTER.ENCODER, encoder & 0xffff, false);
	}

	resetEncoder(): void {
		this.#activeBus.writeUint8(Scroll.REGISTER.RESET, 1);
	}

	setLed(color: RGBColor): void {
		this.#activeBus.writeBuffer(
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
		const data = new Uint8Array(this.#activeBus.readBuffer(Scroll.REGISTER.RGB_LED, 4));
		return { r: data[1], g: data[2], b: data[3] };
	}

	getBootloaderVersion(): number {
		return this.#activeBus.readUint8(Scroll.REGISTER.BOOTLOADER_VERSION) & 0xff;
	}

	getFirmwareVersion(): number {
		return this.#activeBus.readUint8(Scroll.REGISTER.FIRMWARE_VERSION) & 0xff;
	}

	getI2CAddress(): number {
		return this.#activeBus.readUint8(Scroll.REGISTER.I2C_ADDRESS) & 0x7f;
	}

	setI2CAddress(address: number): void {
		const nextAddress = integerInRange(address, "address", 1, 0x7f);
		if (nextAddress === this.#address) return;

		this.#activeBus.writeUint8(Scroll.REGISTER.I2C_ADDRESS, nextAddress);
		this.reconnect(nextAddress);
		this.#address = nextAddress;
		Timer.delay(10);
	}

	enterBootloader(): void {
		this.stop();
		this.#activeBus.writeUint8(Scroll.REGISTER.JUMP_TO_BOOTLOADER, 1);
	}

	get #activeBus(): ScrollIOInstance {
		return this.activeBus;
	}
}
