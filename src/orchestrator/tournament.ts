import { Effect } from "effect";
import { runClaudeAgent } from "./agent";
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

export function parseJudgeRanking(output: string): JudgeRanking | null {
	const match = output.match(
		/RANK:\s*1st\s*=\s*(\d+)\s*,\s*2nd\s*=\s*(\d+)\s*,\s*3rd\s*=\s*(\d+)/,
	);
	if (!match) return null;
	return {
		first: parseInt(match[1], 10),
		second: parseInt(match[2], 10),
		third: parseInt(match[3], 10),
	};
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
	let bestIdx = incumbentIdx;
	let bestScore = scores.get(incumbentIdx) ?? 0;
	for (const [idx, score] of scores) {
		if (score > bestScore) {
			bestScore = score;
			bestIdx = idx;
		}
	}
	return bestIdx;
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
	if (idx === 1) return "A";
	if (idx === 2) return "B";
	return "AB";
}

export function runTournament(config: {
	section: string;
	sources: string;
	criteria: string;
	maxPasses: number;
	convergenceK: number;
	judgeCount: number;
	cwd?: string;
}): Effect.Effect<TournamentResult> {
	return Effect.gen(function* () {
		let incumbent = config.section;
		let streak = 0;
		const rounds: RoundResult[] = [];

		for (let round = 1; round <= config.maxPasses; round++) {
			const pipelineSteps = buildTournamentRound(config.criteria);
			const initialArtifacts = new Map([
				["section", incumbent],
				["sources", config.sources],
				["criteria", config.criteria],
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

			const judgeSystemPrompt = judgePrompt(config.criteria);
			const rankings: JudgeRanking[] = [];

			for (let j = 0; j < config.judgeCount; j++) {
				const result = yield* runClaudeAgent({
					mode: "print",
					systemPrompt: judgeSystemPrompt,
					input: judgeInput,
					cwd: config.cwd,
				});
				const ranking = parseJudgeRanking(result.output);
				if (ranking) {
					rankings.push({
						first: shuffled.indexMap[ranking.first - 1],
						second: shuffled.indexMap[ranking.second - 1],
						third: shuffled.indexMap[ranking.third - 1],
					});
				}
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

			if (winnerOriginalIdx === 1) {
				streak++;
			} else {
				streak = 0;
				if (winnerOriginalIdx === 2) incumbent = revisionB;
				else incumbent = synthesisAB;
			}

			if (streak >= config.convergenceK) {
				return {
					converged: true,
					rounds,
					finalSection: incumbent,
					totalRounds: round,
				};
			}
		}

		return {
			converged: false,
			rounds,
			finalSection: incumbent,
			totalRounds: config.maxPasses,
		};
	});
}
