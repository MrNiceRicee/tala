import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { Effect, Either } from "effect";
import { loadConfig } from "../orchestrator/config";
import { loadTopicCriteria } from "../orchestrator/criteria";
import {
	runTournament,
	type TournamentResult,
} from "../orchestrator/tournament";
import { parseFrontmatter } from "../parser/frontmatter";
import { extractWikilinks, parseMarkdown } from "../parser/markdown";

export interface RefineContext {
	section: string;
	sources: string;
	criteria: string;
	hubContent: string;
	sectionName: string;
}

export async function buildRefineContext(
	labRoot: string,
	slug: string,
	sectionName: string,
): Promise<RefineContext> {
	const hubPath = join(labRoot, "topics", slug, `${slug}.md`);
	let section = "";
	let hubContent = "";

	if (existsSync(hubPath)) {
		const raw = await Bun.file(hubPath).text();
		hubContent = raw;
		const parsed = parseFrontmatter(raw);
		if (Either.isRight(parsed)) {
			const md = parseMarkdown(parsed.right.content);
			section = md.sections.get(sectionName) ?? "";
		}
	}

	const wikilinks = extractWikilinks(section);
	const sourceTexts: string[] = [];
	const topicDir = join(labRoot, "topics", slug);

	for (const link of wikilinks) {
		const sourcePath = join(topicDir, `${link.target}.md`);
		if (existsSync(sourcePath)) {
			const text = await Bun.file(sourcePath).text();
			sourceTexts.push(`--- ${link.target} ---\n${text}`);
		}
	}

	if (sourceTexts.length === 0) {
		const sourcesDir = join(topicDir, "sources");
		if (existsSync(sourcesDir)) {
			const files = await readdir(sourcesDir);
			for (const file of files) {
				if (!file.endsWith(".md")) continue;
				const text = await Bun.file(join(sourcesDir, file)).text();
				sourceTexts.push(`--- sources/${file} ---\n${text}`);
			}
		}
	}

	const criteria = await loadTopicCriteria(labRoot, slug);
	return {
		section,
		sources: sourceTexts.join("\n\n"),
		criteria,
		hubContent,
		sectionName,
	};
}

function generateRefineLog(
	slug: string,
	sectionName: string,
	result: TournamentResult,
): string {
	const date = new Date().toISOString().split("T")[0];
	const lines = [
		"---",
		"type: refine-log",
		`title: Refine Log — ${slug}`,
		`topic_slug: ${slug}`,
		`section: ${sectionName}`,
		`created: ${date}`,
		"---",
		"",
		`# Refine Log — ${slug} (${sectionName})`,
		"",
	];
	for (const round of result.rounds) {
		lines.push(`## Round ${round.round}`, "");
		lines.push(
			`**Critic:** ${round.critique.slice(0, 200).replace(/\n/g, " ")}`,
		);
		lines.push(
			`**Adversary:** ${round.challenges.slice(0, 200).replace(/\n/g, " ")}`,
		);
		lines.push(`**Winner:** ${round.winner}`);
		const scoreEntries: string[] = [];
		for (const [idx, score] of round.bordaScores) {
			const label = idx === 1 ? "A" : idx === 2 ? "B" : "AB";
			scoreEntries.push(`${label}=${score}`);
		}
		lines.push(`**Borda scores:** ${scoreEntries.join(", ")}`, "");
	}
	lines.push(
		result.converged
			? `**CONVERGED** after ${result.totalRounds} rounds.`
			: `**Did not converge** after ${result.totalRounds} rounds (max reached).`,
	);
	lines.push("");
	return lines.join("\n");
}

function replaceSectionInHub(
	hubContent: string,
	sectionName: string,
	newSection: string,
): string {
	const lines = hubContent.split("\n");
	const result: string[] = [];
	let inTargetSection = false;
	let replaced = false;
	for (const line of lines) {
		const headingMatch = line.match(/^## (.+)$/);
		if (headingMatch) {
			if (headingMatch[1].trim() === sectionName) {
				inTargetSection = true;
				result.push(line, "", newSection);
				replaced = true;
				continue;
			}
			if (inTargetSection) {
				inTargetSection = false;
			}
		}
		if (!inTargetSection) {
			result.push(line);
		}
	}
	if (!replaced) {
		result.push(`\n## ${sectionName}\n\n${newSection}`);
	}
	return result.join("\n");
}

export async function runRefine(
	labRoot: string,
	slug: string,
	options: { section: string; maxPasses?: number; visible?: boolean },
): Promise<TournamentResult> {
	const context = await buildRefineContext(labRoot, slug, options.section);
	const config = Effect.runSync(loadConfig(labRoot));

	if (!context.section) {
		console.log(`section "${options.section}" is empty or not found`);
		return { converged: true, rounds: [], finalSection: "", totalRounds: 0 };
	}

	console.log(`refining "${options.section}" section of ${slug}...`);

	const result = await Effect.runPromise(
		runTournament({
			section: context.section,
			sources: context.sources,
			criteria: context.criteria,
			maxPasses: options.maxPasses ?? config.maxPasses,
			convergenceK: config.convergenceK,
			judgeCount: config.judgeCount,
			cwd: join(labRoot, "topics", slug),
		}),
	);

	if (result.finalSection) {
		const hubPath = join(labRoot, "topics", slug, `${slug}.md`);
		const updatedHub = replaceSectionInHub(
			context.hubContent,
			options.section,
			result.finalSection,
		);
		await Bun.write(hubPath, updatedHub);
	}

	const logContent = generateRefineLog(slug, options.section, result);
	const logPath = join(labRoot, "topics", slug, "refine-log.md");
	await Bun.write(logPath, logContent);

	return result;
}
