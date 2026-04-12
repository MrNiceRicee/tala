import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { join } from "node:path"
import { mkdir } from "node:fs/promises"
import { createTempLab, cleanupTempLab } from "../helpers"
import { createTopic } from "../../src/commands/new"
import { refreshIndex } from "../../src/commands/index"

let labRoot: string

beforeEach(async () => {
	labRoot = await createTempLab()
})

afterEach(async () => {
	await cleanupTempLab(labRoot)
})

describe("refreshIndex", () => {
	it("generates index with active topics", async () => {
		await createTopic(labRoot, "Trip to Japan")
		await createTopic(labRoot, "Cost of Living")

		const result = await refreshIndex(labRoot)
		expect(result.topicCount).toBe(2)

		const indexPath = join(labRoot, "topics", "index.md")
		const content = await Bun.file(indexPath).text()
		expect(content).toContain("type: index")
		expect(content).toContain("## Working")
		expect(content).toContain("[[trip-to-japan/trip-to-japan|Trip to Japan]]")
		expect(content).toContain("[[cost-of-living/cost-of-living|Cost of Living]]")
	})

	it("groups topics by status", async () => {
		await createTopic(labRoot, "Active Topic")

		const distilledDir = join(labRoot, "topics", "done-topic")
		await mkdir(distilledDir, { recursive: true })
		await Bun.write(
			join(distilledDir, "done-topic.md"),
			"---\ntype: hub\ntitle: Done Topic\nslug: done-topic\nstatus: distilled\ncreated: 2026-04-12\nupdated: 2026-04-12\n---\n# Done Topic\n",
		)

		const result = await refreshIndex(labRoot)
		expect(result.topicCount).toBe(2)

		const content = await Bun.file(join(labRoot, "topics", "index.md")).text()
		expect(content).toContain("## Working")
		expect(content).toContain("## Distilled")
	})

	it("handles empty topics directory", async () => {
		const result = await refreshIndex(labRoot)
		expect(result.topicCount).toBe(0)
	})
})
