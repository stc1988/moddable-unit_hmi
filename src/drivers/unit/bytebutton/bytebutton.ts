import type I2C from "embedded:io/i2c";
import SMBus from "embedded:io/smbus";
import PollingInput from "hmi/polling";
import { SMBusDevice } from "hmi/smbus";
import { callbackOrNull, integerInRange, type RGBColor } from "hmi/util";
import Timer from "timer";

type I2COptions = ConstructorParameters<typeof I2C>[0];
type SMBusOptions = I2COptions & { stop?: boolean };

export interface ByteButtonIOInstance {
	readUint8(register: number): number;
	writeUint8(register: number, value: number): void;
	readBuffer(register: number, byteLength: number): ArrayBuffer;
	writeBuffer(register: number, buffer: ByteBuffer): void;
	close(): void;
}

export type ByteButtonIO = new (options: SMBusOptions) => ByteButtonIOInstance;

// @moddable/typings 8.3.1 declares the SMBus options as a tuple intersection.
// Narrow the constructor to the object accepted by the runtime implementation.
const SMBusConstructor = SMBus as unknown as ByteButtonIO;

export interface ByteButtonState {
	/** Bit n is 1 while button n is pressed. */
	buttons: number;
}

export type ByteButtonColor = RGBColor;

export type ByteButtonLedMode = 0 | 1;

export interface ByteButtonOptions {
	address?: number;
	data?: I2COptions["data"];
	clock?: I2COptions["clock"];
	hz?: number;
	io?: ByteButtonIO;
	pollingInterval?: number;
	onChange?: ByteButtonChangeCallback;
	onButtonChange?: ByteButtonButtonChangeCallback;
}

export type ByteButtonChangeCallback = (state: ByteButtonState) => void;
export type ByteButtonButtonChangeCallback = (button: number, pressed: boolean) => void;

// https://docs.m5stack.com/ja/unit/Unit%20ByteButton
export default class ByteButton extends SMBusDevice<ByteButtonIOInstance, SMBusOptions> {
	static readonly DEFAULT_ADDRESS = 0x47;
	static readonly DEFAULT_HZ = 400_000;
	static readonly BUTTON_COUNT = 8;
	static readonly LED_COUNT = 9;

	static readonly LED_MODE = {
		MANUAL: 0,
		BUTTON: 1,
	} as const;

	static readonly REGISTER = {
		BUTTONS: 0x00,
		LED_BRIGHTNESS: 0x10,
		LED_MODE: 0x19,
		LED_RGB888: 0x20,
		LED_RGB233: 0x50,
		BUTTON_VALUES: 0x60,
		BUTTON_OFF_RGB888: 0x70,
		BUTTON_ON_RGB888: 0x90,
		SAVE_TO_FLASH: 0xf0,
		IRQ_ENABLED: 0xf1,
		FIRMWARE_VERSION: 0xfe,
		I2C_ADDRESS: 0xff,
	} as const;

	#address: number;
	#polling: PollingInput<ByteButtonState>;
	#onChange: ByteButtonChangeCallback | null;
	#onButtonChange: ByteButtonButtonChangeCallback | null;
	#lastButtons?: number;
	#closed = false;

	constructor(options: ByteButtonOptions = {}) {
		super(
			options.io ?? SMBusConstructor,
			{
				data: options.data ?? device.I2C.default.data,
				clock: options.clock ?? device.I2C.default.clock,
				hz: integerInRange(options.hz ?? ByteButton.DEFAULT_HZ, "hz", 1, Number.MAX_SAFE_INTEGER),
			},
			integerInRange(options.address ?? ByteButton.DEFAULT_ADDRESS, "address", 1, 0x7f),
			"bytebutton",
		);
		this.#address = integerInRange(options.address ?? ByteButton.DEFAULT_ADDRESS, "address", 1, 0x7f);
		this.#onChange = callbackOrNull(options.onChange, "onChange");
		this.#onButtonChange = callbackOrNull(options.onButtonChange, "onButtonChange");
		try {
			this.#polling = new PollingInput(this, this, "ByteButton", {
				pollingInterval: options.pollingInterval,
				changed: (state, previous) => state.buttons !== previous.buttons,
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
		this.#onButtonChange = null;
		super.close();
	}

	start(): void {
		const wasRunning = this.#polling.running;
		this.#polling.start();
		if (!wasRunning) this.#lastButtons = undefined;
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

	set onChange(callback: ByteButtonChangeCallback | null | undefined) {
		const next = callbackOrNull(callback, "onChange");
		if (this.#closed && next) throw new Error("bytebutton is closed");
		if (next !== this.#onChange) this.#polling.onChange = null;
		this.#onChange = next;
		this.#updatePollingState();
	}

	get onChange(): ByteButtonChangeCallback | null {
		return this.#onChange;
	}

	set onButtonChange(callback: ByteButtonButtonChangeCallback | null | undefined) {
		const next = callbackOrNull(callback, "onButtonChange");
		if (this.#closed && next) throw new Error("bytebutton is closed");
		this.#onButtonChange = next;
		this.#updatePollingState();
	}

	get onButtonChange(): ByteButtonButtonChangeCallback | null {
		return this.#onButtonChange;
	}

	read(): ByteButtonState {
		return { buttons: this.readButtons() };
	}

	readButtons(): number {
		return ~this.#activeBus.readUint8(ByteButton.REGISTER.BUTTONS) & 0xff;
	}

	readButton(button: number): boolean {
		const index = ByteButton.#buttonIndex(button);
		return this.#activeBus.readUint8(ByteButton.REGISTER.BUTTON_VALUES + index) === 0;
	}

	setLedBrightness(led: number, brightness: number): void {
		this.#activeBus.writeUint8(
			ByteButton.REGISTER.LED_BRIGHTNESS + ByteButton.#ledIndex(led),
			ByteButton.#byte(brightness, "brightness"),
		);
	}

	getLedBrightness(led: number): number {
		return this.#activeBus.readUint8(ByteButton.REGISTER.LED_BRIGHTNESS + ByteButton.#ledIndex(led)) & 0xff;
	}

	setLed(led: number, color: RGBColor): void {
		this.#writeColor(ByteButton.REGISTER.LED_RGB888 + ByteButton.#ledIndex(led) * 4, color);
	}

	getLed(led: number): ByteButtonColor {
		return this.#readColor(ByteButton.REGISTER.LED_RGB888 + ByteButton.#ledIndex(led) * 4);
	}

	setLedCompact(led: number, color: RGBColor): void {
		const red = ByteButton.#byte(color.r, "r");
		const green = ByteButton.#byte(color.g, "g");
		const blue = ByteButton.#byte(color.b, "b");
		this.#activeBus.writeUint8(
			ByteButton.REGISTER.LED_RGB233 + ByteButton.#ledIndex(led),
			(red & 0xc0) | ((green & 0xe0) >> 2) | ((blue & 0xe0) >> 5),
		);
	}

	setButtonLed(button: number, pressed: boolean, color: RGBColor): void {
		const base = pressed ? ByteButton.REGISTER.BUTTON_ON_RGB888 : ByteButton.REGISTER.BUTTON_OFF_RGB888;
		this.#writeColor(base + ByteButton.#buttonIndex(button) * 4, color);
	}

	getButtonLed(button: number, pressed: boolean): ByteButtonColor {
		const base = pressed ? ByteButton.REGISTER.BUTTON_ON_RGB888 : ByteButton.REGISTER.BUTTON_OFF_RGB888;
		return this.#readColor(base + ByteButton.#buttonIndex(button) * 4);
	}

	setLedMode(mode: ByteButtonLedMode): void {
		this.#activeBus.writeUint8(ByteButton.REGISTER.LED_MODE, integerInRange(mode, "mode", 0, 1));
	}

	getLedMode(): ByteButtonLedMode {
		return this.#activeBus.readUint8(ByteButton.REGISTER.LED_MODE) === ByteButton.LED_MODE.BUTTON
			? ByteButton.LED_MODE.BUTTON
			: ByteButton.LED_MODE.MANUAL;
	}

	setIrqEnabled(enabled: boolean): void {
		if (typeof enabled !== "boolean") throw new TypeError("enabled must be a boolean");
		this.#activeBus.writeUint8(ByteButton.REGISTER.IRQ_ENABLED, enabled ? 1 : 0);
	}

	getIrqEnabled(): boolean {
		return this.#activeBus.readUint8(ByteButton.REGISTER.IRQ_ENABLED) !== 0;
	}

	saveSettings(): void {
		this.#activeBus.writeUint8(ByteButton.REGISTER.SAVE_TO_FLASH, 1);
	}

	getFirmwareVersion(): number {
		return this.#activeBus.readUint8(ByteButton.REGISTER.FIRMWARE_VERSION) & 0xff;
	}

	getI2CAddress(): number {
		return this.#activeBus.readUint8(ByteButton.REGISTER.I2C_ADDRESS) & 0x7f;
	}

	setI2CAddress(address: number): void {
		const nextAddress = integerInRange(address, "address", 1, 0x7f);
		if (nextAddress === this.#address) return;

		this.#activeBus.writeUint8(ByteButton.REGISTER.I2C_ADDRESS, nextAddress);
		this.reconnect(nextAddress);
		this.#address = nextAddress;
		Timer.delay(10);
	}

	#updatePollingState(): void {
		const callback = this.#onChange || this.#onButtonChange ? this.#handleChange : null;
		if (callback && !this.#polling.onChange) this.#lastButtons = undefined;
		this.#polling.onChange = callback;
	}

	#handleChange(state: ByteButtonState): void {
		const changed = this.#lastButtons === undefined ? 0 : state.buttons ^ this.#lastButtons;
		this.#onChange?.call(this, state);
		if (changed && this.#onButtonChange) {
			for (let button = 0; button < ByteButton.BUTTON_COUNT; button++) {
				const bit = 1 << button;
				if (changed & bit) this.#onButtonChange.call(this, button, Boolean(state.buttons & bit));
			}
		}
		this.#lastButtons = state.buttons;
	}

	#writeColor(register: number, color: RGBColor): void {
		this.#activeBus.writeBuffer(
			register,
			Uint8Array.of(ByteButton.#byte(color.b, "b"), ByteButton.#byte(color.g, "g"), ByteButton.#byte(color.r, "r"), 0),
		);
	}

	#readColor(register: number): ByteButtonColor {
		const data = new Uint8Array(this.#activeBus.readBuffer(register, 4));
		return { r: data[2], g: data[1], b: data[0] };
	}

	get #activeBus(): ByteButtonIOInstance {
		return this.activeBus;
	}

	static #buttonIndex(value: number): number {
		return integerInRange(value, "button", 0, ByteButton.BUTTON_COUNT - 1);
	}

	static #ledIndex(value: number): number {
		return integerInRange(value, "led", 0, ByteButton.LED_COUNT - 1);
	}

	static #byte(value: number, name: string): number {
		return integerInRange(value, name, 0, 0xff);
	}
}
