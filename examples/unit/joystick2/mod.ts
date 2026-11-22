import Timer from "timer";
import JoyStick2 from "unit/joystick2";

export async function main(): Promise<void> {
	const input = new JoyStick2({});
	let previous = "";
	// Polling and change detection belong to the application. Clear this timer before input.close().
	Timer.repeat(() => {
		const sample = input.sample();
		const { time: _time, ...values } = sample;
		const current = JSON.stringify(values);
		if (current === previous) return;
		previous = current;
		input.led.color = { r: sample.pressed ? 64 : 0, g: 0, b: sample.pressed ? 0 : 16 };
		trace(`[JoyStick2] ${current}\n`);
	}, 30);
}
