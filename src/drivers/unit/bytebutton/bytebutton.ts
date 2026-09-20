import type { RGBColor } from "hmi/util";
import BytePanel, {
	BytePanelInput,
	type BytePanelInputChangedCallback,
	type BytePanelInputOptions,
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
	onChanged?: ByteButtonChangedCallback;
	onButtonChanged?: ByteButtonButtonChangedCallback;
}

export type ByteButtonChangedCallback = (state: ByteButtonState) => void;
export type ByteButtonButtonChangedCallback = (button: number, pressed: boolean) => void;

function inputOptions(options: ByteButtonOptions): BytePanelInputOptions<ByteButtonState> {
	const result: BytePanelInputOptions<ByteButtonState> = {};
	if (options.pollingInterval !== undefined) result.pollingInterval = options.pollingInterval;
	if (options.onChanged !== undefined) result.onChanged = options.onChanged;
	if (options.onButtonChanged !== undefined) result.onInputChanged = options.onButtonChanged;
	return result;
}

class ByteButtonInput extends BytePanelInput<ByteButtonState> {
	constructor(target: object, source: { read(): ByteButtonState }, options: ByteButtonOptions) {
		super(target, source, "ByteButton", (state) => state.buttons, inputOptions(options));
	}

	set onButtonChanged(callback: ByteButtonButtonChangedCallback | null | undefined) {
		this.onInputChanged = callback;
	}

	get onButtonChanged(): BytePanelInputChangedCallback | null {
		return this.onInputChanged;
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

	#input: ByteButtonInput;

	set onChanged(callback: ByteButtonChangedCallback | null | undefined) {
		this.#input.onChanged = callback;
	}

	get onChanged(): ByteButtonChangedCallback | null {
		return this.#input.onChanged;
	}

	set onButtonChanged(callback: ByteButtonButtonChangedCallback | null | undefined) {
		this.#input.onButtonChanged = callback;
	}

	get onButtonChanged(): ByteButtonButtonChangedCallback | null {
		return this.#input.onButtonChanged;
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

	constructor(options: ByteButtonOptions = {}) {
		super(options, ByteButton.DEFAULT_ADDRESS, "bytebutton");
		try {
			this.#input = new ByteButtonInput(this, this, options);
		} catch (error) {
			super.close();
			throw error;
		}
	}

	close(): void {
		this.#input.close();
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
