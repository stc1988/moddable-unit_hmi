import Timer from "timer";

export interface SampleSource<State extends object> {
	sample(): State | undefined;
	close?(): void;
}

export interface WatchInputOptions<State extends object> {
	interval?: number;
	deadband?: number;
	onChanged(this: SampleSource<State>, sample: State, previous: State | undefined): void;
	onError?(this: SampleSource<State>, error: unknown): void;
	changed?(this: SampleSource<State>, sample: State, previous: State): boolean;
	/** Close the source when the watcher closes. Defaults to false. */
	closeSource?: boolean;
}

// Product samples are acyclic plain objects/arrays. Copy them before user callbacks
// so source buffer reuse and callback mutations cannot alter the comparison baseline.
function copy<Value>(value: Value): Value {
	if (Array.isArray(value)) return value.map(copy) as Value;
	if (value !== null && typeof value === "object")
		return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)])) as Value;
	return value;
}

function different(current: unknown, previous: unknown, deadband: number, key = ""): boolean {
	if (Object.is(current, previous)) return false;
	if (typeof current === "number" && typeof previous === "number") {
		if (key === "buttons" || key === "switches" || !Number.isFinite(current) || !Number.isFinite(previous)) return true;
		return Math.abs(current - previous) > deadband;
	}
	if (Array.isArray(current) && Array.isArray(previous))
		return (
			current.length !== previous.length || current.some((value, index) => different(value, previous[index], deadband))
		);
	if (Array.isArray(current) !== Array.isArray(previous)) return true;
	if (current !== null && previous !== null && typeof current === "object" && typeof previous === "object") {
		const a = current as Record<string, unknown>;
		const b = previous as Record<string, unknown>;
		const keys = (value: Record<string, unknown>) =>
			Object.keys(value).filter(
				(name) => name !== "time" && name !== "ticks" && !(name === "position" && "raw" in value),
			);
		const aKeys = keys(a);
		const bKeys = keys(b);
		return (
			aKeys.length !== bKeys.length ||
			aKeys.some((name) => !bKeys.includes(name) || different(a[name], b[name], deadband, name))
		);
	}
	return true;
}

/** Application-level polling, separate from ECMA-419 driver implementations. */
export class InputWatcher<State extends object> {
	#source: SampleSource<State> | undefined;
	#onChanged: WatchInputOptions<State>["onChanged"] | undefined;
	#onError: WatchInputOptions<State>["onError"];
	#changed: WatchInputOptions<State>["changed"];
	#interval: number;
	#deadband: number;
	#closeSource: boolean;
	#timer: ReturnType<typeof Timer.repeat> | undefined;
	#previous: State | undefined;
	#generation = 0;
	#closed = false;
	declare [Symbol.dispose]: () => void;

	constructor(source: SampleSource<State>, options: WatchInputOptions<State>) {
		if (!source || typeof source.sample !== "function") throw new TypeError("source.sample must be a function");
		if (!options || typeof options !== "object") throw new TypeError("options object is required");
		if (typeof options.onChanged !== "function") throw new TypeError("onChanged must be a function");
		if (options.onError !== undefined && typeof options.onError !== "function")
			throw new TypeError("onError must be a function");
		if (options.changed !== undefined && typeof options.changed !== "function")
			throw new TypeError("changed must be a function");
		const interval = options.interval ?? 30;
		const deadband = options.deadband ?? 0;
		if (!Number.isInteger(interval) || interval < 1) throw new RangeError("interval must be a positive integer");
		if (!Number.isFinite(deadband) || deadband < 0)
			throw new RangeError("deadband must be a non-negative finite number");
		if (options.closeSource !== undefined && typeof options.closeSource !== "boolean")
			throw new TypeError("closeSource must be a boolean");
		if (options.closeSource && typeof source.close !== "function")
			throw new TypeError("closeSource requires source.close");
		this.#source = source;
		this.#onChanged = options.onChanged;
		this.#onError = options.onError;
		this.#changed = options.changed;
		this.#interval = interval;
		this.#deadband = deadband;
		this.#closeSource = options.closeSource ?? false;
		this.start();
	}

	start(): void {
		this.#assertOpen();
		if (this.#timer !== undefined) return;
		this.#previous = undefined;
		const generation = ++this.#generation;
		this.#timer = Timer.repeat(() => this.#tick(generation), this.#interval);
	}

	stop(): void {
		this.#assertOpen();
		this.#cancel();
	}

	get running(): boolean {
		this.#assertOpen();
		return this.#timer !== undefined;
	}

	close(): void {
		if (this.#closed) return;
		this.#closed = true;
		this.#cancel();
		const source = this.#source;
		this.#source = undefined;
		this.#onChanged = undefined;
		this.#onError = undefined;
		this.#changed = undefined;
		this.#previous = undefined;
		if (this.#closeSource) source?.close?.();
	}

	#assertOpen(): void {
		if (this.#closed) throw new Error("input watcher is closed");
	}

	#cancel(): void {
		++this.#generation;
		if (this.#timer !== undefined) Timer.clear(this.#timer);
		this.#timer = undefined;
	}

	#active(generation: number): boolean {
		return !this.#closed && this.#timer !== undefined && this.#generation === generation;
	}

	#tick(generation: number): void {
		const source = this.#source;
		if (!source || !this.#active(generation)) return;
		try {
			const sample = source.sample();
			if (sample === undefined || !this.#active(generation)) return;
			const previous = this.#previous;
			const snapshot = copy(sample);
			const changed =
				previous === undefined ||
				(this.#changed
					? this.#changed.call(source, sample, copy(previous))
					: different(sample, previous, this.#deadband));
			if (!changed || !this.#active(generation)) return;
			this.#onChanged?.call(source, sample, previous === undefined ? undefined : copy(previous));
			if (this.#active(generation)) this.#previous = snapshot;
		} catch (error) {
			if (!this.#active(generation)) return;
			if (this.#onError) this.#onError.call(source, error);
			else trace(`[watchInput] poll failed: ${String(error)}\n`);
		}
	}

	static {
		InputWatcher.prototype[Symbol.dispose] = InputWatcher.prototype.close;
	}
}

export default function watchInput<State extends object>(
	source: SampleSource<State>,
	options: WatchInputOptions<State>,
): InputWatcher<State> {
	return new InputWatcher(source, options);
}
