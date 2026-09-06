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
const {
	default: Led,
	LedCollection,
	scaleColor,
} = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
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

const writes = [];
let groupFlushes = 0;
const groupFlush = () => {
	groupFlushes++;
};
const members = [0, 1, 2].map(
	(index) =>
		new Led({
			write(color, brightness) {
				writes.push({ index, color, brightness });
			},
			flush: groupFlush,
		}),
);
const group = new LedCollection(members);
assert.equal(group.length, 3);
assert.equal(group[1], members[1]);
assert.deepEqual([...group], members);
assert.throws(() => {
	group[0] = members[1];
}, TypeError);
group.color = { r: 200, g: 20, b: 10 };
assert.equal(writes.length, 3);
assert.equal(groupFlushes, 1);
for (const member of group) assert.deepEqual(member.color, group.color);
group.brightness = 32;
assert.equal(group.brightness, 32);
assert.equal(groupFlushes, 2);
assert.deepEqual(group.color, { r: 200, g: 20, b: 10 });
group[1].color = { r: 0, g: 255, b: 0 };
assert.equal(group.color, undefined);
group[1].brightness = 64;
assert.equal(group.brightness, undefined);
group.on = 0;
assert.equal(group.on, 0);
assert.deepEqual(group.color, { r: 0, g: 0, b: 0 });
const beforeInvalid = writes.length;
assert.throws(() => {
	group.color = { r: 1, g: 2, b: 256 };
}, RangeError);
assert.equal(writes.length, beforeInvalid);
group.rainbow();
assert.equal(timers.size, 1);
for (const tick of timers.values()) tick();
assert.deepEqual(group.color, { r: 3, g: 0, b: 0 });
group.rainbow(0);
assert.equal(timers.size, 0);
assert.equal(group.on, 0);
group[1].close();
const beforeClosed = writes.length;
assert.throws(() => {
	group.color = { r: 1, g: 2, b: 3 };
}, /closed/);
assert.equal(writes.length, beforeClosed);
group.close();
group.close();
assert.throws(() => group.rainbow(), /closed/);
console.log("LED collection synchronization, mixed values, batching and lifecycle tests passed");
