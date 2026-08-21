import Angle from "unit/angle";

export async function main(): Promise<void> {
	const angle = new Angle({ deadband: 4 });

	angle.input.onChange = ({ raw, position }) => {
		trace(`[Angle] raw=${raw}\tposition=${position.toFixed(3)}\n`);
	};
}
