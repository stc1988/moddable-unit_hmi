import PollingInput, { type InputSource, type PollingInputOptions } from "hmi/polling";
import { type I2COptions, SMBusDevice, type SMBusDeviceOptions, type SMBusInstance, type SMBusIO } from "hmi/smbus";
import { callbackOrNull, integerInRange, type RGBColor } from "hmi/util";

export type BytePanelI2COptions = I2COptions;

export interface BytePanelIOInstance extends SMBusInstance {
	readUint8(register: number): number;
	writeUint8(register: number, value: number): void;
	readBuffer(register: number, byteLength: number): ArrayBuffer;
	writeBuffer(register: number, buffer: ByteBuffer): void;
}

export type BytePanelIO<Bus extends BytePanelIOInstance = BytePanelIOInstance> = SMBusIO<Bus>;

export type BytePanelOptions<IO extends BytePanelIO = BytePanelIO> = SMBusDeviceOptions<IO>;

export interface BytePanelInputOptions<State> {
	pollingInterval?: number;
	onChange?: BytePanelChangeCallback<State>;
	onInputChange?: BytePanelInputChangeCallback;
}

export type BytePanelChangeCallback<State> = (state: State) => void;
export type BytePanelInputChangeCallback = (index: number, on: boolean) => void;

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
	static readonly INPUT_COUNT = INPUT_COUNT;
	static readonly LED_COUNT = LED_COUNT;

	protected constructor(options: BytePanelOptions<BytePanelIO<Bus>>, defaultAddress: number, name: string) {
		super(options, { address: defaultAddress, hz: DEFAULT_HZ, name });
	}

	protected readInputs(activeLow: boolean): number {
		const inputs = this.activeBus.readUint8(REGISTER.INPUTS) & 0xff;
		return activeLow ? ~inputs & 0xff : inputs;
	}

	protected readInput(index: number, activeLow: boolean): boolean {
		const value = this.activeBus.readUint8(REGISTER.INPUT_VALUES + BytePanel.#inputIndex(index));
		return activeLow ? value === 0 : value !== 0;
	}

	setLedBrightness(led: number, brightness: number): void {
		this.activeBus.writeUint8(
			REGISTER.LED_BRIGHTNESS + BytePanel.#ledIndex(led),
			BytePanel.#byte(brightness, "brightness"),
		);
	}

	getLedBrightness(led: number): number {
		return this.activeBus.readUint8(REGISTER.LED_BRIGHTNESS + BytePanel.#ledIndex(led)) & 0xff;
	}

	setLed(led: number, color: RGBColor): void {
		this.#writeColor(REGISTER.LED_RGB888 + BytePanel.#ledIndex(led) * 4, color);
	}

	getLed(led: number): RGBColor {
		return this.#readColor(REGISTER.LED_RGB888 + BytePanel.#ledIndex(led) * 4);
	}

	setLedCompact(led: number, color: RGBColor): void {
		const red = BytePanel.#byte(color.r, "r");
		const green = BytePanel.#byte(color.g, "g");
		const blue = BytePanel.#byte(color.b, "b");
		this.activeBus.writeUint8(
			REGISTER.LED_RGB233 + BytePanel.#ledIndex(led),
			(red & 0xc0) | ((green & 0xe0) >> 2) | ((blue & 0xe0) >> 5),
		);
	}

	protected setInputLed(index: number, on: boolean, color: RGBColor): void {
		const base = on ? REGISTER.INPUT_ON_RGB888 : REGISTER.INPUT_OFF_RGB888;
		this.#writeColor(base + BytePanel.#inputIndex(index) * 4, color);
	}

	protected getInputLed(index: number, on: boolean): RGBColor {
		const base = on ? REGISTER.INPUT_ON_RGB888 : REGISTER.INPUT_OFF_RGB888;
		return this.#readColor(base + BytePanel.#inputIndex(index) * 4);
	}

	protected setLedModeValue(mode: number): void {
		this.activeBus.writeUint8(REGISTER.LED_MODE, integerInRange(mode, "mode", 0, 1));
	}

	protected getLedModeValue(): 0 | 1 {
		return this.activeBus.readUint8(REGISTER.LED_MODE) === 1 ? 1 : 0;
	}

	saveSettings(): void {
		this.activeBus.writeUint8(REGISTER.SAVE_TO_FLASH, 1);
	}

	getFirmwareVersion(): number {
		return this.activeBus.readUint8(REGISTER.FIRMWARE_VERSION) & 0xff;
	}

	getI2CAddress(): number {
		return this.readAddress(REGISTER.I2C_ADDRESS);
	}

	setI2CAddress(address: number): void {
		this.changeAddress(REGISTER.I2C_ADDRESS, address);
	}

	#writeColor(register: number, color: RGBColor): void {
		this.activeBus.writeBuffer(
			register,
			Uint8Array.of(BytePanel.#byte(color.b, "b"), BytePanel.#byte(color.g, "g"), BytePanel.#byte(color.r, "r"), 0),
		);
	}

	#readColor(register: number): RGBColor {
		const data = new DataView(this.activeBus.readBuffer(register, 4));
		return { r: data.getUint8(2), g: data.getUint8(1), b: data.getUint8(0) };
	}

	static #inputIndex(value: number): number {
		return integerInRange(value, "input", 0, INPUT_COUNT - 1);
	}

	static #ledIndex(value: number): number {
		return integerInRange(value, "led", 0, LED_COUNT - 1);
	}

	static #byte(value: number, name: string): number {
		return integerInRange(value, name, 0, 0xff);
	}
}

export class BytePanelInput<State> {
	#target: object;
	#polling: PollingInput<State>;
	#selectInputs: (state: State) => number;
	#onChange: BytePanelChangeCallback<State> | null;
	#onInputChange: BytePanelInputChangeCallback | null;
	#lastInputs: number | undefined;
	#closed = false;
	#name: string;

	constructor(
		target: object,
		source: InputSource<State>,
		name: string,
		selectInputs: (state: State) => number,
		options: BytePanelInputOptions<State> = {},
	) {
		this.#target = target;
		this.#name = name;
		this.#selectInputs = selectInputs;
		this.#onChange = callbackOrNull(options.onChange, "onChange");
		this.#onInputChange = callbackOrNull(options.onInputChange, "onInputChange");
		const pollingOptions: PollingInputOptions<State> = {
			changed: (state, previous) => selectInputs(state) !== selectInputs(previous),
		};
		if (options.pollingInterval !== undefined) pollingOptions.pollingInterval = options.pollingInterval;
		this.#polling = new PollingInput(this, source, name, pollingOptions);
		this.#updatePollingState();
	}

	close(): void {
		if (this.#closed) return;
		this.#polling.close();
		this.#closed = true;
		this.#onChange = null;
		this.#onInputChange = null;
	}

	start(): void {
		const wasRunning = this.#polling.running;
		this.#polling.start();
		if (!wasRunning) this.#lastInputs = undefined;
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

	set onChange(callback: BytePanelChangeCallback<State> | null | undefined) {
		const next = callbackOrNull(callback, "onChange");
		if (this.#closed && next) throw new Error(`${this.#name} input is closed`);
		if (next !== this.#onChange) this.#polling.onChange = null;
		this.#onChange = next;
		this.#updatePollingState();
	}

	get onChange(): BytePanelChangeCallback<State> | null {
		return this.#onChange;
	}

	set onInputChange(callback: BytePanelInputChangeCallback | null | undefined) {
		const next = callbackOrNull(callback, "onInputChange");
		if (this.#closed && next) throw new Error(`${this.#name} input is closed`);
		this.#onInputChange = next;
		this.#updatePollingState();
	}

	get onInputChange(): BytePanelInputChangeCallback | null {
		return this.#onInputChange;
	}

	#updatePollingState(): void {
		const callback = this.#onChange || this.#onInputChange ? this.#handleChange : null;
		if (callback && !this.#polling.onChange) this.#lastInputs = undefined;
		this.#polling.onChange = callback;
	}

	#handleChange(state: State): void {
		const inputs = this.#selectInputs(state);
		const changed = this.#lastInputs === undefined ? 0 : inputs ^ this.#lastInputs;
		this.#onChange?.call(this.#target, state);
		if (changed && this.#onInputChange) {
			for (let index = 0; index < INPUT_COUNT; index++) {
				const bit = 1 << index;
				if (changed & bit) this.#onInputChange.call(this.#target, index, Boolean(inputs & bit));
			}
		}
		this.#lastInputs = inputs;
	}
}
