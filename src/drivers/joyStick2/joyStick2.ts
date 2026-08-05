import type I2C from "embedded:io/i2c";
import SMBus from "embedded:io/smbus";
import Timer from "timer";

type I2COptions = ConstructorParameters<typeof I2C>[0];
type SMBusOptions = I2COptions & { stop?: boolean };

// @moddable/typings 8.3.1 declares the SMBus options as a tuple intersection.
// Narrow the constructor to the object accepted by the runtime implementation.
const SMBusConstructor = SMBus as unknown as new (options: SMBusOptions) => SMBus;

export interface JoyStick2Position {
	x: number;
	y: number;
}

export interface JoyStick2Options {
	pollingInterval?: number;
	data?: I2COptions["data"];
	clock?: I2COptions["clock"];
	onPoll?: JoyStick2PollCallback;
	onPush?: JoyStick2PushCallback;
}

export type JoyStick2PollCallback = (position: JoyStick2Position) => void;
export type JoyStick2PushCallback = (pushed: boolean) => void;

// https://docs.m5stack.com/ja/unit/Unit-JoyStick2
export default class JoyStick2 {
	static readonly REGISTER = {
		ADC_VALUE_12BITS_REG: 0x00,
		ADC_VALUE_8BITS_REG: 0x10,
		BUTTON_REG: 0x20,
		RGB_LED_REG: 0x30,
		ADC_VALUE_CAL_REG: 0x40,
		OFFSET_ADC_VALUE_12BITS_REG: 0x50,
		OFFSET_ADC_VALUE_8BITS_REG: 0x60,
		FIRMWARE_VERSION_REG: 0xfe,
		BOOTLOADER_VERSION_REG: 0xfc,
		I2C_ADDRESS_REG: 0xff,
	} as const;

	#bus: SMBus;
	#timer?: ReturnType<typeof Timer.repeat>;
	#onPoll: JoyStick2PollCallback | null;
	#onPush: JoyStick2PushCallback | null;
	#buttonState = false;
	#lastPosition?: JoyStick2Position;

	pollingInterval: number;

	constructor(options: JoyStick2Options = {}) {
		this.pollingInterval = options.pollingInterval ?? 30;
		this.#bus = new SMBusConstructor({
			address: 0x63,
			data: device.I2C.default.data ?? options.data,
			clock: device.I2C.default.clock ?? options.clock,
			hz: 400_000,
		});

		this.#onPoll = options.onPoll ?? null;
		this.#onPush = options.onPush ?? null;
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

	set onPoll(callback: JoyStick2PollCallback | null | undefined) {
		this.#onPoll = typeof callback === "function" ? callback : null;
		this.#updatePollingState();
	}

	get onPoll(): JoyStick2PollCallback | null {
		return this.#onPoll;
	}

	set onPush(callback: JoyStick2PushCallback | null | undefined) {
		this.#onPush = typeof callback === "function" ? callback : null;
		this.#updatePollingState();
	}

	get onPush(): JoyStick2PushCallback | null {
		return this.#onPush;
	}

	#updatePollingState(): void {
		if (this.#onPoll || this.#onPush) this.start();
		else this.stop();
	}

	#pollTick(): void {
		try {
			const position = this.readXY();
			const pushed = this.isButtonPushed();

			if (this.#onPoll && this.#shouldDispatchPoll(position)) this.#onPoll(position);
			if (this.#onPush && pushed !== this.#buttonState) {
				this.#onPush(pushed);
				this.#buttonState = pushed;
			}
		} catch (error) {
			trace(`[JoyStick2][ERROR] poll failed: ${error instanceof Error ? error.message : String(error)}\n`);
		}
	}

	#shouldDispatchPoll(position: JoyStick2Position): boolean {
		if (!this.#lastPosition) {
			this.#lastPosition = position;
			return true;
		}

		const changed = this.#lastPosition.x !== position.x || this.#lastPosition.y !== position.y;
		if (changed) this.#lastPosition = position;
		return changed;
	}

	readXY(): JoyStick2Position {
		return this.#readMappedValue8bit();
	}

	#readMappedValue8bit(): JoyStick2Position {
		const words = this.#bus.readUint16(JoyStick2.REGISTER.OFFSET_ADC_VALUE_8BITS_REG, true);
		const x = (words >> 8) & 0xff;
		const y = words & 0xff;

		return {
			x: x & 0x80 ? x - 0x100 : x,
			y: y & 0x80 ? y - 0x100 : y,
		};
	}

	isButtonPushed(): boolean {
		return this.#bus.readUint8(JoyStick2.REGISTER.BUTTON_REG) === 0;
	}

	setLed(r: number, g: number, b: number): void {
		this.#bus.writeUint8(JoyStick2.REGISTER.RGB_LED_REG, b);
		this.#bus.writeUint8(JoyStick2.REGISTER.RGB_LED_REG + 1, g);
		this.#bus.writeUint8(JoyStick2.REGISTER.RGB_LED_REG + 2, r);
	}
}
