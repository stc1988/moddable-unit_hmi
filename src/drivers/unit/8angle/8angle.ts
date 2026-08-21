import type I2C from "embedded:io/i2c";
import SMBus from "embedded:io/smbus";
import PollingInput from "hmi/polling";
import { SMBusDevice } from "hmi/smbus";
import { callbackOrNull, integerInRange, type RGBColor } from "hmi/util";
import Timer from "timer";

type I2COptions = ConstructorParameters<typeof I2C>[0];
type SMBusOptions = I2COptions & { stop?: boolean };

export interface Angle8IOInstance {
	readUint8(register: number): number;
	writeUint8(register: number, value: number): void;
	readBuffer(register: number, byteLength: number): ArrayBuffer;
	writeBuffer(register: number, buffer: ByteBuffer): void;
	close(): void;
}

export type Angle8IO = new (options: SMBusOptions) => Angle8IOInstance;

// @moddable/typings 8.3.1 declares the SMBus options as a tuple intersection.
// Narrow the constructor to the object accepted by the runtime implementation.
const SMBusConstructor = SMBus as unknown as Angle8IO;

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

export interface Angle8Options {
	address?: number;
	data?: I2COptions["data"];
	clock?: I2COptions["clock"];
	hz?: number;
	io?: Angle8IO;
	pollingInterval?: number;
	deadband?: number;
	onChange?: Angle8ChangeCallback;
	onAngleChange?: Angle8AngleChangeCallback;
	onSwitchChange?: Angle8SwitchChangeCallback;
}

export type Angle8ChangeCallback = (state: Angle8State) => void;
export type Angle8AngleChangeCallback = (angle: number, value: number) => void;
export type Angle8SwitchChangeCallback = (on: boolean) => void;

export class Angle8Input {
	#target: object;
	#polling: PollingInput<Angle8State>;
	#onChange: Angle8ChangeCallback | null;
	#onAngleChange: Angle8AngleChangeCallback | null;
	#onSwitchChange: Angle8SwitchChangeCallback | null;
	#lastState?: Angle8State;
	#deadband: number;
	#closed = false;

	constructor(target: object, source: { read(): Angle8State }, options: Angle8Options) {
		this.#target = target;
		this.#deadband = PollingInput.nonNegativeInteger(options.deadband ?? 0, "deadband");
		this.#onChange = callbackOrNull(options.onChange, "onChange");
		this.#onAngleChange = callbackOrNull(options.onAngleChange, "onAngleChange");
		this.#onSwitchChange = callbackOrNull(options.onSwitchChange, "onSwitchChange");
		this.#polling = new PollingInput(this, source, "8Angle", {
			pollingInterval: options.pollingInterval,
			changed: (state, previous) => this.#stateChanged(state, previous),
		});
		this.#updatePollingState();
	}

	close(): void {
		if (this.#closed) return;
		this.#polling.close();
		this.#closed = true;
		this.#onChange = null;
		this.#onAngleChange = null;
		this.#onSwitchChange = null;
		this.#lastState = undefined;
	}

	start(): void {
		const wasRunning = this.#polling.running;
		this.#polling.start();
		if (!wasRunning) this.#lastState = undefined;
	}

	stop(): void {
		this.#polling.stop();
	}

	set pollingInterval(value: number) {
		this.#polling.pollingInterval = value;
	}

	get pollingInterval(): number {
		return this.#polling.pollingInterval;
	}

	set deadband(value: number) {
		this.#deadband = PollingInput.nonNegativeInteger(value, "deadband");
	}

	get deadband(): number {
		return this.#deadband;
	}

	set onChange(callback: Angle8ChangeCallback | null | undefined) {
		const next = callbackOrNull(callback, "onChange");
		if (this.#closed && next) throw new Error("8angle input is closed");
		if (next !== this.#onChange) this.#polling.onChange = null;
		this.#onChange = next;
		this.#updatePollingState();
	}

	get onChange(): Angle8ChangeCallback | null {
		return this.#onChange;
	}

	set onAngleChange(callback: Angle8AngleChangeCallback | null | undefined) {
		const next = callbackOrNull(callback, "onAngleChange");
		if (this.#closed && next) throw new Error("8angle input is closed");
		this.#onAngleChange = next;
		this.#updatePollingState();
	}

	get onAngleChange(): Angle8AngleChangeCallback | null {
		return this.#onAngleChange;
	}

	set onSwitchChange(callback: Angle8SwitchChangeCallback | null | undefined) {
		const next = callbackOrNull(callback, "onSwitchChange");
		if (this.#closed && next) throw new Error("8angle input is closed");
		this.#onSwitchChange = next;
		this.#updatePollingState();
	}

	get onSwitchChange(): Angle8SwitchChangeCallback | null {
		return this.#onSwitchChange;
	}

	#updatePollingState(): void {
		const callback = this.#onChange || this.#onAngleChange || this.#onSwitchChange ? this.#handleChange : null;
		if (callback && !this.#polling.onChange) this.#lastState = undefined;
		this.#polling.onChange = callback;
	}

	#handleChange(state: Angle8State): void {
		const previous = this.#lastState;
		this.#onChange?.call(this.#target, state);
		if (previous && this.#onAngleChange) {
			for (let angle = 0; angle < Angle8.ANGLE_COUNT; angle++) {
				if (Math.abs(state.angles[angle] - previous.angles[angle]) > this.#deadband)
					this.#onAngleChange.call(this.#target, angle, state.angles[angle]);
			}
		}
		if (previous && state.switchOn !== previous.switchOn) this.#onSwitchChange?.call(this.#target, state.switchOn);
		this.#lastState = state;
	}

	#stateChanged(state: Angle8State, previous: Angle8State): boolean {
		if (state.switchOn !== previous.switchOn) return true;
		for (let angle = 0; angle < Angle8.ANGLE_COUNT; angle++) {
			if (Math.abs(state.angles[angle] - previous.angles[angle]) > this.#deadband) return true;
		}
		return false;
	}
}

// https://docs.m5stack.com/en/unit/8Angle
export default class Angle8 extends SMBusDevice<Angle8IOInstance, SMBusOptions> {
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

	#address: number;
	readonly input: Angle8Input;

	constructor(options: Angle8Options = {}) {
		super(
			options.io ?? SMBusConstructor,
			{
				data: options.data ?? device.I2C.default.data,
				clock: options.clock ?? device.I2C.default.clock,
				hz: integerInRange(options.hz ?? Angle8.DEFAULT_HZ, "hz", 1, Number.MAX_SAFE_INTEGER),
			},
			integerInRange(options.address ?? Angle8.DEFAULT_ADDRESS, "address", 1, 0x7f),
			"8angle",
		);
		this.#address = integerInRange(options.address ?? Angle8.DEFAULT_ADDRESS, "address", 1, 0x7f);
		try {
			this.input = new Angle8Input(this, this, options);
		} catch (error) {
			super.close();
			throw error;
		}
	}

	close(): void {
		this.input.close();
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
			return Array.from(new Uint8Array(this.#activeBus.readBuffer(Angle8.REGISTER.ANALOG_8BIT, Angle8.ANGLE_COUNT)));

		const data = new Uint8Array(this.#activeBus.readBuffer(Angle8.REGISTER.ANALOG_12BIT, Angle8.ANGLE_COUNT * 2));
		const angles = new Array<number>(Angle8.ANGLE_COUNT);
		for (let angle = 0; angle < Angle8.ANGLE_COUNT; angle++)
			angles[angle] = (data[angle * 2] | (data[angle * 2 + 1] << 8)) & 0x0fff;
		return angles;
	}

	readAngle(angle: number, resolution: Angle8Resolution = 12): number {
		const index = Angle8.#angleIndex(angle);
		Angle8.#resolution(resolution);
		if (resolution === 8) return this.#activeBus.readUint8(Angle8.REGISTER.ANALOG_8BIT + index) & 0xff;

		const data = new Uint8Array(this.#activeBus.readBuffer(Angle8.REGISTER.ANALOG_12BIT + index * 2, 2));
		return (data[0] | (data[1] << 8)) & 0x0fff;
	}

	isSwitchOn(): boolean {
		return this.#activeBus.readUint8(Angle8.REGISTER.SWITCH) !== 0;
	}

	setLed(led: number, color: RGBColor, brightness = 100): void {
		this.#activeBus.writeBuffer(
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
		const data = new Uint8Array(this.#activeBus.readBuffer(Angle8.REGISTER.RGB_LED + Angle8.#ledIndex(led) * 4, 4));
		return { r: data[0], g: data[1], b: data[2], brightness: data[3] };
	}

	getFirmwareVersion(): number {
		return this.#activeBus.readUint8(Angle8.REGISTER.FIRMWARE_VERSION) & 0xff;
	}

	getI2CAddress(): number {
		return this.#activeBus.readUint8(Angle8.REGISTER.I2C_ADDRESS) & 0x7f;
	}

	setI2CAddress(address: number): void {
		const nextAddress = integerInRange(address, "address", 1, 0x7f);
		if (nextAddress === this.#address) return;

		this.#activeBus.writeUint8(Angle8.REGISTER.I2C_ADDRESS, nextAddress);
		this.reconnect(nextAddress);
		this.#address = nextAddress;
		Timer.delay(10);
	}

	get #activeBus(): Angle8IOInstance {
		return this.activeBus;
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
