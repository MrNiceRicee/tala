import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	cacheRoot,
	clearConfigCache,
	hubPath,
	loadConfig,
	toolPath,
	toolsRoot,
	topicDir,
	topicsRoot,
} from "../src/config";
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

describe("loadConfig", () => {
	it("returns defaults when no .tala/config.json exists", () => {
		const config = loadConfig(labRoot);
		expect(config.topicsDir).toBe(join(labRoot, "./topics"));
		expect(config.toolsDir).toBe(join(labRoot, "./tools"));
		expect(config.cacheDir).toBe(join(labRoot, "./.cache"));
		expect(config.apis).toEqual([]);
	});

	it("honors custom topicsDir from config.json", async () => {
		await mkdir(join(labRoot, ".tala"), { recursive: true });
		await writeFile(
			join(labRoot, ".tala", "config.json"),
			JSON.stringify({ topicsDir: "./.tala/topics" }),
		);
		const config = loadConfig(labRoot);
		expect(config.topicsDir).toBe(join(labRoot, "./.tala/topics"));
	});

	it("honors custom toolsDir from config.json", async () => {
		await mkdir(join(labRoot, ".tala"), { recursive: true });
		await writeFile(
			join(labRoot, ".tala", "config.json"),
			JSON.stringify({ toolsDir: "./custom/tools" }),
		);
		const config = loadConfig(labRoot);
		expect(config.toolsDir).toBe(join(labRoot, "./custom/tools"));
	});

	it("handles absolute paths in config", async () => {
		await mkdir(join(labRoot, ".tala"), { recursive: true });
		await writeFile(
			join(labRoot, ".tala", "config.json"),
			JSON.stringify({ topicsDir: "/abs/somewhere" }),
		);
		const config = loadConfig(labRoot);
		expect(config.topicsDir).toBe("/abs/somewhere");
	});

	it("falls back to defaults on malformed JSON", async () => {
		await mkdir(join(labRoot, ".tala"), { recursive: true });
		await writeFile(join(labRoot, ".tala", "config.json"), "{ not json");
		const config = loadConfig(labRoot);
		expect(config.topicsDir).toBe(join(labRoot, "./topics"));
	});

	it("captures apis array", async () => {
		await mkdir(join(labRoot, ".tala"), { recursive: true });
		await writeFile(
			join(labRoot, ".tala", "config.json"),
			JSON.stringify({ apis: ["openrouteservice", "here"] }),
		);
		const config = loadConfig(labRoot);
		expect(config.apis).toEqual(["openrouteservice", "here"]);
	});
});

describe("path helpers", () => {
	it("topicsRoot + topicDir + hubPath compose correctly", () => {
		expect(topicsRoot(labRoot)).toBe(join(labRoot, "./topics"));
		expect(topicDir(labRoot, "oahu")).toBe(join(labRoot, "./topics", "oahu"));
		expect(hubPath(labRoot, "oahu")).toBe(
			join(labRoot, "./topics", "oahu", "oahu.md"),
		);
	});

	it("toolsRoot + toolPath compose correctly", () => {
		expect(toolsRoot(labRoot)).toBe(join(labRoot, "./tools"));
		expect(toolPath(labRoot, "drive-matrix")).toBe(
			join(labRoot, "./tools", "drive-matrix.ts"),
		);
	});

	it("cacheRoot honors custom override", async () => {
		await mkdir(join(labRoot, ".tala"), { recursive: true });
		await writeFile(
			join(labRoot, ".tala", "config.json"),
			JSON.stringify({ cacheDir: "./custom-cache" }),
		);
		expect(cacheRoot(labRoot)).toBe(join(labRoot, "./custom-cache"));
	});

	it("nested layout path helpers return nested paths", async () => {
		await mkdir(join(labRoot, ".tala"), { recursive: true });
		await writeFile(
			join(labRoot, ".tala", "config.json"),
			JSON.stringify({
				topicsDir: "./.tala/topics",
				toolsDir: "./.tala/tools",
			}),
		);
		expect(topicsRoot(labRoot)).toBe(join(labRoot, "./.tala/topics"));
		expect(topicDir(labRoot, "x")).toBe(join(labRoot, "./.tala/topics/x"));
		expect(toolPath(labRoot, "t")).toBe(join(labRoot, "./.tala/tools/t.ts"));
	});
});
