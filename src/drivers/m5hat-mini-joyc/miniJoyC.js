import Timer from "timer";

export default class MiniJoyC {
	static DEFAULT_ADDRESS = 0x54;

	static REGISTER = {
		ADC_VALUE_REG: 0x00,
		POS_VALUE_REG_8_BIT: 0x20,
		POS_VALUE_REG_10_BIT: 0x10,
		BUTTON_REG: 0x30,
		RGB_LED_REG: 0x40,
		CAL_REG: 0x50,
		FIRMWARE_VERSION_REG: 0xfe,
		I2C_ADDRESS_REG: 0xf,
	};

	#bus;
	#timer;
	#onPoll;
	#onButtonPressed;
	#buttonState = false;
	#lastPosition;

	constructor(
		options = {
			sensor: {
				...device.I2C.hat,
				io: device.io.SMBus,
			},
		},
	) {
		this.pollingInterval = options.pollingInterval ?? 1000;
		this.readMode = options.readMode ?? "pos8";

		// this.#bus = new SMBus({
		// 	address: MiniJoyC.DEFAULT_ADDRESS,
		// 	// data: device.I2C.hat.data,
		// 	// clock: device.I2C.hat.clock,
		// 	data:0,
		// 	clock:26,
		// 	hz: 200000,
		// });
		new options.sensor.io({
			address: MiniJoyC.DEFAULT_ADDRESS,
			hz: 200_000,
			...options.sensor,
		});
		Timer.delay(1000);

		this.onPoll = options.onPoll;
		this.onButtonPressed = options.onButtonPressed;
	}

	close() {
		this.stop();
		this.#bus.close();
	}

	start() {
		if (this.#timer) return;
		this.#timer = Timer.repeat(() => {
			this.#pollTick();
		}, this.pollingInterval);
	}

	stop() {
		if (!this.#timer) return;
		Timer.clear(this.#timer);
		this.#timer = null;
	}

	set onPoll(callback) {
		this.#onPoll = typeof callback === "function" ? callback : null;
		this.#updatePollingState();
	}

	get onPoll() {
		return this.#onPoll;
	}

	set onButtonPressed(callback) {
		this.#onButtonPressed = typeof callback === "function" ? callback : null;
		this.#updatePollingState();
	}

	get onButtonPressed() {
		return this.#onButtonPressed;
	}

	#updatePollingState() {
		if (this.#onPoll || this.#onButtonPressed) this.start();
		else this.stop();
	}

	#pollTick() {
		try {
			// const position = this.readXY();
			const pressed = this.isButtonPressed();

			if (this.#onPoll && this.#shouldDispatchPoll(position)) this.#onPoll(position);
			if (this.#onButtonPressed && pressed && !this.#buttonState) this.#onButtonPressed(pressed);

			this.#buttonState = pressed;
		} catch (e) {
			trace(`[miniJoyC][ERROR] poll failed: ${e?.message ?? e}\n`);
		}
	}

	#shouldDispatchPoll(position) {
		if (!this.#lastPosition) {
			this.#lastPosition = position;
			return true;
		}

		const changed = this.#lastPosition.x !== position.x || this.#lastPosition.y !== position.y;
		if (changed) this.#lastPosition = position;
		return changed;
	}

	readXY() {
		switch (this.readMode) {
			case "pos8":
				return this.#readPosition8Bit();
			case "pos10":
				return this.#readPosition10Bit();
			default:
				return this.#readADC();
		}
	}

	#readADC() {
		return {
			x: this.#readWordLE(MiniJoyC.REGISTER.ADC_VALUE_REG),
			y: this.#readWordLE(MiniJoyC.REGISTER.ADC_VALUE_REG + 2),
		};
	}

	#readPosition8Bit() {
		return {
			x: this.#readByte(MiniJoyC.REGISTER.POS_VALUE_REG_8_BIT),
			y: this.#readByte(MiniJoyC.REGISTER.POS_VALUE_REG_8_BIT + 1),
		};
	}

	#readPosition10Bit() {
		return {
			x: this.#readWordLE(MiniJoyC.REGISTER.POS_VALUE_REG_10_BIT),
			y: this.#readWordLE(MiniJoyC.REGISTER.POS_VALUE_REG_10_BIT + 2),
		};
	}

	isButtonPressed() {
		return this.#readByte(MiniJoyC.REGISTER.BUTTON_REG) !== 0;
	}

	#readByte(register) {
		return this.#bus.readUint8(register) & 0xff;
	}

	#readWordLE(register) {
		return this.#bus.readUint16(register, false) & 0xffff;
	}
}
