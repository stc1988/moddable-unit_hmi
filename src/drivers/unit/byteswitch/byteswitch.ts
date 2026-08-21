import PollingInput from "hmi/polling";
import { callbackOrNull, type RGBColor } from "hmi/util";
import BytePanel, {
	type BytePanelColor,
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

export type ByteSwitchColor = BytePanelColor;

export type ByteSwitchLedMode = 0 | 1;

export interface ByteSwitchOptions extends BytePanelOptions<ByteSwitchIO> {
	pollingInterval?: number;
	onChange?: ByteSwitchChangeCallback;
	onSwitchChange?: ByteSwitchSwitchChangeCallback;
}

export type ByteSwitchChangeCallback = (state: ByteSwitchState) => void;
export type ByteSwitchSwitchChangeCallback = (switchIndex: number, on: boolean) => void;

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

	#polling: PollingInput<ByteSwitchState>;
	#onChange: ByteSwitchChangeCallback | null;
	#onSwitchChange: ByteSwitchSwitchChangeCallback | null;
	#lastSwitches?: number;
	#closed = false;

	constructor(options: ByteSwitchOptions = {}) {
		super(options, ByteSwitch.DEFAULT_ADDRESS, "byteswitch");
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
		return this.readInputs(false);
	}

	readSwitch(switchIndex: number): boolean {
		return this.readInput(switchIndex, false);
	}

	setSwitchLed(switchIndex: number, on: boolean, color: RGBColor): void {
		this.setInputLed(switchIndex, on, color);
	}

	getSwitchLed(switchIndex: number, on: boolean): ByteSwitchColor {
		return this.getInputLed(switchIndex, on);
	}

	setLedMode(mode: ByteSwitchLedMode): void {
		this.setLedModeValue(mode);
	}

	getLedMode(): ByteSwitchLedMode {
		return this.getLedModeValue();
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
}
