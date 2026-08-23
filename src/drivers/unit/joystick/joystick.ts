import JoystickInput, {
	type JoystickButtonChangeCallback,
	type JoystickChangeCallback,
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

export type JoyStickChangeCallback = JoystickChangeCallback<JoyStickState>;
export type JoyStickButtonChangeCallback = JoystickButtonChangeCallback;

// https://docs.m5stack.com/ja/unit/joystick_1.1
export default class JoyStick extends SMBusDevice<JoyStickIOInstance> {
	static readonly DEFAULT_ADDRESS = 0x52;
	static readonly DEFAULT_HZ = 400_000;
	static readonly STATE_LENGTH = 3;

	#input: JoystickInput<JoyStickState>;

	set onChange(callback: JoyStickChangeCallback | null | undefined) {
		this.#input.onChange = callback;
	}
	get onChange(): JoyStickChangeCallback | null {
		return this.#input.onChange;
	}
	set onButtonChange(callback: JoyStickButtonChangeCallback | null | undefined) {
		this.#input.onButtonChange = callback;
	}
	get onButtonChange(): JoyStickButtonChangeCallback | null {
		return this.#input.onButtonChange;
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
		const data = new Uint8Array(this.activeBus.read(JoyStick.STATE_LENGTH));
		return {
			x: data[0],
			y: data[1],
			pressed: data[2] !== 0,
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
