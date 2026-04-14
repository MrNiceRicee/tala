import { describe, expect, it } from "bun:test";
import { parseEnv, requireKey } from "../src/env";

describe("parseEnv", () => {
	it("accepts known keys when present", () => {
		const env = parseEnv({ OPENROUTESERVICE_API_KEY: "test-key-123" });
		expect(env.OPENROUTESERVICE_API_KEY).toBe("test-key-123");
	});

	it("leaves absent keys as undefined", () => {
		const env = parseEnv({});
		expect(env.OPENROUTESERVICE_API_KEY).toBeUndefined();
		expect(env.HERE_API_KEY).toBeUndefined();
		expect(env.TOMTOM_API_KEY).toBeUndefined();
	});

	it("accepts all three known keys", () => {
		const env = parseEnv({
			OPENROUTESERVICE_API_KEY: "ors-key",
			HERE_API_KEY: "here-key",
			TOMTOM_API_KEY: "tt-key",
		});
		expect(env.OPENROUTESERVICE_API_KEY).toBe("ors-key");
		expect(env.HERE_API_KEY).toBe("here-key");
		expect(env.TOMTOM_API_KEY).toBe("tt-key");
	});

	it("ignores unknown keys silently", () => {
		const env = parseEnv({ SOME_OTHER_VAR: "value" });
		expect(env.OPENROUTESERVICE_API_KEY).toBeUndefined();
	});
});

describe("requireKey", () => {
	it("returns the value when set", () => {
		const env = parseEnv({ OPENROUTESERVICE_API_KEY: "xyz-key" });
		expect(requireKey("OPENROUTESERVICE_API_KEY", { env })).toBe("xyz-key");
	});

	it("throws when value is missing", () => {
		const env = parseEnv({});
		expect(() => requireKey("OPENROUTESERVICE_API_KEY", { env })).toThrow(
			/missing env var/,
		);
	});

	it("throws when value is empty string", () => {
		const env = parseEnv({ OPENROUTESERVICE_API_KEY: "" });
		expect(() => requireKey("OPENROUTESERVICE_API_KEY", { env })).toThrow(
			/missing env var/,
		);
	});

	it("includes tool hint in error when context provided", () => {
		const env = parseEnv({});
		expect(() =>
			requireKey("OPENROUTESERVICE_API_KEY", { env, tool: "drive-matrix" }),
		).toThrow(/required by tool: drive-matrix/);
	});

	it("references .env.example in error message", () => {
		const env = parseEnv({});
		expect(() => requireKey("OPENROUTESERVICE_API_KEY", { env })).toThrow(
			/\.env\.example/,
		);
	});
});
