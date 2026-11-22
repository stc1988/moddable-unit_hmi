import watchInput from "hmi/watch";
import JoyStick2 from "unit/joystick2";

export async function main(): Promise<void> {
	const input = new JoyStick2({});
	watchInput(input, {
		deadband: 2,
		onChanged(sample) {
			input.led.color = { r: sample.pressed ? 64 : 0, g: 0, b: sample.pressed ? 0 : 16 };
			trace(`[JoyStick2] ${JSON.stringify(sample)}\n`);
		},
	});
}
