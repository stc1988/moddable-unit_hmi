import {
	calibrationIndex,
	calibrationValue,
	type MiniJoyCCalibration,
	type MiniJoyCCalibrationIndex,
	type MiniJoyCIOInstance,
	type MiniJoyCOptions,
	type MiniJoyCPosition,
	type MiniJoyCReadMode,
	type MiniJoyCState,
	readMode,
	setWordLE,
	wordLE,
} from "hat/mini-joyc/protocol";
import { type I2COptions, SMBusDevice } from "hmi/smbus";
import { integerInRange, type RGBColor, signed8, signed16 } from "hmi/util";
import JoystickInput from "joystick/input";
import Timer from "timer";

export type {
	MiniJoyCButtonChangeCallback,
	MiniJoyCCalibration,
	MiniJoyCCalibrationIndex,
	MiniJoyCChangeCallback,
	MiniJoyCIO,
	MiniJoyCIOInstance,
	MiniJoyCOptions,
	MiniJoyCPosition,
	MiniJoyCReadMode,
	MiniJoyCState,
} from "hat/mini-joyc/protocol";

// https://docs.m5stack.com/en/hat/MiniJoyC
export default class MiniJoyC extends SMBusDevice<MiniJoyCIOInstance> {
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

	readonly input: JoystickInput<MiniJoyCState>;

	readMode: MiniJoyCReadMode;

	constructor(options: MiniJoyCOptions = {}) {
		const hat = (device.I2C as typeof device.I2C & { hat: I2COptions }).hat;

		super(options, {
			address: MiniJoyC.DEFAULT_ADDRESS,
			hz: MiniJoyC.DEFAULT_HZ,
			name: "joystick",
			data: hat.data,
			clock: hat.clock,
		});
		this.readMode = readMode(options.readMode ?? "pos8");
		Timer.delay(10);
		try {
			this.input = new JoystickInput(this, this, "MiniJoyC", options);
		} catch (error) {
			super.close();
			throw error;
		}
	}

	close(): void {
		this.input.close();
		super.close();
	}

	read(): MiniJoyCState {
		return {
			...this.readXY(),
			pressed: this.isButtonPressed(),
		};
	}

	readXY(mode: MiniJoyCReadMode = this.readMode): MiniJoyCPosition {
		switch (readMode(mode)) {
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
		this.activeBus.writeBuffer(
			MiniJoyC.REGISTER.RGB_LED,
			Uint8Array.of(
				integerInRange(color.r, "r", 0, 0xff),
				integerInRange(color.g, "g", 0, 0xff),
				integerInRange(color.b, "b", 0, 0xff),
			),
		);
	}

	readCalibration(index: MiniJoyCCalibrationIndex): number {
		return this.#readWordLE(MiniJoyC.REGISTER.CALIBRATION + calibrationIndex(index) * 2);
	}

	readCalibrationValues(): MiniJoyCCalibration {
		const data = new Uint8Array(this.activeBus.readBuffer(MiniJoyC.REGISTER.CALIBRATION, 12));
		return {
			xMin: wordLE(data, 0),
			xMax: wordLE(data, 2),
			yMin: wordLE(data, 4),
			yMax: wordLE(data, 6),
			xCenter: wordLE(data, 8),
			yCenter: wordLE(data, 10),
		};
	}

	writeCalibration(index: MiniJoyCCalibrationIndex, value: number): void {
		this.activeBus.writeUint16(
			MiniJoyC.REGISTER.CALIBRATION + calibrationIndex(index) * 2,
			calibrationValue(value),
			false,
		);
		Timer.delay(1000);
	}

	writeCalibrationValues(values: MiniJoyCCalibration): void {
		const data = new Uint8Array(12);
		setWordLE(data, 0, calibrationValue(values.xMin));
		setWordLE(data, 2, calibrationValue(values.xMax));
		setWordLE(data, 4, calibrationValue(values.yMin));
		setWordLE(data, 6, calibrationValue(values.yMax));
		setWordLE(data, 8, calibrationValue(values.xCenter));
		setWordLE(data, 10, calibrationValue(values.yCenter));
		this.activeBus.writeBuffer(MiniJoyC.REGISTER.CALIBRATION, data);
		Timer.delay(1000);
	}

	getFirmwareVersion(): number {
		return this.#readByte(MiniJoyC.REGISTER.FIRMWARE_VERSION);
	}

	getI2CAddress(): number {
		return this.readAddress(MiniJoyC.REGISTER.I2C_ADDRESS);
	}

	setI2CAddress(address: number): void {
		this.changeAddress(MiniJoyC.REGISTER.I2C_ADDRESS, address);
	}

	#readByte(register: number): number {
		return this.activeBus.readUint8(register) & 0xff;
	}

	#readWordLE(register: number): number {
		return this.activeBus.readUint16(register, false) & 0xffff;
	}
}
