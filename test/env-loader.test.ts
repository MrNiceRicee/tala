import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnvFile } from "../src/env-loader";
import { cleanupTempLab, createTempLab } from "./helpers";

let labRoot: string;

beforeEach(async () => {
	labRoot = await createTempLab();
});

afterEach(async () => {
	await cleanupTempLab(labRoot);
});

describe("loadEnvFile", () => {
	it("returns 0 and no-ops when file does not exist", async () => {
		const loaded = await loadEnvFile(join(labRoot, "missing.env"));
		expect(loaded).toBe(0);
	});

	it("loads simple KEY=VALUE pairs into Bun.env", async () => {
		const path = join(labRoot, ".env");
		await writeFile(path, "TALA_TEST_KEY_A=hello\nTALA_TEST_KEY_B=world\n");
		const loaded = await loadEnvFile(path);
		expect(loaded).toBe(2);
		expect(Bun.env.TALA_TEST_KEY_A).toBe("hello");
		expect(Bun.env.TALA_TEST_KEY_B).toBe("world");
	});

	it("ignores comments and blank lines", async () => {
		const path = join(labRoot, ".env");
		await writeFile(path, "# comment\n\nTALA_TEST_KEY_C=value\n# another\n");
		const loaded = await loadEnvFile(path);
		expect(loaded).toBe(1);
		expect(Bun.env.TALA_TEST_KEY_C).toBe("value");
	});

	it("strips surrounding quotes", async () => {
		const path = join(labRoot, ".env");
		await writeFile(
			path,
			"TALA_TEST_KEY_D=\"double\"\nTALA_TEST_KEY_E='single'\n",
		);
		await loadEnvFile(path);
		expect(Bun.env.TALA_TEST_KEY_D).toBe("double");
		expect(Bun.env.TALA_TEST_KEY_E).toBe("single");
	});

	it("does not overwrite existing Bun.env entries", async () => {
		Bun.env.TALA_TEST_KEY_F = "from-shell";
		const path = join(labRoot, ".env");
		await writeFile(path, "TALA_TEST_KEY_F=from-file\n");
		await loadEnvFile(path);
		expect(Bun.env.TALA_TEST_KEY_F).toBe("from-shell");
	});
});
