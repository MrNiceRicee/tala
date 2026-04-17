import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Effect, Schema } from "effect";
import { parseGetArgs, runGet } from "../../src/commands/get";
import { createTopic } from "../../src/commands/new";
import { defineTool } from "../../src/tool-runner";
import { cleanupTempLab, createTempLab } from "../helpers";

describe("parseGetArgs", () => {
	it("parses empty argv to catalog request", () => {
		expect(parseGetArgs([])).toEqual({
			resource: undefined,
			name: undefined,
			view: undefined,
			fullMode: false,
			format: "markdown",
			filters: {},
		});
	});

	it("parses resource only", () => {
		const result = parseGetArgs(["topics"]);
		expect(result.resource).toBe("topics");
		expect(result.name).toBeUndefined();
	});

	it("parses resource + name", () => {
		const result = parseGetArgs(["topics", "oahu"]);
		expect(result.resource).toBe("topics");
		expect(result.name).toBe("oahu");
	});

	it("parses view flag (claims is a topics view)", () => {
		const result = parseGetArgs(["topics", "oahu", "--claims"]);
		expect(result.view).toBe("claims");
	});

	it("parses view filter (--marker) as filters.marker", () => {
		const result = parseGetArgs([
			"topics",
			"oahu",
			"--claims",
			"--marker",
			"unsupported",
		]);
		expect(result.view).toBe("claims");
		expect(result.filters.marker).toBe("unsupported");
	});

	it("parses --full", () => {
		const result = parseGetArgs(["topics", "oahu", "--full"]);
		expect(result.fullMode).toBe(true);
	});

	it("parses --format json", () => {
		const result = parseGetArgs(["topics", "--format", "json"]);
		expect(result.format).toBe("json");
	});

	it("parses --status as list filter", () => {
		const result = parseGetArgs(["topics", "--status", "working"]);
		expect(result.filters.status).toBe("working");
	});
});

describe("runGet", () => {
	let labRoot: string;

	beforeEach(async () => {
		labRoot = await createTempLab();
	});

	afterEach(async () => {
		await cleanupTempLab(labRoot);
	});

	it("returns resource catalog when called with no resource", async () => {
		const result = await runGet(labRoot, {
			fullMode: false,
			format: "markdown",
			filters: {},
		});
		expect(result.success).toBe(true);
		expect(result.output).toContain("topics");
		expect(result.output).toContain("tools");
	});

	it("returns catalog as JSON", async () => {
		const result = await runGet(labRoot, {
			fullMode: false,
			format: "json",
			filters: {},
		});
		expect(result.success).toBe(true);
		const parsed = JSON.parse(result.output);
		expect(Array.isArray(parsed)).toBe(true);
		expect(parsed.map((r: { name: string }) => r.name).sort()).toEqual([
			"cache",
			"config",
			"schema",
			"tools",
			"topics",
		]);
	});

	it("fails on unknown resource with helpful error", async () => {
		const result = await runGet(labRoot, {
			resource: "widgets",
			fullMode: false,
			format: "markdown",
			filters: {},
		});
		expect(result.success).toBe(false);
		expect(result.error).toContain("unknown resource");
		expect(result.error).toContain("topics");
	});

	it("lists topics from a fresh lab (empty)", async () => {
		const result = await runGet(labRoot, {
			resource: "topics",
			fullMode: false,
			format: "markdown",
			filters: {},
		});
		expect(result.success).toBe(true);
		expect(result.output).toContain("no topics found");
	});

	it("lists a topic after creating one", async () => {
		await createTopic(labRoot, "Test Topic");
		const result = await runGet(labRoot, {
			resource: "topics",
			fullMode: false,
			format: "markdown",
			filters: {},
		});
		expect(result.success).toBe(true);
		expect(result.output).toContain("test-topic");
	});

	it("filters topic list by status", async () => {
		await createTopic(labRoot, "Test Topic");
		// createTopic defaults status=working; filter should include it.
		const working = await runGet(labRoot, {
			resource: "topics",
			fullMode: false,
			format: "markdown",
			filters: { status: "working" },
		});
		expect(working.output).toContain("test-topic");

		// Filter for a status this topic doesn't have — should exclude it.
		const distilled = await runGet(labRoot, {
			resource: "topics",
			fullMode: false,
			format: "markdown",
			filters: { status: "distilled" },
		});
		expect(distilled.output).toContain("no topics found");
	});

	it("returns topic detail as JSON", async () => {
		await createTopic(labRoot, "Sample");
		const result = await runGet(labRoot, {
			resource: "topics",
			name: "sample",
			fullMode: false,
			format: "json",
			filters: {},
		});
		expect(result.success).toBe(true);
		const parsed = JSON.parse(result.output);
		expect(parsed.slug).toBe("sample");
		expect(parsed.status).toBeDefined();
		expect(Array.isArray(parsed.questions)).toBe(true);
	});

	it("returns 'not found' for unknown topic", async () => {
		const result = await runGet(labRoot, {
			resource: "topics",
			name: "nonexistent",
			fullMode: false,
			format: "markdown",
			filters: {},
		});
		expect(result.success).toBe(false);
		expect(result.error).toContain("not found");
	});

	it("lists tools (empty when no ./tools/ dir)", async () => {
		const result = await runGet(labRoot, {
			resource: "tools",
			fullMode: false,
			format: "markdown",
			filters: {},
		});
		expect(result.success).toBe(true);
		expect(result.output).toContain("no tools found");
	});

	it("returns tool detail for a registered tool", async () => {
		await mkdir(join(labRoot, "tools"), { recursive: true });
		await Bun.write(join(labRoot, "tools", "sample-tool.ts"), "// stub\n");
		defineTool({
			name: "sample-tool",
			description: "sample tool for tests",
			args: Schema.Struct({}),
			env: ["SAMPLE_KEY"],
			cache: { ttlMinutes: 60 },
			run: () => Effect.succeed("ok"),
		});

		const result = await runGet(labRoot, {
			resource: "tools",
			name: "sample-tool",
			fullMode: false,
			format: "markdown",
			filters: {},
		});
		expect(result.success).toBe(true);
		expect(result.output).toContain("sample-tool");
		expect(result.output).toContain("sample tool for tests");
		expect(result.output).toContain("SAMPLE_KEY");
		expect(result.output).toContain("ttl: 60 min");
	});

	it("rejects unknown view with available list", async () => {
		await createTopic(labRoot, "Sample");
		const result = await runGet(labRoot, {
			resource: "topics",
			name: "sample",
			view: "galaxies",
			fullMode: false,
			format: "markdown",
			filters: {},
		});
		expect(result.success).toBe(false);
		expect(result.error).toContain("unknown view");
		expect(result.error).toContain("claims");
	});
});
