import PollingInput from "hmi/polling";
import { callbackOrNull, type RGBColor } from "hmi/util";
import BytePanel, {
	type BytePanelColor,
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

export type ByteButtonColor = BytePanelColor;

export type ByteButtonLedMode = 0 | 1;

export interface ByteButtonOptions extends BytePanelOptions<ByteButtonIO> {
	pollingInterval?: number;
	onChange?: ByteButtonChangeCallback;
	onButtonChange?: ByteButtonButtonChangeCallback;
}

export type ByteButtonChangeCallback = (state: ByteButtonState) => void;
export type ByteButtonButtonChangeCallback = (button: number, pressed: boolean) => void;

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

	#polling: PollingInput<ByteButtonState>;
	#onChange: ByteButtonChangeCallback | null;
	#onButtonChange: ByteButtonButtonChangeCallback | null;
	#lastButtons?: number;
	#closed = false;

	constructor(options: ByteButtonOptions = {}) {
		super(options, ByteButton.DEFAULT_ADDRESS, "bytebutton");
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
		return this.readInputs(true);
	}

	readButton(button: number): boolean {
		return this.readInput(button, true);
	}

	setButtonLed(button: number, pressed: boolean, color: RGBColor): void {
		this.setInputLed(button, pressed, color);
	}

	getButtonLed(button: number, pressed: boolean): ByteButtonColor {
		return this.getInputLed(button, pressed);
	}

	setLedMode(mode: ByteButtonLedMode): void {
		this.setLedModeValue(mode);
	}

	getLedMode(): ByteButtonLedMode {
		return this.getLedModeValue();
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
}
