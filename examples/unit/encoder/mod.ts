import Encoder from "unit/encoder";

export async function main(): Promise<void> {
	const encoder = new Encoder();

	encoder.setAllLeds(0, 0, 24);

	encoder.onChange = ({ value, pressed }) => {
		trace(`[Encoder] value=${value}\tpressed=${pressed}\n`);
		encoder.setLed(0, value < 0 ? 64 : 0, value > 0 ? 64 : 0, value === 0 ? 24 : 0);
	};

	encoder.onButtonChange = (pressed) => {
		trace(`[Encoder] button pressed: ${pressed}\n`);
		encoder.setLed(1, pressed ? 64 : 0, pressed ? 64 : 0, pressed ? 64 : 24);
	};
}
