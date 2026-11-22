import Timer from "timer";
import Encoder from "unit/encoder";

export async function main(): Promise<void> {
	const input = new Encoder({});
	let previous = "";
	// Polling and change detection belong to the application. Clear this timer before input.close().
	Timer.repeat(() => {
		const sample = input.sample();
		const { time: _time, ...values } = sample;
		const current = JSON.stringify(values);
		if (current === previous) return;
		previous = current;
		input.setLed(0, { r: sample.value < 0 ? 64 : 0, g: sample.value > 0 ? 64 : 0, b: 0 });
		input.setLed(1, { r: sample.pressed ? 64 : 0, g: 0, b: 0 });
		trace(`[Encoder] ${current}\n`);
	}, 30);
}
