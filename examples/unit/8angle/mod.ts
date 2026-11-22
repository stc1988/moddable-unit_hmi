import watchInput from "hmi/watch";
import Angle8 from "unit/8angle";

export async function main(): Promise<void> {
	const input = new Angle8({});
	watchInput(input, {
		deadband: 4,
		onChanged(sample) {
			for (let index = 0; index < sample.angles.length; index++) {
				input.setLed(index, { r: 0, g: Math.round(((sample.angles[index] ?? 0) / 4095) * 64), b: 0 });
			}
			input.setLed(8, { r: sample.switchOn ? 0 : 64, g: sample.switchOn ? 64 : 0, b: 0 });
			trace(`[Angle8] ${JSON.stringify(sample)}\n`);
		},
	});
}
