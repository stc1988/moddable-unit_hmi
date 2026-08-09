import Scroll from "unit/scroll";

export async function main(): Promise<void> {
	const scroll = new Scroll();

	scroll.onChange = ({ value, pressed }) => {
		trace(`[Scroll] value=${value}\tpressed=${pressed}\n`);
	};

	scroll.onButtonChange = (pressed) => {
		trace(`[Scroll] button pressed: ${pressed}\n`);
		scroll.setLed(pressed ? 255 : 0, pressed ? 64 : 0, pressed ? 0 : 32);
	};
}
