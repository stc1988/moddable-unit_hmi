import watchInput from "hmi/watch";
import Angle from "unit/angle";

export async function main(): Promise<void> {
	const input = new Angle({});
	watchInput(input, {
		deadband: 4,
		onChanged(sample) {
			trace(`[Angle] ${JSON.stringify(sample)}\n`);
		},
	});
}
