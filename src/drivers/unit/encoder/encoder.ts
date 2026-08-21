import type I2C from "embedded:io/i2c";
import SMBus from "embedded:io/smbus";
import PollingInput from "hmi/polling";
import { SMBusDevice } from "hmi/smbus";
import { callbackOrNull, integerInRange, type RGBColor, signed16 } from "hmi/util";

type I2COptions = ConstructorParameters<typeof I2C>[0];
type SMBusOptions = I2COptions & { stop?: boolean };

export interface EncoderIOInstance {
	readUint8(register: number): number;
	writeUint8(register: number, value: number): void;
	readUint16(register: number, bigEndian?: boolean): number;
	writeUint16(register: number, value: number, bigEndian?: boolean): void;
	writeBuffer(register: number, buffer: ByteBuffer): void;
	close(): void;
}

export type EncoderIO = new (options: SMBusOptions) => EncoderIOInstance;

// @moddable/typings 8.3.1 declares the SMBus options as a tuple intersection.
// Narrow the constructor to the object accepted by the runtime implementation.
const SMBusConstructor = SMBus as unknown as EncoderIO;

export interface EncoderState {
	/** Signed 16-bit accumulated encoder value. */
	value: number;
	/** True while the encoder knob is pressed. */
	pressed: boolean;
}

export type EncoderMode = 0 | 1;

export interface EncoderOptions {
	address?: number;
	data?: I2COptions["data"];
	clock?: I2COptions["clock"];
	hz?: number;
	io?: EncoderIO;
	pollingInterval?: number;
	onChange?: EncoderChangeCallback;
	onButtonChange?: EncoderButtonChangeCallback;
}

export type EncoderChangeCallback = (state: EncoderState) => void;
export type EncoderButtonChangeCallback = (pressed: boolean) => void;

// https://docs.m5stack.com/en/unit/encoder
export default class Encoder extends SMBusDevice<EncoderIOInstance, SMBusOptions> {
	static readonly DEFAULT_ADDRESS = 0x40;
	static readonly DEFAULT_HZ = 200_000;
	static readonly LED_COUNT = 2;

	static readonly MODE = {
		PULSE: 0,
		AB: 1,
	} as const;

	static readonly REGISTER = {
		MODE: 0x00,
		ENCODER: 0x10,
		BUTTON: 0x20,
		RGB_LED: 0x30,
		RESET: 0x40,
	} as const;

	#polling: PollingInput<EncoderState>;
	#onChange: EncoderChangeCallback | null;
	#onButtonChange: EncoderButtonChangeCallback | null;
	#lastButtonState?: boolean;
	#closed = false;

	constructor(options: EncoderOptions = {}) {
		super(
			options.io ?? SMBusConstructor,
			{
				data: options.data ?? device.I2C.default.data,
				clock: options.clock ?? device.I2C.default.clock,
				hz: integerInRange(options.hz ?? Encoder.DEFAULT_HZ, "hz", 1, Number.MAX_SAFE_INTEGER),
			},
			integerInRange(options.address ?? Encoder.DEFAULT_ADDRESS, "address", 1, 0x7f),
			"encoder",
		);
		this.#onChange = callbackOrNull(options.onChange, "onChange");
		this.#onButtonChange = callbackOrNull(options.onButtonChange, "onButtonChange");
		try {
			this.#polling = new PollingInput(this, this, "Encoder", {
				pollingInterval: options.pollingInterval,
				changed: (state, previous) => state.value !== previous.value || state.pressed !== previous.pressed,
			});
			this.#updatePollingState();
		} catch (error) {
			super.close();
			throw error;
		}
	}

	close(): void {
		if (this.#closed) return;
		this.#polling.close();
		this.#closed = true;
		this.#onChange = null;
		this.#onButtonChange = null;
		this.#lastButtonState = undefined;
		super.close();
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

	set onChange(callback: EncoderChangeCallback | null | undefined) {
		const next = callbackOrNull(callback, "onChange");
		if (this.#closed && next) throw new Error("encoder is closed");
		if (next !== this.#onChange) this.#polling.onChange = null;
		this.#onChange = next;
		this.#updatePollingState();
	}

	get onChange(): EncoderChangeCallback | null {
		return this.#onChange;
	}

	set onButtonChange(callback: EncoderButtonChangeCallback | null | undefined) {
		const next = callbackOrNull(callback, "onButtonChange");
		if (this.#closed && next) throw new Error("encoder is closed");
		this.#onButtonChange = next;
		this.#updatePollingState();
	}

	get onButtonChange(): EncoderButtonChangeCallback | null {
		return this.#onButtonChange;
	}

	read(): EncoderState {
		return {
			value: this.readEncoder(),
			pressed: this.isButtonPressed(),
		};
	}

	readEncoder(): number {
		return signed16(this.#activeBus.readUint16(Encoder.REGISTER.ENCODER, false));
	}

	setEncoder(value: number): void {
		const encoder = integerInRange(value, "value", -0x8000, 0x7fff);
		this.#activeBus.writeUint16(Encoder.REGISTER.ENCODER, encoder & 0xffff, false);
	}

	resetEncoder(): void {
		this.#activeBus.writeUint8(Encoder.REGISTER.RESET, 1);
	}

	isButtonPressed(): boolean {
		return this.#activeBus.readUint8(Encoder.REGISTER.BUTTON) !== 0;
	}

	setMode(mode: EncoderMode): void {
		this.#activeBus.writeUint8(Encoder.REGISTER.MODE, integerInRange(mode, "mode", 0, 1));
	}

	setLed(led: number, color: RGBColor): void {
		this.#writeLed(integerInRange(led, "led", 0, Encoder.LED_COUNT - 1) + 1, color);
	}

	setAllLeds(color: RGBColor): void {
		this.#writeLed(0, color);
	}

	#writeLed(index: number, color: RGBColor): void {
		this.#activeBus.writeBuffer(
			Encoder.REGISTER.RGB_LED,
			Uint8Array.of(
				index,
				integerInRange(color.r, "r", 0, 0xff),
				integerInRange(color.g, "g", 0, 0xff),
				integerInRange(color.b, "b", 0, 0xff),
			),
		);
	}

	#updatePollingState(): void {
		const callback = this.#onChange || this.#onButtonChange ? this.#handleChange : null;
		if (callback && !this.#polling.onChange) this.#lastButtonState = undefined;
		this.#polling.onChange = callback;
	}

	#handleChange(state: EncoderState): void {
		const buttonChanged = this.#lastButtonState !== undefined && state.pressed !== this.#lastButtonState;
		this.#onChange?.call(this, state);
		if (buttonChanged) this.#onButtonChange?.call(this, state.pressed);
		this.#lastButtonState = state.pressed;
	}

	get #activeBus(): EncoderIOInstance {
		return this.activeBus;
	}
}
