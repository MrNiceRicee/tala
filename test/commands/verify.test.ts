import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import { join } from "node:path"
import { createTempLab, cleanupTempLab } from "../helpers"
import { createTopic } from "../../src/commands/new"
import { extractClaimsForVerification } from "../../src/commands/verify"

let labRoot: string
beforeEach(async () => { labRoot = await createTempLab() })
afterEach(async () => { await cleanupTempLab(labRoot) })

describe("extractClaimsForVerification", () => {
	it("extracts claims with source links", async () => {
		await createTopic(labRoot, "Verify Test")
		const hubPath = join(labRoot, "topics", "verify-test", "verify-test.md")
		let hub = await Bun.file(hubPath).text()
		hub = hub.replace("## Findings\n", "## Findings\n\n- JR pass is 50k [[sources/jr-guide|Guide]]\n- Hotels are cheap *(unsupported)*\n")
		await Bun.write(hubPath, hub)
		const claims = await extractClaimsForVerification(labRoot, "verify-test")
		expect(claims.withSources).toHaveLength(1)
		expect(claims.withSources[0].text).toContain("JR pass")
		expect(claims.withSources[0].sourceTarget).toBe("sources/jr-guide")
	})

	it("extracts claims needing corroboration", async () => {
		await createTopic(labRoot, "Corroborate Test")
		const hubPath = join(labRoot, "topics", "corroborate-test", "corroborate-test.md")
		let hub = await Bun.file(hubPath).text()
		hub = hub.replace("## Findings\n", "## Findings\n\n- Hotels are cheap *(unsupported)*\n- Transit is good *(single-source)*\n")
		await Bun.write(hubPath, hub)
		const claims = await extractClaimsForVerification(labRoot, "corroborate-test")
		expect(claims.needingCorroboration).toHaveLength(2)
	})

	it("returns empty for topic with no findings", async () => {
		await createTopic(labRoot, "Empty Test")
		const claims = await extractClaimsForVerification(labRoot, "empty-test")
		expect(claims.withSources).toHaveLength(0)
		expect(claims.needingCorroboration).toHaveLength(0)
	})
})
