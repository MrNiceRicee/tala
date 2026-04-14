import { describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Schema } from "effect";
import {
	fetchJson,
	parseArgv,
	readJsonFile,
	readTextFile,
} from "../src/tool-runner";

// ---- argv parser ----

describe("parseArgv", () => {
	it("parses --key value pairs", () => {
		expect(parseArgv(["--foo", "bar", "--baz", "qux"])).toEqual({
			foo: "bar",
			baz: "qux",
		});
	});

	it("parses boolean flags with no following value", () => {
		expect(parseArgv(["--verbose"])).toEqual({ verbose: true });
	});

	it("treats a flag followed by another flag as boolean", () => {
		expect(parseArgv(["--dry-run", "--verbose"])).toEqual({
			"dry-run": true,
			verbose: true,
		});
	});

	it("handles mixed flags and key-value pairs", () => {
		expect(
			parseArgv(["--output", "out.txt", "--debug", "--profile", "car"]),
		).toEqual({
			output: "out.txt",
			debug: true,
			profile: "car",
		});
	});

	it("returns empty record for empty input", () => {
		expect(parseArgv([])).toEqual({});
	});

	it("skips positional arguments that don't start with --", () => {
		expect(parseArgv(["positional", "--key", "val"])).toEqual({ key: "val" });
	});

	it("handles multiple key-value pairs in order", () => {
		expect(parseArgv(["--a", "1", "--b", "2", "--c", "3"])).toEqual({
			a: "1",
			b: "2",
			c: "3",
		});
	});
});

// ---- readTextFile ----

const withTempDir = async (
	fn: (dir: string) => Promise<void>,
): Promise<void> => {
	const dir = join(tmpdir(), `tool-runner-test-${Date.now()}`);
	await mkdir(dir, { recursive: true });
	try {
		await fn(dir);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
};

describe("readTextFile", () => {
	it("reads an existing file", async () => {
		await withTempDir(async (dir) => {
			const path = join(dir, "test.txt");
			await Bun.write(path, "hello world");
			const result = await Effect.runPromise(readTextFile(path));
			expect(result).toBe("hello world");
		});
	});

	it("fails with error for missing file", async () => {
		const path = "/tmp/definitely-does-not-exist-abc123xyz.txt";
		const result = await Effect.runPromiseExit(readTextFile(path));
		expect(result._tag).toBe("Failure");
	});
});

// ---- readJsonFile ----

const TestSchema = Schema.Struct({
	name: Schema.String,
	count: Schema.Number,
});

describe("readJsonFile", () => {
	it("reads and decodes valid JSON file", async () => {
		await withTempDir(async (dir) => {
			const path = join(dir, "data.json");
			await Bun.write(path, JSON.stringify({ name: "test", count: 42 }));
			const result = await Effect.runPromise(readJsonFile(path, TestSchema));
			expect(result.name).toBe("test");
			expect(result.count).toBe(42);
		});
	});

	it("fails on invalid JSON", async () => {
		await withTempDir(async (dir) => {
			const path = join(dir, "bad.json");
			await Bun.write(path, "{ not valid json }");
			const exit = await Effect.runPromiseExit(readJsonFile(path, TestSchema));
			expect(exit._tag).toBe("Failure");
		});
	});

	it("fails when JSON does not match schema", async () => {
		await withTempDir(async (dir) => {
			const path = join(dir, "wrong.json");
			await Bun.write(path, JSON.stringify({ name: 42, count: "wrong" }));
			const exit = await Effect.runPromiseExit(readJsonFile(path, TestSchema));
			expect(exit._tag).toBe("Failure");
		});
	});

	it("fails for missing file", async () => {
		const path = "/tmp/missing-file-xyz789.json";
		const exit = await Effect.runPromiseExit(readJsonFile(path, TestSchema));
		expect(exit._tag).toBe("Failure");
	});
});

// ---- fetchJson (mocked via local server) ----

const ResponseSchema = Schema.Struct({
	id: Schema.Number,
	value: Schema.String,
});

describe("fetchJson", () => {
	it("decodes a successful JSON response", async () => {
		using server = Bun.serve({
			port: 0,
			fetch() {
				return Response.json({ id: 1, value: "hello" });
			},
		});

		const url = `http://localhost:${server.port}/data`;
		const result = await Effect.runPromise(fetchJson(url, {}, ResponseSchema));
		expect(result.id).toBe(1);
		expect(result.value).toBe("hello");
	});

	it("fails with error on non-ok HTTP response", async () => {
		using server = Bun.serve({
			port: 0,
			fetch() {
				return new Response("not found", { status: 404 });
			},
		});

		const url = `http://localhost:${server.port}/missing`;
		const exit = await Effect.runPromiseExit(
			fetchJson(url, {}, ResponseSchema),
		);
		expect(exit._tag).toBe("Failure");
	});

	it("fails when response JSON does not match schema", async () => {
		using server = Bun.serve({
			port: 0,
			fetch() {
				return Response.json({ wrong: "shape" });
			},
		});

		const url = `http://localhost:${server.port}/data`;
		const exit = await Effect.runPromiseExit(
			fetchJson(url, {}, ResponseSchema),
		);
		expect(exit._tag).toBe("Failure");
	});
});
