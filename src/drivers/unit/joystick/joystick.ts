import { assertOpen } from "hmi/peripheral";
import { busFor, SMBusDevice, type SMBusInstance, type SMBusIO, type SMBusPortOptions } from "hmi/smbus";
import type { JoystickPosition, JoystickState } from "hmi/util";

export interface JoyStickIOInstance extends SMBusInstance {
	read(byteLength: number, stop?: boolean): ArrayBuffer;
}

export type JoyStickIO = SMBusIO<JoyStickIOInstance>;

export type JoyStickPosition = JoystickPosition;
export type JoyStickState = JoystickState;

export interface JoyStickOptions extends SMBusPortOptions<JoyStickIO> {}

// https://docs.m5stack.com/ja/unit/joystick_1.1
export default class JoyStick extends SMBusDevice<JoyStickIOInstance> {
	static readonly DEFAULT_ADDRESS = 0x52;
	static readonly DEFAULT_HZ = 400_000;
	static readonly STATE_LENGTH = 3;

	constructor(options: JoyStickOptions) {
		super(options, { address: JoyStick.DEFAULT_ADDRESS, hz: JoyStick.DEFAULT_HZ, name: "JoyStick" });
		try {
			this.read();
		} catch (error) {
			this.close();
			throw error;
		}
	}

	sample(): JoyStickState & { time: number } {
		assertOpen(this);
		return { ...this.read(), time: Date.now() };
	}

	read(): JoyStickState {
		assertOpen(this);
		const data = new DataView(busFor(this).read(JoyStick.STATE_LENGTH));
		return {
			x: data.getUint8(0),
			y: data.getUint8(1),
			pressed: data.getUint8(2) !== 0,
		};
	}

	readXY(): JoyStickPosition {
		assertOpen(this);
		const { x, y } = this.read();
		return { x, y };
	}

	isButtonPressed(): boolean {
		assertOpen(this);
		return this.read().pressed;
	}
}
