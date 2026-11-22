import Analog from "embedded:io/analog";
import NeoPixel from "neopixel";
import Timer from "timer";
import Fader from "unit/fader";

export async function main(): Promise<void> {
	const input = new Fader({ sensor: { io: Analog, pin: 8 }, leds: { io: NeoPixel, pin: 9 } });
	let previous = "";
	// Polling and change detection belong to the application. Clear this timer before input.close().
	Timer.repeat(() => {
		const sample = input.sample();
		const { time: _time, ...values } = sample;
		const current = JSON.stringify(values);
		if (current === previous) return;
		previous = current;
		const lit = Math.round(sample.position * Fader.LEVEL_COUNT);
		for (let level = 0; level < Fader.LEVEL_COUNT; level++)
			input.setLevel(level, { r: 0, g: level < lit ? 128 : 0, b: level < lit ? 255 : 0 }, false);
		input.show();
		trace(`[Fader] ${current}\n`);
	}, 30);
}
