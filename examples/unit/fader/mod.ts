import Fader from "unit/fader";

export async function main(): Promise<void> {
	const fader = new Fader({ deadband: 4 });

	fader.onChange = ({ raw, position }) => {
		const lit = Math.round(position * Fader.LEVEL_COUNT);

		for (let level = 0; level < Fader.LEVEL_COUNT; level++) {
			fader.setLevel(level, { r: 0, g: level < lit ? 128 : 0, b: level < lit ? 255 : 0 }, false);
		}
		fader.show();

		trace(`[Fader] raw=${raw}\tposition=${position.toFixed(3)}\n`);
	};
}
