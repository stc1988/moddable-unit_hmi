import { integerInRange, type RGBColor } from "hmi/util";
import Timer from "timer";

const directions = [
	[1, 0, -1, 0, 0, 1, 0, -1],
	[0, 0, 0, 1, 0, 0, 0, -1],
	[0, 1, 0, 0, -1, 0, 1, -1],
];

export interface LedOptions {
	write(color: RGBColor, brightness: number): void;
	flush?: () => void;
}

/** A logical LED. The product retains ownership of the underlying hardware. */
export default class Led {
	#write: LedOptions["write"];
	#flush: (() => void) | undefined;
	static #batching = false;
	static #flushes = new Set<() => void>();
	#color: RGBColor = { r: 0, g: 0, b: 0 };
	#brightness = 255;
	#closed = false;
	#animation: { rgb: number[]; phase: number; step: number } | undefined;
	static #active = new Set<Led>();
	static #timer: ReturnType<typeof Timer.repeat> | undefined;

	constructor(options: LedOptions) {
		this.#write = options.write;
		this.#flush = options.flush;
	}

	get color(): RGBColor {
		return { ...this.#color };
	}
	set color(value: RGBColor) {
		this.#assertOpen();
		const color = {
			r: integerInRange(value.r, "r", 0, 255),
			g: integerInRange(value.g, "g", 0, 255),
			b: integerInRange(value.b, "b", 0, 255),
		};
		this.#write(color, this.#brightness);
		this.#commit();
		this.#color = color;
	}
	get on(): number {
		const { r, g, b } = this.#color;
		return ((3 * r + 4 * g + b) >> 3) / 255;
	}
	set on(value: number) {
		const level = Number(value);
		const gray = Math.round((level > 0 ? Math.min(1, level) : 0) * 255);
		this.color = { r: gray, g: gray, b: gray };
	}
	get brightness(): number {
		return this.#brightness;
	}
	set brightness(value: number) {
		this.#assertOpen();
		const brightness = integerInRange(value, "brightness", 0, 255);
		this.#write(this.#color, brightness);
		this.#commit();
		this.#brightness = brightness;
	}
	rainbow(value?: 0 | { step?: number }): void {
		this.#assertOpen();
		if (value === 0) {
			this.#stop();
			this.on = 0;
			return;
		}
		const step = integerInRange(value?.step ?? 3, "step", 1, 255);
		this.#animation = { rgb: [0, 0, 0], phase: 0, step };
		Led.#active.add(this);
		Led.#timer ??= Timer.repeat(() => {
			Led.#batching = true;
			for (const led of Led.#active) {
				try {
					led.#tick();
				} catch (error) {
					led.#stop();
					trace(`[LED] animation stopped: ${String(error)}\n`);
				}
			}
			Led.#batching = false;
			for (const flush of Led.#flushes) {
				try {
					flush();
				} catch (error) {
					trace(`[LED] update failed: ${String(error)}\n`);
				}
			}
			Led.#flushes.clear();
		}, 33);
	}
	close(): void {
		if (this.#closed) return;
		this.#stop();
		this.#closed = true;
	}
	/** Apply a collection operation with one flush per output, after checking lifecycle. */
	static batch(leds: readonly Led[], apply: (led: Led) => void): void {
		for (const led of leds) led.#assertOpen();
		const wasBatching = Led.#batching;
		Led.#batching = true;
		try {
			for (const led of leds) apply(led);
		} finally {
			Led.#batching = wasBatching;
			if (!wasBatching) {
				const flushes = [...Led.#flushes];
				Led.#flushes.clear();
				for (const flush of flushes) flush();
			}
		}
	}

	#commit(): void {
		if (!this.#flush) return;
		if (Led.#batching) Led.#flushes.add(this.#flush);
		else this.#flush();
	}
	#stop(): void {
		this.#animation = undefined;
		Led.#active.delete(this);
		if (!Led.#active.size && Led.#timer !== undefined) {
			Timer.clear(Led.#timer);
			Led.#timer = undefined;
		}
	}
	#assertOpen(): void {
		if (this.#closed) throw new Error("LED is closed");
	}
	#tick(): void {
		const state = this.#animation;
		if (!state) return;

		let advance = false;
		for (let i = 0; i < 3; i++) {
			const direction = directions[i]?.[state.phase] ?? 0;
			const next = (state.rgb[i] ?? 0) + direction * state.step;
			state.rgb[i] = Math.max(0, Math.min(255, next));
			if (direction && (next <= 0 || next >= 255)) advance = true;
		}
		if (advance) state.phase = (state.phase + 1) % 8;
		this.color = { r: state.rgb[0] ?? 0, g: state.rgb[1] ?? 0, b: state.rgb[2] ?? 0 };
	}
}

/** Fixed, iterable LED collection with synchronized group controls. */
export class LedCollection implements Iterable<Led> {
	readonly [index: number]: Led;
	readonly length: number;
	#leds: readonly Led[];

	constructor(leds: readonly Led[]) {
		if (!leds.length) throw new RangeError("LED collection must not be empty");
		this.#leds = Object.freeze([...leds]);
		this.length = leds.length;
		for (let index = 0; index < leds.length; index++)
			Object.defineProperty(this, index, { value: leds[index], enumerable: true });
		Object.freeze(this);
	}

	[Symbol.iterator](): ArrayIterator<Led> {
		return this.#leds[Symbol.iterator]();
	}

	get color(): RGBColor | undefined {
		const first = this.#leds[0]?.color;
		return this.#leds.every((led) => {
			const color = led.color;
			return color.r === first?.r && color.g === first?.g && color.b === first?.b;
		})
			? first
			: undefined;
	}
	set color(value: RGBColor) {
		// Snapshot and validate before any output, including objects with getters.
		const color = {
			r: integerInRange(value.r, "r", 0, 255),
			g: integerInRange(value.g, "g", 0, 255),
			b: integerInRange(value.b, "b", 0, 255),
		};
		Led.batch(this.#leds, (led) => {
			led.color = color;
		});
	}
	get brightness(): number | undefined {
		const first = this.#leds[0]?.brightness;
		return this.#leds.every((led) => led.brightness === first) ? first : undefined;
	}
	set brightness(value: number) {
		const brightness = integerInRange(value, "brightness", 0, 255);
		Led.batch(this.#leds, (led) => {
			led.brightness = brightness;
		});
	}
	get on(): number | undefined {
		const first = this.#leds[0]?.on;
		return this.#leds.every((led) => led.on === first) ? first : undefined;
	}
	set on(value: number) {
		Led.batch(this.#leds, (led) => {
			led.on = value;
		});
	}
	rainbow(value?: 0 | { step?: number }): void {
		const options = value === 0 ? 0 : { step: integerInRange(value?.step ?? 3, "step", 1, 255) };
		Led.batch(this.#leds, (led) => led.rainbow(options));
	}
	close(): void {
		for (const led of this.#leds) led.close();
	}
}

export function scaleColor(color: RGBColor, brightness: number): RGBColor {
	return {
		r: Math.round((color.r * brightness) / 255),
		g: Math.round((color.g * brightness) / 255),
		b: Math.round((color.b * brightness) / 255),
	};
}
