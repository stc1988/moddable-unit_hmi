import I2C from "embedded:io/i2c";
import Timer from "timer";

type I2COptions = ConstructorParameters<typeof I2C>[0];

export interface UnitJoystickPosition {
	x: number;
	y: number;
}

export interface UnitJoystickState extends UnitJoystickPosition {
	pressed: boolean;
}

export interface UnitJoystickOptions {
	pollingInterval?: number;
	data?: I2COptions["data"];
	clock?: I2COptions["clock"];
	onPoll?: UnitJoystickPollCallback;
	onPush?: UnitJoystickPushCallback;
}

export type UnitJoystickPollCallback = (position: UnitJoystickPosition) => void;
export type UnitJoystickPushCallback = (pressed: boolean) => void;

// https://docs.m5stack.com/ja/unit/joystick_1.1
export default class UnitJoystick {
	static readonly DEFAULT_ADDRESS = 0x52;
	static readonly STATE_LENGTH = 3;

	#bus: I2C;
	#timer?: ReturnType<typeof Timer.repeat>;
	#onPoll: UnitJoystickPollCallback | null;
	#onPush: UnitJoystickPushCallback | null;
	#buttonState = false;
	#lastPosition?: UnitJoystickPosition;

	pollingInterval: number;

	constructor(options: UnitJoystickOptions = {}) {
		this.pollingInterval = UnitJoystick.#positiveInteger(options.pollingInterval ?? 30, "pollingInterval");
		this.#bus = new I2C({
			address: UnitJoystick.DEFAULT_ADDRESS,
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

	set onPoll(callback: UnitJoystickPollCallback | null | undefined) {
		this.#onPoll = typeof callback === "function" ? callback : null;
		this.#updatePollingState();
	}

	get onPoll(): UnitJoystickPollCallback | null {
		return this.#onPoll;
	}

	set onPush(callback: UnitJoystickPushCallback | null | undefined) {
		this.#onPush = typeof callback === "function" ? callback : null;
		this.#updatePollingState();
	}

	get onPush(): UnitJoystickPushCallback | null {
		return this.#onPush;
	}

	read(): UnitJoystickState {
		const data = new Uint8Array(this.#bus.read(UnitJoystick.STATE_LENGTH));
		return {
			x: data[0],
			y: data[1],
			pressed: data[2] !== 0,
		};
	}

	readXY(): UnitJoystickPosition {
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
			trace(`[UnitJoystick][ERROR] poll failed: ${error instanceof Error ? error.message : String(error)}\n`);
		}
	}

	#shouldDispatchPoll(position: UnitJoystickPosition): boolean {
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
