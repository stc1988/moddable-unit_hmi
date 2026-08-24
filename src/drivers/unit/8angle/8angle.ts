import { SMBusDevice, type SMBusDeviceOptions, type SMBusInstance, type SMBusIO } from "hmi/smbus";
import { integerInRange, type RGBColor } from "hmi/util";
import Angle8Input from "unit/8angle/input";

export interface Angle8IOInstance extends SMBusInstance {
	readUint8(register: number): number;
	writeUint8(register: number, value: number): void;
	readBuffer(register: number, byteLength: number): ArrayBuffer;
	writeBuffer(register: number, buffer: ByteBuffer): void;
}

export type Angle8IO = SMBusIO<Angle8IOInstance>;

export interface Angle8State {
	/** Raw 12-bit ADC values for potentiometers 0 through 7. */
	angles: readonly number[];
	/** State of the physical toggle switch. */
	switchOn: boolean;
}

export interface Angle8Color extends RGBColor {
	brightness: number;
}

export type Angle8Resolution = 8 | 12;

export interface Angle8Options extends SMBusDeviceOptions<Angle8IO> {
	pollingInterval?: number;
	deadband?: number;
	onChange?: Angle8ChangeCallback;
	onAngleChange?: Angle8AngleChangeCallback;
	onSwitchChange?: Angle8SwitchChangeCallback;
}

export type Angle8ChangeCallback = (state: Angle8State) => void;
export type Angle8AngleChangeCallback = (angle: number, value: number) => void;
export type Angle8SwitchChangeCallback = (on: boolean) => void;

// https://docs.m5stack.com/en/unit/8Angle
export default class Angle8 extends SMBusDevice<Angle8IOInstance> {
	static readonly DEFAULT_ADDRESS = 0x43;
	static readonly DEFAULT_HZ = 400_000;
	static readonly ANGLE_COUNT = 8;
	static readonly LED_COUNT = 9;
	static readonly SWITCH_LED = 8;

	static readonly REGISTER = {
		ANALOG_12BIT: 0x00,
		ANALOG_8BIT: 0x10,
		SWITCH: 0x20,
		RGB_LED: 0x30,
		FIRMWARE_VERSION: 0xfe,
		I2C_ADDRESS: 0xff,
	} as const;

	#input: Angle8Input;

	set onChange(callback: Angle8ChangeCallback | null | undefined) {
		this.#input.onChange = callback;
	}
	get onChange(): Angle8ChangeCallback | null {
		return this.#input.onChange;
	}
	set onAngleChange(callback: Angle8AngleChangeCallback | null | undefined) {
		this.#input.onAngleChange = callback;
	}
	get onAngleChange(): Angle8AngleChangeCallback | null {
		return this.#input.onAngleChange;
	}
	set onSwitchChange(callback: Angle8SwitchChangeCallback | null | undefined) {
		this.#input.onSwitchChange = callback;
	}
	get onSwitchChange(): Angle8SwitchChangeCallback | null {
		return this.#input.onSwitchChange;
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

	constructor(options: Angle8Options = {}) {
		super(options, { address: Angle8.DEFAULT_ADDRESS, hz: Angle8.DEFAULT_HZ, name: "8angle" });
		try {
			this.#input = new Angle8Input(this, this, options);
		} catch (error) {
			super.close();
			throw error;
		}
	}

	close(): void {
		this.#input.close();
		super.close();
	}

	read(): Angle8State {
		return {
			angles: this.readAngles(),
			switchOn: this.isSwitchOn(),
		};
	}

	readAngles(resolution: Angle8Resolution = 12): number[] {
		Angle8.#resolution(resolution);
		if (resolution === 8)
			return Array.from(new Uint8Array(this.activeBus.readBuffer(Angle8.REGISTER.ANALOG_8BIT, Angle8.ANGLE_COUNT)));

		const data = new DataView(this.activeBus.readBuffer(Angle8.REGISTER.ANALOG_12BIT, Angle8.ANGLE_COUNT * 2));
		const angles = new Array<number>(Angle8.ANGLE_COUNT);
		for (let angle = 0; angle < Angle8.ANGLE_COUNT; angle++) angles[angle] = data.getUint16(angle * 2, true) & 0x0fff;
		return angles;
	}

	readAngle(angle: number, resolution: Angle8Resolution = 12): number {
		const index = Angle8.#angleIndex(angle);
		Angle8.#resolution(resolution);
		if (resolution === 8) return this.activeBus.readUint8(Angle8.REGISTER.ANALOG_8BIT + index) & 0xff;

		const data = new DataView(this.activeBus.readBuffer(Angle8.REGISTER.ANALOG_12BIT + index * 2, 2));
		return data.getUint16(0, true) & 0x0fff;
	}

	isSwitchOn(): boolean {
		return this.activeBus.readUint8(Angle8.REGISTER.SWITCH) !== 0;
	}

	setLed(led: number, color: RGBColor, brightness = 100): void {
		this.activeBus.writeBuffer(
			Angle8.REGISTER.RGB_LED + Angle8.#ledIndex(led) * 4,
			Uint8Array.of(
				Angle8.#byte(color.r, "r"),
				Angle8.#byte(color.g, "g"),
				Angle8.#byte(color.b, "b"),
				integerInRange(brightness, "brightness", 0, 100),
			),
		);
	}

	getLed(led: number): Angle8Color {
		const data = new DataView(this.activeBus.readBuffer(Angle8.REGISTER.RGB_LED + Angle8.#ledIndex(led) * 4, 4));
		return {
			r: data.getUint8(0),
			g: data.getUint8(1),
			b: data.getUint8(2),
			brightness: data.getUint8(3),
		};
	}

	getFirmwareVersion(): number {
		return this.activeBus.readUint8(Angle8.REGISTER.FIRMWARE_VERSION) & 0xff;
	}

	getI2CAddress(): number {
		return this.readAddress(Angle8.REGISTER.I2C_ADDRESS);
	}

	setI2CAddress(address: number): void {
		this.changeAddress(Angle8.REGISTER.I2C_ADDRESS, address);
	}

	static #angleIndex(value: number): number {
		return integerInRange(value, "angle", 0, Angle8.ANGLE_COUNT - 1);
	}

	static #ledIndex(value: number): number {
		return integerInRange(value, "led", 0, Angle8.LED_COUNT - 1);
	}

	static #resolution(value: number): void {
		if (value !== 8 && value !== 12) throw new RangeError("resolution must be 8 or 12");
	}

	static #byte(value: number, name: string): number {
		return integerInRange(value, name, 0, 0xff);
	}
}
