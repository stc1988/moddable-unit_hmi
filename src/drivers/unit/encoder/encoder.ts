import Led, { LedCollection, scaleColor } from "hmi/led";
import { assertOpen, ownResource } from "hmi/peripheral";
import { busFor, SMBusDevice, type SMBusDeviceOptions, type SMBusInstance, type SMBusIO } from "hmi/smbus";
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

export interface EncoderOptions extends SMBusDeviceOptions<EncoderIO> {}

// https://docs.m5stack.com/en/unit/encoder
export default class Encoder extends SMBusDevice<EncoderIOInstance> {
	readonly leds = new LedCollection(
		Array.from(
			{ length: 2 },
			(_, index) =>
				new Led({
					write: (color, brightness) => {
						this.setLed(index, scaleColor(color, brightness));
					},
				}),
		),
	);

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

	#mode: EncoderMode = 0;
	configure(options: { mode?: EncoderMode }): void {
		super.configure(options);
		if ("mode" in options) {
			const mode = integerInRange(options.mode as number, "mode", 0, 1) as EncoderMode;
			busFor(this).writeUint8(Encoder.REGISTER.MODE, mode);
			this.#mode = mode;
		}
	}
	get configuration(): { interrupt: boolean; mode: EncoderMode } {
		return { ...super.configuration, mode: this.#mode };
	}

	constructor(options: EncoderOptions) {
		super(options, { address: Encoder.DEFAULT_ADDRESS, hz: Encoder.DEFAULT_HZ, name: "Encoder" });
		try {
			ownResource(this, this.leds);
			this.configure({ mode: 0 });
			this.resetEncoder();
			this.leds.color = { r: 0, g: 0, b: 0 };
			this.read();
		} catch (error) {
			this.close();
			throw error;
		}
	}

	sample(): EncoderState & { time: number } {
		assertOpen(this);
		return { ...this.read(), time: Date.now() };
	}

	read(): EncoderState {
		assertOpen(this);
		return {
			value: this.readEncoder(),
			pressed: this.isButtonPressed(),
		};
	}

	readEncoder(): number {
		assertOpen(this);
		return signed16(busFor(this).readUint16(Encoder.REGISTER.ENCODER, false));
	}

	setEncoder(value: number): void {
		assertOpen(this);
		const encoder = integerInRange(value, "value", -0x8000, 0x7fff);
		busFor(this).writeUint16(Encoder.REGISTER.ENCODER, encoder & 0xffff, false);
	}

	resetEncoder(): void {
		assertOpen(this);
		busFor(this).writeUint8(Encoder.REGISTER.RESET, 1);
	}

	isButtonPressed(): boolean {
		assertOpen(this);
		return busFor(this).readUint8(Encoder.REGISTER.BUTTON) !== 0;
	}

	setMode(mode: EncoderMode): void {
		assertOpen(this);
		this.configure({ mode });
	}

	setLed(led: number, color: RGBColor): void {
		assertOpen(this);
		this.#writeLed(integerInRange(led, "led", 0, Encoder.LED_COUNT - 1) + 1, color);
	}

	setAllLeds(color: RGBColor): void {
		assertOpen(this);
		this.#writeLed(0, color);
	}

	#writeLed(index: number, color: RGBColor): void {
		busFor(this).writeBuffer(
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
