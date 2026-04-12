import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { join } from "node:path"
import { mkdir } from "node:fs/promises"
import { createTempLab, cleanupTempLab } from "../helpers"
import { createTopic } from "../../src/commands/new"
import { validateTopic } from "../../src/validation/rules"

let labRoot: string

beforeEach(async () => {
	labRoot = await createTempLab()
})

afterEach(async () => {
	await cleanupTempLab(labRoot)
})

describe("structural validation", () => {
	it("passes for a valid topic", async () => {
		await createTopic(labRoot, "Valid Topic")
		const issues = await validateTopic(labRoot, "valid-topic")
		const errors = issues.filter((i) => i.severity === "error")
		expect(errors).toHaveLength(0)
	})

	it("errors when hub note is missing", async () => {
		const topicDir = join(labRoot, "topics", "no-hub")
		await mkdir(topicDir, { recursive: true })
		await Bun.write(
			join(topicDir, "notes.md"),
			"---\ntype: note\ntitle: Orphan\nstatus: working\ncreated: 2026-04-12\nupdated: 2026-04-12\n---\n",
		)

		const issues = await validateTopic(labRoot, "no-hub")
		const hubErrors = issues.filter((i) => i.rule === "hub-exists")
		expect(hubErrors).toHaveLength(1)
		expect(hubErrors[0].severity).toBe("error")
	})

	it("errors when frontmatter is missing", async () => {
		await createTopic(labRoot, "Bad Note")
		await Bun.write(
			join(labRoot, "topics", "bad-note", "raw.md"),
			"# No frontmatter\n\nJust text.\n",
		)

		const issues = await validateTopic(labRoot, "bad-note")
		const fmErrors = issues.filter((i) => i.rule === "frontmatter-valid")
		expect(fmErrors.length).toBeGreaterThan(0)
	})

	it("errors when source file has wrong type", async () => {
		await createTopic(labRoot, "Wrong Type")
		await Bun.write(
			join(labRoot, "topics", "wrong-type", "sources", "bad.md"),
			"---\ntype: note\ntitle: Not a Source\nstatus: working\ncreated: 2026-04-12\nupdated: 2026-04-12\n---\n",
		)

		const issues = await validateTopic(labRoot, "wrong-type")
		const typeErrors = issues.filter((i) => i.rule === "source-type")
		expect(typeErrors).toHaveLength(1)
	})
})

describe("content validation", () => {
	it("warns on bare claims in working findings", async () => {
		await createTopic(labRoot, "Bare Claims")
		const hubPath = join(labRoot, "topics", "bare-claims", "bare-claims.md")
		const hub = await Bun.file(hubPath).text()
		const updated = hub.replace(
			"## Findings\n",
			"## Findings\n\n- Hotels are cheap\n- JR pass is worth it [[sources/jr|JR Guide]]\n",
		)
		await Bun.write(hubPath, updated)

		const issues = await validateTopic(labRoot, "bare-claims")
		const bareWarns = issues.filter((i) => i.rule === "bare-claim")
		expect(bareWarns).toHaveLength(1)
		expect(bareWarns[0].severity).toBe("warn")
	})

	it("errors on bare claims in distilled findings", async () => {
		await createTopic(labRoot, "Distilled Claims")
		const hubPath = join(labRoot, "topics", "distilled-claims", "distilled-claims.md")
		let hub = await Bun.file(hubPath).text()
		hub = hub.replace("status: working", "status: distilled")
		hub = hub.replace("## Findings\n", "## Findings\n\n- Hotels are cheap\n")
		await Bun.write(hubPath, hub)

		const issues = await validateTopic(labRoot, "distilled-claims")
		const bareErrors = issues.filter((i) => i.rule === "bare-claim")
		expect(bareErrors).toHaveLength(1)
		expect(bareErrors[0].severity).toBe("error")
	})

	it("ignores bare claims in sketch notes", async () => {
		await createTopic(labRoot, "Sketch Claims")
		const hubPath = join(labRoot, "topics", "sketch-claims", "sketch-claims.md")
		let hub = await Bun.file(hubPath).text()
		hub = hub.replace("status: working", "status: sketch")
		hub = hub.replace("## Findings\n", "## Findings\n\n- Hotels are cheap\n")
		await Bun.write(hubPath, hub)

		const issues = await validateTopic(labRoot, "sketch-claims")
		const bareIssues = issues.filter((i) => i.rule === "bare-claim")
		expect(bareIssues).toHaveLength(0)
	})
})
