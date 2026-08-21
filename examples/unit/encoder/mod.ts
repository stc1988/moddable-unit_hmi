import Encoder from "unit/encoder";

export async function main(): Promise<void> {
	const encoder = new Encoder();

	encoder.setAllLeds({ r: 0, g: 0, b: 24 });

	encoder.onChange = ({ value, pressed }) => {
		trace(`[Encoder] value=${value}\tpressed=${pressed}\n`);
		encoder.setLed(0, { r: value < 0 ? 64 : 0, g: value > 0 ? 64 : 0, b: value === 0 ? 24 : 0 });
	};

	encoder.onButtonChange = (pressed) => {
		trace(`[Encoder] button pressed: ${pressed}\n`);
		encoder.setLed(1, { r: pressed ? 64 : 0, g: pressed ? 64 : 0, b: pressed ? 64 : 24 });
	};
}
