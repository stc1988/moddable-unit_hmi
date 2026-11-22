import Led, { LedCollection, scaleColor } from "hmi/led";
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
import { integerInRange, type RGBColor, signed32, signed32ToLittleEndian } from "hmi/util";

export interface Encoder8IOInstance extends SMBusInstance {
	readUint8(register: number): number;
	writeUint8(register: number, value: number): void;
	readBuffer(register: number, byteLength: number): ArrayBuffer;
	writeBuffer(register: number, buffer: ByteBuffer): void;
}

export type Encoder8IO = SMBusIO<Encoder8IOInstance>;

export interface Encoder8State {
	/** Signed counter values for encoders 0 through 7. */
	encoders: readonly number[];
	/** Bit n is 1 while encoder button n is pressed. */
	buttons: number;
	/** State of the physical toggle switch. */
	switchOn: boolean;
}

export interface Encoder8Options extends SMBusDeviceOptions<Encoder8IO> {}

// https://docs.m5stack.com/en/unit/8Encoder
export default class Encoder8 extends SMBusDevice<Encoder8IOInstance> {
	readonly leds = new LedCollection(
		Array.from(
			{ length: 9 },
			(_, index) =>
				new Led({
					write: (color, brightness) => {
						this.setLed(index, scaleColor(color, brightness));
					},
				}),
		),
	);

	static readonly DEFAULT_ADDRESS = 0x41;
	static readonly DEFAULT_HZ = 100_000;
	static readonly ENCODER_COUNT = 8;
	static readonly BUTTON_COUNT = 8;
	static readonly LED_COUNT = 9;
	static readonly SWITCH_LED = 8;

	static readonly REGISTER = {
		ENCODER: 0x00,
		INCREMENT: 0x20,
		RESET_COUNTER: 0x40,
		BUTTON: 0x50,
		BUTTON_TOGGLE_COUNT: 0x58,
		SWITCH: 0x60,
		ENCODER_CHANGE_FLAGS: 0x61,
		BUTTONS: 0x62,
		RGB_LED: 0x70,
		FIRMWARE_VERSION: 0xfe,
		I2C_ADDRESS: 0xff,
	} as const;

	constructor(options: Encoder8Options) {
		super(options, { address: Encoder8.DEFAULT_ADDRESS, hz: Encoder8.DEFAULT_HZ, name: "Encoder8" });
		try {
			ownResource(this, this.leds);
			this.resetEncoders();
			this.leds.color = { r: 0, g: 0, b: 0 };
			this.read();
		} catch (error) {
			this.close();
			throw error;
		}
	}

	sample(): Encoder8State & { time: number } {
		assertOpen(this);
		return { ...this.read(), time: Date.now() };
	}

	read(): Encoder8State {
		assertOpen(this);
		return {
			encoders: this.readEncoders(),
			buttons: this.readButtons(),
			switchOn: this.isSwitchOn(),
		};
	}

	readEncoders(): number[] {
		assertOpen(this);
		return Encoder8.#readSignedValues(busFor(this).readBuffer(Encoder8.REGISTER.ENCODER, Encoder8.ENCODER_COUNT * 4));
	}

	readEncoder(encoder: number): number {
		assertOpen(this);
		const data = busFor(this).readBuffer(Encoder8.REGISTER.ENCODER + Encoder8.#encoderIndex(encoder) * 4, 4);
		return signed32(new DataView(data), 0);
	}

	setEncoder(encoder: number, value: number): void {
		assertOpen(this);
		busFor(this).writeBuffer(
			Encoder8.REGISTER.ENCODER + Encoder8.#encoderIndex(encoder) * 4,
			signed32ToLittleEndian(value, "value"),
		);
	}

	readIncrements(): number[] {
		assertOpen(this);
		return Encoder8.#readSignedValues(busFor(this).readBuffer(Encoder8.REGISTER.INCREMENT, Encoder8.ENCODER_COUNT * 4));
	}

	readIncrement(encoder: number): number {
		assertOpen(this);
		const data = busFor(this).readBuffer(Encoder8.REGISTER.INCREMENT + Encoder8.#encoderIndex(encoder) * 4, 4);
		return signed32(new DataView(data), 0);
	}

	readEncoderChangeFlags(): number {
		assertOpen(this);
		return busFor(this).readUint8(Encoder8.REGISTER.ENCODER_CHANGE_FLAGS) & 0xff;
	}

	resetEncoder(encoder: number): void {
		assertOpen(this);
		busFor(this).writeUint8(Encoder8.REGISTER.RESET_COUNTER + Encoder8.#encoderIndex(encoder), 1);
	}

	resetEncoders(): void {
		assertOpen(this);
		busFor(this).writeBuffer(Encoder8.REGISTER.RESET_COUNTER, Uint8Array.of(1, 1, 1, 1, 1, 1, 1, 1));
	}

	readButtons(): number {
		assertOpen(this);
		return ~busFor(this).readUint8(Encoder8.REGISTER.BUTTONS) & 0xff;
	}

	isButtonPressed(button: number): boolean {
		assertOpen(this);
		return busFor(this).readUint8(Encoder8.REGISTER.BUTTON + Encoder8.#buttonIndex(button)) === 0;
	}

	readButtonToggleCounts(): number[] {
		assertOpen(this);
		return Array.from(
			new Uint8Array(busFor(this).readBuffer(Encoder8.REGISTER.BUTTON_TOGGLE_COUNT, Encoder8.BUTTON_COUNT)),
		);
	}

	isSwitchOn(): boolean {
		assertOpen(this);
		return busFor(this).readUint8(Encoder8.REGISTER.SWITCH) !== 0;
	}

	setLed(led: number, color: RGBColor): void {
		assertOpen(this);
		busFor(this).writeBuffer(
			Encoder8.REGISTER.RGB_LED + Encoder8.#ledIndex(led) * 3,
			Uint8Array.of(Encoder8.#byte(color.r, "r"), Encoder8.#byte(color.g, "g"), Encoder8.#byte(color.b, "b")),
		);
	}

	getLed(led: number): RGBColor {
		assertOpen(this);
		const data = new DataView(busFor(this).readBuffer(Encoder8.REGISTER.RGB_LED + Encoder8.#ledIndex(led) * 3, 3));
		return { r: data.getUint8(0), g: data.getUint8(1), b: data.getUint8(2) };
	}

	setAllLeds(color: RGBColor): void {
		assertOpen(this);
		const red = Encoder8.#byte(color.r, "r");
		const green = Encoder8.#byte(color.g, "g");
		const blue = Encoder8.#byte(color.b, "b");
		const data = new Uint8Array(Encoder8.LED_COUNT * 3);
		for (let offset = 0; offset < data.length; offset += 3) {
			data[offset] = red;
			data[offset + 1] = green;
			data[offset + 2] = blue;
		}
		busFor(this).writeBuffer(Encoder8.REGISTER.RGB_LED, data);
	}

	getFirmwareVersion(): number {
		assertOpen(this);
		return busFor(this).readUint8(Encoder8.REGISTER.FIRMWARE_VERSION) & 0xff;
	}

	getI2CAddress(): number {
		assertOpen(this);
		return readAddress(this, Encoder8.REGISTER.I2C_ADDRESS);
	}

	setI2CAddress(address: number): void {
		assertOpen(this);
		changeAddress(this, Encoder8.REGISTER.I2C_ADDRESS, address);
	}

	static #readSignedValues(buffer: ArrayBuffer): number[] {
		const data = new DataView(buffer);
		const values = new Array<number>(Encoder8.ENCODER_COUNT);
		for (let encoder = 0; encoder < Encoder8.ENCODER_COUNT; encoder++) values[encoder] = signed32(data, encoder * 4);
		return values;
	}

	static #encoderIndex(value: number): number {
		return integerInRange(value, "encoder", 0, Encoder8.ENCODER_COUNT - 1);
	}

	static #buttonIndex(value: number): number {
		return integerInRange(value, "button", 0, Encoder8.BUTTON_COUNT - 1);
	}

	static #ledIndex(value: number): number {
		return integerInRange(value, "led", 0, Encoder8.LED_COUNT - 1);
	}

	static #byte(value: number, name: string): number {
		return integerInRange(value, name, 0, 0xff);
	}
}
