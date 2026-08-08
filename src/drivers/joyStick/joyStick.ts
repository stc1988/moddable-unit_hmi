import I2C from "embedded:io/i2c";
import JoystickInput, {
	type JoystickButtonChangeCallback,
	type JoystickChangeCallback,
	type JoystickInputOptions,
	type JoystickPosition,
	type JoystickState,
} from "joystick/input";

type I2COptions = ConstructorParameters<typeof I2C>[0];

export interface JoyStickIOInstance {
	read(byteLength: number, stop?: boolean): ArrayBuffer;
	close(): void;
}

export type JoyStickIO = new (options: I2COptions) => JoyStickIOInstance;

export type JoyStickPosition = JoystickPosition;
export type JoyStickState = JoystickState;

export interface JoyStickOptions extends JoystickInputOptions<JoyStickState> {
	data?: I2COptions["data"];
	clock?: I2COptions["clock"];
	io?: JoyStickIO;
}

export type JoyStickChangeCallback = JoystickChangeCallback<JoyStickState>;
export type JoyStickButtonChangeCallback = JoystickButtonChangeCallback;

// https://docs.m5stack.com/ja/unit/joystick_1.1
export default class JoyStick {
	static readonly DEFAULT_ADDRESS = 0x52;
	static readonly STATE_LENGTH = 3;

	#bus?: JoyStickIOInstance;
	#input: JoystickInput<JoyStickState>;

	constructor(options: JoyStickOptions = {}) {
		const IO = options.io ?? I2C;
		this.#bus = new IO({
			address: JoyStick.DEFAULT_ADDRESS,
			data: options.data ?? device.I2C.default.data,
			clock: options.clock ?? device.I2C.default.clock,
			hz: 400_000,
		});
		try {
			this.#input = new JoystickInput(this, this, "JoyStick", options);
		} catch (error) {
			this.#bus.close();
			this.#bus = undefined;
			throw error;
		}
	}

	close(): void {
		this.#input.close();
		this.#bus?.close();
		this.#bus = undefined;
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

	read(): JoyStickState {
		const data = new Uint8Array(this.#activeBus.read(JoyStick.STATE_LENGTH));
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

	get #activeBus(): JoyStickIOInstance {
		if (!this.#bus) throw new Error("joystick is closed");
		return this.#bus;
	}
}
