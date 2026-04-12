import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { runComputation } from "../../src/commands/compute";
import { createTopic } from "../../src/commands/new";
import { cleanupTempLab, createTempLab } from "../helpers";

let labRoot: string;

beforeEach(async () => {
	labRoot = await createTempLab();
});

afterEach(async () => {
	await cleanupTempLab(labRoot);
});

describe("runComputation", () => {
	it("runs a script and captures output", async () => {
		await createTopic(labRoot, "Salary Research");

		const scriptPath = join(
			labRoot,
			"topics",
			"salary-research",
			"computations",
			"add.ts",
		);
		await Bun.write(scriptPath, 'console.log("result: " + (100 + 200))');

		const result = await runComputation(
			labRoot,
			"salary-research",
			"add.ts",
			[],
		);
		expect(result.success).toBe(true);
		expect(result.output).toContain("result: 300");

		const outputPath = join(
			labRoot,
			"topics",
			"salary-research",
			"computations",
			"add.output.md",
		);
		const outputContent = await Bun.file(outputPath).text();
		expect(outputContent).toContain("type: computation");
		expect(outputContent).toContain("script: ./add.ts");
		expect(outputContent).toContain("result: 300");
	});

	it("passes args to the script", async () => {
		await createTopic(labRoot, "Args Test");

		const scriptPath = join(
			labRoot,
			"topics",
			"args-test",
			"computations",
			"echo-args.ts",
		);
		await Bun.write(
			scriptPath,
			'console.log(process.argv.slice(2).join(", "))',
		);

		const result = await runComputation(labRoot, "args-test", "echo-args.ts", [
			"--salary",
			"165000",
		]);
		expect(result.success).toBe(true);
		expect(result.output).toContain("--salary, 165000");
	});

	it("fails for nonexistent script", async () => {
		await createTopic(labRoot, "Missing Script");

		const result = await runComputation(
			labRoot,
			"missing-script",
			"nope.ts",
			[],
		);
		expect(result.success).toBe(false);
		expect(result.error).toContain("not found");
	});
});
