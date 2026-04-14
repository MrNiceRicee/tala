import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import {
	type PipelineStep,
	runPipeline,
} from "../../src/orchestrator/pipeline";

describe("runPipeline", () => {
	it("runs steps sequentially and accumulates artifacts", async () => {
		const steps: PipelineStep[] = [
			{
				name: "step1",
				receives: ["input"],
				outputKey: "step1_out",
				run: (artifacts) =>
					Effect.succeed({
						output: `processed: ${artifacts.get("input")}`,
						stderr: "",
						exitCode: 0,
					}),
			},
			{
				name: "step2",
				receives: ["step1_out"],
				outputKey: "step2_out",
				run: (artifacts) =>
					Effect.succeed({
						output: `final: ${artifacts.get("step1_out")}`,
						stderr: "",
						exitCode: 0,
					}),
			},
		];
		const initial = new Map([["input", "hello"]]);
		const result = await Effect.runPromise(runPipeline(steps, initial));
		expect(result.get("step1_out")).toBe("processed: hello");
		expect(result.get("step2_out")).toBe("final: processed: hello");
	});

	it("preserves initial artifacts", async () => {
		const steps: PipelineStep[] = [
			{
				name: "step1",
				receives: ["input"],
				outputKey: "out",
				run: () => Effect.succeed({ output: "done", stderr: "", exitCode: 0 }),
			},
		];
		const initial = new Map([["input", "preserved"]]);
		const result = await Effect.runPromise(runPipeline(steps, initial));
		expect(result.get("input")).toBe("preserved");
		expect(result.get("out")).toBe("done");
	});

	it("handles empty pipeline", async () => {
		const result = await Effect.runPromise(
			runPipeline([], new Map([["x", "y"]])),
		);
		expect(result.get("x")).toBe("y");
	});
});
