import { SMBusDevice, type SMBusDeviceOptions, type SMBusIO, type SMBusInstance } from "hmi/smbus";
import { integerInRange, type RGBColor, signed32, signed32ToLittleEndian } from "hmi/util";
import Encoder8Input from "unit/8encoder/input";

export { Encoder8Input };

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

export type Encoder8Color = RGBColor;

export interface Encoder8Options extends SMBusDeviceOptions<Encoder8IO> {
	pollingInterval?: number;
	onChange?: Encoder8ChangeCallback;
	onEncoderChange?: Encoder8EncoderChangeCallback;
	onButtonChange?: Encoder8ButtonChangeCallback;
	onSwitchChange?: Encoder8SwitchChangeCallback;
}

export type Encoder8ChangeCallback = (state: Encoder8State) => void;
export type Encoder8EncoderChangeCallback = (encoder: number, value: number) => void;
export type Encoder8ButtonChangeCallback = (button: number, pressed: boolean) => void;
export type Encoder8SwitchChangeCallback = (on: boolean) => void;

// https://docs.m5stack.com/en/unit/8Encoder
export default class Encoder8 extends SMBusDevice<Encoder8IOInstance> {
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

	readonly input: Encoder8Input;

	constructor(options: Encoder8Options = {}) {
		super(options, { address: Encoder8.DEFAULT_ADDRESS, hz: Encoder8.DEFAULT_HZ, name: "8encoder" });
		try {
			this.input = new Encoder8Input(this, this, options);
		} catch (error) {
			super.close();
			throw error;
		}
	}

	close(): void {
		this.input.close();
		super.close();
	}

	read(): Encoder8State {
		return {
			encoders: this.readEncoders(),
			buttons: this.readButtons(),
			switchOn: this.isSwitchOn(),
		};
	}

	readEncoders(): number[] {
		return Encoder8.#readSignedValues(this.activeBus.readBuffer(Encoder8.REGISTER.ENCODER, Encoder8.ENCODER_COUNT * 4));
	}

	readEncoder(encoder: number): number {
		const data = this.activeBus.readBuffer(Encoder8.REGISTER.ENCODER + Encoder8.#encoderIndex(encoder) * 4, 4);
		return signed32(new Uint8Array(data), 0);
	}

	setEncoder(encoder: number, value: number): void {
		this.activeBus.writeBuffer(
			Encoder8.REGISTER.ENCODER + Encoder8.#encoderIndex(encoder) * 4,
			signed32ToLittleEndian(value, "value"),
		);
	}

	readIncrements(): number[] {
		return Encoder8.#readSignedValues(
			this.activeBus.readBuffer(Encoder8.REGISTER.INCREMENT, Encoder8.ENCODER_COUNT * 4),
		);
	}

	readIncrement(encoder: number): number {
		const data = this.activeBus.readBuffer(Encoder8.REGISTER.INCREMENT + Encoder8.#encoderIndex(encoder) * 4, 4);
		return signed32(new Uint8Array(data), 0);
	}

	readEncoderChangeFlags(): number {
		return this.activeBus.readUint8(Encoder8.REGISTER.ENCODER_CHANGE_FLAGS) & 0xff;
	}

	resetEncoder(encoder: number): void {
		this.activeBus.writeUint8(Encoder8.REGISTER.RESET_COUNTER + Encoder8.#encoderIndex(encoder), 1);
	}

	resetEncoders(): void {
		this.activeBus.writeBuffer(Encoder8.REGISTER.RESET_COUNTER, Uint8Array.of(1, 1, 1, 1, 1, 1, 1, 1));
	}

	readButtons(): number {
		return ~this.activeBus.readUint8(Encoder8.REGISTER.BUTTONS) & 0xff;
	}

	isButtonPressed(button: number): boolean {
		return this.activeBus.readUint8(Encoder8.REGISTER.BUTTON + Encoder8.#buttonIndex(button)) === 0;
	}

	readButtonToggleCounts(): number[] {
		return Array.from(
			new Uint8Array(this.activeBus.readBuffer(Encoder8.REGISTER.BUTTON_TOGGLE_COUNT, Encoder8.BUTTON_COUNT)),
		);
	}

	isSwitchOn(): boolean {
		return this.activeBus.readUint8(Encoder8.REGISTER.SWITCH) !== 0;
	}

	setLed(led: number, color: RGBColor): void {
		this.activeBus.writeBuffer(
			Encoder8.REGISTER.RGB_LED + Encoder8.#ledIndex(led) * 3,
			Uint8Array.of(Encoder8.#byte(color.r, "r"), Encoder8.#byte(color.g, "g"), Encoder8.#byte(color.b, "b")),
		);
	}

	getLed(led: number): Encoder8Color {
		const data = new Uint8Array(this.activeBus.readBuffer(Encoder8.REGISTER.RGB_LED + Encoder8.#ledIndex(led) * 3, 3));
		return { r: data[0], g: data[1], b: data[2] };
	}

	setAllLeds(color: RGBColor): void {
		const red = Encoder8.#byte(color.r, "r");
		const green = Encoder8.#byte(color.g, "g");
		const blue = Encoder8.#byte(color.b, "b");
		const data = new Uint8Array(Encoder8.LED_COUNT * 3);
		for (let offset = 0; offset < data.length; offset += 3) {
			data[offset] = red;
			data[offset + 1] = green;
			data[offset + 2] = blue;
		}
		this.activeBus.writeBuffer(Encoder8.REGISTER.RGB_LED, data);
	}

	getFirmwareVersion(): number {
		return this.activeBus.readUint8(Encoder8.REGISTER.FIRMWARE_VERSION) & 0xff;
	}

	getI2CAddress(): number {
		return this.readAddress(Encoder8.REGISTER.I2C_ADDRESS);
	}

	setI2CAddress(address: number): void {
		this.changeAddress(Encoder8.REGISTER.I2C_ADDRESS, address);
	}

	static #readSignedValues(buffer: ArrayBuffer): number[] {
		const data = new Uint8Array(buffer);
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
