import Encoder from "unit/encoder";

export async function main(): Promise<void> {
	const encoder = new Encoder();

	encoder.leds.color = { r: 0, g: 0, b: 24 };

	encoder.onChanged = ({ value, pressed }) => {
		trace(`[Encoder] value=${value}\tpressed=${pressed}\n`);
		{
			const led = encoder.leds[0];
			if (led) led.color = { r: value < 0 ? 64 : 0, g: value > 0 ? 64 : 0, b: value === 0 ? 24 : 0 };
		}
	};

	encoder.onButtonChanged = (pressed) => {
		trace(`[Encoder] button pressed: ${pressed}\n`);
		{
			const led = encoder.leds[1];
			if (led) led.color = { r: pressed ? 64 : 0, g: pressed ? 64 : 0, b: pressed ? 64 : 24 };
		}
	};
}
