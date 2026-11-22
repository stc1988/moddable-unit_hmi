import MiniJoyC from "hat/mini-joyc";
import watchInput from "hmi/watch";

export async function main(): Promise<void> {
	const input = new MiniJoyC({});
	watchInput(input, {
		deadband: 2,
		onChanged(sample) {
			input.led.color = { r: sample.pressed ? 64 : 0, g: 0, b: sample.pressed ? 0 : 16 };
			trace(`[MiniJoyC] ${JSON.stringify(sample)}\n`);
		},
	});
}
