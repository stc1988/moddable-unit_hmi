import JoystickInput, {
	type JoystickButtonChangedCallback,
	type JoystickChangedCallback,
	type JoystickInputOptions,
	type JoystickPosition,
	type JoystickState,
} from "hmi/input/joystick";
import { SMBusDevice, type SMBusInstance, type SMBusIO, type SMBusPortOptions } from "hmi/smbus";

export interface JoyStickIOInstance extends SMBusInstance {
	read(byteLength: number, stop?: boolean): ArrayBuffer;
}

export type JoyStickIO = SMBusIO<JoyStickIOInstance>;

export type JoyStickPosition = JoystickPosition;
export type JoyStickState = JoystickState;

export interface JoyStickOptions extends JoystickInputOptions<JoyStickState>, SMBusPortOptions<JoyStickIO> {}

export type JoyStickChangedCallback = JoystickChangedCallback<JoyStickState>;
export type JoyStickButtonChangedCallback = JoystickButtonChangedCallback;

// https://docs.m5stack.com/ja/unit/joystick_1.1
export default class JoyStick extends SMBusDevice<JoyStickIOInstance> {
	static readonly DEFAULT_ADDRESS = 0x52;
	static readonly DEFAULT_HZ = 400_000;
	static readonly STATE_LENGTH = 3;

	#input: JoystickInput<JoyStickState>;

	set onChanged(callback: JoyStickChangedCallback | null | undefined) {
		this.#input.onChanged = callback;
	}
	get onChanged(): JoyStickChangedCallback | null {
		return this.#input.onChanged;
	}
	set onButtonChanged(callback: JoyStickButtonChangedCallback | null | undefined) {
		this.#input.onButtonChanged = callback;
	}
	get onButtonChanged(): JoyStickButtonChangedCallback | null {
		return this.#input.onButtonChanged;
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
	start(): void {
		this.#input.start();
	}
	stop(): void {
		this.#input.stop();
	}

	constructor(options: JoyStickOptions = {}) {
		super(options, { address: JoyStick.DEFAULT_ADDRESS, hz: JoyStick.DEFAULT_HZ, name: "joystick" });
		try {
			this.#input = new JoystickInput(this, this, "JoyStick", options);
		} catch (error) {
			super.close();
			throw error;
		}
	}

	close(): void {
		this.#input.close();
		super.close();
	}

	read(): JoyStickState {
		const data = new DataView(this.activeBus.read(JoyStick.STATE_LENGTH));
		return {
			x: data.getUint8(0),
			y: data.getUint8(1),
			pressed: data.getUint8(2) !== 0,
		};
	}

	readXY(): JoyStickPosition {
		const { x, y } = this.read();
		return { x, y };
	}

	isButtonPressed(): boolean {
		return this.read().pressed;
	}
}
