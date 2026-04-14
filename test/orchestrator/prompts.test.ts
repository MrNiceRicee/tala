import { describe, expect, it } from "bun:test";
import {
	adversaryPrompt,
	criticPrompt,
	gathererPrompt,
	judgePrompt,
	reviserPrompt,
	synthesizerPrompt,
	verifierCheckPrompt,
	verifierSearchPrompt,
} from "../../src/orchestrator/prompts";

describe("gathererPrompt", () => {
	it("includes criteria when provided", () => {
		const prompt = gathererPrompt("evidence:\n  - must cite sources");
		expect(prompt).toContain("must cite sources");
		expect(prompt).toContain("Evaluation criteria");
	});
	it("omits criteria section when empty", () => {
		const prompt = gathererPrompt("");
		expect(prompt).not.toContain("Evaluation criteria");
	});
	it("includes core gathering instructions", () => {
		const prompt = gathererPrompt("");
		expect(prompt).toContain("sources/");
		expect(prompt).toContain("frontmatter");
		expect(prompt).toContain("*(unsupported)*");
	});
});

describe("verifierCheckPrompt", () => {
	it("includes verification instructions", () => {
		const prompt = verifierCheckPrompt("some criteria");
		expect(prompt).toContain("SUPPORTED");
		expect(prompt).toContain("CONTRADICTED");
		expect(prompt).toContain("PARTIAL");
	});
});

describe("verifierSearchPrompt", () => {
	it("includes claims needing corroboration", () => {
		const claims = ["claim A *(unsupported)*", "claim B *(single-source)*"];
		const prompt = verifierSearchPrompt("criteria", claims);
		expect(prompt).toContain("claim A");
		expect(prompt).toContain("claim B");
	});
});

describe("criticPrompt", () => {
	it("includes criteria", () => {
		const prompt = criticPrompt("evidence:\n  - must cite");
		expect(prompt).toContain("must cite");
	});
	it("asks for specific problems", () => {
		const prompt = criticPrompt("");
		expect(prompt).toContain("missing evidence");
		expect(prompt).toContain("organizational");
	});
});

describe("adversaryPrompt", () => {
	it("requires evidence-backed objections", () => {
		const prompt = adversaryPrompt("");
		expect(prompt).toContain("MUST cite specific evidence");
		expect(prompt).toContain("found nothing wrong");
	});
	it("restricts to existing sources only", () => {
		const prompt = adversaryPrompt("");
		expect(prompt).toContain("existing source notes only");
	});
});

describe("reviserPrompt", () => {
	it("includes instructions to address critique and challenges", () => {
		const prompt = reviserPrompt("");
		expect(prompt).toContain("critique");
		expect(prompt).toContain("challenges");
		expect(prompt).toContain("markers");
	});
});

describe("synthesizerPrompt", () => {
	it("asks to merge best of both versions", () => {
		const prompt = synthesizerPrompt();
		expect(prompt).toContain("strongest");
		expect(prompt).toContain("evidence links");
	});
});

describe("judgePrompt", () => {
	it("asks for ranking with Borda format", () => {
		const prompt = judgePrompt("");
		expect(prompt).toContain("RANK:");
		expect(prompt).toContain("1st");
		expect(prompt).toContain("2nd");
		expect(prompt).toContain("3rd");
	});
});
