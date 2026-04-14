import { Effect } from "effect";
import type { AgentResult } from "./agent";

export interface PipelineStep {
	name: string;
	receives: readonly string[];
	outputKey: string;
	run: (artifacts: Map<string, string>) => Effect.Effect<AgentResult>;
}

export function runPipeline(
	steps: PipelineStep[],
	initialArtifacts: Map<string, string>,
): Effect.Effect<Map<string, string>> {
	return Effect.gen(function* () {
		const artifacts = new Map(initialArtifacts);
		for (const step of steps) {
			const result = yield* step.run(artifacts);
			artifacts.set(step.outputKey, result.output);
		}
		return artifacts;
	});
}
