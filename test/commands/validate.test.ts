import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { createTopic } from "../../src/commands/new";
import { runValidation } from "../../src/commands/validate";
import { cleanupTempLab, createTempLab } from "../helpers";

let labRoot: string;

beforeEach(async () => {
	labRoot = await createTempLab();
});

afterEach(async () => {
	await cleanupTempLab(labRoot);
});

describe("runValidation", () => {
	it("returns clean for valid topics", async () => {
		await createTopic(labRoot, "Good Topic");
		const hubPath = join(labRoot, "topics", "good-topic", "good-topic.md");
		let hub = await Bun.file(hubPath).text();
		hub = hub.replace(
			"## Intent\n\n\n",
			"## Intent\n\nTo study this topic.\n\n",
		);
		hub = hub.replace(
			"## Questions\n\n-\n",
			"## Questions\n\n- What is this?\n",
		);
		await Bun.write(hubPath, hub);
		const result = await runValidation(labRoot);
		expect(result.totalIssues).toBe(0);
		expect(result.exitCode).toBe(0);
	});

	it("returns exit code 1 for errors", async () => {
		await createTopic(labRoot, "Bad Topic");
		await Bun.write(
			join(labRoot, "topics", "bad-topic", "orphan.md"),
			"# No frontmatter\n",
		);

		const result = await runValidation(labRoot);
		expect(result.totalIssues).toBeGreaterThan(0);
		expect(result.exitCode).toBe(1);
	});

	it("scopes to a single topic", async () => {
		await createTopic(labRoot, "Topic A");
		const hubPathA = join(labRoot, "topics", "topic-a", "topic-a.md");
		let hubA = await Bun.file(hubPathA).text();
		hubA = hubA.replace(
			"## Intent\n\n\n",
			"## Intent\n\nTo study topic A.\n\n",
		);
		hubA = hubA.replace(
			"## Questions\n\n-\n",
			"## Questions\n\n- What is topic A?\n",
		);
		await Bun.write(hubPathA, hubA);

		await createTopic(labRoot, "Topic B");
		await Bun.write(
			join(labRoot, "topics", "topic-b", "bad.md"),
			"# No frontmatter\n",
		);

		const resultA = await runValidation(labRoot, "topic-a");
		expect(resultA.totalIssues).toBe(0);

		const resultB = await runValidation(labRoot, "topic-b");
		expect(resultB.totalIssues).toBeGreaterThan(0);
	});
});
