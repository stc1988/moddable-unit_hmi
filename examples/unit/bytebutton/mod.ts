import watchInput from "hmi/watch";
import ByteButton from "unit/bytebutton";

export async function main(): Promise<void> {
	const input = new ByteButton({});
	watchInput(input, {
		onChanged(sample) {
			for (let index = 0; index < 8; index++) {
				const on = Boolean(sample.buttons & (1 << index));
				input.setLed(index, { r: on ? 64 : 0, g: 0, b: on ? 0 : 16 });
			}
			trace(`[ByteButton] ${JSON.stringify(sample)}\n`);
		},
	});
}
