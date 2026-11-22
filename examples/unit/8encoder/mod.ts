import Timer from "timer";
import Encoder8 from "unit/8encoder";

export async function main(): Promise<void> {
	const input = new Encoder8({});
	let previous = "";
	// Polling and change detection belong to the application. Clear this timer before input.close().
	Timer.repeat(() => {
		const sample = input.sample();
		const { time: _time, ...values } = sample;
		const current = JSON.stringify(values);
		if (current === previous) return;
		previous = current;
		for (let index = 0; index < sample.encoders.length; index++) {
			const value = sample.encoders[index] ?? 0;
			input.setLed(index, { r: sample.buttons & (1 << index) ? 64 : 0, g: value > 0 ? 64 : 0, b: value < 0 ? 64 : 0 });
		}
		input.setLed(8, { r: sample.switchOn ? 0 : 64, g: sample.switchOn ? 64 : 0, b: 0 });
		trace(`[Encoder8] ${current}\n`);
	}, 30);
}
