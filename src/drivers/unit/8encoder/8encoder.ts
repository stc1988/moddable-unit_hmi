import type I2C from "embedded:io/i2c";
import SMBus from "embedded:io/smbus";
import PollingInput from "input/polling";
import Timer from "timer";
import { callbackOrNull, I2CBusResource, integerInRange, signed32, signed32ToLittleEndian } from "hmi/util";

type I2COptions = ConstructorParameters<typeof I2C>[0];
type SMBusOptions = I2COptions & { stop?: boolean };

export interface Encoder8IOInstance {
	readUint8(register: number): number;
	writeUint8(register: number, value: number): void;
	readBuffer(register: number, byteLength: number): ArrayBuffer;
	writeBuffer(register: number, buffer: ByteBuffer): void;
	close(): void;
}

export type Encoder8IO = new (options: SMBusOptions) => Encoder8IOInstance;

// @moddable/typings 8.3.1 declares the SMBus options as a tuple intersection.
// Narrow the constructor to the object accepted by the runtime implementation.
const SMBusConstructor = SMBus as unknown as Encoder8IO;

export interface Encoder8State {
	/** Signed counter values for encoders 0 through 7. */
	encoders: readonly number[];
	/** Bit n is 1 while encoder button n is pressed. */
	buttons: number;
	/** State of the physical toggle switch. */
	switchOn: boolean;
}

export interface Encoder8Color {
	r: number;
	g: number;
	b: number;
}

export interface Encoder8Options {
	address?: number;
	data?: I2COptions["data"];
	clock?: I2COptions["clock"];
	hz?: number;
	io?: Encoder8IO;
	pollingInterval?: number;
	onChange?: Encoder8ChangeCallback;
	onEncoderChange?: Encoder8EncoderChangeCallback;
	onButtonChange?: Encoder8ButtonChangeCallback;
	onSwitchChange?: Encoder8SwitchChangeCallback;
}

export type Encoder8ChangeCallback = (state: Encoder8State) => void;
export type Encoder8EncoderChangeCallback = (encoder: number, value: number) => void;
export type Encoder8ButtonChangeCallback = (button: number, pressed: boolean) => void;
export type Encoder8SwitchChangeCallback = (on: boolean) => void;

// https://docs.m5stack.com/en/unit/8Encoder
export default class Encoder8 {
	static readonly DEFAULT_ADDRESS = 0x41;
	static readonly DEFAULT_HZ = 100_000;
	static readonly ENCODER_COUNT = 8;
	static readonly BUTTON_COUNT = 8;
	static readonly LED_COUNT = 9;
	static readonly SWITCH_LED = 8;

	static readonly REGISTER = {
		ENCODER: 0x00,
		INCREMENT: 0x20,
		RESET_COUNTER: 0x40,
		BUTTON: 0x50,
		BUTTON_TOGGLE_COUNT: 0x58,
		SWITCH: 0x60,
		ENCODER_CHANGE_FLAGS: 0x61,
		BUTTONS: 0x62,
		RGB_LED: 0x70,
		FIRMWARE_VERSION: 0xfe,
		I2C_ADDRESS: 0xff,
	} as const;

	#bus: I2CBusResource<Encoder8IOInstance, SMBusOptions>;
	#address: number;
	#polling: PollingInput<Encoder8State>;
	#onChange: Encoder8ChangeCallback | null;
	#onEncoderChange: Encoder8EncoderChangeCallback | null;
	#onButtonChange: Encoder8ButtonChangeCallback | null;
	#onSwitchChange: Encoder8SwitchChangeCallback | null;
	#lastState?: Encoder8State;
	#closed = false;

	constructor(options: Encoder8Options = {}) {
		this.#address = integerInRange(options.address ?? Encoder8.DEFAULT_ADDRESS, "address", 1, 0x7f);
		this.#bus = new I2CBusResource(
			options.io ?? SMBusConstructor,
			{
				data: options.data ?? device.I2C.default.data,
				clock: options.clock ?? device.I2C.default.clock,
				hz: integerInRange(options.hz ?? Encoder8.DEFAULT_HZ, "hz", 1, Number.MAX_SAFE_INTEGER),
			},
			this.#address,
			"8encoder",
		);
		this.#onChange = callbackOrNull(options.onChange, "onChange");
		this.#onEncoderChange = callbackOrNull(options.onEncoderChange, "onEncoderChange");
		this.#onButtonChange = callbackOrNull(options.onButtonChange, "onButtonChange");
		this.#onSwitchChange = callbackOrNull(options.onSwitchChange, "onSwitchChange");
		try {
			this.#polling = new PollingInput(this, this, "8Encoder", {
				pollingInterval: options.pollingInterval,
				changed: (state, previous) => Encoder8.#stateChanged(state, previous),
			});
			this.#updatePollingState();
		} catch (error) {
			this.#bus.close();
			throw error;
		}
	}

	close(): void {
		if (this.#closed) return;
		this.#polling.close();
		this.#closed = true;
		this.#onChange = null;
		this.#onEncoderChange = null;
		this.#onButtonChange = null;
		this.#onSwitchChange = null;
		this.#lastState = undefined;
		this.#bus.close();
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

	set onChange(callback: Encoder8ChangeCallback | null | undefined) {
		const next = callbackOrNull(callback, "onChange");
		if (this.#closed && next) throw new Error("8encoder is closed");
		if (next !== this.#onChange) this.#polling.onChange = null;
		this.#onChange = next;
		this.#updatePollingState();
	}

	get onChange(): Encoder8ChangeCallback | null {
		return this.#onChange;
	}

	set onEncoderChange(callback: Encoder8EncoderChangeCallback | null | undefined) {
		const next = callbackOrNull(callback, "onEncoderChange");
		if (this.#closed && next) throw new Error("8encoder is closed");
		this.#onEncoderChange = next;
		this.#updatePollingState();
	}

	get onEncoderChange(): Encoder8EncoderChangeCallback | null {
		return this.#onEncoderChange;
	}

	set onButtonChange(callback: Encoder8ButtonChangeCallback | null | undefined) {
		const next = callbackOrNull(callback, "onButtonChange");
		if (this.#closed && next) throw new Error("8encoder is closed");
		this.#onButtonChange = next;
		this.#updatePollingState();
	}

	get onButtonChange(): Encoder8ButtonChangeCallback | null {
		return this.#onButtonChange;
	}

	set onSwitchChange(callback: Encoder8SwitchChangeCallback | null | undefined) {
		const next = callbackOrNull(callback, "onSwitchChange");
		if (this.#closed && next) throw new Error("8encoder is closed");
		this.#onSwitchChange = next;
		this.#updatePollingState();
	}

	get onSwitchChange(): Encoder8SwitchChangeCallback | null {
		return this.#onSwitchChange;
	}

	read(): Encoder8State {
		return {
			encoders: this.readEncoders(),
			buttons: this.readButtons(),
			switchOn: this.isSwitchOn(),
		};
	}

	readEncoders(): number[] {
		return Encoder8.#readSignedValues(
			this.#activeBus.readBuffer(Encoder8.REGISTER.ENCODER, Encoder8.ENCODER_COUNT * 4),
		);
	}

	readEncoder(encoder: number): number {
		const data = this.#activeBus.readBuffer(Encoder8.REGISTER.ENCODER + Encoder8.#encoderIndex(encoder) * 4, 4);
		return signed32(new Uint8Array(data), 0);
	}

	setEncoder(encoder: number, value: number): void {
		this.#activeBus.writeBuffer(
			Encoder8.REGISTER.ENCODER + Encoder8.#encoderIndex(encoder) * 4,
			signed32ToLittleEndian(value, "value"),
		);
	}

	readIncrements(): number[] {
		return Encoder8.#readSignedValues(
			this.#activeBus.readBuffer(Encoder8.REGISTER.INCREMENT, Encoder8.ENCODER_COUNT * 4),
		);
	}

	readIncrement(encoder: number): number {
		const data = this.#activeBus.readBuffer(Encoder8.REGISTER.INCREMENT + Encoder8.#encoderIndex(encoder) * 4, 4);
		return signed32(new Uint8Array(data), 0);
	}

	readEncoderChangeFlags(): number {
		return this.#activeBus.readUint8(Encoder8.REGISTER.ENCODER_CHANGE_FLAGS) & 0xff;
	}

	resetEncoder(encoder: number): void {
		this.#activeBus.writeUint8(Encoder8.REGISTER.RESET_COUNTER + Encoder8.#encoderIndex(encoder), 1);
	}

	resetEncoders(): void {
		this.#activeBus.writeBuffer(Encoder8.REGISTER.RESET_COUNTER, Uint8Array.of(1, 1, 1, 1, 1, 1, 1, 1));
	}

	readButtons(): number {
		return ~this.#activeBus.readUint8(Encoder8.REGISTER.BUTTONS) & 0xff;
	}

	isButtonPressed(button: number): boolean {
		return this.#activeBus.readUint8(Encoder8.REGISTER.BUTTON + Encoder8.#buttonIndex(button)) === 0;
	}

	readButtonToggleCounts(): number[] {
		return Array.from(
			new Uint8Array(this.#activeBus.readBuffer(Encoder8.REGISTER.BUTTON_TOGGLE_COUNT, Encoder8.BUTTON_COUNT)),
		);
	}

	isSwitchOn(): boolean {
		return this.#activeBus.readUint8(Encoder8.REGISTER.SWITCH) !== 0;
	}

	setLed(led: number, r: number, g: number, b: number): void {
		this.#activeBus.writeBuffer(
			Encoder8.REGISTER.RGB_LED + Encoder8.#ledIndex(led) * 3,
			Uint8Array.of(Encoder8.#byte(r, "r"), Encoder8.#byte(g, "g"), Encoder8.#byte(b, "b")),
		);
	}

	getLed(led: number): Encoder8Color {
		const data = new Uint8Array(this.#activeBus.readBuffer(Encoder8.REGISTER.RGB_LED + Encoder8.#ledIndex(led) * 3, 3));
		return { r: data[0], g: data[1], b: data[2] };
	}

	setAllLeds(r: number, g: number, b: number): void {
		const red = Encoder8.#byte(r, "r");
		const green = Encoder8.#byte(g, "g");
		const blue = Encoder8.#byte(b, "b");
		const data = new Uint8Array(Encoder8.LED_COUNT * 3);
		for (let offset = 0; offset < data.length; offset += 3) {
			data[offset] = red;
			data[offset + 1] = green;
			data[offset + 2] = blue;
		}
		this.#activeBus.writeBuffer(Encoder8.REGISTER.RGB_LED, data);
	}

	getFirmwareVersion(): number {
		return this.#activeBus.readUint8(Encoder8.REGISTER.FIRMWARE_VERSION) & 0xff;
	}

	getI2CAddress(): number {
		return this.#activeBus.readUint8(Encoder8.REGISTER.I2C_ADDRESS) & 0x7f;
	}

	setI2CAddress(address: number): void {
		const nextAddress = integerInRange(address, "address", 1, 0x7f);
		if (nextAddress === this.#address) return;

		this.#activeBus.writeUint8(Encoder8.REGISTER.I2C_ADDRESS, nextAddress);
		this.#bus.open(nextAddress);
		this.#address = nextAddress;
		Timer.delay(10);
	}

	#updatePollingState(): void {
		const callback =
			this.#onChange || this.#onEncoderChange || this.#onButtonChange || this.#onSwitchChange
				? this.#handleChange
				: null;
		if (callback && !this.#polling.onChange) this.#lastState = undefined;
		this.#polling.onChange = callback;
	}

	#handleChange(state: Encoder8State): void {
		const previous = this.#lastState;
		this.#onChange?.call(this, state);
		if (previous) {
			if (this.#onEncoderChange) {
				for (let encoder = 0; encoder < Encoder8.ENCODER_COUNT; encoder++) {
					if (state.encoders[encoder] !== previous.encoders[encoder])
						this.#onEncoderChange.call(this, encoder, state.encoders[encoder]);
				}
			}

			const changedButtons = state.buttons ^ previous.buttons;
			if (changedButtons && this.#onButtonChange) {
				for (let button = 0; button < Encoder8.BUTTON_COUNT; button++) {
					const bit = 1 << button;
					if (changedButtons & bit) this.#onButtonChange.call(this, button, Boolean(state.buttons & bit));
				}
			}

			if (state.switchOn !== previous.switchOn) this.#onSwitchChange?.call(this, state.switchOn);
		}
		this.#lastState = state;
	}

	get #activeBus(): Encoder8IOInstance {
		return this.#bus.active;
	}

	static #stateChanged(state: Encoder8State, previous: Encoder8State): boolean {
		if (state.buttons !== previous.buttons || state.switchOn !== previous.switchOn) return true;
		for (let encoder = 0; encoder < Encoder8.ENCODER_COUNT; encoder++) {
			if (state.encoders[encoder] !== previous.encoders[encoder]) return true;
		}
		return false;
	}

	static #readSignedValues(buffer: ArrayBuffer): number[] {
		const data = new Uint8Array(buffer);
		const values = new Array<number>(Encoder8.ENCODER_COUNT);
		for (let encoder = 0; encoder < Encoder8.ENCODER_COUNT; encoder++) values[encoder] = signed32(data, encoder * 4);
		return values;
	}

	static #encoderIndex(value: number): number {
		return integerInRange(value, "encoder", 0, Encoder8.ENCODER_COUNT - 1);
	}

	static #buttonIndex(value: number): number {
		return integerInRange(value, "button", 0, Encoder8.BUTTON_COUNT - 1);
	}

	static #ledIndex(value: number): number {
		return integerInRange(value, "led", 0, Encoder8.LED_COUNT - 1);
	}

	static #byte(value: number, name: string): number {
		return integerInRange(value, name, 0, 0xff);
	}
}
