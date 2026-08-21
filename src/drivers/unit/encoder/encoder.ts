import EncoderInput, {
	type EncoderButtonChangeCallback as InputButtonChangeCallback,
	type EncoderChangeCallback as InputChangeCallback,
	type EncoderInputOptions,
} from "encoder/input";
import { SMBusDevice, type SMBusDeviceOptions, type SMBusIO, type SMBusInstance } from "hmi/smbus";
import { integerInRange, type RGBColor, signed16 } from "hmi/util";

export interface EncoderIOInstance extends SMBusInstance {
	readUint8(register: number): number;
	writeUint8(register: number, value: number): void;
	readUint16(register: number, bigEndian?: boolean): number;
	writeUint16(register: number, value: number, bigEndian?: boolean): void;
	writeBuffer(register: number, buffer: ByteBuffer): void;
}

export type EncoderIO = SMBusIO<EncoderIOInstance>;

export interface EncoderState {
	/** Signed 16-bit accumulated encoder value. */
	value: number;
	/** True while the encoder knob is pressed. */
	pressed: boolean;
}

export type EncoderMode = 0 | 1;

export interface EncoderOptions extends EncoderInputOptions<EncoderState>, SMBusDeviceOptions<EncoderIO> {}

export type EncoderChangeCallback = InputChangeCallback<EncoderState>;
export type EncoderButtonChangeCallback = InputButtonChangeCallback;

// https://docs.m5stack.com/en/unit/encoder
export default class Encoder extends SMBusDevice<EncoderIOInstance> {
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

	readonly input: EncoderInput<EncoderState>;

	constructor(options: EncoderOptions = {}) {
		super(options, { address: Encoder.DEFAULT_ADDRESS, hz: Encoder.DEFAULT_HZ, name: "encoder" });
		try {
			this.input = new EncoderInput(this, this, "Encoder", options);
		} catch (error) {
			super.close();
			throw error;
		}
	}

	close(): void {
		this.input.close();
		super.close();
	}

	read(): EncoderState {
		return {
			value: this.readEncoder(),
			pressed: this.isButtonPressed(),
		};
	}

	readEncoder(): number {
		return signed16(this.activeBus.readUint16(Encoder.REGISTER.ENCODER, false));
	}

	setEncoder(value: number): void {
		const encoder = integerInRange(value, "value", -0x8000, 0x7fff);
		this.activeBus.writeUint16(Encoder.REGISTER.ENCODER, encoder & 0xffff, false);
	}

	resetEncoder(): void {
		this.activeBus.writeUint8(Encoder.REGISTER.RESET, 1);
	}

	isButtonPressed(): boolean {
		return this.activeBus.readUint8(Encoder.REGISTER.BUTTON) !== 0;
	}

	setMode(mode: EncoderMode): void {
		this.activeBus.writeUint8(Encoder.REGISTER.MODE, integerInRange(mode, "mode", 0, 1));
	}

	setLed(led: number, color: RGBColor): void {
		this.#writeLed(integerInRange(led, "led", 0, Encoder.LED_COUNT - 1) + 1, color);
	}

	setAllLeds(color: RGBColor): void {
		this.#writeLed(0, color);
	}

	#writeLed(index: number, color: RGBColor): void {
		this.activeBus.writeBuffer(
			Encoder.REGISTER.RGB_LED,
			Uint8Array.of(
				index,
				integerInRange(color.r, "r", 0, 0xff),
				integerInRange(color.g, "g", 0, 0xff),
				integerInRange(color.b, "b", 0, 0xff),
			),
		);
	}
}
