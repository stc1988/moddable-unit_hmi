import type { RGBColor } from "hmi/util";
import BytePanel, {
	BytePanelInput,
	type BytePanelInputChangeCallback,
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
	onChange?: ByteSwitchChangeCallback;
	onSwitchChange?: ByteSwitchSwitchChangeCallback;
}

export type ByteSwitchChangeCallback = (state: ByteSwitchState) => void;
export type ByteSwitchSwitchChangeCallback = (switchIndex: number, on: boolean) => void;

export class ByteSwitchInput extends BytePanelInput<ByteSwitchState> {
	constructor(target: object, source: { read(): ByteSwitchState }, options: ByteSwitchOptions) {
		super(target, source, "ByteSwitch", (state) => state.switches, {
			pollingInterval: options.pollingInterval,
			onChange: options.onChange,
			onInputChange: options.onSwitchChange,
		});
	}

	set onSwitchChange(callback: ByteSwitchSwitchChangeCallback | null | undefined) {
		this.onInputChange = callback;
	}

	get onSwitchChange(): BytePanelInputChangeCallback | null {
		return this.onInputChange;
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

	readonly input: ByteSwitchInput;

	constructor(options: ByteSwitchOptions = {}) {
		super(options, ByteSwitch.DEFAULT_ADDRESS, "byteswitch");
		try {
			this.input = new ByteSwitchInput(this, this, options);
		} catch (error) {
			super.close();
			throw error;
		}
	}

	close(): void {
		this.input.close();
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
