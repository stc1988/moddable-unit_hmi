import { assertOpen } from "hmi/peripheral";
import type { RGBColor } from "hmi/util";
import BytePanel, {
	type BytePanelIO,
	type BytePanelIOInstance,
	type BytePanelOptions,
	getInputLed,
	readInput,
	readInputs,
	setInputLed,
} from "unit/byte-panel";

export interface ByteSwitchIOInstance extends BytePanelIOInstance {}

export type ByteSwitchIO = BytePanelIO<ByteSwitchIOInstance>;

export interface ByteSwitchState {
	/** Bit n is 1 while switch n is on. */
	switches: number;
}

export type ByteSwitchLedMode = 0 | 1;

export interface ByteSwitchOptions extends BytePanelOptions<ByteSwitchIO> {}

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

	constructor(options: ByteSwitchOptions) {
		super(options, ByteSwitch.DEFAULT_ADDRESS, "byteswitch");
	}

	sample(): ByteSwitchState & { time: number } {
		assertOpen(this);
		return { ...this.read(), time: Date.now() };
	}

	read(): ByteSwitchState {
		assertOpen(this);
		return { switches: this.readSwitches() };
	}

	readSwitches(): number {
		assertOpen(this);
		return readInputs(this, false);
	}

	readSwitch(switchIndex: number): boolean {
		assertOpen(this);
		return readInput(this, switchIndex, false);
	}

	setSwitchLed(switchIndex: number, on: boolean, color: RGBColor): void {
		assertOpen(this);
		setInputLed(this, switchIndex, on, color);
	}

	getSwitchLed(switchIndex: number, on: boolean): RGBColor {
		assertOpen(this);
		return getInputLed(this, switchIndex, on);
	}

	setLedMode(mode: ByteSwitchLedMode): void {
		assertOpen(this);
		this.configure({ ledMode: mode });
	}

	getLedMode(): ByteSwitchLedMode {
		assertOpen(this);
		return this.configuration.ledMode;
	}
}
