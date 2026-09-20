import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const timers = new Map();
let sequence = 0;
globalThis.__pollingTestTimer = {
	repeat(callback, interval) {
		const id = ++sequence;
		timers.set(id, { callback, interval });
		return id;
	},
	clear(id) {
		timers.delete(id);
	},
};

const traces = [];
globalThis.trace = (message) => traces.push(message);

const outputDirectory = mkdtempSync(join(tmpdir(), "hmi-polling-test-"));
process.on("exit", () => rmSync(outputDirectory, { recursive: true, force: true }));
execFileSync("./node_modules/.bin/tsc", ["--noEmit", "false", "--outDir", outputDirectory], { stdio: "inherit" });
const source = readFileSync(join(outputDirectory, "src/hmi/polling/pollingInput.js"), "utf8").replace(
	'import Timer from "timer";',
	"const Timer = globalThis.__pollingTestTimer;",
);
const { default: PollingInput } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

let state = 1;
const delivered = [];
const input = new PollingInput({}, { read: () => state }, "Test", {
	changed: (current, previous) => current !== previous,
	onChange(value) {
		delivered.push(value);
	},
});

assert.equal(timers.size, 1);
assert.equal([...timers.values()][0].interval, 30);
const tick = () => [...timers.values()][0].callback();
tick();
tick();
assert.deepEqual(delivered, [1]);
state = 2;
tick();
assert.deepEqual(delivered, [1, 2]);

input.pollingInterval = 50;
assert.equal(timers.size, 1);
assert.equal([...timers.values()][0].interval, 50);
tick();
assert.deepEqual(delivered, [1, 2, 2]);

let attempts = 0;
input.onChange = () => {
	attempts++;
	if (attempts === 1) throw new Error("callback failure");
};
tick();
tick();
assert.equal(attempts, 2, "a failed notification must not advance the comparison baseline");
assert.match(traces.at(-1), /callback failure/);

input.onChange = null;
assert.equal(timers.size, 0);
input.start();
assert.equal(timers.size, 1);
input.stop();
assert.equal(timers.size, 0);
input.close();
assert.throws(() => input.start(), /closed/);
assert.throws(() => {
	input.onChange = () => {};
}, /closed/);

assert.throws(() => new PollingInput({}, { read: () => 0 }, "Invalid", { pollingInterval: 0 }), RangeError);
console.log("Polling lifecycle, comparison baseline, retry, interval and close tests passed");
