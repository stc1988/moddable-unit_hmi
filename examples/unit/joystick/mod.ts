import JoyStick from "unit/joystick";

export async function main(): Promise<void> {
	const joystick = new JoyStick({ deadband: 2 });

	joystick.onChange = ({ x, y, pressed }) => {
		trace(`[JoyStick] x=${x}\ty=${y}\tpressed=${pressed}\n`);
	};

	joystick.onButtonChange = (pressed) => {
		trace(`[JoyStick] button pressed: ${pressed}\n`);
	};
}
