import Scroll from "unit/scroll";

export async function main(): Promise<void> {
	const scroll = new Scroll();

	scroll.input.onChange = ({ value, pressed }) => {
		trace(`[Scroll] value=${value}\tpressed=${pressed}\n`);
	};

	scroll.input.onButtonChange = (pressed) => {
		trace(`[Scroll] button pressed: ${pressed}\n`);
		scroll.setLed({ r: pressed ? 255 : 0, g: pressed ? 64 : 0, b: pressed ? 0 : 32 });
	};
}
