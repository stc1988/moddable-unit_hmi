import ByteSwitch from "unit/byteswitch";

export async function main(): Promise<void> {
	const byteSwitch = new ByteSwitch();

	byteSwitch.setLedMode(ByteSwitch.LED_MODE.MANUAL);
	for (let index = 0; index < ByteSwitch.LED_COUNT; index++) {
		{
			const led = byteSwitch.leds[index];
			if (led) led.brightness = 64;
		}
		{
			const led = byteSwitch.leds[index];
			if (led) led.color = { r: 0, g: 0, b: index === 8 ? 64 : 0 };
		}
	}

	byteSwitch.onChanged = ({ switches }) => {
		trace(`[ByteSwitch] switches=0b${switches.toString(2).padStart(8, "0")}\n`);
	};

	byteSwitch.onSwitchChanged = (switchIndex, on) => {
		trace(`[ByteSwitch] switch=${switchIndex}\ton=${on}\n`);
		{
			const led = byteSwitch.leds[switchIndex];
			if (led) led.color = { r: on ? 255 : 0, g: on ? 128 : 0, b: 0 };
		}
	};
}
