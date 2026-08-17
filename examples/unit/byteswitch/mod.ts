import ByteSwitch from "unit/byteswitch";

export async function main(): Promise<void> {
	const byteSwitch = new ByteSwitch();

	byteSwitch.setLedMode(ByteSwitch.LED_MODE.MANUAL);
	for (let led = 0; led < ByteSwitch.LED_COUNT; led++) {
		byteSwitch.setLedBrightness(led, 64);
		byteSwitch.setLed(led, 0, 0, led === 8 ? 64 : 0);
	}

	byteSwitch.onChange = ({ switches }) => {
		trace(`[ByteSwitch] switches=0b${switches.toString(2).padStart(8, "0")}\n`);
	};

	byteSwitch.onSwitchChange = (switchIndex, on) => {
		trace(`[ByteSwitch] switch=${switchIndex}\ton=${on}\n`);
		byteSwitch.setLed(switchIndex, on ? 255 : 0, on ? 128 : 0, 0);
	};
}
