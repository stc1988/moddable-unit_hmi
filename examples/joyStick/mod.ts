import JoyStick from "joyStick";

export async function main(): Promise<void> {
	const joystick = new JoyStick();

	joystick.onPoll = ({ x, y }) => {
		trace(`[JoyStick] x=${x}\ty=${y}\n`);
	};

	joystick.onPush = (pressed) => {
		trace(`[JoyStick] button pressed: ${pressed}\n`);
	};
}
