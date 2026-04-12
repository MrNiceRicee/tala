import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { existsSync } from "node:fs"
import { readdir } from "node:fs/promises"
import { join } from "node:path"
import { createTempLab, cleanupTempLab } from "../helpers"
import { createTopic } from "../../src/commands/new"

let labRoot: string

beforeEach(async () => {
	labRoot = await createTempLab()
})

afterEach(async () => {
	await cleanupTempLab(labRoot)
})

describe("createTopic", () => {
	it("creates topic directory with hub note", async () => {
		const result = await createTopic(labRoot, "Trip to Japan")
		expect(result.success).toBe(true)
		expect(result.slug).toBe("trip-to-japan")

		const hubPath = join(labRoot, "topics", "trip-to-japan", "trip-to-japan.md")
		expect(existsSync(hubPath)).toBe(true)

		const content = await Bun.file(hubPath).text()
		expect(content).toContain("type: hub")
		expect(content).toContain("title: Trip to Japan")
		expect(content).toContain("slug: trip-to-japan")
		expect(content).toContain("status: working")
		expect(content).toContain("## Intent")
		expect(content).toContain("## Questions")
		expect(content).toContain("## Findings")
		expect(content).toContain("## Open")
		expect(content).toContain("## Related")
	})

	it("creates sources and computations directories", async () => {
		await createTopic(labRoot, "Trip to Japan")
		const topicDir = join(labRoot, "topics", "trip-to-japan")
		const entries = await readdir(topicDir)
		expect(entries).toContain("sources")
		expect(entries).toContain("computations")
	})

	it("rejects duplicate topic", async () => {
		await createTopic(labRoot, "Trip to Japan")
		const result = await createTopic(labRoot, "Trip to Japan")
		expect(result.success).toBe(false)
		expect(result.error).toContain("already exists")
	})

	it("slugifies title correctly", async () => {
		const result = await createTopic(labRoot, "EffectTS v4 Beta!")
		expect(result.slug).toBe("effectts-v4-beta")
	})
})
