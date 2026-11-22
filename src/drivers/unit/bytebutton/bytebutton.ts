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

export interface ByteButtonIOInstance extends BytePanelIOInstance {}

export type ByteButtonIO = BytePanelIO<ByteButtonIOInstance>;

export interface ByteButtonState {
	/** Bit n is 1 while button n is pressed. */
	buttons: number;
}

export type ByteButtonLedMode = 0 | 1;

export interface ByteButtonOptions extends BytePanelOptions<ByteButtonIO> {}

// https://docs.m5stack.com/ja/unit/Unit%20ByteButton
export default class ByteButton extends BytePanel<ByteButtonIOInstance> {
	static readonly DEFAULT_ADDRESS = 0x47;
	static readonly DEFAULT_HZ = 400_000;
	static readonly BUTTON_COUNT = 8;
	static readonly LED_COUNT = 9;

	static readonly LED_MODE = {
		MANUAL: 0,
		BUTTON: 1,
	} as const;

	constructor(options: ByteButtonOptions) {
		super(options, ByteButton.DEFAULT_ADDRESS, "bytebutton");
	}

	sample(): ByteButtonState & { time: number } {
		assertOpen(this);
		return { ...this.read(), time: Date.now() };
	}

	read(): ByteButtonState {
		assertOpen(this);
		return { buttons: this.readButtons() };
	}

	readButtons(): number {
		assertOpen(this);
		return readInputs(this, true);
	}

	readButton(button: number): boolean {
		assertOpen(this);
		return readInput(this, button, true);
	}

	setButtonLed(button: number, pressed: boolean, color: RGBColor): void {
		assertOpen(this);
		setInputLed(this, button, pressed, color);
	}

	getButtonLed(button: number, pressed: boolean): RGBColor {
		assertOpen(this);
		return getInputLed(this, button, pressed);
	}

	setLedMode(mode: ByteButtonLedMode): void {
		assertOpen(this);
		this.configure({ ledMode: mode });
	}

	getLedMode(): ByteButtonLedMode {
		assertOpen(this);
		return this.configuration.ledMode;
	}
}
