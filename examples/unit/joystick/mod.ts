import Timer from "timer";
import JoyStick from "unit/joystick";

export async function main(): Promise<void> {
	const input = new JoyStick({});
	let previous = "";
	// Polling and change detection belong to the application. Clear this timer before input.close().
	Timer.repeat(() => {
		const sample = input.sample();
		const { time: _time, ...values } = sample;
		const current = JSON.stringify(values);
		if (current === previous) return;
		previous = current;
		trace(`[JoyStick] ${current}\n`);
	}, 30);
}
