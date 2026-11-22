import Led, { scaleColor } from "hmi/led";
import { assertOpen, ownResource } from "hmi/peripheral";
import { busFor, SMBusDevice, type SMBusInstance, type SMBusIO, type SMBusPortOptions } from "hmi/smbus";
import type { JoystickPosition, JoystickState } from "hmi/util";
import { integerInRange, type RGBColor } from "hmi/util";

export interface JoyStick2IOInstance extends SMBusInstance {
	readUint8(register: number): number;
	writeUint8(register: number, value: number): void;
	readUint16(register: number, bigEndian?: boolean): number;
}

export type JoyStick2IO = SMBusIO<JoyStick2IOInstance>;

export type JoyStick2Position = JoystickPosition;
export type JoyStick2State = JoystickState;

export interface JoyStick2Options extends SMBusPortOptions<JoyStick2IO> {}

// https://docs.m5stack.com/ja/unit/Unit-JoyStick2
export default class JoyStick2 extends SMBusDevice<JoyStick2IOInstance> {
	readonly led = new Led({ write: (color, brightness) => this.setLed(scaleColor(color, brightness)) });

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

	constructor(options: JoyStick2Options) {
		super(options, { address: JoyStick2.DEFAULT_ADDRESS, hz: JoyStick2.DEFAULT_HZ, name: "JoyStick2" });
		try {
			ownResource(this, this.led);
			this.led.color = { r: 0, g: 0, b: 0 };
			this.read();
		} catch (error) {
			this.close();
			throw error;
		}
	}

	sample(): JoyStick2State & { time: number } {
		assertOpen(this);
		return { ...this.read(), time: Date.now() };
	}

	read(): JoyStick2State {
		assertOpen(this);
		return {
			...this.readXY(),
			pressed: this.isButtonPressed(),
		};
	}

	readXY(): JoyStick2Position {
		assertOpen(this);
		return this.#readMappedValue8bit();
	}

	#readMappedValue8bit(): JoyStick2Position {
		const words = busFor(this).readUint16(JoyStick2.REGISTER.OFFSET_ADC_VALUE_8BITS_REG, true);
		const x = (words >> 8) & 0xff;
		const y = words & 0xff;

		return {
			x: x & 0x80 ? x - 0x100 : x,
			y: y & 0x80 ? y - 0x100 : y,
		};
	}

	isButtonPressed(): boolean {
		assertOpen(this);
		return busFor(this).readUint8(JoyStick2.REGISTER.BUTTON_REG) === 0;
	}

	setLed(color: RGBColor): void {
		assertOpen(this);
		const bus = busFor(this);
		bus.writeUint8(JoyStick2.REGISTER.RGB_LED_REG, integerInRange(color.b, "b", 0, 0xff));
		bus.writeUint8(JoyStick2.REGISTER.RGB_LED_REG + 1, integerInRange(color.g, "g", 0, 0xff));
		bus.writeUint8(JoyStick2.REGISTER.RGB_LED_REG + 2, integerInRange(color.r, "r", 0, 0xff));
	}
}
