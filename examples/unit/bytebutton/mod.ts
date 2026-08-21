import ByteButton from "unit/bytebutton";

export async function main(): Promise<void> {
	const byteButton = new ByteButton();

	byteButton.setLedMode(ByteButton.LED_MODE.MANUAL);
	for (let led = 0; led < ByteButton.LED_COUNT; led++) {
		byteButton.setLedBrightness(led, 64);
		byteButton.setLed(led, { r: 0, g: 0, b: led === 8 ? 64 : 0 });
	}

	byteButton.input.onChange = ({ buttons }) => {
		trace(`[ByteButton] buttons=0b${buttons.toString(2).padStart(8, "0")}\n`);
	};

	byteButton.input.onButtonChange = (button, pressed) => {
		trace(`[ByteButton] button=${button}\tpressed=${pressed}\n`);
		byteButton.setLed(button, { r: 0, g: pressed ? 255 : 0, b: 0 });
	};
}
