import Timer from "timer";
import ByteButton from "unit/bytebutton";

export async function main(): Promise<void> {
	const input = new ByteButton({});
	let previous = "";
	// Polling and change detection belong to the application. Clear this timer before input.close().
	Timer.repeat(() => {
		const sample = input.sample();
		const { time: _time, ...values } = sample;
		const current = JSON.stringify(values);
		if (current === previous) return;
		previous = current;
		for (let index = 0; index < 8; index++) {
			const on = Boolean(sample.buttons & (1 << index));
			input.setLed(index, { r: on ? 64 : 0, g: 0, b: on ? 0 : 16 });
		}
		trace(`[ByteButton] ${current}\n`);
	}, 30);
}
