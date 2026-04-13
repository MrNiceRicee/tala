import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import {
	BaseFrontmatter,
	CLAIM_MARKERS,
	ClaimMarkerKind,
	ComputationFrontmatter,
	HubFrontmatter,
	MARKER_SEVERITY,
	NoteFrontmatter,
	NoteStatus,
	NoteType,
	SourceFrontmatter,
} from "../src/schema";

describe("NoteStatus", () => {
	const decode = Schema.decodeUnknownSync(NoteStatus);

	it("accepts valid statuses", () => {
		expect(decode("sketch")).toBe("sketch");
		expect(decode("working")).toBe("working");
		expect(decode("distilled")).toBe("distilled");
	});

	it("rejects invalid status", () => {
		expect(() => decode("draft")).toThrow();
		expect(() => decode("")).toThrow();
	});
});

describe("NoteType", () => {
	const decode = Schema.decodeUnknownSync(NoteType);

	it("accepts valid types", () => {
		expect(decode("hub")).toBe("hub");
		expect(decode("source")).toBe("source");
		expect(decode("note")).toBe("note");
		expect(decode("computation")).toBe("computation");
	});

	it("rejects invalid type", () => {
		expect(() => decode("page")).toThrow();
	});
});

describe("BaseFrontmatter", () => {
	const decode = Schema.decodeUnknownSync(BaseFrontmatter);

	it("parses valid base frontmatter", () => {
		const result = decode({
			type: "note",
			title: "Test Note",
			status: "working",
			created: "2026-04-12",
			updated: "2026-04-12",
		});
		expect(result.type).toBe("note");
		expect(result.title).toBe("Test Note");
	});

	it("rejects missing required fields", () => {
		expect(() => decode({ type: "note" })).toThrow();
		expect(() => decode({})).toThrow();
	});
});

describe("HubFrontmatter", () => {
	const decode = Schema.decodeUnknownSync(HubFrontmatter);

	it("parses hub with optional fields", () => {
		const result = decode({
			type: "hub",
			title: "Test Topic",
			status: "working",
			created: "2026-04-12",
			updated: "2026-04-12",
			slug: "test-topic",
			tags: ["research"],
		});
		expect(result.slug).toBe("test-topic");
		expect(result.tags).toEqual(["research"]);
	});

	it("parses hub without optional fields", () => {
		const result = decode({
			type: "hub",
			title: "Test Topic",
			status: "working",
			created: "2026-04-12",
			updated: "2026-04-12",
		});
		expect(result.slug).toBeUndefined();
	});
});

describe("SourceFrontmatter", () => {
	const decode = Schema.decodeUnknownSync(SourceFrontmatter);

	it("parses source with url and author", () => {
		const result = decode({
			type: "source",
			title: "Test Source",
			status: "working",
			created: "2026-04-12",
			updated: "2026-04-12",
			url: "https://example.com",
			author: "Author Name",
			accessed: "2026-04-12",
		});
		expect(result.url).toBe("https://example.com");
		expect(result.author).toBe("Author Name");
	});
});

describe("ComputationFrontmatter", () => {
	const decode = Schema.decodeUnknownSync(ComputationFrontmatter);

	it("parses computation with script and inputs", () => {
		const result = decode({
			type: "computation",
			title: "Salary Comparison",
			status: "distilled",
			created: "2026-04-12",
			updated: "2026-04-12",
			script: "./salary-comparison.ts",
			ran_at: "2026-04-12",
		});
		expect(result.script).toBe("./salary-comparison.ts");
	});
});

describe("CLAIM_MARKERS", () => {
	it("has all four marker kinds", () => {
		expect(CLAIM_MARKERS.unsupported).toBeDefined();
		expect(CLAIM_MARKERS["single-source"]).toBeDefined();
		expect(CLAIM_MARKERS.hypothesis).toBeDefined();
		expect(CLAIM_MARKERS.contradicted).toBeDefined();
	});

	it("each marker has label and description", () => {
		for (const marker of Object.values(CLAIM_MARKERS)) {
			expect(typeof marker.label).toBe("string");
			expect(typeof marker.description).toBe("string");
			expect(marker.label.length).toBeGreaterThan(0);
			expect(marker.description.length).toBeGreaterThan(0);
		}
	});

	it("labels are unique", () => {
		const labels = Object.values(CLAIM_MARKERS).map((m) => m.label);
		expect(new Set(labels).size).toBe(labels.length);
	});
});

describe("ClaimMarkerKind", () => {
	const decode = Schema.decodeUnknownSync(ClaimMarkerKind);

	it("accepts all marker labels", () => {
		expect(decode("unsupported")).toBe("unsupported");
		expect(decode("single-source")).toBe("single-source");
		expect(decode("hypothesis")).toBe("hypothesis");
		expect(decode("contradicted")).toBe("contradicted");
	});

	it("rejects unknown labels", () => {
		expect(() => decode("proven")).toThrow();
		expect(() => decode("unverified")).toThrow();
	});
});

describe("MARKER_SEVERITY", () => {
	it("has entries for all claim markers", () => {
		for (const marker of Object.values(CLAIM_MARKERS)) {
			expect(MARKER_SEVERITY[marker.label]).toBeDefined();
		}
	});

	it("has entries for bare-claim", () => {
		expect(MARKER_SEVERITY["bare-claim"]).toBeDefined();
	});

	it("returns correct severity for unsupported in distilled", () => {
		expect(MARKER_SEVERITY.unsupported.distilled).toBe("error");
	});

	it("returns correct severity for hypothesis in distilled", () => {
		expect(MARKER_SEVERITY.hypothesis.distilled).toBe("ignore");
	});

	it("returns correct severity for single-source in working", () => {
		expect(MARKER_SEVERITY["single-source"].working).toBe("info");
	});
});
