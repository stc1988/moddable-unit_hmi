import ByteButton from "unit/bytebutton";

export async function main(): Promise<void> {
	const byteButton = new ByteButton();

	byteButton.setLedMode(ByteButton.LED_MODE.MANUAL);
	for (let index = 0; index < ByteButton.LED_COUNT; index++) {
		{
			const led = byteButton.leds[index];
			if (led) led.brightness = 64;
		}
		{
			const led = byteButton.leds[index];
			if (led) led.color = { r: 0, g: 0, b: index === 8 ? 64 : 0 };
		}
	}

	byteButton.onChanged = ({ buttons }) => {
		trace(`[ByteButton] buttons=0b${buttons.toString(2).padStart(8, "0")}\n`);
	};

	byteButton.onButtonChanged = (button, pressed) => {
		trace(`[ByteButton] button=${button}\tpressed=${pressed}\n`);
		{
			const led = byteButton.leds[button];
			if (led) led.color = { r: 0, g: pressed ? 255 : 0, b: 0 };
		}
	};
}
