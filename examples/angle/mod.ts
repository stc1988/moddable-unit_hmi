import Angle from "angle";

export async function main(): Promise<void> {
	const angle = new Angle({ deadband: 4 });

	angle.onChange = ({ raw, position }) => {
		trace(`[Angle] raw=${raw}\tposition=${position.toFixed(3)}\n`);
	};
}
