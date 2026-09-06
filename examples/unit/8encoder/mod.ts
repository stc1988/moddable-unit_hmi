import Encoder8 from "unit/8encoder";

export async function main(): Promise<void> {
	const encoder8 = new Encoder8();

	encoder8.leds.color = { r: 0, g: 0, b: 16 };
	{
		const led = encoder8.leds[Encoder8.SWITCH_LED];
		if (led) led.color = { r: 0, g: 0, b: 64 };
	}

	encoder8.onChange = ({ encoders, buttons, switchOn }) => {
		trace(`[8Encoder] values=${encoders.join(",")}\tbuttons=0x${buttons.toString(16)}\tswitch=${switchOn}\n`);
	};

	encoder8.onEncoderChange = (encoder, value) => {
		trace(`[8Encoder] encoder=${encoder}\tvalue=${value}\n`);
		{
			const led = encoder8.leds[encoder];
			if (led) led.color = { r: value < 0 ? 64 : 0, g: value > 0 ? 64 : 0, b: value === 0 ? 16 : 0 };
		}
	};

	encoder8.onButtonChange = (button, pressed) => {
		trace(`[8Encoder] button=${button}\tpressed=${pressed}\n`);
		{
			const led = encoder8.leds[button];
			if (led) led.color = { r: pressed ? 64 : 0, g: 0, b: pressed ? 0 : 16 };
		}
	};

	encoder8.onSwitchChange = (on) => {
		trace(`[8Encoder] switch=${on}\n`);
		{
			const led = encoder8.leds[Encoder8.SWITCH_LED];
			if (led) led.color = { r: on ? 0 : 64, g: on ? 64 : 0, b: 0 };
		}
	};
}
