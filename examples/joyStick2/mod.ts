import JoyStick2 from "joyStick2";

export async function main(): Promise<void> {
	const joystick = new JoyStick2();

	joystick.onPoll = ({ x, y }) => {
		trace(`[JoyStick2] x=${x}\ty=${y}\n`);
	};

	joystick.onPush = (value) => {
		trace(`[JoyStick2] button pressed: ${value}\n`);
		joystick.setLed(value ? 255 : 0, 0, value ? 0 : 255);
	};
}
