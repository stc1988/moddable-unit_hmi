import watchInput from "hmi/watch";
import Fader from "unit/fader";

export async function main(): Promise<void> {
	const input = new Fader({});
	watchInput(input, {
		deadband: 4,
		onChanged(sample) {
			const lit = Math.round(sample.position * Fader.LEVEL_COUNT);
			for (let level = 0; level < Fader.LEVEL_COUNT; level++)
				input.setLevel(level, { r: 0, g: level < lit ? 128 : 0, b: level < lit ? 255 : 0 }, false);
			input.show();
			trace(`[Fader] ${JSON.stringify(sample)}\n`);
		},
	});
}
