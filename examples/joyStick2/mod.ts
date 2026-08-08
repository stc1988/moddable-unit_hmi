import JoyStick2 from "joyStick2";

export async function main(): Promise<void> {
	const joystick = new JoyStick2({ deadband: 2 });

	joystick.onChange = ({ x, y, pressed }) => {
		trace(`[JoyStick2] x=${x}\ty=${y}\tpressed=${pressed}\n`);
	};

	joystick.onButtonChange = (pressed) => {
		trace(`[JoyStick2] button pressed: ${pressed}\n`);
		joystick.setLed(pressed ? 255 : 0, 0, pressed ? 0 : 255);
	};
}
