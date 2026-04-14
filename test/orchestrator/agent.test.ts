import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { buildClaudeArgs, runAgent } from "../../src/orchestrator/agent";

describe("runAgent", () => {
	it("captures stdout from a command", async () => {
		const result = await Effect.runPromise(
			runAgent({
				command: "bun",
				args: ["-e", 'console.log("hello from agent")'],
				mode: "print",
			}),
		);
		expect(result.output.trim()).toBe("hello from agent");
		expect(result.exitCode).toBe(0);
	});

	it("captures exit code from failing command", async () => {
		const result = await Effect.runPromise(
			runAgent({
				command: "bun",
				args: ["-e", "throw new Error('test failure')"],
				mode: "print",
			}),
		);
		expect(result.exitCode).toBe(1);
	});
});

describe("buildClaudeArgs", () => {
	it("adds -p flag for print mode", () => {
		const args = buildClaudeArgs({ mode: "print" });
		expect(args).toContain("-p");
	});

	it("does not add -p for interactive mode", () => {
		const args = buildClaudeArgs({ mode: "interactive" });
		expect(args).not.toContain("-p");
	});

	it("adds system prompt when provided", () => {
		const args = buildClaudeArgs({
			mode: "print",
			systemPrompt: "you are a test",
		});
		expect(args).toContain("--append-system-prompt");
		expect(args).toContain("you are a test");
	});

	it("adds input as last arg in print mode", () => {
		const args = buildClaudeArgs({ mode: "print", input: "test input" });
		expect(args[args.length - 1]).toBe("test input");
	});
});
