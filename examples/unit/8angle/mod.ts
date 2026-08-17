import Angle8 from "unit/8angle";

export async function main(): Promise<void> {
	const angle8 = new Angle8({ deadband: 8 });

	for (let led = 0; led < Angle8.LED_COUNT; led++) angle8.setLed(led, 0, 0, led === Angle8.SWITCH_LED ? 255 : 32, 30);

	angle8.onChange = ({ angles, switchOn }) => {
		trace(`[8Angle] angles=${angles.join(",")}\tswitch=${switchOn}\n`);
	};

	angle8.onAngleChange = (angle, value) => {
		trace(`[8Angle] angle=${angle}\tvalue=${value}\n`);
		angle8.setLed(angle, value >> 4, 255 - (value >> 4), 0, 30);
	};

	angle8.onSwitchChange = (on) => {
		trace(`[8Angle] switch=${on}\n`);
		angle8.setLed(Angle8.SWITCH_LED, on ? 255 : 0, 0, on ? 0 : 64, 30);
	};
}
