import Led, { LedCollection } from "hmi/led";
import { assertOpen, ownResource } from "hmi/peripheral";
import {
	busFor,
	changeAddress,
	type I2COptions,
	readAddress,
	SMBusDevice,
	type SMBusDeviceOptions,
	type SMBusInstance,
	type SMBusIO,
} from "hmi/smbus";
import { integerInRange, type RGBColor } from "hmi/util";

export type BytePanelI2COptions = I2COptions;

export interface BytePanelIOInstance extends SMBusInstance {
	readUint8(register: number): number;
	writeUint8(register: number, value: number): void;
	readBuffer(register: number, byteLength: number): ArrayBuffer;
	writeBuffer(register: number, buffer: ByteBuffer): void;
}

export type BytePanelIO<Bus extends BytePanelIOInstance = BytePanelIOInstance> = SMBusIO<Bus>;

export type BytePanelOptions<IO extends BytePanelIO = BytePanelIO> = SMBusDeviceOptions<IO>;

const REGISTER = {
	INPUTS: 0x00,
	LED_BRIGHTNESS: 0x10,
	LED_MODE: 0x19,
	LED_RGB888: 0x20,
	LED_RGB233: 0x50,
	INPUT_VALUES: 0x60,
	INPUT_OFF_RGB888: 0x70,
	INPUT_ON_RGB888: 0x90,
	SAVE_TO_FLASH: 0xf0,
	FIRMWARE_VERSION: 0xfe,
	I2C_ADDRESS: 0xff,
} as const;

const DEFAULT_HZ = 400_000;
const INPUT_COUNT = 8;
const LED_COUNT = 9;

export default class BytePanel<Bus extends BytePanelIOInstance = BytePanelIOInstance> extends SMBusDevice<Bus> {
	readonly leds = new LedCollection(
		Array.from(
			{ length: 9 },
			(_, index) =>
				new Led({
					write: (color, brightness) => {
						this.setLed(index, color);
						this.setLedBrightness(index, brightness);
					},
				}),
		),
	);

	static readonly INPUT_COUNT = INPUT_COUNT;
	static readonly LED_COUNT = LED_COUNT;

	protected constructor(options: BytePanelOptions<BytePanelIO<Bus>>, defaultAddress: number, name: string) {
		super(options, { address: defaultAddress, hz: DEFAULT_HZ, name });
		try {
			ownResource(this, this.leds);
			this.configure({ ledMode: 0 });
			for (let index = 0; index < LED_COUNT; index++) this.setLedBrightness(index, 255);
			this.leds.color = { r: 0, g: 0, b: 0 };
			for (let index = 0; index < INPUT_COUNT; index++) {
				setInputLed(this, index, false, { r: 0, g: 0, b: 0 });
				setInputLed(this, index, true, { r: 255, g: 255, b: 255 });
			}
			this.getFirmwareVersion();
		} catch (error) {
			this.close();
			throw error;
		}
	}

	configure(options: { ledMode?: 0 | 1 }): void {
		super.configure(options);
		if ("ledMode" in options)
			busFor(this).writeUint8(REGISTER.LED_MODE, integerInRange(options.ledMode as number, "ledMode", 0, 1));
	}
	get configuration(): { interrupt: boolean; ledMode: 0 | 1 } {
		assertOpen(this);
		return { ...super.configuration, ledMode: busFor(this).readUint8(REGISTER.LED_MODE) === 1 ? 1 : 0 };
	}

	setLedBrightness(led: number, brightness: number): void {
		assertOpen(this);
		busFor(this).writeUint8(
			REGISTER.LED_BRIGHTNESS + BytePanel.#ledIndex(led),
			BytePanel.#byte(brightness, "brightness"),
		);
	}

	getLedBrightness(led: number): number {
		assertOpen(this);
		return busFor(this).readUint8(REGISTER.LED_BRIGHTNESS + BytePanel.#ledIndex(led)) & 0xff;
	}

	setLed(led: number, color: RGBColor): void {
		assertOpen(this);
		this.#writeColor(REGISTER.LED_RGB888 + BytePanel.#ledIndex(led) * 4, color);
	}

	getLed(led: number): RGBColor {
		assertOpen(this);
		return this.#readColor(REGISTER.LED_RGB888 + BytePanel.#ledIndex(led) * 4);
	}

	setLedCompact(led: number, color: RGBColor): void {
		assertOpen(this);
		const red = BytePanel.#byte(color.r, "r");
		const green = BytePanel.#byte(color.g, "g");
		const blue = BytePanel.#byte(color.b, "b");
		busFor(this).writeUint8(
			REGISTER.LED_RGB233 + BytePanel.#ledIndex(led),
			(red & 0xc0) | ((green & 0xe0) >> 2) | ((blue & 0xe0) >> 5),
		);
	}

	saveSettings(): void {
		assertOpen(this);
		busFor(this).writeUint8(REGISTER.SAVE_TO_FLASH, 1);
	}

	getFirmwareVersion(): number {
		assertOpen(this);
		return busFor(this).readUint8(REGISTER.FIRMWARE_VERSION) & 0xff;
	}

	getI2CAddress(): number {
		assertOpen(this);
		return readAddress(this, REGISTER.I2C_ADDRESS);
	}

	setI2CAddress(address: number): void {
		assertOpen(this);
		changeAddress(this, REGISTER.I2C_ADDRESS, address);
	}

	#writeColor(register: number, color: RGBColor): void {
		busFor(this).writeBuffer(
			register,
			Uint8Array.of(BytePanel.#byte(color.b, "b"), BytePanel.#byte(color.g, "g"), BytePanel.#byte(color.r, "r"), 0),
		);
	}

	#readColor(register: number): RGBColor {
		const data = new DataView(busFor(this).readBuffer(register, 4));
		return { r: data.getUint8(2), g: data.getUint8(1), b: data.getUint8(0) };
	}

	static #ledIndex(value: number): number {
		return integerInRange(value, "led", 0, LED_COUNT - 1);
	}

	static #byte(value: number, name: string): number {
		return integerInRange(value, name, 0, 0xff);
	}
}

export function readInputs(instance: BytePanel, activeLow: boolean): number {
	const inputs = busFor(instance).readUint8(REGISTER.INPUTS) & 0xff;
	return activeLow ? ~inputs & 0xff : inputs;
}
export function readInput(instance: BytePanel, index: number, activeLow: boolean): boolean {
	const value = busFor(instance).readUint8(REGISTER.INPUT_VALUES + integerInRange(index, "input", 0, INPUT_COUNT - 1));
	return activeLow ? value === 0 : value !== 0;
}
export function setInputLed(instance: BytePanel, index: number, on: boolean, color: RGBColor): void {
	const register =
		(on ? REGISTER.INPUT_ON_RGB888 : REGISTER.INPUT_OFF_RGB888) +
		integerInRange(index, "input", 0, INPUT_COUNT - 1) * 4;
	busFor(instance).writeBuffer(
		register,
		Uint8Array.of(
			integerInRange(color.b, "b", 0, 255),
			integerInRange(color.g, "g", 0, 255),
			integerInRange(color.r, "r", 0, 255),
			0,
		),
	);
}
export function getInputLed(instance: BytePanel, index: number, on: boolean): RGBColor {
	const register =
		(on ? REGISTER.INPUT_ON_RGB888 : REGISTER.INPUT_OFF_RGB888) +
		integerInRange(index, "input", 0, INPUT_COUNT - 1) * 4;
	const data = new DataView(busFor(instance).readBuffer(register, 4));
	return { r: data.getUint8(2), g: data.getUint8(1), b: data.getUint8(0) };
}
