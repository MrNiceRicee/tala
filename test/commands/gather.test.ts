import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { buildGatherContext } from "../../src/commands/gather";
import { createTopic } from "../../src/commands/new";
import { cleanupTempLab, createTempLab } from "../helpers";

let labRoot: string;
beforeEach(async () => {
	labRoot = await createTempLab();
});
afterEach(async () => {
	await cleanupTempLab(labRoot);
});

describe("buildGatherContext", () => {
	it("extracts questions from hub note", async () => {
		await createTopic(labRoot, "Test Gather");
		const hubPath = join(labRoot, "topics", "test-gather", "test-gather.md");
		let hub = await Bun.file(hubPath).text();
		hub = hub.replace(
			"## Questions\n\n-",
			"## Questions\n\n- What is the JR pass situation?\n- Best areas to stay?",
		);
		await Bun.write(hubPath, hub);
		const context = await buildGatherContext(labRoot, "test-gather");
		expect(context.questions).toContain("JR pass");
		expect(context.questions).toContain("Best areas");
	});

	it("lists existing source titles", async () => {
		await createTopic(labRoot, "Sources Test");
		await Bun.write(
			join(labRoot, "topics", "sources-test", "sources", "guide.md"),
			"---\ntype: source\ntitle: JR Pass Guide\nstatus: working\ncreated: 2026-04-12\nupdated: 2026-04-12\nurl: https://example.com\n---\n# JR Pass Guide\n",
		);
		const context = await buildGatherContext(labRoot, "sources-test");
		expect(context.existingSources).toContain("JR Pass Guide");
	});

	it("includes merged criteria", async () => {
		await createTopic(labRoot, "Criteria Test");
		const context = await buildGatherContext(labRoot, "criteria-test");
		expect(context.criteria).toContain("must cite");
	});
});
