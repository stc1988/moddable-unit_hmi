import type { RGBColor } from "hmi/util";
import BytePanel, {
	BytePanelInput,
	type BytePanelInputChangeCallback,
	type BytePanelIO,
	type BytePanelIOInstance,
	type BytePanelOptions,
} from "unit/byte-panel";

export interface ByteButtonIOInstance extends BytePanelIOInstance {}

export type ByteButtonIO = BytePanelIO<ByteButtonIOInstance>;

export interface ByteButtonState {
	/** Bit n is 1 while button n is pressed. */
	buttons: number;
}

export type ByteButtonLedMode = 0 | 1;

export interface ByteButtonOptions extends BytePanelOptions<ByteButtonIO> {
	pollingInterval?: number;
	onChange?: ByteButtonChangeCallback;
	onButtonChange?: ByteButtonButtonChangeCallback;
}

export type ByteButtonChangeCallback = (state: ByteButtonState) => void;
export type ByteButtonButtonChangeCallback = (button: number, pressed: boolean) => void;

export class ByteButtonInput extends BytePanelInput<ByteButtonState> {
	constructor(target: object, source: { read(): ByteButtonState }, options: ByteButtonOptions) {
		super(target, source, "ByteButton", (state) => state.buttons, {
			pollingInterval: options.pollingInterval,
			onChange: options.onChange,
			onInputChange: options.onButtonChange,
		});
	}

	set onButtonChange(callback: ByteButtonButtonChangeCallback | null | undefined) {
		this.onInputChange = callback;
	}

	get onButtonChange(): BytePanelInputChangeCallback | null {
		return this.onInputChange;
	}
}

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

	readonly input: ByteButtonInput;

	set onChange(callback: ByteButtonChangeCallback | null | undefined) {
		this.input.onChange = callback;
	}

	get onChange(): ByteButtonChangeCallback | null {
		return this.input.onChange;
	}

	set onButtonChange(callback: ByteButtonButtonChangeCallback | null | undefined) {
		this.input.onButtonChange = callback;
	}

	get onButtonChange(): ByteButtonButtonChangeCallback | null {
		return this.input.onButtonChange;
	}

	constructor(options: ByteButtonOptions = {}) {
		super(options, ByteButton.DEFAULT_ADDRESS, "bytebutton");
		try {
			this.input = new ByteButtonInput(this, this, options);
		} catch (error) {
			super.close();
			throw error;
		}
	}

	close(): void {
		this.input.close();
		super.close();
	}

	read(): ByteButtonState {
		return { buttons: this.readButtons() };
	}

	readButtons(): number {
		return this.readInputs(true);
	}

	readButton(button: number): boolean {
		return this.readInput(button, true);
	}

	setButtonLed(button: number, pressed: boolean, color: RGBColor): void {
		this.setInputLed(button, pressed, color);
	}

	getButtonLed(button: number, pressed: boolean): RGBColor {
		return this.getInputLed(button, pressed);
	}

	setLedMode(mode: ByteButtonLedMode): void {
		this.setLedModeValue(mode);
	}

	getLedMode(): ByteButtonLedMode {
		return this.getLedModeValue();
	}
}
