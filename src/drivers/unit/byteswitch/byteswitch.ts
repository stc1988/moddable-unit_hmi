import type { RGBColor } from "hmi/util";
import BytePanel, {
	BytePanelInput,
	type BytePanelInputChangedCallback,
	type BytePanelInputOptions,
	type BytePanelIO,
	type BytePanelIOInstance,
	type BytePanelOptions,
} from "unit/byte-panel";

export interface ByteSwitchIOInstance extends BytePanelIOInstance {}

export type ByteSwitchIO = BytePanelIO<ByteSwitchIOInstance>;

export interface ByteSwitchState {
	/** Bit n is 1 while switch n is on. */
	switches: number;
}

export type ByteSwitchLedMode = 0 | 1;

export interface ByteSwitchOptions extends BytePanelOptions<ByteSwitchIO> {
	pollingInterval?: number;
	onChanged?: ByteSwitchChangedCallback;
	onSwitchChanged?: ByteSwitchSwitchChangedCallback;
}

export type ByteSwitchChangedCallback = (state: ByteSwitchState) => void;
export type ByteSwitchSwitchChangedCallback = (switchIndex: number, on: boolean) => void;

function inputOptions(options: ByteSwitchOptions): BytePanelInputOptions<ByteSwitchState> {
	const result: BytePanelInputOptions<ByteSwitchState> = {};
	if (options.pollingInterval !== undefined) result.pollingInterval = options.pollingInterval;
	if (options.onChanged !== undefined) result.onChanged = options.onChanged;
	if (options.onSwitchChanged !== undefined) result.onInputChanged = options.onSwitchChanged;
	return result;
}

class ByteSwitchInput extends BytePanelInput<ByteSwitchState> {
	constructor(target: object, source: { read(): ByteSwitchState }, options: ByteSwitchOptions) {
		super(target, source, "ByteSwitch", (state) => state.switches, inputOptions(options));
	}

	set onSwitchChanged(callback: ByteSwitchSwitchChangedCallback | null | undefined) {
		this.onInputChanged = callback;
	}

	get onSwitchChanged(): BytePanelInputChangedCallback | null {
		return this.onInputChanged;
	}
}

// https://docs.m5stack.com/en/unit/Unit%20ByteSwitch
export default class ByteSwitch extends BytePanel<ByteSwitchIOInstance> {
	static readonly DEFAULT_ADDRESS = 0x46;
	static readonly DEFAULT_HZ = 400_000;
	static readonly SWITCH_COUNT = 8;
	static readonly LED_COUNT = 9;

	static readonly LED_MODE = {
		MANUAL: 0,
		SWITCH: 1,
	} as const;

	#input: ByteSwitchInput;

	set onChanged(callback: ByteSwitchChangedCallback | null | undefined) {
		this.#input.onChanged = callback;
	}

	get onChanged(): ByteSwitchChangedCallback | null {
		return this.#input.onChanged;
	}

	set onSwitchChanged(callback: ByteSwitchSwitchChangedCallback | null | undefined) {
		this.#input.onSwitchChanged = callback;
	}

	get onSwitchChanged(): ByteSwitchSwitchChangedCallback | null {
		return this.#input.onSwitchChanged;
	}

	set pollingInterval(value: number) {
		this.#input.pollingInterval = value;
	}

	get pollingInterval(): number {
		return this.#input.pollingInterval;
	}

	start(): void {
		this.#input.start();
	}

	stop(): void {
		this.#input.stop();
	}

	constructor(options: ByteSwitchOptions = {}) {
		super(options, ByteSwitch.DEFAULT_ADDRESS, "byteswitch");
		try {
			this.#input = new ByteSwitchInput(this, this, options);
		} catch (error) {
			super.close();
			throw error;
		}
	}

	close(): void {
		this.#input.close();
		super.close();
	}

	read(): ByteSwitchState {
		return { switches: this.readSwitches() };
	}

	readSwitches(): number {
		return this.readInputs(false);
	}

	readSwitch(switchIndex: number): boolean {
		return this.readInput(switchIndex, false);
	}

	setSwitchLed(switchIndex: number, on: boolean, color: RGBColor): void {
		this.setInputLed(switchIndex, on, color);
	}

	getSwitchLed(switchIndex: number, on: boolean): RGBColor {
		return this.getInputLed(switchIndex, on);
	}

	setLedMode(mode: ByteSwitchLedMode): void {
		this.setLedModeValue(mode);
	}

	getLedMode(): ByteSwitchLedMode {
		return this.getLedModeValue();
	}
}
