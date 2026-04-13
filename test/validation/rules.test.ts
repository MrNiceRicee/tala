import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createTopic } from "../../src/commands/new";
import { validateTopic } from "../../src/validation/rules";
import { cleanupTempLab, createTempLab } from "../helpers";

let labRoot: string;

beforeEach(async () => {
	labRoot = await createTempLab();
});

afterEach(async () => {
	await cleanupTempLab(labRoot);
});

describe("structural validation", () => {
	it("passes for a valid topic", async () => {
		await createTopic(labRoot, "Valid Topic");
		const issues = await validateTopic(labRoot, "valid-topic");
		const errors = issues.filter((i) => i.severity === "error");
		expect(errors).toHaveLength(0);
	});

	it("errors when hub note is missing", async () => {
		const topicDir = join(labRoot, "topics", "no-hub");
		await mkdir(topicDir, { recursive: true });
		await Bun.write(
			join(topicDir, "notes.md"),
			"---\ntype: note\ntitle: Orphan\nstatus: working\ncreated: 2026-04-12\nupdated: 2026-04-12\n---\n",
		);

		const issues = await validateTopic(labRoot, "no-hub");
		const hubErrors = issues.filter((i) => i.rule === "hub-exists");
		expect(hubErrors).toHaveLength(1);
		expect(hubErrors[0].severity).toBe("error");
	});

	it("errors when frontmatter is missing", async () => {
		await createTopic(labRoot, "Bad Note");
		await Bun.write(
			join(labRoot, "topics", "bad-note", "raw.md"),
			"# No frontmatter\n\nJust text.\n",
		);

		const issues = await validateTopic(labRoot, "bad-note");
		const fmErrors = issues.filter((i) => i.rule === "frontmatter-valid");
		expect(fmErrors.length).toBeGreaterThan(0);
	});

	it("errors when source file has wrong type", async () => {
		await createTopic(labRoot, "Wrong Type");
		await Bun.write(
			join(labRoot, "topics", "wrong-type", "sources", "bad.md"),
			"---\ntype: note\ntitle: Not a Source\nstatus: working\ncreated: 2026-04-12\nupdated: 2026-04-12\n---\n",
		);

		const issues = await validateTopic(labRoot, "wrong-type");
		const typeErrors = issues.filter((i) => i.rule === "source-type");
		expect(typeErrors).toHaveLength(1);
	});

	it("errors on orphan notes not linked from hub", async () => {
		await createTopic(labRoot, "Orphan Test");
		await Bun.write(
			join(labRoot, "topics", "orphan-test", "stray.md"),
			"---\ntype: note\ntitle: Stray Note\nstatus: working\ncreated: 2026-04-12\nupdated: 2026-04-12\n---\n# Stray\n",
		);

		const issues = await validateTopic(labRoot, "orphan-test");
		const orphanErrors = issues.filter((i) => i.rule === "orphan-note");
		expect(orphanErrors).toHaveLength(1);
	});

	it("does not flag source or computation files as orphans", async () => {
		await createTopic(labRoot, "No Orphan");
		await Bun.write(
			join(labRoot, "topics", "no-orphan", "sources", "legit.md"),
			"---\ntype: source\ntitle: Legit Source\nstatus: working\ncreated: 2026-04-12\nupdated: 2026-04-12\n---\n",
		);

		const issues = await validateTopic(labRoot, "no-orphan");
		const orphanErrors = issues.filter((i) => i.rule === "orphan-note");
		expect(orphanErrors).toHaveLength(0);
	});
});

describe("content validation", () => {
	it("warns on bare claims in working findings", async () => {
		await createTopic(labRoot, "Bare Claims");
		const hubPath = join(labRoot, "topics", "bare-claims", "bare-claims.md");
		const hub = await Bun.file(hubPath).text();
		const updated = hub.replace(
			"## Findings\n",
			"## Findings\n\n- Hotels are cheap\n- JR pass is worth it [[sources/jr|JR Guide]]\n",
		);
		await Bun.write(hubPath, updated);

		const issues = await validateTopic(labRoot, "bare-claims");
		const bareWarns = issues.filter((i) => i.rule === "bare-claim");
		expect(bareWarns).toHaveLength(1);
		expect(bareWarns[0].severity).toBe("warn");
	});

	it("errors on bare claims in distilled findings", async () => {
		await createTopic(labRoot, "Distilled Claims");
		const hubPath = join(
			labRoot,
			"topics",
			"distilled-claims",
			"distilled-claims.md",
		);
		let hub = await Bun.file(hubPath).text();
		hub = hub.replace("status: working", "status: distilled");
		hub = hub.replace("## Findings\n", "## Findings\n\n- Hotels are cheap\n");
		await Bun.write(hubPath, hub);

		const issues = await validateTopic(labRoot, "distilled-claims");
		const bareErrors = issues.filter((i) => i.rule === "bare-claim");
		expect(bareErrors).toHaveLength(1);
		expect(bareErrors[0].severity).toBe("error");
	});

	it("ignores bare claims in sketch notes", async () => {
		await createTopic(labRoot, "Sketch Claims");
		const hubPath = join(
			labRoot,
			"topics",
			"sketch-claims",
			"sketch-claims.md",
		);
		let hub = await Bun.file(hubPath).text();
		hub = hub.replace("status: working", "status: sketch");
		hub = hub.replace("## Findings\n", "## Findings\n\n- Hotels are cheap\n");
		await Bun.write(hubPath, hub);

		const issues = await validateTopic(labRoot, "sketch-claims");
		const bareIssues = issues.filter((i) => i.rule === "bare-claim");
		expect(bareIssues).toHaveLength(0);
	});

	it("warns on empty Intent section in working hub", async () => {
		await createTopic(labRoot, "Empty Sections");
		const issues = await validateTopic(labRoot, "empty-sections");
		const emptyWarns = issues.filter((i) => i.rule === "empty-hub-section");
		expect(emptyWarns.length).toBeGreaterThan(0);
		expect(emptyWarns[0].severity).toBe("warn");
	});

	it("warns on contradicted claims in working notes", async () => {
		await createTopic(labRoot, "Contradicted Test");
		const hubPath = join(
			labRoot,
			"topics",
			"contradicted-test",
			"contradicted-test.md",
		);
		let hub = await Bun.file(hubPath).text();
		hub = hub.replace(
			"## Findings\n",
			"## Findings\n\n- Hotels are cheaper near stations *(contradicted)*\n",
		);
		await Bun.write(hubPath, hub);

		const issues = await validateTopic(labRoot, "contradicted-test");
		const contradicted = issues.filter((i) => i.rule === "contradicted-claim");
		expect(contradicted).toHaveLength(1);
		expect(contradicted[0].severity).toBe("warn");
	});

	it("errors on contradicted claims in distilled notes", async () => {
		await createTopic(labRoot, "Contradicted Distilled");
		const hubPath = join(
			labRoot,
			"topics",
			"contradicted-distilled",
			"contradicted-distilled.md",
		);
		let hub = await Bun.file(hubPath).text();
		hub = hub.replace("status: working", "status: distilled");
		hub = hub.replace(
			"## Findings\n",
			"## Findings\n\n- Hotels are cheaper near stations *(contradicted)*\n",
		);
		await Bun.write(hubPath, hub);

		const issues = await validateTopic(labRoot, "contradicted-distilled");
		const contradicted = issues.filter((i) => i.rule === "contradicted-claim");
		expect(contradicted).toHaveLength(1);
		expect(contradicted[0].severity).toBe("error");
	});

	it("does not flag unsupported as bare claim (it has a marker)", async () => {
		await createTopic(labRoot, "Unsupported Marker");
		const hubPath = join(
			labRoot,
			"topics",
			"unsupported-marker",
			"unsupported-marker.md",
		);
		let hub = await Bun.file(hubPath).text();
		hub = hub.replace(
			"## Findings\n",
			"## Findings\n\n- Something claimed *(unsupported)*\n",
		);
		await Bun.write(hubPath, hub);

		const issues = await validateTopic(labRoot, "unsupported-marker");
		const bare = issues.filter((i) => i.rule === "bare-claim");
		expect(bare).toHaveLength(0);
	});

	it("errors on empty Intent section in distilled hub", async () => {
		await createTopic(labRoot, "Distilled Empty");
		const hubPath = join(
			labRoot,
			"topics",
			"distilled-empty",
			"distilled-empty.md",
		);
		let hub = await Bun.file(hubPath).text();
		hub = hub.replace("status: working", "status: distilled");
		await Bun.write(hubPath, hub);

		const issues = await validateTopic(labRoot, "distilled-empty");
		const emptyErrors = issues.filter(
			(i) => i.rule === "empty-hub-section" && i.severity === "error",
		);
		expect(emptyErrors.length).toBeGreaterThan(0);
	});
});

describe("staleness validation", () => {
	it("flags files with old updated dates", async () => {
		await createTopic(labRoot, "Stale Topic");
		const hubPath = join(labRoot, "topics", "stale-topic", "stale-topic.md");
		let hub = await Bun.file(hubPath).text();
		hub = hub.replace(/updated: .+/, "updated: 2026-01-01");
		await Bun.write(hubPath, hub);

		const issues = await validateTopic(labRoot, "stale-topic");
		const staleIssues = issues.filter((i) => i.rule === "stale-file");
		expect(staleIssues.length).toBeGreaterThan(0);
	});
});
