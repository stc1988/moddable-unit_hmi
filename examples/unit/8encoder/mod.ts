import Encoder8 from "unit/8encoder";

export async function main(): Promise<void> {
	const encoder8 = new Encoder8();

	encoder8.setAllLeds(0, 0, 16);
	encoder8.setLed(Encoder8.SWITCH_LED, 0, 0, 64);

	encoder8.onChange = ({ encoders, buttons, switchOn }) => {
		trace(`[8Encoder] values=${encoders.join(",")}\tbuttons=0x${buttons.toString(16)}\tswitch=${switchOn}\n`);
	};

	encoder8.onEncoderChange = (encoder, value) => {
		trace(`[8Encoder] encoder=${encoder}\tvalue=${value}\n`);
		encoder8.setLed(encoder, value < 0 ? 64 : 0, value > 0 ? 64 : 0, value === 0 ? 16 : 0);
	};

	encoder8.onButtonChange = (button, pressed) => {
		trace(`[8Encoder] button=${button}\tpressed=${pressed}\n`);
		encoder8.setLed(button, pressed ? 64 : 0, 0, pressed ? 0 : 16);
	};

	encoder8.onSwitchChange = (on) => {
		trace(`[8Encoder] switch=${on}\n`);
		encoder8.setLed(Encoder8.SWITCH_LED, on ? 0 : 64, on ? 64 : 0, 0);
	};
}
