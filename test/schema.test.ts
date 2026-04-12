import { describe, expect, it } from "bun:test"
import { Schema } from "effect"
import {
	BaseFrontmatter,
	HubFrontmatter,
	SourceFrontmatter,
	NoteFrontmatter,
	ComputationFrontmatter,
	NoteStatus,
	NoteType,
} from "../src/schema"

describe("NoteStatus", () => {
	const decode = Schema.decodeUnknownSync(NoteStatus)

	it("accepts valid statuses", () => {
		expect(decode("sketch")).toBe("sketch")
		expect(decode("working")).toBe("working")
		expect(decode("distilled")).toBe("distilled")
	})

	it("rejects invalid status", () => {
		expect(() => decode("draft")).toThrow()
		expect(() => decode("")).toThrow()
	})
})

describe("NoteType", () => {
	const decode = Schema.decodeUnknownSync(NoteType)

	it("accepts valid types", () => {
		expect(decode("hub")).toBe("hub")
		expect(decode("source")).toBe("source")
		expect(decode("note")).toBe("note")
		expect(decode("computation")).toBe("computation")
	})

	it("rejects invalid type", () => {
		expect(() => decode("page")).toThrow()
	})
})

describe("BaseFrontmatter", () => {
	const decode = Schema.decodeUnknownSync(BaseFrontmatter)

	it("parses valid base frontmatter", () => {
		const result = decode({
			type: "note",
			title: "Test Note",
			status: "working",
			created: "2026-04-12",
			updated: "2026-04-12",
		})
		expect(result.type).toBe("note")
		expect(result.title).toBe("Test Note")
	})

	it("rejects missing required fields", () => {
		expect(() => decode({ type: "note" })).toThrow()
		expect(() => decode({})).toThrow()
	})
})

describe("HubFrontmatter", () => {
	const decode = Schema.decodeUnknownSync(HubFrontmatter)

	it("parses hub with optional fields", () => {
		const result = decode({
			type: "hub",
			title: "Test Topic",
			status: "working",
			created: "2026-04-12",
			updated: "2026-04-12",
			slug: "test-topic",
			tags: ["research"],
		})
		expect(result.slug).toBe("test-topic")
		expect(result.tags).toEqual(["research"])
	})

	it("parses hub without optional fields", () => {
		const result = decode({
			type: "hub",
			title: "Test Topic",
			status: "working",
			created: "2026-04-12",
			updated: "2026-04-12",
		})
		expect(result.slug).toBeUndefined()
	})
})

describe("SourceFrontmatter", () => {
	const decode = Schema.decodeUnknownSync(SourceFrontmatter)

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
		})
		expect(result.url).toBe("https://example.com")
		expect(result.author).toBe("Author Name")
	})
})

describe("ComputationFrontmatter", () => {
	const decode = Schema.decodeUnknownSync(ComputationFrontmatter)

	it("parses computation with script and inputs", () => {
		const result = decode({
			type: "computation",
			title: "Salary Comparison",
			status: "distilled",
			created: "2026-04-12",
			updated: "2026-04-12",
			script: "./salary-comparison.ts",
			ran_at: "2026-04-12",
		})
		expect(result.script).toBe("./salary-comparison.ts")
	})
})
