import type { SMBusDeviceOptions, SMBusInstance, SMBusIO } from "hmi/smbus";
import { integerInRange } from "hmi/util";
import type {
	JoystickButtonChangeCallback,
	JoystickChangeCallback,
	JoystickInputOptions,
	JoystickPosition,
	JoystickState,
} from "joystick/input";

export interface MiniJoyCIOInstance extends SMBusInstance {
	readUint8(register: number): number;
	writeUint8(register: number, value: number): void;
	readUint16(register: number, bigEndian?: boolean): number;
	writeUint16(register: number, value: number, bigEndian?: boolean): void;
	readBuffer(register: number, byteLength: number): ArrayBuffer;
	writeBuffer(register: number, buffer: ByteBuffer): void;
}

export type MiniJoyCIO = SMBusIO<MiniJoyCIOInstance>;
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

export interface MiniJoyCOptions extends JoystickInputOptions<MiniJoyCState>, SMBusDeviceOptions<MiniJoyCIO> {
	readMode?: MiniJoyCReadMode;
}

export type MiniJoyCChangeCallback = JoystickChangeCallback<MiniJoyCState>;
export type MiniJoyCButtonChangeCallback = JoystickButtonChangeCallback;

export function readMode(value: string): MiniJoyCReadMode {
	if (value !== "adc" && value !== "pos8" && value !== "pos10")
		throw new RangeError('readMode must be "adc", "pos8", or "pos10"');
	return value;
}

export function calibrationIndex(value: number): MiniJoyCCalibrationIndex {
	return integerInRange(value, "calibration index", 0, 5) as MiniJoyCCalibrationIndex;
}

export function calibrationValue(value: number): number {
	return integerInRange(value, "calibration value", 0, 4095);
}

export function wordLE(data: Uint8Array, offset: number): number {
	return data[offset] | (data[offset + 1] << 8);
}

export function setWordLE(data: Uint8Array, offset: number, value: number): void {
	data[offset] = value;
	data[offset + 1] = value >> 8;
}
