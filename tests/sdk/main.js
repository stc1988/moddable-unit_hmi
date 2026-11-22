import MiniJoyC from "hat/mini-joyc";
import Pixels from "neopixel";
import Angle8 from "unit/8angle";
import Encoder8 from "unit/8encoder";
import Angle from "unit/angle";
import ByteButton from "unit/bytebutton";
import ByteSwitch from "unit/byteswitch";
import Encoder from "unit/encoder";
import Fader from "unit/fader";
import JoyStick from "unit/joystick";
import JoyStick2 from "unit/joystick2";
import Scroll from "unit/scroll";

class Bus {
	close() {}
	read() {
		return new Uint8Array(3).buffer;
	}
	readUint8() {
		return 0;
	}
	readUint16() {
		return 0;
	}
	readBuffer(_register, count) {
		return new Uint8Array(count).buffer;
	}
	writeUint8() {}
	writeUint16() {}
	writeBuffer() {}
}
class Analog {
	get resolution() {
		return 12;
	}
	read() {
		return 1024;
	}
	close() {}
}
function verify(input) {
	if (!Object.isFrozen(Object.getPrototypeOf(input))) throw new Error("driver was not preloaded");
	const first = input.sample();
	const second = input.sample();
	if (first === second || typeof first.time !== "number") throw new Error("invalid sample");
	if (input.configuration.interrupt !== false) throw new Error("unexpected notifications");
	if (input[Symbol.dispose] !== input.close) throw new Error("dispose must alias close");
	const leds = input.leds ?? input.led;
	if (leds) {
		leds.rainbow();
		leds.rainbow(0);
		leds.rainbow(); // Disposal must stop this active animation and its timer.
	}
	input[Symbol.dispose]();
	input.close();
}

export default function () {
	for (const Driver of [Angle8, Encoder8, ByteButton, ByteSwitch, Encoder, JoyStick, JoyStick2, Scroll, MiniJoyC]) {
		verify(new Driver({ sensor: { io: Bus, data: 1, clock: 2 } }));
	}
	verify(new Angle({ sensor: { io: Analog, pin: 8 } }));
	verify(new Fader({ sensor: { io: Analog, pin: 8 }, leds: { io: Pixels, pin: 9 } }));
	trace("ECMA-419 smoke test: 11 drivers PASS\n");
}
