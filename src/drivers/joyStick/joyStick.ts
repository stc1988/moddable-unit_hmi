import I2C from "embedded:io/i2c";
import Timer from "timer";

type I2COptions = ConstructorParameters<typeof I2C>[0];

export interface JoyStickPosition {
	x: number;
	y: number;
}

export interface JoyStickState extends JoyStickPosition {
	pressed: boolean;
}

export interface JoyStickOptions {
	pollingInterval?: number;
	data?: I2COptions["data"];
	clock?: I2COptions["clock"];
	onPoll?: JoyStickPollCallback;
	onPush?: JoyStickPushCallback;
}

export type JoyStickPollCallback = (position: JoyStickPosition) => void;
export type JoyStickPushCallback = (pressed: boolean) => void;

// https://docs.m5stack.com/ja/unit/joystick_1.1
export default class JoyStick {
	static readonly DEFAULT_ADDRESS = 0x52;
	static readonly STATE_LENGTH = 3;

	#bus: I2C;
	#timer?: ReturnType<typeof Timer.repeat>;
	#onPoll: JoyStickPollCallback | null;
	#onPush: JoyStickPushCallback | null;
	#buttonState = false;
	#lastPosition?: JoyStickPosition;

	pollingInterval: number;

	constructor(options: JoyStickOptions = {}) {
		this.pollingInterval = JoyStick.#positiveInteger(options.pollingInterval ?? 30, "pollingInterval");
		this.#bus = new I2C({
			address: JoyStick.DEFAULT_ADDRESS,
			data: options.data ?? device.I2C.default.data,
			clock: options.clock ?? device.I2C.default.clock,
			hz: 400_000,
		});
		this.#onPoll = options.onPoll ?? null;
		this.#onPush = options.onPush ?? null;
		this.#updatePollingState();
	}

	close(): void {
		this.stop();
		this.#bus.close();
	}

	start(): void {
		if (this.#timer) return;
		this.#timer = Timer.repeat(() => {
			this.#pollTick();
		}, this.pollingInterval);
	}

	stop(): void {
		if (!this.#timer) return;
		Timer.clear(this.#timer);
		this.#timer = undefined;
	}

	set onPoll(callback: JoyStickPollCallback | null | undefined) {
		this.#onPoll = typeof callback === "function" ? callback : null;
		this.#updatePollingState();
	}

	get onPoll(): JoyStickPollCallback | null {
		return this.#onPoll;
	}

	set onPush(callback: JoyStickPushCallback | null | undefined) {
		this.#onPush = typeof callback === "function" ? callback : null;
		this.#updatePollingState();
	}

	get onPush(): JoyStickPushCallback | null {
		return this.#onPush;
	}

	read(): JoyStickState {
		const data = new Uint8Array(this.#bus.read(JoyStick.STATE_LENGTH));
		return {
			x: data[0],
			y: data[1],
			pressed: data[2] !== 0,
		};
	}

	readXY(): JoyStickPosition {
		const { x, y } = this.read();
		return { x, y };
	}

	isButtonPressed(): boolean {
		return this.read().pressed;
	}

	#updatePollingState(): void {
		if (this.#onPoll || this.#onPush) this.start();
		else this.stop();
	}

	#pollTick(): void {
		try {
			const state = this.read();
			const position = { x: state.x, y: state.y };

			if (this.#onPoll && this.#shouldDispatchPoll(position)) this.#onPoll(position);
			if (this.#onPush && state.pressed !== this.#buttonState) this.#onPush(state.pressed);

			this.#buttonState = state.pressed;
		} catch (error) {
			trace(`[JoyStick][ERROR] poll failed: ${error instanceof Error ? error.message : String(error)}\n`);
		}
	}

	#shouldDispatchPoll(position: JoyStickPosition): boolean {
		if (!this.#lastPosition) {
			this.#lastPosition = position;
			return true;
		}

		const changed = this.#lastPosition.x !== position.x || this.#lastPosition.y !== position.y;
		if (changed) this.#lastPosition = position;
		return changed;
	}

	static #positiveInteger(value: number, name: string): number {
		if (!Number.isInteger(value) || value < 1) throw new RangeError(`${name} must be an integer >= 1`);
		return value;
	}
}
