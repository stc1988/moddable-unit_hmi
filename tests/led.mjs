import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const timers = new Map();
let sequence = 0;
globalThis.__ledTestTimer = {
	repeat(callback) {
		const id = ++sequence;
		timers.set(id, callback);
		return id;
	},
	clear(id) {
		timers.delete(id);
	},
};
globalThis.trace = () => {};
const outputDirectory = mkdtempSync(join(tmpdir(), "hmi-led-test-"));
process.on("exit", () => rmSync(outputDirectory, { recursive: true, force: true }));
execFileSync("./node_modules/.bin/tsc", ["--noEmit", "false", "--outDir", outputDirectory], { stdio: "inherit" });
const util = readFileSync(join(outputDirectory, "src/hmi/util/util.js"), "utf8");
const utilURL = `data:text/javascript;base64,${Buffer.from(util).toString("base64")}`;
const source = readFileSync(join(outputDirectory, "src/hmi/led/led.js"), "utf8")
	.replace('from "hmi/util"', `from "${utilURL}"`)
	.replace('import Timer from "timer";', "const Timer = globalThis.__ledTestTimer;");
const { default: Led, scaleColor } = await import(
	`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);
let output;
const led = new Led({
	write(color, brightness) {
		output = scaleColor(color, brightness);
	},
});
assert.equal(output, undefined);
led.color = { r: 200, g: 100, b: 50 };
led.brightness = 0;
assert.deepEqual(output, { r: 0, g: 0, b: 0 });
assert.deepEqual(led.color, { r: 200, g: 100, b: 50 });
led.brightness = 255;
assert.deepEqual(output, led.color);
const copy = led.color;
copy.r = 0;
assert.equal(led.color.r, 200);
led.on = 0.5;
assert.deepEqual(led.color, { r: 128, g: 128, b: 128 });
assert.equal(led.on, 128 / 255);
assert.throws(() => {
	led.brightness = 256;
}, RangeError);
assert.throws(() => {
	led.color = { r: -1, g: 0, b: 0 };
}, RangeError);
let flushes = 0;
const flush = () => {
	flushes++;
};
const a = new Led({ write() {}, flush });
const b = new Led({ write() {}, flush });
a.rainbow();
b.rainbow();
assert.equal(timers.size, 1);
for (const tick of timers.values()) tick();
assert.equal(flushes, 1);
assert.deepEqual(a.color, { r: 3, g: 0, b: 0 });
a.rainbow(0);
assert.equal(a.on, 0);
assert.equal(timers.size, 1);
b.close();
b.close();
assert.equal(timers.size, 0);
assert.throws(() => b.rainbow(), /closed/);
const bad = new Led({
	write() {
		throw new Error("bus failure");
	},
});
bad.rainbow();
for (const tick of timers.values()) tick();
assert.equal(timers.size, 0);
assert.deepEqual(bad.color, { r: 0, g: 0, b: 0 });
led.close();
a.close();
bad.close();
console.log("LED state, validation, shared timer, flush batching, failure and close tests passed");
