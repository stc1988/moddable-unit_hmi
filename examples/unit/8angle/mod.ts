import Angle8 from "unit/8angle";

export async function main(): Promise<void> {
	const angle8 = new Angle8({ deadband: 8 });

	for (let index = 0; index < Angle8.LED_COUNT; index++) {
		const led = angle8.leds[index];
		if (led) {
			led.brightness = 77;
			led.color = { r: 0, g: 0, b: index === Angle8.SWITCH_LED ? 255 : 32 };
		}
	}

	angle8.onChanged = ({ angles, switchOn }) => {
		trace(`[8Angle] angles=${angles.join(",")}\tswitch=${switchOn}\n`);
	};

	angle8.onAngleChanged = (angle, value) => {
		trace(`[8Angle] angle=${angle}\tvalue=${value}\n`);
		{
			const led = angle8.leds[angle];
			if (led) {
				led.brightness = 77;
				led.color = { r: value >> 4, g: 255 - (value >> 4), b: 0 };
			}
		}
	};

	angle8.onSwitchChanged = (on) => {
		trace(`[8Angle] switch=${on}\n`);
		{
			const led = angle8.leds[Angle8.SWITCH_LED];
			if (led) {
				led.brightness = 77;
				led.color = { r: on ? 255 : 0, g: 0, b: on ? 0 : 64 };
			}
		}
	};
}
