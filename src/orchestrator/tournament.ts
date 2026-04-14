import { Effect, Match, Option } from "effect";
import type { AgentExecutor } from "./agent";
import { runPipeline } from "./pipeline";
import { buildTournamentRound } from "./pipelines";
import { judgePrompt } from "./prompts";

export interface JudgeRanking {
	first: number;
	second: number;
	third: number;
}

export interface RoundResult {
	round: number;
	winner: "A" | "B" | "AB";
	bordaScores: Map<number, number>;
	critique: string;
	challenges: string;
}

export interface TournamentResult {
	converged: boolean;
	rounds: RoundResult[];
	finalSection: string;
	totalRounds: number;
}

export function parseJudgeRanking(output: string): Option.Option<JudgeRanking> {
	const match = output.match(
		/RANK:\s*1st\s*=\s*(\d+)\s*,\s*2nd\s*=\s*(\d+)\s*,\s*3rd\s*=\s*(\d+)/,
	);
	return Option.fromNullOr(match).pipe(
		Option.map((m) => ({
			first: parseInt(m[1], 10),
			second: parseInt(m[2], 10),
			third: parseInt(m[3], 10),
		})),
	);
}

export function computeBordaScores(
	rankings: JudgeRanking[],
): Map<number, number> {
	const scores = new Map<number, number>();
	for (const ranking of rankings) {
		scores.set(ranking.first, (scores.get(ranking.first) ?? 0) + 2);
		scores.set(ranking.second, (scores.get(ranking.second) ?? 0) + 1);
		scores.set(ranking.third, (scores.get(ranking.third) ?? 0) + 0);
	}
	return scores;
}

export function determineWinner(
	scores: Map<number, number>,
	incumbentIdx: number,
): number {
	const incumbentScore = scores.get(incumbentIdx) ?? 0;
	const maxScore = Math.max(0, ...scores.values());
	return Match.value(incumbentScore >= maxScore).pipe(
		Match.when(true, () => incumbentIdx),
		Match.orElse(
			() =>
				[...scores.entries()].find(([, s]) => s === maxScore)?.[0] ??
				incumbentIdx,
		),
	);
}

export function shuffleProposals(
	a: string,
	b: string,
	ab: string,
): { proposals: string[]; indexMap: number[] } {
	const items = [
		{ text: a, originalIdx: 1 },
		{ text: b, originalIdx: 2 },
		{ text: ab, originalIdx: 3 },
	];
	for (let i = items.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const tmp = items[i];
		items[i] = items[j];
		items[j] = tmp;
	}
	return {
		proposals: items.map((item) => item.text),
		indexMap: items.map((item) => item.originalIdx),
	};
}

function labelForOriginalIdx(idx: number): "A" | "B" | "AB" {
	return Match.value(idx).pipe(
		Match.when(1, () => "A" as const),
		Match.when(2, () => "B" as const),
		Match.orElse(() => "AB" as const),
	);
}

export function runTournament(config: {
	section: string;
	sources: string;
	criteria: string;
	maxPasses: number;
	convergenceK: number;
	judgeCount: number;
	executor: AgentExecutor;
	cwd?: string;
}) {
	const {
		section,
		sources,
		criteria,
		maxPasses,
		convergenceK,
		judgeCount,
		executor,
		cwd,
	} = config;
	return Effect.gen(function* () {
		let incumbent = section;
		let streak = 0;
		const rounds: RoundResult[] = [];
		let round = 1;

		while (round <= maxPasses && streak < convergenceK) {
			const pipelineSteps = buildTournamentRound(criteria, executor);
			const initialArtifacts = new Map([
				["section", incumbent],
				["sources", sources],
				["criteria", criteria],
			]);

			const artifacts = yield* runPipeline(pipelineSteps, initialArtifacts);
			const revisionB = artifacts.get("revisionB") ?? "";
			const synthesisAB = artifacts.get("synthesisAB") ?? "";
			const critique = artifacts.get("critique") ?? "";
			const challenges = artifacts.get("challenges") ?? "";

			const shuffled = shuffleProposals(incumbent, revisionB, synthesisAB);
			const judgeInput = shuffled.proposals
				.map((text, i) => `## Proposal ${i + 1}\n\n${text}`)
				.join("\n\n---\n\n");

			const judgeSystemPrompt = judgePrompt(criteria);
			const rankings: JudgeRanking[] = [];

			for (let j = 0; j < judgeCount; j++) {
				const result = yield* executor({
					mode: "print",
					systemPrompt: judgeSystemPrompt,
					input: judgeInput,
					cwd,
				});
				Option.map(parseJudgeRanking(result.output), (ranking) => {
					rankings.push({
						first: shuffled.indexMap[ranking.first - 1],
						second: shuffled.indexMap[ranking.second - 1],
						third: shuffled.indexMap[ranking.third - 1],
					});
				});
			}

			const scores = computeBordaScores(rankings);
			const winnerOriginalIdx = determineWinner(scores, 1);
			const winnerLabel = labelForOriginalIdx(winnerOriginalIdx);

			rounds.push({
				round,
				winner: winnerLabel,
				bordaScores: scores,
				critique,
				challenges,
			});

			streak = Match.value(winnerOriginalIdx === 1).pipe(
				Match.when(true, () => streak + 1),
				Match.orElse(() => 0),
			);
			incumbent = Match.value(winnerOriginalIdx).pipe(
				Match.when(1, () => incumbent),
				Match.when(2, () => revisionB),
				Match.orElse(() => synthesisAB),
			);
			round++;
		}

		return {
			converged: streak >= convergenceK,
			rounds,
			finalSection: incumbent,
			totalRounds: round - 1,
		};
	});
}
