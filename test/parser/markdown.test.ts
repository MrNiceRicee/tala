import { describe, expect, it } from "bun:test";
import {
	extractClaimMarkers,
	extractSections,
	extractWikilinks,
	parseMarkdown,
} from "../../src/parser/markdown";

const sampleMarkdown = `# Trip to Japan

## Intent

Research trip planning.

## Findings

- JR 7-day pass is 50,000 yen [[sources/jr-pass-guide|JR Pass Guide]]
- Shinjuku is the best base for Tokyo *(hypothesis)*
- Budget 15,000 yen per day for food *(single-source)*
- Hotels average 12,000 yen per night

## Open

- Need more data on Kyoto accommodations
`;

describe("extractWikilinks", () => {
	it("finds wikilinks in content", () => {
		const links = extractWikilinks(sampleMarkdown);
		expect(links).toHaveLength(1);
		expect(links[0].target).toBe("sources/jr-pass-guide");
		expect(links[0].display).toBe("JR Pass Guide");
	});

	it("handles wikilinks without display text", () => {
		const links = extractWikilinks("See [[some-topic]] for details.");
		expect(links).toHaveLength(1);
		expect(links[0].target).toBe("some-topic");
		expect(links[0].display).toBeUndefined();
	});

	it("returns empty for no wikilinks", () => {
		const links = extractWikilinks("No links here.");
		expect(links).toHaveLength(0);
	});
});

describe("extractClaimMarkers", () => {
	it("finds hypothesis and single-source markers", () => {
		const markers = extractClaimMarkers(sampleMarkdown);
		expect(markers).toHaveLength(2);
		expect(markers[0].kind).toBe("hypothesis");
		expect(markers[0].line).toContain("Shinjuku");
		expect(markers[1].kind).toBe("single-source");
		expect(markers[1].line).toContain("Budget");
	});

	it("finds callout-style markers", () => {
		const md = `> [!hypothesis]\n> This is speculative.`;
		const markers = extractClaimMarkers(md);
		expect(markers).toHaveLength(1);
		expect(markers[0].kind).toBe("hypothesis");
	});

	it("returns empty when no markers", () => {
		const markers = extractClaimMarkers("Just normal text.");
		expect(markers).toHaveLength(0);
	});

	it("finds unsupported markers", () => {
		const md = "- Hotels average 12,000 yen *(unsupported)*"
		const markers = extractClaimMarkers(md)
		expect(markers).toHaveLength(1)
		expect(markers[0].kind).toBe("unsupported")
	})

	it("finds single-source markers", () => {
		const md = "- Shinjuku has most transit *(single-source)*"
		const markers = extractClaimMarkers(md)
		expect(markers).toHaveLength(1)
		expect(markers[0].kind).toBe("single-source")
	})

	it("finds contradicted markers", () => {
		const md = "- Capsule hotels are cheaper *(contradicted)*"
		const markers = extractClaimMarkers(md)
		expect(markers).toHaveLength(1)
		expect(markers[0].kind).toBe("contradicted")
	})

	it("finds contradicted callout markers", () => {
		const md = "> [!contradicted]\n> Sources disagree on this."
		const markers = extractClaimMarkers(md)
		expect(markers).toHaveLength(1)
		expect(markers[0].kind).toBe("contradicted")
	})

	it("finds all four marker types in one document", () => {
		const md = [
			"- Claim A *(unsupported)*",
			"- Claim B *(single-source)*",
			"- Claim C *(hypothesis)*",
			"- Claim D *(contradicted)*",
		].join("\n")
		const markers = extractClaimMarkers(md)
		expect(markers).toHaveLength(4)
		const kinds = markers.map((m) => m.kind)
		expect(kinds).toContain("unsupported")
		expect(kinds).toContain("single-source")
		expect(kinds).toContain("hypothesis")
		expect(kinds).toContain("contradicted")
	})
});

describe("extractSections", () => {
	it("extracts h2 sections from markdown", () => {
		const sections = extractSections(sampleMarkdown);
		expect(sections.has("Intent")).toBe(true);
		expect(sections.has("Findings")).toBe(true);
		expect(sections.has("Open")).toBe(true);
	});

	it("captures content under each section", () => {
		const sections = extractSections(sampleMarkdown);
		const findings = sections.get("Findings") ?? "";
		expect(findings).toContain("JR 7-day pass");
		expect(findings).toContain("*(hypothesis)*");
	});
});

describe("parseMarkdown", () => {
	it("returns structured result with all extractions", () => {
		const result = parseMarkdown(sampleMarkdown);
		expect(result.wikilinks.length).toBeGreaterThan(0);
		expect(result.claimMarkers.length).toBeGreaterThan(0);
		expect(result.sections.size).toBeGreaterThan(0);
	});
});
