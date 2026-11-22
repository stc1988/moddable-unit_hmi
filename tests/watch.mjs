import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const timers = new Map();
let nextId = 0;
const traces = [];
globalThis.trace = (value) => traces.push(value);
globalThis.__watchTimer = {
	repeat(callback, interval) {
		const id = nextId++;
		timers.set(id, { callback, interval });
		return id;
	},
	clear(id) {
		timers.delete(id);
	},
};
const output = mkdtempSync(join(tmpdir(), "hmi-watch-test-"));
process.on("exit", () => rmSync(output, { recursive: true, force: true }));
execFileSync("./node_modules/.bin/tsc", ["--noEmit", "false", "--outDir", output], { stdio: "inherit" });
const code = readFileSync(join(output, "src/hmi/watch/watchInput.js"), "utf8").replace(
	'import Timer from "timer";',
	"const Timer = globalThis.__watchTimer;",
);
const { default: watchInput } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
function tick() {
	for (const timer of [...timers.values()]) timer.callback();
}

test("asynchronous first notification, numeric deadband and discrete transitions", () => {
	let state = { x: 0, y: 0, pressed: false, time: 1 };
	const source = { sample: () => state };
	const delivered = [];
	const options = Object.freeze({
		deadband: 2,
		onChanged(sample, previous) {
			assert.equal(this, source);
			delivered.push([sample.x, sample.y, sample.pressed, previous?.x]);
		},
	});
	const watcher = watchInput(source, options);
	assert.equal(delivered.length, 0);
	assert.equal(watcher.running, true);
	assert.equal([...timers.values()][0].interval, 30);
	watcher.start();
	assert.equal(timers.size, 1);
	tick();
	tick();
	state = { ...state, x: 2, time: 2 };
	tick();
	assert.equal(delivered.length, 1, "threshold equality and timestamps must not notify");
	state = { ...state, x: 3 };
	tick();
	state = { ...state, pressed: true };
	tick();
	assert.deepEqual(delivered, [
		[0, 0, false, undefined],
		[3, 0, false, 0],
		[3, 0, true, 3],
	]);
	watcher.close();
	assert.equal(timers.size, 0);
});

test("analog comparison uses raw units; arrays and bit masks work across products", () => {
	for (const [initial, small, changed] of [
		[
			{ raw: 10, position: 0.1 },
			{ raw: 11, position: 0.11 },
			{ raw: 13, position: 0.13 },
		],
		[
			{ angles: [10, 20], switchOn: false },
			{ angles: [12, 20], switchOn: false },
			{ angles: [13, 20], switchOn: false },
		],
		[
			{ encoders: [0], buttons: 0, switchOn: false },
			{ encoders: [2], buttons: 0, switchOn: false },
			{ encoders: [2], buttons: 1, switchOn: false },
		],
		[
			{ value: 0, pressed: false },
			{ value: 2, pressed: false },
			{ value: 2, pressed: true },
		],
		[{ switches: 0 }, { switches: 0 }, { switches: 1 }],
	]) {
		let state = initial;
		let calls = 0;
		const watcher = watchInput(
			{ sample: () => state },
			{
				deadband: 2,
				onChanged() {
					calls++;
				},
			},
		);
		tick();
		state = small;
		tick();
		assert.equal(calls, 1);
		state = changed;
		tick();
		assert.equal(calls, 2);
		watcher.close();
	}
});

test("undefined samples and IO/callback failures retry without advancing the baseline", () => {
	let state;
	let readFailure = false;
	let callbackFailure = false;
	let calls = 0;
	const errors = [];
	const source = {
		sample() {
			if (readFailure) throw new Error("read failed");
			return state;
		},
	};
	const watcher = watchInput(source, {
		onChanged() {
			calls++;
			if (callbackFailure) throw new Error("callback failed");
		},
		onError(error) {
			assert.equal(this, source);
			errors.push(error.message);
		},
	});
	tick();
	assert.equal(calls, 0);
	state = { value: 1 };
	tick();
	readFailure = true;
	tick();
	readFailure = false;
	callbackFailure = true;
	state = { value: 2 };
	tick();
	callbackFailure = false;
	tick();
	tick();
	assert.equal(calls, 3);
	assert.deepEqual(errors, ["read failed", "callback failed"]);
	watcher.close();
	const logged = watchInput(
		{
			sample() {
				throw new Error("trace fallback");
			},
		},
		{ onChanged() {} },
	);
	tick();
	assert.match(traces.at(-1), /trace fallback/);
	logged.close();
});

test("reused buffers and mutations by callbacks cannot change the private baseline", () => {
	const state = { angles: [0], switchOn: false, time: 0 };
	const history = [];
	const watcher = watchInput(
		{ sample: () => state },
		{
			deadband: 2,
			onChanged(sample, previous) {
				history.push([sample.angles[0], previous?.angles[0]]);
				sample.angles[0] = 999;
				if (previous) previous.angles[0] = -999;
			},
		},
	);
	tick();
	state.angles[0] = 2;
	tick();
	state.angles[0] = 3;
	tick();
	assert.deepEqual(history, [
		[0, undefined],
		[3, 0],
	]);
	state.angles[0] = 4;
	tick();
	assert.equal(history.length, 2);
	watcher.close();
});

test("custom comparison overrides defaults and options callbacks are copied", () => {
	let state = { value: 0, time: 1 };
	const calls = [];
	const options = {
		interval: 50,
		changed(sample, previous) {
			assert.equal(this.sample(), state);
			previous.value = 999;
			return sample.value % 2 === 0;
		},
		onChanged(sample) {
			calls.push(sample.value);
		},
	};
	const watcher = watchInput({ sample: () => state }, options);
	options.onChanged = () => {
		throw new Error("options must not be retained");
	};
	assert.equal([...timers.values()][0].interval, 50);
	tick();
	state = { value: 1, time: 2 };
	tick();
	state = { value: 2, time: 3 };
	tick();
	assert.deepEqual(calls, [0, 2]);
	watcher.close();
});

test("stop/restart invalidates old ticks, resets baseline, and disposal is idempotent", () => {
	let reads = 0;
	let closed = 0;
	const source = {
		sample() {
			reads++;
			return { value: 1 };
		},
		close() {
			closed++;
		},
	};
	const samples = [];
	const watcher = watchInput(source, {
		onChanged(sample) {
			samples.push(sample);
		},
	});
	const stale = [...timers.values()][0].callback;
	tick();
	watcher.stop();
	stale();
	assert.equal(reads, 1);
	assert.equal(watcher.running, false);
	watcher.start();
	stale();
	tick();
	assert.equal(samples.length, 2);
	assert.equal(watcher[Symbol.dispose], watcher.close);
	watcher[Symbol.dispose]();
	watcher.close();
	stale();
	assert.equal(closed, 0, "watching must not take ownership by default");
	assert.throws(() => watcher.start(), /closed/);
	assert.throws(() => watcher.stop(), /closed/);
	assert.throws(() => watcher.running, /closed/);
	const owned = watchInput(source, { closeSource: true, onChanged() {} });
	owned.close();
	owned.close();
	assert.equal(closed, 1);
	assert.equal(timers.size, 0);
});

test("close or stop during sampling/comparison/notification prevents later callbacks", () => {
	for (const stage of ["sample", "changed", "onChanged"]) {
		let watcher;
		let first = true;
		let calls = 0;
		let errors = 0;
		const source = {
			sample() {
				if (!first && stage === "sample") watcher.close();
				return { value: first ? 0 : 1 };
			},
		};
		watcher = watchInput(source, {
			changed() {
				if (stage === "changed") watcher.close();
				return true;
			},
			onChanged() {
				calls++;
				if (!first && stage === "onChanged") {
					watcher.close();
					throw new Error("after close");
				}
			},
			onError() {
				errors++;
			},
		});
		tick();
		first = false;
		tick();
		assert.equal(calls, stage === "onChanged" ? 2 : 1);
		assert.equal(errors, 0);
		assert.equal(timers.size, 0);
	}
	let watcher;
	let calls = 0;
	watcher = watchInput(
		{
			sample() {
				watcher.stop();
				return { value: 1 };
			},
		},
		{
			onChanged() {
				calls++;
			},
		},
	);
	tick();
	assert.equal(calls, 0);
	watcher.close();
});

test("invalid options create no timer and never close caller-owned IO", () => {
	let closes = 0;
	const source = {
		sample: () => ({ value: 0 }),
		close() {
			closes++;
		},
	};
	for (const options of [
		null,
		{},
		{ onChanged: 3 },
		{ onChanged() {}, interval: 0 },
		{ onChanged() {}, interval: 1.5 },
		{ onChanged() {}, deadband: -1 },
		{ onChanged() {}, deadband: NaN },
		{ onChanged() {}, onError: false },
		{ onChanged() {}, changed: 3 },
		{ onChanged() {}, closeSource: 1 },
	]) {
		assert.throws(() => watchInput(source, options));
	}
	assert.throws(() => watchInput({}, { onChanged() {} }), TypeError);
	assert.throws(() => watchInput({ sample: () => ({}) }, { closeSource: true, onChanged() {} }), TypeError);
	assert.equal(timers.size, 0);
	assert.equal(closes, 0);
});

test("source cleanup failure still cancels monitoring and is not repeated", () => {
	let attempts = 0;
	const watcher = watchInput(
		{
			sample: () => ({ value: 1 }),
			close() {
				attempts++;
				throw new Error("source close failed");
			},
		},
		{ closeSource: true, onChanged() {} },
	);
	const stale = [...timers.values()][0].callback;
	assert.throws(() => watcher.close(), /source close failed/);
	stale();
	watcher.close();
	assert.equal(attempts, 1);
	assert.equal(timers.size, 0);
});
