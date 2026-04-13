import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import { join } from "node:path"
import { createTempLab, cleanupTempLab } from "../helpers"
import { createTopic } from "../../src/commands/new"
import {
	GLOBAL_CRITERIA,
	DOMAIN_CRITERIA,
	mergeCriteria,
	renderCriteria,
	loadTopicCriteria,
} from "../../src/orchestrator/criteria"

describe("GLOBAL_CRITERIA", () => {
	it("has evidence and quality categories", () => {
		expect(GLOBAL_CRITERIA.evidence).toBeDefined()
		expect(GLOBAL_CRITERIA.evidence.length).toBeGreaterThan(0)
		expect(GLOBAL_CRITERIA.quality).toBeDefined()
		expect(GLOBAL_CRITERIA.quality.length).toBeGreaterThan(0)
	})
})

describe("DOMAIN_CRITERIA", () => {
	it("has software domain", () => {
		expect(DOMAIN_CRITERIA.software).toBeDefined()
	})
	it("has travel domain", () => {
		expect(DOMAIN_CRITERIA.travel).toBeDefined()
	})
})

describe("mergeCriteria", () => {
	it("merges global and domain criteria", () => {
		const merged = mergeCriteria("software")
		expect(merged.evidence).toBeDefined()
		expect(merged.quality).toBeDefined()
		expect(merged.security).toBeDefined()
	})
	it("returns only global when domain is unknown", () => {
		const merged = mergeCriteria("unknown-domain")
		expect(merged.evidence).toBeDefined()
		expect(merged.security).toBeUndefined()
	})
	it("returns only global when no domain specified", () => {
		const merged = mergeCriteria(undefined)
		expect(merged.evidence).toBeDefined()
	})
})

describe("renderCriteria", () => {
	it("renders criteria set to readable string", () => {
		const rendered = renderCriteria({ evidence: ["must cite sources"] })
		expect(rendered).toContain("evidence:")
		expect(rendered).toContain("must cite sources")
	})
})

let labRoot: string
beforeEach(async () => { labRoot = await createTempLab() })
afterEach(async () => { await cleanupTempLab(labRoot) })

describe("loadTopicCriteria", () => {
	it("returns merged global criteria for topic without domain", async () => {
		await createTopic(labRoot, "Generic Topic")
		const criteria = await loadTopicCriteria(labRoot, "generic-topic")
		expect(criteria).toContain("must cite")
	})
	it("includes topic-level criteria when criteria.md exists", async () => {
		await createTopic(labRoot, "Custom Topic")
		await Bun.write(
			join(labRoot, "topics", "custom-topic", "criteria.md"),
			"---\ntype: criteria\ntitle: Criteria\nstatus: working\ncreated: 2026-04-12\nupdated: 2026-04-12\n---\n\n## custom\n- check seasonal pricing\n",
		)
		const criteria = await loadTopicCriteria(labRoot, "custom-topic")
		expect(criteria).toContain("seasonal pricing")
	})
})
