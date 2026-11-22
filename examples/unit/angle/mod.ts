import Analog from "embedded:io/analog";
import Timer from "timer";
import Angle from "unit/angle";

export async function main(): Promise<void> {
	const input = new Angle({ sensor: { io: Analog, pin: 8 } });
	let previous = "";
	// Polling and change detection belong to the application. Clear this timer before input.close().
	Timer.repeat(() => {
		const sample = input.sample();
		const { time: _time, ...values } = sample;
		const current = JSON.stringify(values);
		if (current === previous) return;
		previous = current;
		trace(`[Angle] ${current}\n`);
	}, 30);
}
