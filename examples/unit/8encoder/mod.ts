import watchInput from "hmi/watch";
import Encoder8 from "unit/8encoder";

export async function main(): Promise<void> {
	const input = new Encoder8({});
	watchInput(input, {
		onChanged(sample) {
			for (let index = 0; index < sample.encoders.length; index++) {
				const value = sample.encoders[index] ?? 0;
				input.setLed(index, {
					r: sample.buttons & (1 << index) ? 64 : 0,
					g: value > 0 ? 64 : 0,
					b: value < 0 ? 64 : 0,
				});
			}
			input.setLed(8, { r: sample.switchOn ? 0 : 64, g: sample.switchOn ? 64 : 0, b: 0 });
			trace(`[Encoder8] ${JSON.stringify(sample)}\n`);
		},
	});
}
