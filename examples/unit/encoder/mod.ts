import watchInput from "hmi/watch";
import Encoder from "unit/encoder";

export async function main(): Promise<void> {
	const input = new Encoder({});
	watchInput(input, {
		onChanged(sample) {
			input.setLed(0, { r: sample.value < 0 ? 64 : 0, g: sample.value > 0 ? 64 : 0, b: 0 });
			input.setLed(1, { r: sample.pressed ? 64 : 0, g: 0, b: 0 });
			trace(`[Encoder] ${JSON.stringify(sample)}\n`);
		},
	});
}
