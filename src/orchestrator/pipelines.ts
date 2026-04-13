import type { AgentExecutor } from "./agent";
import type { PipelineStep } from "./pipeline";
import {
	adversaryPrompt,
	criticPrompt,
	reviserPrompt,
	synthesizerPrompt,
} from "./prompts";

export function buildTournamentRound(
	criteria: string,
	executor: AgentExecutor,
): PipelineStep[] {
	return [
		{
			name: "critic",
			receives: ["section", "criteria"],
			outputKey: "critique",
			run: (artifacts) =>
				executor({
					mode: "print",
					systemPrompt: criticPrompt(criteria),
					input: `Review this section:\n\n${artifacts.get("section") ?? ""}`,
				}),
		},
		{
			name: "adversary",
			receives: ["section", "sources"],
			outputKey: "challenges",
			run: (artifacts) =>
				executor({
					mode: "print",
					systemPrompt: adversaryPrompt(criteria),
					input: `Section:\n${artifacts.get("section") ?? ""}\n\nSource notes:\n${artifacts.get("sources") ?? ""}`,
				}),
		},
		{
			name: "reviser",
			receives: ["section", "critique", "challenges"],
			outputKey: "revisionB",
			run: (artifacts) =>
				executor({
					mode: "print",
					systemPrompt: reviserPrompt(criteria),
					input: `Section A:\n${artifacts.get("section") ?? ""}\n\nCritique:\n${artifacts.get("critique") ?? ""}\n\nAdversary challenges:\n${artifacts.get("challenges") ?? ""}`,
				}),
		},
		{
			name: "synthesizer",
			receives: ["section", "revisionB"],
			outputKey: "synthesisAB",
			run: (artifacts) =>
				executor({
					mode: "print",
					systemPrompt: synthesizerPrompt(),
					input: `Version A:\n${artifacts.get("section") ?? ""}\n\nVersion B:\n${artifacts.get("revisionB") ?? ""}`,
				}),
		},
	];
}
