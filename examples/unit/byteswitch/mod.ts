import watchInput from "hmi/watch";
import ByteSwitch from "unit/byteswitch";

export async function main(): Promise<void> {
	const input = new ByteSwitch({});
	watchInput(input, {
		onChanged(sample) {
			for (let index = 0; index < 8; index++) {
				const on = Boolean(sample.switches & (1 << index));
				input.setLed(index, { r: on ? 64 : 0, g: 0, b: on ? 0 : 16 });
			}
			trace(`[ByteSwitch] ${JSON.stringify(sample)}\n`);
		},
	});
}
