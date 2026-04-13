import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import { loadConfig, DEFAULT_CONFIG } from "../../src/orchestrator/config"

describe("DEFAULT_CONFIG", () => {
	it("has expected default values", () => {
		expect(DEFAULT_CONFIG.convergenceK).toBe(2)
		expect(DEFAULT_CONFIG.maxPasses).toBe(10)
		expect(DEFAULT_CONFIG.judgeCount).toBe(3)
		expect(DEFAULT_CONFIG.staleAfterDays).toBe(60)
		expect(DEFAULT_CONFIG.warnUnverifiedAfterDays).toBe(30)
	})
})

describe("loadConfig", () => {
	it("returns defaults when no config file exists", () => {
		const config = Effect.runSync(loadConfig("/nonexistent/path"))
		expect(config).toEqual(DEFAULT_CONFIG)
	})
})
