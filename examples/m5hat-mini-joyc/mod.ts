import MiniJoyC from "miniJoyC";

export async function main(): Promise<void> {
	const joystick = new MiniJoyC({ pollingInterval: 30, readMode: "pos8" });
	let ledOn = false;

	trace(`[MiniJoyC] firmware=${joystick.getFirmwareVersion()}\taddress=0x${joystick.getI2CAddress().toString(16)}\n`);

	joystick.onPoll = ({ x, y }) => {
		trace(`[MiniJoyC] x=${x}\ty=${y}\n`);
	};

	joystick.onButtonPressed = () => {
		ledOn = !ledOn;
		joystick.setLed(0, ledOn ? 128 : 0, ledOn ? 255 : 0);
		trace("[MiniJoyC] button pressed\n");
	};
}
