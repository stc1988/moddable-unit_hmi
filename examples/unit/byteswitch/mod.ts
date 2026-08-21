import ByteSwitch from "unit/byteswitch";

export async function main(): Promise<void> {
	const byteSwitch = new ByteSwitch();

	byteSwitch.setLedMode(ByteSwitch.LED_MODE.MANUAL);
	for (let led = 0; led < ByteSwitch.LED_COUNT; led++) {
		byteSwitch.setLedBrightness(led, 64);
		byteSwitch.setLed(led, { r: 0, g: 0, b: led === 8 ? 64 : 0 });
	}

	byteSwitch.input.onChange = ({ switches }) => {
		trace(`[ByteSwitch] switches=0b${switches.toString(2).padStart(8, "0")}\n`);
	};

	byteSwitch.input.onSwitchChange = (switchIndex, on) => {
		trace(`[ByteSwitch] switch=${switchIndex}\ton=${on}\n`);
		byteSwitch.setLed(switchIndex, { r: on ? 255 : 0, g: on ? 128 : 0, b: 0 });
	};
}
