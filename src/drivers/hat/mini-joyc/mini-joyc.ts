import type I2C from "embedded:io/i2c";
import SMBus from "embedded:io/smbus";
import { I2CBusResource, integerInRange, type RGBColor, signed8, signed16 } from "hmi/util";
import JoystickInput, {
	type JoystickButtonChangeCallback,
	type JoystickChangeCallback,
	type JoystickInputOptions,
	type JoystickPosition,
	type JoystickState,
} from "joystick/input";
import Timer from "timer";

type I2COptions = ConstructorParameters<typeof I2C>[0];
type SMBusOptions = I2COptions & { stop?: boolean };

export interface MiniJoyCIOInstance {
	readUint8(register: number): number;
	writeUint8(register: number, value: number): void;
	readUint16(register: number, bigEndian?: boolean): number;
	writeUint16(register: number, value: number, bigEndian?: boolean): void;
	readBuffer(register: number, byteLength: number): ArrayBuffer;
	writeBuffer(register: number, buffer: ByteBuffer): void;
	close(): void;
}

export type MiniJoyCIO = new (options: SMBusOptions) => MiniJoyCIOInstance;

// @moddable/typings 8.3.1 declares the SMBus options as a tuple intersection.
// Narrow the constructor to the object accepted by the runtime implementation.
const SMBusConstructor = SMBus as unknown as MiniJoyCIO;

export type MiniJoyCReadMode = "adc" | "pos8" | "pos10";
export type MiniJoyCCalibrationIndex = 0 | 1 | 2 | 3 | 4 | 5;

export type MiniJoyCPosition = JoystickPosition;
export type MiniJoyCState = JoystickState;

export interface MiniJoyCCalibration {
	xMin: number;
	xMax: number;
	yMin: number;
	yMax: number;
	xCenter: number;
	yCenter: number;
}

export interface MiniJoyCOptions extends JoystickInputOptions<MiniJoyCState> {
	address?: number;
	data?: I2COptions["data"];
	clock?: I2COptions["clock"];
	hz?: number;
	io?: MiniJoyCIO;
	readMode?: MiniJoyCReadMode;
}

export type MiniJoyCChangeCallback = JoystickChangeCallback<MiniJoyCState>;
export type MiniJoyCButtonChangeCallback = JoystickButtonChangeCallback;

// https://docs.m5stack.com/en/hat/MiniJoyC
export default class MiniJoyC {
	static readonly DEFAULT_ADDRESS = 0x54;
	static readonly DEFAULT_HZ = 200_000;

	static readonly REGISTER = {
		ADC_VALUE: 0x00,
		POSITION_10_BIT: 0x10,
		POSITION_8_BIT: 0x20,
		BUTTON: 0x30,
		RGB_LED: 0x40,
		CALIBRATION: 0x50,
		FIRMWARE_VERSION: 0xfe,
		I2C_ADDRESS: 0xff,
	} as const;

	static readonly CALIBRATION = {
		X_MIN: 0,
		X_MAX: 1,
		Y_MIN: 2,
		Y_MAX: 3,
		X_CENTER: 4,
		Y_CENTER: 5,
	} as const;

	#bus: I2CBusResource<MiniJoyCIOInstance, SMBusOptions>;
	#address: number;
	#input: JoystickInput<MiniJoyCState>;

	readMode: MiniJoyCReadMode;

	constructor(options: MiniJoyCOptions = {}) {
		const hat = (device.I2C as typeof device.I2C & { hat: I2COptions }).hat;

		this.readMode = MiniJoyC.#readMode(options.readMode ?? "pos8");
		this.#address = integerInRange(options.address ?? MiniJoyC.DEFAULT_ADDRESS, "address", 1, 0x7f);
		this.#bus = new I2CBusResource(
			options.io ?? SMBusConstructor,
			{
				data: options.data ?? hat.data,
				clock: options.clock ?? hat.clock,
				hz: integerInRange(options.hz ?? MiniJoyC.DEFAULT_HZ, "hz", 1, Number.MAX_SAFE_INTEGER),
			},
			this.#address,
			"joystick",
		);
		Timer.delay(10);
		try {
			this.#input = new JoystickInput(this, this, "MiniJoyC", options);
		} catch (error) {
			this.#bus.close();
			throw error;
		}
	}

	close(): void {
		this.#input.close();
		this.#bus.close();
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

	set deadband(value: number) {
		this.#input.deadband = value;
	}

	get deadband(): number {
		return this.#input.deadband;
	}

	set onChange(callback: MiniJoyCChangeCallback | null | undefined) {
		this.#input.onChange = callback;
	}

	get onChange(): MiniJoyCChangeCallback | null {
		return this.#input.onChange;
	}

	set onButtonChange(callback: MiniJoyCButtonChangeCallback | null | undefined) {
		this.#input.onButtonChange = callback;
	}

	get onButtonChange(): MiniJoyCButtonChangeCallback | null {
		return this.#input.onButtonChange;
	}

	read(): MiniJoyCState {
		return {
			...this.readXY(),
			pressed: this.isButtonPressed(),
		};
	}

	readXY(mode: MiniJoyCReadMode = this.readMode): MiniJoyCPosition {
		switch (MiniJoyC.#readMode(mode)) {
			case "adc":
				return this.readADC();
			case "pos8":
				return this.readPosition8Bit();
			case "pos10":
				return this.readPosition10Bit();
		}
	}

	readADC(): MiniJoyCPosition {
		return {
			x: this.#readWordLE(MiniJoyC.REGISTER.ADC_VALUE),
			y: this.#readWordLE(MiniJoyC.REGISTER.ADC_VALUE + 2),
		};
	}

	readPosition8Bit(): MiniJoyCPosition {
		return {
			x: signed8(this.#readByte(MiniJoyC.REGISTER.POSITION_8_BIT)),
			y: signed8(this.#readByte(MiniJoyC.REGISTER.POSITION_8_BIT + 1)),
		};
	}

	readPosition10Bit(): MiniJoyCPosition {
		return {
			x: signed16(this.#readWordLE(MiniJoyC.REGISTER.POSITION_10_BIT)),
			y: signed16(this.#readWordLE(MiniJoyC.REGISTER.POSITION_10_BIT + 2)),
		};
	}

	isButtonPressed(): boolean {
		return this.#readByte(MiniJoyC.REGISTER.BUTTON) !== 0;
	}

	setLed(color: RGBColor): void {
		this.#activeBus.writeBuffer(
			MiniJoyC.REGISTER.RGB_LED,
			Uint8Array.of(
				integerInRange(color.r, "r", 0, 0xff),
				integerInRange(color.g, "g", 0, 0xff),
				integerInRange(color.b, "b", 0, 0xff),
			),
		);
	}

	readCalibration(index: MiniJoyCCalibrationIndex): number {
		return this.#readWordLE(MiniJoyC.REGISTER.CALIBRATION + MiniJoyC.#calibrationIndex(index) * 2);
	}

	readCalibrationValues(): MiniJoyCCalibration {
		const data = new Uint8Array(this.#activeBus.readBuffer(MiniJoyC.REGISTER.CALIBRATION, 12));
		return {
			xMin: MiniJoyC.#wordLE(data, 0),
			xMax: MiniJoyC.#wordLE(data, 2),
			yMin: MiniJoyC.#wordLE(data, 4),
			yMax: MiniJoyC.#wordLE(data, 6),
			xCenter: MiniJoyC.#wordLE(data, 8),
			yCenter: MiniJoyC.#wordLE(data, 10),
		};
	}

	writeCalibration(index: MiniJoyCCalibrationIndex, value: number): void {
		this.#activeBus.writeUint16(
			MiniJoyC.REGISTER.CALIBRATION + MiniJoyC.#calibrationIndex(index) * 2,
			MiniJoyC.#calibrationValue(value),
			false,
		);
		Timer.delay(1000);
	}

	writeCalibrationValues(values: MiniJoyCCalibration): void {
		const data = new Uint8Array(12);
		MiniJoyC.#setWordLE(data, 0, MiniJoyC.#calibrationValue(values.xMin));
		MiniJoyC.#setWordLE(data, 2, MiniJoyC.#calibrationValue(values.xMax));
		MiniJoyC.#setWordLE(data, 4, MiniJoyC.#calibrationValue(values.yMin));
		MiniJoyC.#setWordLE(data, 6, MiniJoyC.#calibrationValue(values.yMax));
		MiniJoyC.#setWordLE(data, 8, MiniJoyC.#calibrationValue(values.xCenter));
		MiniJoyC.#setWordLE(data, 10, MiniJoyC.#calibrationValue(values.yCenter));
		this.#activeBus.writeBuffer(MiniJoyC.REGISTER.CALIBRATION, data);
		Timer.delay(1000);
	}

	getFirmwareVersion(): number {
		return this.#readByte(MiniJoyC.REGISTER.FIRMWARE_VERSION);
	}

	getI2CAddress(): number {
		return this.#readByte(MiniJoyC.REGISTER.I2C_ADDRESS);
	}

	setI2CAddress(address: number): void {
		const nextAddress = integerInRange(address, "address", 1, 0x7f);
		if (nextAddress === this.#address) return;

		this.#activeBus.writeUint8(MiniJoyC.REGISTER.I2C_ADDRESS, nextAddress);
		this.#bus.open(nextAddress);
		this.#address = nextAddress;
		Timer.delay(10);
	}

	#readByte(register: number): number {
		return this.#activeBus.readUint8(register) & 0xff;
	}

	#readWordLE(register: number): number {
		return this.#activeBus.readUint16(register, false) & 0xffff;
	}

	get #activeBus(): MiniJoyCIOInstance {
		return this.#bus.active;
	}

	static #readMode(value: string): MiniJoyCReadMode {
		if (value !== "adc" && value !== "pos8" && value !== "pos10")
			throw new RangeError('readMode must be "adc", "pos8", or "pos10"');
		return value;
	}

	static #calibrationIndex(value: number): MiniJoyCCalibrationIndex {
		return integerInRange(value, "calibration index", 0, 5) as MiniJoyCCalibrationIndex;
	}

	static #calibrationValue(value: number): number {
		return integerInRange(value, "calibration value", 0, 4095);
	}

	static #wordLE(data: Uint8Array, offset: number): number {
		return data[offset] | (data[offset + 1] << 8);
	}

	static #setWordLE(data: Uint8Array, offset: number, value: number): void {
		data[offset] = value;
		data[offset + 1] = value >> 8;
	}
}
