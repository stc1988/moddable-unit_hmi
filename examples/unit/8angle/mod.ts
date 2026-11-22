import Timer from "timer";
import Angle8 from "unit/8angle";

export async function main(): Promise<void> {
	const input = new Angle8({});
	let previous = "";
	// Polling and change detection belong to the application. Clear this timer before input.close().
	Timer.repeat(() => {
		const sample = input.sample();
		const { time: _time, ...values } = sample;
		const current = JSON.stringify(values);
		if (current === previous) return;
		previous = current;
		for (let index = 0; index < sample.angles.length; index++) {
			input.setLed(index, { r: 0, g: Math.round(((sample.angles[index] ?? 0) / 4095) * 64), b: 0 });
		}
		input.setLed(8, { r: sample.switchOn ? 0 : 64, g: sample.switchOn ? 64 : 0, b: 0 });
		trace(`[Angle8] ${current}\n`);
	}, 30);
}
