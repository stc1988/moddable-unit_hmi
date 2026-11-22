import watchInput from "hmi/watch";
import JoyStick from "unit/joystick";

export async function main(): Promise<void> {
	const input = new JoyStick({});
	watchInput(input, {
		deadband: 2,
		onChanged(sample) {
			trace(`[JoyStick] ${JSON.stringify(sample)}\n`);
		},
	});
}
