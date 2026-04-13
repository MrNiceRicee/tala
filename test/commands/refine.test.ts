import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { createTopic } from "../../src/commands/new";
import { buildRefineContext } from "../../src/commands/refine";
import { cleanupTempLab, createTempLab } from "../helpers";

let labRoot: string;
beforeEach(async () => {
	labRoot = await createTempLab();
});
afterEach(async () => {
	await cleanupTempLab(labRoot);
});

describe("buildRefineContext", () => {
	it("extracts target section from hub", async () => {
		await createTopic(labRoot, "Refine Test");
		const hubPath = join(labRoot, "topics", "refine-test", "refine-test.md");
		let hub = await Bun.file(hubPath).text();
		hub = hub.replace(
			"## Findings\n",
			"## Findings\n\n- Claim one *(unsupported)*\n- Claim two [[sources/s1|S1]]\n",
		);
		await Bun.write(hubPath, hub);

		const context = await buildRefineContext(
			labRoot,
			"refine-test",
			"Findings",
		);
		expect(context.section).toContain("Claim one");
		expect(context.section).toContain("Claim two");
	});

	it("collects linked source content", async () => {
		await createTopic(labRoot, "Sources Refine");
		const hubPath = join(
			labRoot,
			"topics",
			"sources-refine",
			"sources-refine.md",
		);
		let hub = await Bun.file(hubPath).text();
		hub = hub.replace(
			"## Findings\n",
			"## Findings\n\n- JR pass is 50k [[sources/jr-guide|Guide]]\n",
		);
		await Bun.write(hubPath, hub);
		await Bun.write(
			join(labRoot, "topics", "sources-refine", "sources", "jr-guide.md"),
			"---\ntype: source\ntitle: JR Guide\nstatus: working\ncreated: 2026-04-12\nupdated: 2026-04-12\n---\n# JR Guide\n\nThe 7-day pass costs 50,000 yen.\n",
		);

		const context = await buildRefineContext(
			labRoot,
			"sources-refine",
			"Findings",
		);
		expect(context.sources).toContain("50,000 yen");
	});

	it("returns empty section for missing heading", async () => {
		await createTopic(labRoot, "Missing Section");
		const context = await buildRefineContext(
			labRoot,
			"missing-section",
			"NonExistent",
		);
		expect(context.section).toBe("");
	});
});
