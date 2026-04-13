import { describe, expect, it } from "bun:test";
import {
	parseFrontmatter,
	parseFrontmatterFromFile,
} from "../../src/parser/frontmatter";

const validHub = `---
type: hub
title: Trip to Japan
slug: trip-to-japan
status: working
tags:
  - travel
created: 2026-04-12
updated: 2026-04-12
---

# Trip to Japan

## Intent

Research trip planning.
`;

const missingFields = `---
type: hub
title: Missing Status
---

# Content
`;

const noFrontmatter = `# Just a markdown file

No frontmatter here.
`;

describe("parseFrontmatter", () => {
	it("parses valid hub frontmatter", () => {
		const result = parseFrontmatter(validHub);
		expect(result.ok === true).toBe(true);
		if (result.ok === true) {
			expect(result.value.data.type).toBe("hub");
			expect(result.value.data.title).toBe("Trip to Japan");
			expect(result.value.data.slug).toBe("trip-to-japan");
			expect(result.value.content).toContain("# Trip to Japan");
		}
	});

	it("returns left for missing required fields", () => {
		const result = parseFrontmatter(missingFields);
		expect(result.ok === false).toBe(true);
	});

	it("returns left for no frontmatter", () => {
		const result = parseFrontmatter(noFrontmatter);
		expect(result.ok === false).toBe(true);
	});
});

describe("parseFrontmatterFromFile", () => {
	it("returns left for nonexistent file", async () => {
		const result = await parseFrontmatterFromFile("/nonexistent/path.md");
		expect(result.ok === false).toBe(true);
	});
});
