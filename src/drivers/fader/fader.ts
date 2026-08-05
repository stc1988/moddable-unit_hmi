import Analog from "embedded:io/analog";
import NeoPixel from "neopixel";
import Timer from "timer";

export interface FaderSample {
	raw: number;
	position: number;
}

export interface FaderOptions {
	analogPin?: number;
	ledPin?: number;
	pollingInterval?: number;
	deadband?: number;
	brightness?: number;
	onChange?: FaderChangeCallback;
}

export type FaderChangeCallback = (sample: FaderSample) => void;
export type FaderLedColumn = "left" | "right";

// https://docs.m5stack.com/ja/unit/fader
export default class Fader {
	static readonly LED_COUNT = 14;
	static readonly COLUMN_COUNT = 2;
	static readonly LEVEL_COUNT = 7;
	static readonly DEFAULT_ANALOG_PIN = 8;
	static readonly DEFAULT_LED_PIN = 9;

	#analog: Analog;
	#leds: NeoPixel;
	#timer?: ReturnType<typeof Timer.repeat>;
	#onChange: FaderChangeCallback | null;
	#lastRaw?: number;

	pollingInterval: number;
	deadband: number;

	constructor(options: FaderOptions = {}) {
		this.pollingInterval = Fader.#nonNegativeInteger(options.pollingInterval ?? 30, "pollingInterval", 1);
		this.deadband = Fader.#nonNegativeInteger(options.deadband ?? 0, "deadband");

		this.#analog = new Analog({ pin: options.analogPin ?? Fader.DEFAULT_ANALOG_PIN });
		this.#leds = new NeoPixel({
			length: Fader.LED_COUNT,
			pin: options.ledPin ?? Fader.DEFAULT_LED_PIN,
			order: "GRB",
		});
		this.#leds.brightness = Fader.#colorComponent(options.brightness ?? 128, "brightness");
		this.#onChange = options.onChange ?? null;
		this.#updatePollingState();
	}

	close(): void {
		this.stop();
		this.#analog.close();
		this.#leds.close();
	}

	start(): void {
		if (this.#timer) return;
		this.#timer = Timer.repeat(() => {
			this.#pollTick();
		}, this.pollingInterval);
	}

	stop(): void {
		if (!this.#timer) return;
		Timer.clear(this.#timer);
		this.#timer = undefined;
	}

	set onChange(callback: FaderChangeCallback | null | undefined) {
		this.#onChange = typeof callback === "function" ? callback : null;
		this.#updatePollingState();
	}

	get onChange(): FaderChangeCallback | null {
		return this.#onChange;
	}

	get brightness(): number {
		return this.#leds.brightness;
	}

	set brightness(value: number) {
		this.#leds.brightness = Fader.#colorComponent(value, "brightness");
		this.#leds.update();
	}

	read(): number {
		return this.#analog.read();
	}

	readSample(): FaderSample {
		const raw = this.read();
		const maximum = (1 << this.#analog.resolution) - 1;
		return {
			raw,
			position: (maximum - raw) / maximum,
		};
	}

	static ledIndex(column: FaderLedColumn, level: number): number {
		Fader.#validateLevel(level);
		if (column === "right") return level;
		if (column === "left") return Fader.LED_COUNT - 1 - level;
		throw new RangeError('column must be "left" or "right"');
	}

	setLed(column: FaderLedColumn, level: number, r: number, g: number, b: number, update = true): void {
		this.setPixel(Fader.ledIndex(column, level), r, g, b, update);
	}

	setLevel(level: number, r: number, g: number, b: number, update = true): void {
		Fader.#validateLevel(level);
		this.setLed("left", level, r, g, b, false);
		this.setLed("right", level, r, g, b, false);
		if (update) this.show();
	}

	fillColumn(column: FaderLedColumn, r: number, g: number, b: number, update = true): void {
		for (let level = 0; level < Fader.LEVEL_COUNT; level++) this.setLed(column, level, r, g, b, false);
		if (update) this.show();
	}

	setPixel(index: number, r: number, g: number, b: number, update = true): void {
		if (!Number.isInteger(index) || index < 0 || index >= Fader.LED_COUNT)
			throw new RangeError(`index must be an integer from 0 to ${Fader.LED_COUNT - 1}`);

		this.#leds.setPixel(
			index,
			this.#leds.makeRGB(Fader.#colorComponent(r, "r"), Fader.#colorComponent(g, "g"), Fader.#colorComponent(b, "b")),
		);
		if (update) this.show();
	}

	fill(r: number, g: number, b: number): void {
		this.#leds.fill(
			this.#leds.makeRGB(Fader.#colorComponent(r, "r"), Fader.#colorComponent(g, "g"), Fader.#colorComponent(b, "b")),
		);
		this.show();
	}

	show(): void {
		this.#leds.update();
	}

	#updatePollingState(): void {
		if (this.#onChange) this.start();
		else this.stop();
	}

	#pollTick(): void {
		try {
			const sample = this.readSample();
			if (this.#lastRaw === undefined || Math.abs(sample.raw - this.#lastRaw) > this.deadband) {
				this.#lastRaw = sample.raw;
				this.#onChange?.(sample);
			}
		} catch (error) {
			trace(`[Fader][ERROR] poll failed: ${error instanceof Error ? error.message : String(error)}\n`);
		}
	}

	static #colorComponent(value: number, name: string): number {
		if (!Number.isFinite(value)) throw new RangeError(`${name} must be a finite number`);
		return Math.round(Math.max(0, Math.min(255, value)));
	}

	static #nonNegativeInteger(value: number, name: string, minimum = 0): number {
		if (!Number.isInteger(value) || value < minimum) throw new RangeError(`${name} must be an integer >= ${minimum}`);
		return value;
	}

	static #validateLevel(level: number): void {
		if (!Number.isInteger(level) || level < 0 || level >= Fader.LEVEL_COUNT)
			throw new RangeError(`level must be an integer from 0 to ${Fader.LEVEL_COUNT - 1}`);
	}
}
