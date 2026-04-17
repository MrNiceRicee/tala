import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect, Schema } from "effect";
import { runEnvCheck, runEnvSync } from "../../src/commands/env";
import { clearConfigCache } from "../../src/config";
import { defineTool } from "../../src/tool-runner";
import { cleanupTempLab, createTempLab } from "../helpers";

let labRoot: string;

beforeEach(async () => {
	labRoot = await createTempLab();
	clearConfigCache();
});

afterEach(async () => {
	await cleanupTempLab(labRoot);
	clearConfigCache();
});

describe("runEnvSync", () => {
	it("writes empty example (header only) when no tools", async () => {
		const result = await runEnvSync(labRoot);
		expect(result.success).toBe(true);
		expect(result.keysWritten).toEqual([]);
	});

	it("collects env keys from registered tools", async () => {
		await mkdir(join(labRoot, "tools"), { recursive: true });
		await Bun.write(join(labRoot, "tools", "sample-a.ts"), "// stub\n");
		await Bun.write(join(labRoot, "tools", "sample-b.ts"), "// stub\n");
		defineTool({
			name: "sample-a",
			args: Schema.Struct({}),
			env: ["KEY_ONE", "KEY_TWO"],
			run: () => Effect.succeed("ok"),
		});
		defineTool({
			name: "sample-b",
			args: Schema.Struct({}),
			env: ["KEY_TWO", "KEY_THREE"],
			run: () => Effect.succeed("ok"),
		});

		const result = await runEnvSync(labRoot);
		expect(result.success).toBe(true);
		expect([...result.keysWritten].sort()).toEqual([
			"KEY_ONE",
			"KEY_THREE",
			"KEY_TWO",
		]);
	});
});

describe("runEnvCheck", () => {
	it("reports no missing when no tools require env", async () => {
		const result = await runEnvCheck(labRoot);
		expect(result.success).toBe(true);
		expect(result.missing).toEqual([]);
	});

	it("reports missing keys when env file lacks them", async () => {
		await mkdir(join(labRoot, "tools"), { recursive: true });
		await Bun.write(join(labRoot, "tools", "check-tool.ts"), "// stub\n");
		defineTool({
			name: "check-tool",
			args: Schema.Struct({}),
			env: ["CHECK_TOOL_KEY"],
			run: () => Effect.succeed("ok"),
		});

		const result = await runEnvCheck(labRoot);
		expect(result.success).toBe(false);
		expect(result.missing).toContain("CHECK_TOOL_KEY");
	});

	it("reports success when all required keys are present", async () => {
		await mkdir(join(labRoot, "tools"), { recursive: true });
		await mkdir(join(labRoot, ".tala"), { recursive: true });
		await Bun.write(join(labRoot, "tools", "present-tool.ts"), "// stub\n");
		await writeFile(
			join(labRoot, ".tala", ".env"),
			"PRESENT_TOOL_KEY=somevalue\n",
		);
		defineTool({
			name: "present-tool",
			args: Schema.Struct({}),
			env: ["PRESENT_TOOL_KEY"],
			run: () => Effect.succeed("ok"),
		});

		const result = await runEnvCheck(labRoot);
		expect(result.success).toBe(true);
		expect(result.present).toContain("PRESENT_TOOL_KEY");
	});
});
