import type I2C from "embedded:io/i2c";
import SMBus from "embedded:io/smbus";
import JoystickInput, {
	type JoystickButtonChangeCallback,
	type JoystickChangeCallback,
	type JoystickInputOptions,
	type JoystickPosition,
	type JoystickState,
} from "joystick/input";
import { I2CBusResource, integerInRange, type RGBColor } from "hmi/util";

type I2COptions = ConstructorParameters<typeof I2C>[0];
type SMBusOptions = I2COptions & { stop?: boolean };

export interface JoyStick2IOInstance {
	readUint8(register: number): number;
	writeUint8(register: number, value: number): void;
	readUint16(register: number, bigEndian?: boolean): number;
	close(): void;
}

export type JoyStick2IO = new (options: SMBusOptions) => JoyStick2IOInstance;

// @moddable/typings 8.3.1 declares the SMBus options as a tuple intersection.
// Narrow the constructor to the object accepted by the runtime implementation.
const SMBusConstructor = SMBus as unknown as JoyStick2IO;

export type JoyStick2Position = JoystickPosition;
export type JoyStick2State = JoystickState;

export interface JoyStick2Options extends JoystickInputOptions<JoyStick2State> {
	data?: I2COptions["data"];
	clock?: I2COptions["clock"];
	io?: JoyStick2IO;
}

export type JoyStick2ChangeCallback = JoystickChangeCallback<JoyStick2State>;
export type JoyStick2ButtonChangeCallback = JoystickButtonChangeCallback;

// https://docs.m5stack.com/ja/unit/Unit-JoyStick2
export default class JoyStick2 {
	static readonly REGISTER = {
		ADC_VALUE_12BITS_REG: 0x00,
		ADC_VALUE_8BITS_REG: 0x10,
		BUTTON_REG: 0x20,
		RGB_LED_REG: 0x30,
		ADC_VALUE_CAL_REG: 0x40,
		OFFSET_ADC_VALUE_12BITS_REG: 0x50,
		OFFSET_ADC_VALUE_8BITS_REG: 0x60,
		FIRMWARE_VERSION_REG: 0xfe,
		BOOTLOADER_VERSION_REG: 0xfc,
		I2C_ADDRESS_REG: 0xff,
	} as const;

	#bus: I2CBusResource<JoyStick2IOInstance, SMBusOptions>;
	#input: JoystickInput<JoyStick2State>;

	constructor(options: JoyStick2Options = {}) {
		this.#bus = new I2CBusResource(
			options.io ?? SMBusConstructor,
			{
				data: options.data ?? device.I2C.default.data,
				clock: options.clock ?? device.I2C.default.clock,
				hz: 400_000,
			},
			0x63,
			"joystick",
		);
		try {
			this.#input = new JoystickInput(this, this, "JoyStick2", options);
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

	set onChange(callback: JoyStick2ChangeCallback | null | undefined) {
		this.#input.onChange = callback;
	}

	get onChange(): JoyStick2ChangeCallback | null {
		return this.#input.onChange;
	}

	set onButtonChange(callback: JoyStick2ButtonChangeCallback | null | undefined) {
		this.#input.onButtonChange = callback;
	}

	get onButtonChange(): JoyStick2ButtonChangeCallback | null {
		return this.#input.onButtonChange;
	}

	read(): JoyStick2State {
		return {
			...this.readXY(),
			pressed: this.isButtonPressed(),
		};
	}

	readXY(): JoyStick2Position {
		return this.#readMappedValue8bit();
	}

	#readMappedValue8bit(): JoyStick2Position {
		const words = this.#activeBus.readUint16(JoyStick2.REGISTER.OFFSET_ADC_VALUE_8BITS_REG, true);
		const x = (words >> 8) & 0xff;
		const y = words & 0xff;

		return {
			x: x & 0x80 ? x - 0x100 : x,
			y: y & 0x80 ? y - 0x100 : y,
		};
	}

	isButtonPressed(): boolean {
		return this.#activeBus.readUint8(JoyStick2.REGISTER.BUTTON_REG) === 0;
	}

	setLed(color: RGBColor): void {
		const bus = this.#activeBus;
		bus.writeUint8(JoyStick2.REGISTER.RGB_LED_REG, integerInRange(color.b, "b", 0, 0xff));
		bus.writeUint8(JoyStick2.REGISTER.RGB_LED_REG + 1, integerInRange(color.g, "g", 0, 0xff));
		bus.writeUint8(JoyStick2.REGISTER.RGB_LED_REG + 2, integerInRange(color.r, "r", 0, 0xff));
	}

	get #activeBus(): JoyStick2IOInstance {
		return this.#bus.active;
	}
}
