import { SMBusDevice, type SMBusIO, type SMBusInstance, type SMBusPortOptions } from "hmi/smbus";
import { integerInRange, type RGBColor } from "hmi/util";
import JoystickInput, {
	type JoystickButtonChangeCallback,
	type JoystickChangeCallback,
	type JoystickInputOptions,
	type JoystickPosition,
	type JoystickState,
} from "joystick/input";

export interface JoyStick2IOInstance extends SMBusInstance {
	readUint8(register: number): number;
	writeUint8(register: number, value: number): void;
	readUint16(register: number, bigEndian?: boolean): number;
}

export type JoyStick2IO = SMBusIO<JoyStick2IOInstance>;

export type JoyStick2Position = JoystickPosition;
export type JoyStick2State = JoystickState;

export interface JoyStick2Options extends JoystickInputOptions<JoyStick2State>, SMBusPortOptions<JoyStick2IO> {}

export type JoyStick2ChangeCallback = JoystickChangeCallback<JoyStick2State>;
export type JoyStick2ButtonChangeCallback = JoystickButtonChangeCallback;

// https://docs.m5stack.com/ja/unit/Unit-JoyStick2
export default class JoyStick2 extends SMBusDevice<JoyStick2IOInstance> {
	static readonly DEFAULT_ADDRESS = 0x63;
	static readonly DEFAULT_HZ = 400_000;
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

	readonly input: JoystickInput<JoyStick2State>;

	constructor(options: JoyStick2Options = {}) {
		super(options, { address: JoyStick2.DEFAULT_ADDRESS, hz: JoyStick2.DEFAULT_HZ, name: "joystick" });
		try {
			this.input = new JoystickInput(this, this, "JoyStick2", options);
		} catch (error) {
			super.close();
			throw error;
		}
	}

	close(): void {
		this.input.close();
		super.close();
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
		const words = this.activeBus.readUint16(JoyStick2.REGISTER.OFFSET_ADC_VALUE_8BITS_REG, true);
		const x = (words >> 8) & 0xff;
		const y = words & 0xff;

		return {
			x: x & 0x80 ? x - 0x100 : x,
			y: y & 0x80 ? y - 0x100 : y,
		};
	}

	isButtonPressed(): boolean {
		return this.activeBus.readUint8(JoyStick2.REGISTER.BUTTON_REG) === 0;
	}

	setLed(color: RGBColor): void {
		const bus = this.activeBus;
		bus.writeUint8(JoyStick2.REGISTER.RGB_LED_REG, integerInRange(color.b, "b", 0, 0xff));
		bus.writeUint8(JoyStick2.REGISTER.RGB_LED_REG + 1, integerInRange(color.g, "g", 0, 0xff));
		bus.writeUint8(JoyStick2.REGISTER.RGB_LED_REG + 2, integerInRange(color.r, "r", 0, 0xff));
	}
}
