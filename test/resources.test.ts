import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { clearConfigCache } from "../src/config";
import { cacheResource } from "../src/resources/cache";
import { configResource } from "../src/resources/config";
import { schemaResource } from "../src/resources/schema";
import { cleanupTempLab, createTempLab } from "./helpers";

let labRoot: string;

beforeEach(async () => {
	labRoot = await createTempLab();
	clearConfigCache();
});

afterEach(async () => {
	await cleanupTempLab(labRoot);
	clearConfigCache();
});

describe("cacheResource", () => {
	it("returns empty list when no .cache/ exists", async () => {
		const items = await cacheResource.list({ labRoot }, {});
		expect(items).toEqual([]);
	});

	it("lists entries and marks fresh/stale correctly", async () => {
		const cacheDir = join(labRoot, ".cache");
		await mkdir(cacheDir, { recursive: true });
		const now = Date.now();
		await writeFile(
			join(cacheDir, "abc.json"),
			JSON.stringify({
				fetchedAt: new Date(now - 86_400_000).toISOString(),
				expiresAt: new Date(now + 86_400_000).toISOString(),
				data: { hello: "world" },
			}),
		);
		await writeFile(
			join(cacheDir, "stale.json"),
			JSON.stringify({
				fetchedAt: new Date(now - 10 * 86_400_000).toISOString(),
				expiresAt: new Date(now - 5 * 86_400_000).toISOString(),
				data: {},
			}),
		);

		const items = await cacheResource.list({ labRoot }, {});
		expect(items.length).toBe(2);
		const fresh = items.find((i) => i.hash === "abc");
		const stale = items.find((i) => i.hash === "stale");
		expect(fresh?.fresh).toBe(true);
		expect(stale?.fresh).toBe(false);
	});

	it("returns null for missing hash in get()", async () => {
		const detail = await cacheResource.get?.({ labRoot }, "missing");
		expect(detail).toBe(null);
	});
});

describe("configResource", () => {
	it("list returns rows sourced from defaults when no config file", async () => {
		const items = await configResource.list({ labRoot }, {});
		expect(items.every((i) => i.source === "default")).toBe(true);
		expect(items.some((i) => i.field === "topicsDir")).toBe(true);
		expect(items.some((i) => i.field === "envFile")).toBe(true);
	});

	it("list marks source=config when .tala/config.json exists", async () => {
		await mkdir(join(labRoot, ".tala"), { recursive: true });
		await writeFile(
			join(labRoot, ".tala", "config.json"),
			JSON.stringify({ topicsDir: "./custom" }),
		);
		const items = await configResource.list({ labRoot }, {});
		expect(items.every((i) => i.source === "config")).toBe(true);
	});

	it("get returns full ResolvedConfig with file-presence flag", async () => {
		const detail = await configResource.get?.({ labRoot }, "any");
		expect(detail?.labRoot).toBe(labRoot);
		expect(detail?.configFileExists).toBe(false);
	});
});

describe("schemaResource", () => {
	it("lists three built-in schemas", async () => {
		const items = await schemaResource.list({ labRoot }, {});
		const names = items.map((i) => i.name).sort();
		expect(names).toEqual(["claim-markers", "frontmatter", "severity"]);
	});

	it("get('claim-markers') returns all marker labels", async () => {
		const detail = await schemaResource.get?.({ labRoot }, "claim-markers");
		expect(detail?.kind).toBe("enum");
		expect(Array.isArray(detail?.entries)).toBe(true);
		const labels = (detail?.entries as Array<{ label: string }>).map(
			(e) => e.label,
		);
		expect(labels).toContain("unsupported");
		expect(labels).toContain("single-source");
		expect(labels).toContain("hypothesis");
		expect(labels).toContain("contradicted");
	});

	it("get returns null for unknown schema", async () => {
		const detail = await schemaResource.get?.({ labRoot }, "galaxies");
		expect(detail).toBe(null);
	});
});
