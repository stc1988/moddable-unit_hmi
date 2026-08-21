import type I2C from "embedded:io/i2c";
import SMBus from "embedded:io/smbus";
import { SMBusDevice } from "hmi/smbus";
import { callbackOrNull, integerInRange, type RGBColor } from "hmi/util";
import PollingInput from "input/polling";
import Timer from "timer";

type I2COptions = ConstructorParameters<typeof I2C>[0];
type SMBusOptions = I2COptions & { stop?: boolean };

export interface ByteSwitchIOInstance {
	readUint8(register: number): number;
	writeUint8(register: number, value: number): void;
	readBuffer(register: number, byteLength: number): ArrayBuffer;
	writeBuffer(register: number, buffer: ByteBuffer): void;
	close(): void;
}

export type ByteSwitchIO = new (options: SMBusOptions) => ByteSwitchIOInstance;

// @moddable/typings 8.3.1 declares the SMBus options as a tuple intersection.
// Narrow the constructor to the object accepted by the runtime implementation.
const SMBusConstructor = SMBus as unknown as ByteSwitchIO;

export interface ByteSwitchState {
	/** Bit n is 1 while switch n is on. */
	switches: number;
}

export type ByteSwitchColor = RGBColor;

export type ByteSwitchLedMode = 0 | 1;

export interface ByteSwitchOptions {
	address?: number;
	data?: I2COptions["data"];
	clock?: I2COptions["clock"];
	hz?: number;
	io?: ByteSwitchIO;
	pollingInterval?: number;
	onChange?: ByteSwitchChangeCallback;
	onSwitchChange?: ByteSwitchSwitchChangeCallback;
}

export type ByteSwitchChangeCallback = (state: ByteSwitchState) => void;
export type ByteSwitchSwitchChangeCallback = (switchIndex: number, on: boolean) => void;

// https://docs.m5stack.com/en/unit/Unit%20ByteSwitch
export default class ByteSwitch extends SMBusDevice<ByteSwitchIOInstance, SMBusOptions> {
	static readonly DEFAULT_ADDRESS = 0x46;
	static readonly DEFAULT_HZ = 400_000;
	static readonly SWITCH_COUNT = 8;
	static readonly LED_COUNT = 9;

	static readonly LED_MODE = {
		MANUAL: 0,
		SWITCH: 1,
	} as const;

	static readonly REGISTER = {
		SWITCHES: 0x00,
		LED_BRIGHTNESS: 0x10,
		LED_MODE: 0x19,
		LED_RGB888: 0x20,
		LED_RGB233: 0x50,
		SWITCH_VALUES: 0x60,
		SWITCH_OFF_RGB888: 0x70,
		SWITCH_ON_RGB888: 0x90,
		SAVE_TO_FLASH: 0xf0,
		IRQ_ENABLED: 0xf1,
		FIRMWARE_VERSION: 0xfe,
		I2C_ADDRESS: 0xff,
	} as const;

	#address: number;
	#polling: PollingInput<ByteSwitchState>;
	#onChange: ByteSwitchChangeCallback | null;
	#onSwitchChange: ByteSwitchSwitchChangeCallback | null;
	#lastSwitches?: number;
	#closed = false;

	constructor(options: ByteSwitchOptions = {}) {
		super(
			options.io ?? SMBusConstructor,
			{
				data: options.data ?? device.I2C.default.data,
				clock: options.clock ?? device.I2C.default.clock,
				hz: integerInRange(options.hz ?? ByteSwitch.DEFAULT_HZ, "hz", 1, Number.MAX_SAFE_INTEGER),
			},
			integerInRange(options.address ?? ByteSwitch.DEFAULT_ADDRESS, "address", 1, 0x7f),
			"byteswitch",
		);
		this.#address = integerInRange(options.address ?? ByteSwitch.DEFAULT_ADDRESS, "address", 1, 0x7f);
		this.#onChange = callbackOrNull(options.onChange, "onChange");
		this.#onSwitchChange = callbackOrNull(options.onSwitchChange, "onSwitchChange");
		try {
			this.#polling = new PollingInput(this, this, "ByteSwitch", {
				pollingInterval: options.pollingInterval,
				changed: (state, previous) => state.switches !== previous.switches,
			});
			this.#updatePollingState();
		} catch (error) {
			super.close();
			throw error;
		}
	}

	close(): void {
		if (this.#closed) return;
		this.#polling.close();
		this.#closed = true;
		this.#onChange = null;
		this.#onSwitchChange = null;
		super.close();
	}

	start(): void {
		const wasRunning = this.#polling.running;
		this.#polling.start();
		if (!wasRunning) this.#lastSwitches = undefined;
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

	set onChange(callback: ByteSwitchChangeCallback | null | undefined) {
		const next = callbackOrNull(callback, "onChange");
		if (this.#closed && next) throw new Error("byteswitch is closed");
		if (next !== this.#onChange) this.#polling.onChange = null;
		this.#onChange = next;
		this.#updatePollingState();
	}

	get onChange(): ByteSwitchChangeCallback | null {
		return this.#onChange;
	}

	set onSwitchChange(callback: ByteSwitchSwitchChangeCallback | null | undefined) {
		const next = callbackOrNull(callback, "onSwitchChange");
		if (this.#closed && next) throw new Error("byteswitch is closed");
		this.#onSwitchChange = next;
		this.#updatePollingState();
	}

	get onSwitchChange(): ByteSwitchSwitchChangeCallback | null {
		return this.#onSwitchChange;
	}

	read(): ByteSwitchState {
		return { switches: this.readSwitches() };
	}

	readSwitches(): number {
		return this.#activeBus.readUint8(ByteSwitch.REGISTER.SWITCHES) & 0xff;
	}

	readSwitch(switchIndex: number): boolean {
		const index = ByteSwitch.#switchIndex(switchIndex);
		return this.#activeBus.readUint8(ByteSwitch.REGISTER.SWITCH_VALUES + index) !== 0;
	}

	setLedBrightness(led: number, brightness: number): void {
		this.#activeBus.writeUint8(
			ByteSwitch.REGISTER.LED_BRIGHTNESS + ByteSwitch.#ledIndex(led),
			ByteSwitch.#byte(brightness, "brightness"),
		);
	}

	getLedBrightness(led: number): number {
		return this.#activeBus.readUint8(ByteSwitch.REGISTER.LED_BRIGHTNESS + ByteSwitch.#ledIndex(led)) & 0xff;
	}

	setLed(led: number, color: RGBColor): void {
		this.#writeColor(ByteSwitch.REGISTER.LED_RGB888 + ByteSwitch.#ledIndex(led) * 4, color);
	}

	getLed(led: number): ByteSwitchColor {
		return this.#readColor(ByteSwitch.REGISTER.LED_RGB888 + ByteSwitch.#ledIndex(led) * 4);
	}

	setLedCompact(led: number, color: RGBColor): void {
		const red = ByteSwitch.#byte(color.r, "r");
		const green = ByteSwitch.#byte(color.g, "g");
		const blue = ByteSwitch.#byte(color.b, "b");
		this.#activeBus.writeUint8(
			ByteSwitch.REGISTER.LED_RGB233 + ByteSwitch.#ledIndex(led),
			(red & 0xc0) | ((green & 0xe0) >> 2) | ((blue & 0xe0) >> 5),
		);
	}

	setSwitchLed(switchIndex: number, on: boolean, color: RGBColor): void {
		const base = on ? ByteSwitch.REGISTER.SWITCH_ON_RGB888 : ByteSwitch.REGISTER.SWITCH_OFF_RGB888;
		this.#writeColor(base + ByteSwitch.#switchIndex(switchIndex) * 4, color);
	}

	getSwitchLed(switchIndex: number, on: boolean): ByteSwitchColor {
		const base = on ? ByteSwitch.REGISTER.SWITCH_ON_RGB888 : ByteSwitch.REGISTER.SWITCH_OFF_RGB888;
		return this.#readColor(base + ByteSwitch.#switchIndex(switchIndex) * 4);
	}

	setLedMode(mode: ByteSwitchLedMode): void {
		this.#activeBus.writeUint8(ByteSwitch.REGISTER.LED_MODE, integerInRange(mode, "mode", 0, 1));
	}

	getLedMode(): ByteSwitchLedMode {
		return this.#activeBus.readUint8(ByteSwitch.REGISTER.LED_MODE) === ByteSwitch.LED_MODE.SWITCH
			? ByteSwitch.LED_MODE.SWITCH
			: ByteSwitch.LED_MODE.MANUAL;
	}

	setIrqEnabled(enabled: boolean): void {
		if (typeof enabled !== "boolean") throw new TypeError("enabled must be a boolean");
		this.#activeBus.writeUint8(ByteSwitch.REGISTER.IRQ_ENABLED, enabled ? 1 : 0);
	}

	getIrqEnabled(): boolean {
		return this.#activeBus.readUint8(ByteSwitch.REGISTER.IRQ_ENABLED) !== 0;
	}

	saveSettings(): void {
		this.#activeBus.writeUint8(ByteSwitch.REGISTER.SAVE_TO_FLASH, 1);
	}

	getFirmwareVersion(): number {
		return this.#activeBus.readUint8(ByteSwitch.REGISTER.FIRMWARE_VERSION) & 0xff;
	}

	getI2CAddress(): number {
		return this.#activeBus.readUint8(ByteSwitch.REGISTER.I2C_ADDRESS) & 0x7f;
	}

	setI2CAddress(address: number): void {
		const nextAddress = integerInRange(address, "address", 1, 0x7f);
		if (nextAddress === this.#address) return;

		this.#activeBus.writeUint8(ByteSwitch.REGISTER.I2C_ADDRESS, nextAddress);
		this.reconnect(nextAddress);
		this.#address = nextAddress;
		Timer.delay(10);
	}

	#updatePollingState(): void {
		const callback = this.#onChange || this.#onSwitchChange ? this.#handleChange : null;
		if (callback && !this.#polling.onChange) this.#lastSwitches = undefined;
		this.#polling.onChange = callback;
	}

	#handleChange(state: ByteSwitchState): void {
		const changed = this.#lastSwitches === undefined ? 0 : state.switches ^ this.#lastSwitches;
		this.#onChange?.call(this, state);
		if (changed && this.#onSwitchChange) {
			for (let switchIndex = 0; switchIndex < ByteSwitch.SWITCH_COUNT; switchIndex++) {
				const bit = 1 << switchIndex;
				if (changed & bit) this.#onSwitchChange.call(this, switchIndex, Boolean(state.switches & bit));
			}
		}
		this.#lastSwitches = state.switches;
	}

	#writeColor(register: number, color: RGBColor): void {
		this.#activeBus.writeBuffer(
			register,
			Uint8Array.of(ByteSwitch.#byte(color.b, "b"), ByteSwitch.#byte(color.g, "g"), ByteSwitch.#byte(color.r, "r"), 0),
		);
	}

	#readColor(register: number): ByteSwitchColor {
		const data = new Uint8Array(this.#activeBus.readBuffer(register, 4));
		return { r: data[2], g: data[1], b: data[0] };
	}

	get #activeBus(): ByteSwitchIOInstance {
		return this.activeBus;
	}

	static #switchIndex(value: number): number {
		return integerInRange(value, "switchIndex", 0, ByteSwitch.SWITCH_COUNT - 1);
	}

	static #ledIndex(value: number): number {
		return integerInRange(value, "led", 0, ByteSwitch.LED_COUNT - 1);
	}

	static #byte(value: number, name: string): number {
		return integerInRange(value, name, 0, 0xff);
	}
}
