import type I2C from "embedded:io/i2c";
import SMBus from "embedded:io/smbus";
import { I2CBusResource } from "hmi/util";
import JoystickInput, {
	type JoystickButtonChangeCallback,
	type JoystickChangeCallback,
	type JoystickInputOptions,
	type JoystickPosition,
	type JoystickState,
} from "joystick/input";

type I2COptions = ConstructorParameters<typeof I2C>[0];
type SMBusOptions = I2COptions & { stop?: boolean };

export interface JoyStickIOInstance {
	read(byteLength: number, stop?: boolean): ArrayBuffer;
	close(): void;
}

export type JoyStickIO = new (options: SMBusOptions) => JoyStickIOInstance;

// @moddable/typings 8.3.1 declares the SMBus options as a tuple intersection.
// Narrow the constructor to the object accepted by the runtime implementation.
const SMBusConstructor = SMBus as unknown as JoyStickIO;

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

	#bus: I2CBusResource<JoyStickIOInstance, SMBusOptions>;
	#input: JoystickInput<JoyStickState>;

	constructor(options: JoyStickOptions = {}) {
		this.#bus = new I2CBusResource(
			options.io ?? SMBusConstructor,
			{
				data: options.data ?? device.I2C.default.data,
				clock: options.clock ?? device.I2C.default.clock,
				hz: 400_000,
			},
			JoyStick.DEFAULT_ADDRESS,
			"joystick",
		);
		try {
			this.#input = new JoystickInput(this, this, "JoyStick", options);
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
		const data = new Uint8Array(this.#bus.active.read(JoyStick.STATE_LENGTH));
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
		return this.#bus.active;
	}
}
