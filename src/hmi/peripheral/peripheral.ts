export interface PeripheralOptions {
	target?: unknown;
	onSample?: () => void;
	onError?: () => void;
}
export interface Resource {
	close(): void;
}
interface State {
	closed: boolean;
	resources: Resource[];
}
let states: WeakMap<object, State> | undefined;
// Allocate mutable registries at runtime, never in the preload image.
// Open peripherals stay alive until explicitly closed, as required by the base pattern.
let active: Set<object> | undefined;
export function optionsObject(value: unknown): asserts value is object {
	if (value === null || typeof value !== "object") throw new TypeError("options object is required");
}
export function assertOpen(instance: object): void {
	const state = states?.get(instance);
	if (!state || state.closed) throw new Error("peripheral is closed");
}
export function ownResource<T extends Resource>(instance: object, resource: T): T {
	assertOpen(instance);
	states?.get(instance)?.resources.push(resource);
	active ??= new Set();
	active.add(instance);
	return resource;
}
export default class Peripheral {
	declare target?: unknown;
	declare [Symbol.dispose]: () => void;
	constructor(options: PeripheralOptions) {
		optionsObject(options);
		if ("target" in options) this.target = options.target;
		states ??= new WeakMap();
		states.set(this, { closed: false, resources: [] });
	}
	close(): void {
		const state = states?.get(this);
		if (!state || state.closed) return;
		state.closed = true;
		active?.delete(this);
		let failure: unknown;
		let failed = false;
		for (const resource of state.resources.reverse()) {
			try {
				resource.close();
			} catch (error) {
				if (!failed) {
					failure = error;
					failed = true;
				}
			}
		}
		state.resources.length = 0;
		if (failed) throw failure;
	}
	configure(options: object): void {
		assertOpen(this);
		optionsObject(options);
	}
	get configuration(): { interrupt: boolean } {
		assertOpen(this);
		return { interrupt: false };
	}
	static {
		Peripheral.prototype[Symbol.dispose] = Peripheral.prototype.close;
	}
}
