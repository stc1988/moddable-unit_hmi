import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const outputDirectory = mkdtempSync(join(tmpdir(), "hmi-peripheral-test-"));
process.on("exit", () => rmSync(outputDirectory, { recursive: true, force: true }));
execFileSync("./node_modules/.bin/tsc", ["--noEmit", "false", "--outDir", outputDirectory], { stdio: "inherit" });
const mappings = JSON.parse(readFileSync("tsconfig.json", "utf8")).compilerOptions.paths;
const urls = new Map();
const timers = new Map();
let nextTimer = 0;
globalThis.__peripheralTestTimer = {
	repeat(callback) {
		timers.set(++nextTimer, callback);
		return nextTimer;
	},
	clear(id) {
		timers.delete(id);
	},
	delay() {},
};
globalThis.trace = () => {};
// No device global or concrete IO modules are available to these driver imports.
delete globalThis.device;
function moduleURL(name) {
	if (urls.has(name)) return urls.get(name);
	const path = mappings[name]?.[0];
	assert.ok(path, `unresolved module: ${name}`);
	let source = readFileSync(join(outputDirectory, `${path}.js`), "utf8");
	source = source.replace('import Timer from "timer";', "const Timer = globalThis.__peripheralTestTimer;");
	source = source.replace(/from "([^"]+)"/g, (_, imported) => `from "${moduleURL(imported)}"`);
	const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
	urls.set(name, url);
	return url;
}
const { default: Peripheral, ownResource } = await import(moduleURL("hmi/peripheral"));
const names = [
	"unit/joystick",
	"unit/joystick2",
	"hat/mini-joyc",
	"unit/encoder",
	"unit/scroll",
	"unit/8angle",
	"unit/8encoder",
	"unit/bytebutton",
	"unit/byteswitch",
	"unit/angle",
	"unit/fader",
];
const drivers = await Promise.all(names.map(async (name) => [name, (await import(moduleURL(name))).default]));
const live = new Set();
let failAt = Infinity;
let operations = 0;
let openCount = 0;
let analogCloseCount = 0;
let ledCloseCount = 0;
function operation() {
	if (++operations === failAt) throw new Error("injected IO failure");
}
class Bus {
	constructor(options) {
		this.options = options;
		this.memory = new Uint8Array(256);
		this.memory[0x19] = 1;
		this.closed = false;
		live.add(this);
		openCount++;
	}
	close() {
		assert.equal(this.closed, false, "resource must be closed only once");
		this.closed = true;
		live.delete(this);
	}
	read(length) {
		operation();
		return Uint8Array.of(10, 20, 1).buffer.slice(0, length);
	}
	readUint8(register) {
		operation();
		return this.memory[register];
	}
	readUint16(register, bigEndian) {
		operation();
		const a = this.memory[register];
		const b = this.memory[register + 1];
		return bigEndian ? (a << 8) | b : a | (b << 8);
	}
	readBuffer(register, length) {
		operation();
		return this.memory.slice(register, register + length).buffer;
	}
	writeUint8(register, value) {
		operation();
		this.memory[register] = value;
	}
	writeUint16(register, value, bigEndian) {
		operation();
		this.memory[register] = bigEndian ? value >> 8 : value;
		this.memory[register + 1] = bigEndian ? value : value >> 8;
	}
	writeBuffer(register, buffer) {
		operation();
		this.memory.set(new Uint8Array(buffer.buffer ?? buffer), register);
	}
}
class Analog {
	resolution = 12;
	constructor(options) {
		this.options = options;
		live.add(this);
	}
	read() {
		operation();
		return 1024;
	}
	close() {
		assert.ok(live.delete(this));
		analogCloseCount++;
	}
}
class Pixels {
	brightness = 0;
	constructor(options) {
		this.options = options;
		live.add(this);
	}
	update() {
		operation();
	}
	makeRGB(r, g, b) {
		return (r << 16) | (g << 8) | b;
	}
	setPixel() {
		operation();
	}
	fill() {
		operation();
	}
	close() {
		assert.ok(live.delete(this));
		ledCloseCount++;
	}
}
function optionsFor(name) {
	if (name === "unit/angle" || name === "unit/fader") {
		const options = { sensor: Object.freeze({ io: Analog, pin: 8, resolution: 12, custom: "analog option" }) };
		if (name === "unit/fader") options.leds = Object.freeze({ io: Pixels, pin: 9, custom: "LED option" });
		return options;
	}
	return { sensor: Object.freeze({ io: Bus, data: 1, clock: 2, port: 3, stop: true, timeout: 123 }) };
}
function assertClosedSurface(input) {
	for (
		let prototype = Object.getPrototypeOf(input);
		prototype !== Object.prototype;
		prototype = Object.getPrototypeOf(prototype)
	) {
		for (const name of Object.getOwnPropertyNames(prototype)) {
			if (["constructor", "close"].includes(name)) continue;
			const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
			if (typeof descriptor.value === "function") assert.throws(() => descriptor.value.call(input), /closed/, name);
			if (descriptor.get) assert.throws(() => descriptor.get.call(input), /closed/, name);
			if (descriptor.set) assert.throws(() => descriptor.set.call(input, undefined), /closed/, name);
		}
	}
}
for (const [name, Driver] of drivers) {
	test(`${name}: common pattern, injected IO, fresh samples and close`, () => {
		operations = 0;
		const target = { name };
		let notifications = 0;
		const options = Object.freeze({
			...optionsFor(name),
			target,
			onSample() {
				notifications++;
			},
			ignored: true,
		});
		const input = new Driver(options);
		assert.equal(input.target, target);
		input.target = "changed";
		assert.equal(input.target, "changed");
		delete input.target;
		const before = Date.now();
		const first = input.sample();
		const second = input.sample();
		assert.notEqual(first, second);
		assert.ok(first.time >= before && second.time <= Date.now());
		assert.equal(input.configuration.interrupt, false);
		assert.notEqual(input.configuration, input.configuration);
		assert.equal(input[Symbol.dispose], input.close);
		input.configure(Object.freeze({ ignored: 123 }));
		assert.throws(() => input.configure(), TypeError);
		assert.throws(() => input.configure(null), TypeError);
		for (const internal of [
			"activeBus",
			"reconnect",
			"readAddress",
			"changeAddress",
			"busType",
			"readInputs",
			"setInputLed",
			"onChanged",
			"onButtonChanged",
			"pollingInterval",
			"deadband",
			"start",
			"stop",
		])
			assert.equal(internal in input, false, internal);
		assert.equal(timers.size, 0, "sensor must not poll or synthesize notifications");
		assert.equal(notifications, 0);
		if (input.led) input.led.rainbow();
		if (input.leds) input.leds.rainbow();
		input[Symbol.dispose]();
		assert.equal(timers.size, 0, "close must cancel product LED animations");
		input.close();
		assert.equal(live.size, 0);
		assertClosedSurface(input);
		for (const bad of [undefined, null, 1, "options"]) assert.throws(() => new Driver(bad), TypeError);
		assert.throws(() => new Driver({}), TypeError);
		assert.equal(live.size, 0);
	});
	test(`${name}: every initialization IO failure releases resources`, () => {
		operations = 0;
		const input = new Driver(optionsFor(name));
		const initializationOperations = operations;
		input.close();
		assert.ok(initializationOperations > 0, "construction must communicate with the hardware");
		for (let index = 1; index <= initializationOperations; index++) {
			operations = 0;
			failAt = index;
			assert.throws(() => new Driver(optionsFor(name)), /injected IO failure/);
			assert.equal(live.size, 0, `failure at operation ${index}`);
			assert.equal(timers.size, 0);
		}
		failAt = Infinity;
	});
}
test("configuration reports preserve omitted settings and reject invalid values", () => {
	const MiniJoyC = drivers.find(([name]) => name === "hat/mini-joyc")[1];
	const mini = new MiniJoyC(optionsFor("hat/mini-joyc"));
	mini.configure(Object.freeze({ readMode: "adc" }));
	mini.configure({ ignored: true });
	assert.equal(mini.configuration.readMode, "adc");
	assert.throws(() => mini.configure({ readMode: "invalid" }), RangeError);
	assert.throws(() => mini.configure({ readMode: undefined }), RangeError);
	assert.equal(mini.configuration.readMode, "adc");
	mini.close();
	const Encoder = drivers.find(([name]) => name === "unit/encoder")[1];
	const encoder = new Encoder(optionsFor("unit/encoder"));
	encoder.configure({ mode: 1 });
	encoder.configure({ ignored: true });
	assert.equal(encoder.configuration.mode, 1);
	assert.throws(() => encoder.configure({ mode: 2 }), RangeError);
	assert.equal(encoder.configuration.mode, 1);
	encoder.close();
	const Fader = drivers.find(([name]) => name === "unit/fader")[1];
	const fader = new Fader(optionsFor("unit/fader"));
	assert.equal(fader.brightness, 128);
	fader.configure({ brightness: 64 });
	fader.configure({ ignored: true });
	assert.equal(fader.configuration.brightness, 64);
	assert.throws(() => fader.configure({ brightness: 256 }), RangeError);
	assert.throws(() => fader.configure({ brightness: 2.5 }), RangeError);
	fader.close();
});
test("IO options are forwarded and address changes never replace the IO connection", () => {
	const MiniJoyC = drivers.find(([name]) => name === "hat/mini-joyc")[1];
	const startCount = openCount;
	const mini = new MiniJoyC(optionsFor("hat/mini-joyc"));
	const bus = [...live][0];
	assert.equal(bus.options.port, 3);
	assert.equal(bus.options.stop, true);
	assert.equal(bus.options.timeout, 123);
	assert.equal(bus.options.address, 0x54);
	assert.equal(bus.options.hz, 200_000);
	mini.setI2CAddress(0x55);
	assert.equal(bus.memory[0xff], 0x55);
	assert.equal(openCount, startCount + 1);
	mini.close();
	const reopened = new MiniJoyC({ sensor: { ...optionsFor("hat/mini-joyc").sensor, address: 0x55 } });
	assert.equal([...live][0].options.address, 0x55);
	reopened.close();
});
test("Fader releases its analog input when LED construction fails", () => {
	const Fader = drivers.find(([name]) => name === "unit/fader")[1];
	const before = analogCloseCount;
	assert.throws(
		() =>
			new Fader({
				...optionsFor("unit/fader"),
				leds: {
					io: class {
						constructor() {
							throw new Error("LED open failed");
						}
					},
					pin: 9,
				},
			}),
		/LED open failed/,
	);
	assert.equal(analogCloseCount, before + 1);
	assert.equal(live.size, 0);
	assert.ok(ledCloseCount > 0);
});
test("close releases all resources once, even when one close throws", () => {
	const peripheral = new Peripheral(Object.freeze({}));
	const order = [];
	ownResource(peripheral, {
		close() {
			order.push("bus");
		},
	});
	ownResource(peripheral, {
		close() {
			order.push("LED");
			throw new Error("close failure");
		},
	});
	assert.throws(() => peripheral.close(), /close failure/);
	assert.deepEqual(order, ["LED", "bus"]);
	peripheral.close();
	assert.deepEqual(order, ["LED", "bus"]);
});

test("product samples preserve native encoding, button polarity and analog direction", () => {
	for (const [name, Driver] of drivers) {
		const input = new Driver(optionsFor(name));
		const bus = [...live].find((resource) => resource instanceof Bus);
		if (name === "unit/joystick") assert.deepEqual(input.read(), { x: 10, y: 20, pressed: true });
		if (name === "unit/joystick2") {
			bus.memory[0x60] = 0xff;
			bus.memory[0x61] = 0x7f;
			bus.memory[0x20] = 0;
			assert.deepEqual(input.read(), { x: -1, y: 127, pressed: true });
		}
		if (name === "hat/mini-joyc") {
			bus.memory[0x20] = 0x80;
			bus.memory[0x21] = 0x7f;
			bus.memory[0x30] = 1;
			assert.deepEqual(input.read(), { x: -128, y: 127, pressed: true });
			input.configure({ readMode: "adc" });
			bus.memory[0] = 0x34;
			bus.memory[1] = 0x12;
			assert.equal(input.sample().x, 0x1234);
		}
		if (name === "unit/encoder" || name === "unit/scroll") {
			bus.memory[0x10] = 0xff;
			bus.memory[0x11] = 0xff;
			bus.memory[0x20] = 0;
			assert.deepEqual(input.read(), { value: -1, pressed: name === "unit/scroll" });
		}
		if (name === "unit/8angle") {
			bus.memory[0] = 0x34;
			bus.memory[1] = 0xf2;
			bus.memory[0x20] = 1;
			const sample = input.sample();
			assert.equal(sample.angles[0], 0x234);
			assert.equal(sample.switchOn, true);
			sample.angles[0] = 0;
			assert.equal(input.sample().angles[0], 0x234);
		}
		if (name === "unit/8encoder") {
			bus.memory.fill(0xff, 0, 4);
			bus.memory[0x62] = 0xfe;
			bus.memory[0x60] = 1;
			assert.equal(input.sample().encoders[0], -1);
			assert.equal(input.sample().buttons, 1);
			assert.equal(input.sample().switchOn, true);
		}
		if (name === "unit/bytebutton" || name === "unit/byteswitch") {
			bus.memory[0] = 0xfe;
			const sample = input.sample();
			assert.equal(
				name === "unit/bytebutton" ? sample.buttons : sample.switches,
				name === "unit/bytebutton" ? 1 : 0xfe,
			);
		}
		if (name === "unit/angle" || name === "unit/fader") {
			assert.equal(input.sample().raw, 1024);
			assert.equal(input.sample().position, name === "unit/angle" ? 1024 / 4095 : 1 - 1024 / 4095);
			const analog = [...live].find((resource) => resource instanceof Analog);
			assert.equal(analog.options.custom, "analog option");
			assert.equal(analog.options.resolution, 12);
		}
		input.close();
	}
});
test("invalid bus settings are rejected before any IO is opened", () => {
	const Driver = drivers.find(([name]) => name === "unit/encoder")[1];
	const before = openCount;
	for (const settings of [{ address: 0 }, { address: 128 }, { hz: 0 }, { hz: 2.5 }]) {
		assert.throws(() => new Driver({ sensor: { ...optionsFor("unit/encoder").sensor, ...settings } }), RangeError);
	}
	assert.equal(openCount, before);
	assert.equal(live.size, 0);
});
