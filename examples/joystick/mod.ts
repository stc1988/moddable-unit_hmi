import UnitJoystick from "unitJoystick";

export async function main(): Promise<void> {
	const joystick = new UnitJoystick();

	joystick.onPoll = ({ x, y }) => {
		trace(`[UnitJoystick] x=${x}\ty=${y}\n`);
	};

	joystick.onPush = (pressed) => {
		trace(`[UnitJoystick] button pressed: ${pressed}\n`);
	};
}
