import Analog from "embedded:io/analog";
import type { RGBColor } from "hmi/util";
import AnalogInput, {
	type AnalogInputChangeCallback,
	AnalogInputEvents,
	type AnalogInputEventOptions,
	type AnalogIO,
} from "input/analog";
import NeoPixel from "neopixel";

export interface FaderSample {
	raw: number;
	position: number;
}

export interface FaderOptions extends AnalogInputEventOptions<FaderSample> {
	sensor?: {
		io?: AnalogIO;
		pin?: number;
	};
	leds?: {
		io?: FaderLedIOConstructor;
		pin?: number;
	};
	brightness?: number;
}

export type FaderChangeCallback = AnalogInputChangeCallback<FaderSample>;
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
export default class Fader {
	static readonly LED_COUNT = 14;
	static readonly COLUMN_COUNT = 2;
	static readonly LEVEL_COUNT = 7;
	static readonly DEFAULT_ANALOG_PIN = 8;
	static readonly DEFAULT_LED_PIN = 9;

	#sensor: AnalogInput;
	#leds: FaderLedIO;
	#closed = false;
	readonly input: AnalogInputEvents<FaderSample>;

	constructor(options: FaderOptions = {}) {
		const sensor = new AnalogInput({
			io: options.sensor?.io ?? Analog,
			pin: options.sensor?.pin ?? Fader.DEFAULT_ANALOG_PIN,
			invert: true,
		});
		let leds: FaderLedIO | undefined;
		try {
			const LedIO = options.leds?.io ?? NeoPixel;
			leds = new LedIO({
				length: Fader.LED_COUNT,
				pin: options.leds?.pin ?? Fader.DEFAULT_LED_PIN,
				order: "GRB",
			});
			leds.brightness = Fader.#colorComponent(options.brightness ?? 128, "brightness");
			this.input = new AnalogInputEvents(this, sensor, "Fader", options);
			this.#sensor = sensor;
			this.#leds = leds;
		} catch (error) {
			leds?.close();
			sensor.close();
			throw error;
		}
	}

	close(): void {
		if (this.#closed) return;
		this.#closed = true;
		this.input.close();
		this.#sensor.close();
		this.#leds.close();
	}

	get brightness(): number {
		return this.#leds.brightness;
	}

	set brightness(value: number) {
		this.#leds.brightness = Fader.#colorComponent(value, "brightness");
		this.#leds.update();
	}

	read(): number {
		return this.#sensor.readRaw();
	}

	readSample(): FaderSample {
		return this.#sensor.read();
	}

	static ledIndex(column: FaderLedColumn, level: number): number {
		Fader.#validateLevel(level);
		if (column === "right") return level;
		if (column === "left") return Fader.LED_COUNT - 1 - level;
		throw new RangeError('column must be "left" or "right"');
	}

	setLed(column: FaderLedColumn, level: number, color: RGBColor, update = true): void {
		this.setPixel(Fader.ledIndex(column, level), color, update);
	}

	setLevel(level: number, color: RGBColor, update = true): void {
		Fader.#validateLevel(level);
		this.setLed("left", level, color, false);
		this.setLed("right", level, color, false);
		if (update) this.show();
	}

	fillColumn(column: FaderLedColumn, color: RGBColor, update = true): void {
		for (let level = 0; level < Fader.LEVEL_COUNT; level++) this.setLed(column, level, color, false);
		if (update) this.show();
	}

	setPixel(index: number, color: RGBColor, update = true): void {
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
		this.#leds.update();
	}

	static #colorComponent(value: number, name: string): number {
		if (!Number.isFinite(value)) throw new RangeError(`${name} must be a finite number`);
		return Math.round(Math.max(0, Math.min(255, value)));
	}

	static #validateLevel(level: number): void {
		if (!Number.isInteger(level) || level < 0 || level >= Fader.LEVEL_COUNT)
			throw new RangeError(`level must be an integer from 0 to ${Fader.LEVEL_COUNT - 1}`);
	}
}
