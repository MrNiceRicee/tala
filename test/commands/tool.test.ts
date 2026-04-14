import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createTopic } from "../../src/commands/new";
import { listTools, runTool } from "../../src/commands/tool";
import { cleanupTempLab, createTempLab } from "../helpers";

let labRoot: string;

beforeEach(async () => {
	labRoot = await createTempLab();
});

afterEach(async () => {
	await cleanupTempLab(labRoot);
});

describe("runTool", () => {
	it("runs a tool and captures output", async () => {
		await createTopic(labRoot, "Test Topic");

		await mkdir(join(labRoot, "tools"), { recursive: true });
		await Bun.write(
			join(labRoot, "tools", "echo-test.ts"),
			'console.log("tool result: hello")',
		);

		const result = await runTool(labRoot, "test-topic", "echo-test", []);
		expect(result.success).toBe(true);
		expect(result.output).toContain("tool result: hello");

		const outputPath = join(
			labRoot,
			"topics",
			"test-topic",
			"computations",
			"echo-test.output.md",
		);
		const content = await Bun.file(outputPath).text();
		expect(content).toContain("type: computation");
		expect(content).toContain("tool: echo-test");
		expect(content).toContain("tool result: hello");
	});

	it("fails when tool does not exist", async () => {
		await createTopic(labRoot, "Topic");
		const result = await runTool(labRoot, "topic", "missing-tool", []);
		expect(result.success).toBe(false);
		expect(result.error).toContain("tool not found");
	});

	it("fails when topic does not exist", async () => {
		await mkdir(join(labRoot, "tools"), { recursive: true });
		await Bun.write(join(labRoot, "tools", "any-tool.ts"), 'console.log("hi")');
		const result = await runTool(labRoot, "no-topic", "any-tool", []);
		expect(result.success).toBe(false);
		expect(result.error).toContain("topic not found");
	});

	it("passes args to the tool", async () => {
		await createTopic(labRoot, "Args Topic");
		await mkdir(join(labRoot, "tools"), { recursive: true });
		await Bun.write(
			join(labRoot, "tools", "args-tool.ts"),
			'console.log(Bun.argv.slice(2).join(", "))',
		);

		const result = await runTool(labRoot, "args-topic", "args-tool", [
			"--foo",
			"bar",
		]);
		expect(result.success).toBe(true);
		expect(result.output).toContain("--foo, bar");
	});
});

describe("listTools", () => {
	it("returns sorted list of tool names", async () => {
		await mkdir(join(labRoot, "tools"), { recursive: true });
		await Bun.write(join(labRoot, "tools", "zebra.ts"), "");
		await Bun.write(join(labRoot, "tools", "alpha.ts"), "");
		await Bun.write(join(labRoot, "tools", "beta.ts"), "");

		const tools = await listTools(labRoot);
		expect(tools).toEqual(["alpha", "beta", "zebra"]);
	});

	it("ignores non-.ts files", async () => {
		await mkdir(join(labRoot, "tools"), { recursive: true });
		await Bun.write(join(labRoot, "tools", "real.ts"), "");
		await Bun.write(join(labRoot, "tools", "README.md"), "");

		const tools = await listTools(labRoot);
		expect(tools).toEqual(["real"]);
	});

	it("returns empty array when tools dir missing", async () => {
		const tools = await listTools(labRoot);
		expect(tools).toEqual([]);
	});
});
