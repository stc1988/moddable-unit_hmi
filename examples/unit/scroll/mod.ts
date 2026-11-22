import watchInput from "hmi/watch";
import Scroll from "unit/scroll";

export async function main(): Promise<void> {
	const input = new Scroll({});
	watchInput(input, {
		onChanged(sample) {
			input.led.color = { r: sample.pressed ? 64 : 0, g: 0, b: sample.pressed ? 0 : 16 };
			trace(`[Scroll] ${JSON.stringify(sample)}\n`);
		},
	});
}
