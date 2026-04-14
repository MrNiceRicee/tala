import { Effect } from "effect";
import type { AgentExecutor } from "./agent";

export interface PipelineStep {
	name: string;
	receives: readonly string[];
	outputKey: string;
	run: (artifacts: Map<string, string>) => ReturnType<AgentExecutor>;
}

export function runPipeline(
	steps: PipelineStep[],
	initialArtifacts: Map<string, string>,
) {
	const artifacts = new Map(initialArtifacts);
	return Effect.gen(function* () {
		for (const step of steps) {
			const result = yield* step.run(artifacts);
			artifacts.set(step.outputKey, result.output);
		}
		return artifacts;
	});
}
