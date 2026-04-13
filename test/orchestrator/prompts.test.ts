import { describe, expect, it } from "bun:test"
import { gathererPrompt, verifierCheckPrompt, verifierSearchPrompt } from "../../src/orchestrator/prompts"

describe("gathererPrompt", () => {
	it("includes criteria when provided", () => {
		const prompt = gathererPrompt("evidence:\n  - must cite sources")
		expect(prompt).toContain("must cite sources")
		expect(prompt).toContain("Evaluation criteria")
	})
	it("omits criteria section when empty", () => {
		const prompt = gathererPrompt("")
		expect(prompt).not.toContain("Evaluation criteria")
	})
	it("includes core gathering instructions", () => {
		const prompt = gathererPrompt("")
		expect(prompt).toContain("sources/")
		expect(prompt).toContain("frontmatter")
		expect(prompt).toContain("*(unsupported)*")
	})
})

describe("verifierCheckPrompt", () => {
	it("includes verification instructions", () => {
		const prompt = verifierCheckPrompt("some criteria")
		expect(prompt).toContain("SUPPORTED")
		expect(prompt).toContain("CONTRADICTED")
		expect(prompt).toContain("PARTIAL")
	})
})

describe("verifierSearchPrompt", () => {
	it("includes claims needing corroboration", () => {
		const claims = ["claim A *(unsupported)*", "claim B *(single-source)*"]
		const prompt = verifierSearchPrompt("criteria", claims)
		expect(prompt).toContain("claim A")
		expect(prompt).toContain("claim B")
	})
})
