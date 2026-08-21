import MiniJoyC from "hat/mini-joyc";

export async function main(): Promise<void> {
	const joystick = new MiniJoyC({ pollingInterval: 30, deadband: 2, readMode: "pos8" });
	let ledOn = false;

	trace(`[MiniJoyC] firmware=${joystick.getFirmwareVersion()}\taddress=0x${joystick.getI2CAddress().toString(16)}\n`);

	joystick.onChange = ({ x, y, pressed }) => {
		trace(`[MiniJoyC] x=${x}\ty=${y}\tpressed=${pressed}\n`);
	};

	joystick.onButtonChange = (pressed) => {
		if (!pressed) return;
		ledOn = !ledOn;
		joystick.setLed({ r: 0, g: ledOn ? 128 : 0, b: ledOn ? 255 : 0 });
		trace("[MiniJoyC] button pressed\n");
	};
}
