import AnalogInput, { type AnalogInputOptions } from "hmi/input/analog";
import Led, { LedCollection, scaleColor } from "hmi/led";
import Peripheral, { assertOpen, ownResource, type PeripheralOptions } from "hmi/peripheral";
import { integerInRange, type RGBColor } from "hmi/util";

export interface FaderSample {
	raw: number;
	position: number;
	time: number;
}

export interface FaderOptions extends PeripheralOptions {
	sensor: AnalogInputOptions;
	leds: { io: FaderLedIOConstructor; pin: number; [key: string]: unknown };
}
export type FaderLedColumn = "left" | "right";

export interface FaderLedIO {
	brightness: number;
	close(): void;
	update(): void;
	makeRGB(r: number, g: number, b: number): number;
	setPixel(index: number, color: number): void;
	fill(color: number): void;
}

export type FaderLedIOConstructor = new (options: { pin: number; length: number; order: string }) => FaderLedIO;

// https://docs.m5stack.com/ja/unit/fader
export default class Fader extends Peripheral {
	#flushLeds = () => this.show();
	readonly leds = new LedCollection(
		Array.from(
			{ length: 14 },
			(_, index) =>
				new Led({
					flush: this.#flushLeds,
					write: (color, brightness) => {
						this.setPixel(index, scaleColor(color, brightness), false);
					},
				}),
		),
	);

	static readonly LED_COUNT = 14;
	static readonly COLUMN_COUNT = 2;
	static readonly LEVEL_COUNT = 7;

	#sensor: AnalogInput;
	#leds: FaderLedIO;
	constructor(options: FaderOptions) {
		super(options);
		try {
			if (!options.leds || typeof options.leds.io !== "function") throw new TypeError("leds.io must be a constructor");
			this.#sensor = ownResource(this, new AnalogInput({ ...options.sensor, invert: true }));
			this.#leds = ownResource(this, new options.leds.io({ ...options.leds, length: Fader.LED_COUNT, order: "GRB" }));
			ownResource(this, this.leds);
			this.configure({ brightness: 128 });
			this.leds.color = { r: 0, g: 0, b: 0 };
			this.#sensor.read();
		} catch (error) {
			this.close();
			throw error;
		}
	}
	configure(options: { brightness?: number }): void {
		super.configure(options);
		if ("brightness" in options) {
			this.#leds.brightness = Fader.#colorComponent(options.brightness as number, "brightness");
			this.#leds.update();
		}
	}
	get configuration(): { interrupt: boolean; brightness: number } {
		return { ...super.configuration, brightness: this.#leds.brightness };
	}
	sample(): FaderSample {
		assertOpen(this);
		return { ...this.#sensor.read(), time: Date.now() };
	}

	get brightness(): number {
		assertOpen(this);
		return this.#leds.brightness;
	}

	set brightness(value: number) {
		assertOpen(this);
		this.configure({ brightness: value });
	}

	read(): number {
		assertOpen(this);
		return this.#sensor.readRaw();
	}

	readSample(): FaderSample {
		assertOpen(this);
		return this.sample();
	}

	static ledIndex(column: FaderLedColumn, level: number): number {
		Fader.#validateLevel(level);
		if (column === "right") return level;
		if (column === "left") return Fader.LED_COUNT - 1 - level;
		throw new RangeError('column must be "left" or "right"');
	}

	setLed(column: FaderLedColumn, level: number, color: RGBColor, update = true): void {
		assertOpen(this);
		this.setPixel(Fader.ledIndex(column, level), color, update);
	}

	setLevel(level: number, color: RGBColor, update = true): void {
		assertOpen(this);
		Fader.#validateLevel(level);
		this.setLed("left", level, color, false);
		this.setLed("right", level, color, false);
		if (update) this.show();
	}

	fillColumn(column: FaderLedColumn, color: RGBColor, update = true): void {
		assertOpen(this);
		for (let level = 0; level < Fader.LEVEL_COUNT; level++) this.setLed(column, level, color, false);
		if (update) this.show();
	}

	setPixel(index: number, color: RGBColor, update = true): void {
		assertOpen(this);
		if (!Number.isInteger(index) || index < 0 || index >= Fader.LED_COUNT)
			throw new RangeError(`index must be an integer from 0 to ${Fader.LED_COUNT - 1}`);

		this.#leds.setPixel(
			index,
			this.#leds.makeRGB(
				Fader.#colorComponent(color.r, "r"),
				Fader.#colorComponent(color.g, "g"),
				Fader.#colorComponent(color.b, "b"),
			),
		);
		if (update) this.show();
	}

	fill(color: RGBColor): void {
		assertOpen(this);
		this.#leds.fill(
			this.#leds.makeRGB(
				Fader.#colorComponent(color.r, "r"),
				Fader.#colorComponent(color.g, "g"),
				Fader.#colorComponent(color.b, "b"),
			),
		);
		this.show();
	}

	show(): void {
		assertOpen(this);
		this.#leds.update();
	}

	static #colorComponent(value: number, name: string): number {
		if (!Number.isFinite(value)) throw new RangeError(`${name} must be a finite number`);
		return integerInRange(value, name, 0, 255);
	}

	static #validateLevel(level: number): void {
		if (!Number.isInteger(level) || level < 0 || level >= Fader.LEVEL_COUNT)
			throw new RangeError(`level must be an integer from 0 to ${Fader.LEVEL_COUNT - 1}`);
	}
}
