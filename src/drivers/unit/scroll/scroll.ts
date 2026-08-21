import type I2C from "embedded:io/i2c";
import SMBus from "embedded:io/smbus";
import PollingInput from "input/polling";
import Timer from "timer";
import { callbackOrNull, integerInRange, signed16 } from "hmi/util";

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

export interface ScrollColor {
	r: number;
	g: number;
	b: number;
}

export interface ScrollOptions {
	address?: number;
	data?: I2COptions["data"];
	clock?: I2COptions["clock"];
	hz?: number;
	io?: ScrollIO;
	pollingInterval?: number;
	onChange?: ScrollChangeCallback;
	onButtonChange?: ScrollButtonChangeCallback;
}

export type ScrollChangeCallback = (state: ScrollState) => void;
export type ScrollButtonChangeCallback = (pressed: boolean) => void;

// https://docs.m5stack.com/ja/unit/UNIT-Scroll
export default class Scroll {
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

	#bus?: ScrollIOInstance;
	#io: ScrollIO;
	#busOptions: Omit<SMBusOptions, "address">;
	#address: number;
	#polling: PollingInput<ScrollState>;
	#onChange: ScrollChangeCallback | null;
	#onButtonChange: ScrollButtonChangeCallback | null;
	#lastButtonState?: boolean;
	#closed = false;

	constructor(options: ScrollOptions = {}) {
		this.#address = integerInRange(options.address ?? Scroll.DEFAULT_ADDRESS, "address", 1, 0x7f);
		this.#io = options.io ?? SMBusConstructor;
		this.#busOptions = {
			data: options.data ?? device.I2C.default.data,
			clock: options.clock ?? device.I2C.default.clock,
			hz: integerInRange(options.hz ?? Scroll.DEFAULT_HZ, "hz", 1, Number.MAX_SAFE_INTEGER),
		};
		this.#onChange = callbackOrNull(options.onChange, "onChange");
		this.#onButtonChange = callbackOrNull(options.onButtonChange, "onButtonChange");
		this.#bus = this.#openBus(this.#address);
		try {
			this.#polling = new PollingInput(this, this, "Scroll", {
				pollingInterval: options.pollingInterval,
				changed: (state, previous) => state.value !== previous.value || state.pressed !== previous.pressed,
			});
			this.#updatePollingState();
		} catch (error) {
			this.#bus.close();
			this.#bus = undefined;
			throw error;
		}
	}

	close(): void {
		if (this.#closed) return;
		this.#polling.close();
		this.#closed = true;
		this.#onChange = null;
		this.#onButtonChange = null;
		this.#bus?.close();
		this.#bus = undefined;
	}

	start(): void {
		const wasRunning = this.#polling.running;
		this.#polling.start();
		if (!wasRunning) this.#lastButtonState = undefined;
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

	set onChange(callback: ScrollChangeCallback | null | undefined) {
		const next = callbackOrNull(callback, "onChange");
		if (this.#closed && next) throw new Error("scroll is closed");
		if (next !== this.#onChange) this.#polling.onChange = null;
		this.#onChange = next;
		this.#updatePollingState();
	}

	get onChange(): ScrollChangeCallback | null {
		return this.#onChange;
	}

	set onButtonChange(callback: ScrollButtonChangeCallback | null | undefined) {
		const next = callbackOrNull(callback, "onButtonChange");
		if (this.#closed && next) throw new Error("scroll is closed");
		this.#onButtonChange = next;
		this.#updatePollingState();
	}

	get onButtonChange(): ScrollButtonChangeCallback | null {
		return this.#onButtonChange;
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

	setLed(r: number, g: number, b: number): void {
		this.#activeBus.writeBuffer(
			Scroll.REGISTER.RGB_LED,
			Uint8Array.of(
				0,
				integerInRange(r, "r", 0, 0xff),
				integerInRange(g, "g", 0, 0xff),
				integerInRange(b, "b", 0, 0xff),
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
		this.#activeBus.close();
		this.#address = nextAddress;
		this.#bus = this.#openBus(nextAddress);
		Timer.delay(10);
	}

	enterBootloader(): void {
		this.stop();
		this.#activeBus.writeUint8(Scroll.REGISTER.JUMP_TO_BOOTLOADER, 1);
	}

	#updatePollingState(): void {
		const callback = this.#onChange || this.#onButtonChange ? this.#handleChange : null;
		if (callback && !this.#polling.onChange) this.#lastButtonState = undefined;
		this.#polling.onChange = callback;
	}

	#handleChange(state: ScrollState): void {
		const buttonChanged = this.#lastButtonState !== undefined && state.pressed !== this.#lastButtonState;
		this.#onChange?.call(this, state);
		if (buttonChanged) this.#onButtonChange?.call(this, state.pressed);
		this.#lastButtonState = state.pressed;
	}

	#openBus(address: number): ScrollIOInstance {
		return new this.#io({
			...this.#busOptions,
			address,
		});
	}

	get #activeBus(): ScrollIOInstance {
		if (!this.#bus) throw new Error("scroll is closed");
		return this.#bus;
	}
}
