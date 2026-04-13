import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { loadConfig } from "../orchestrator/config";
import { loadTopicCriteria } from "../orchestrator/criteria";
import {
	adversaryPrompt,
	criticPrompt,
	judgePrompt,
	reviserPrompt,
	synthesizerPrompt,
} from "../orchestrator/prompts";
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
		if (parsed.ok) {
			const md = parseMarkdown(parsed.value.content);
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

export async function prepareRefine(
	labRoot: string,
	slug: string,
	sectionName: string,
): Promise<string> {
	const context = await buildRefineContext(labRoot, slug, sectionName);
	const config = Effect.runSync(loadConfig(labRoot));

	if (!context.section) {
		return `Section "${sectionName}" is empty or not found in ${slug}.`;
	}

	return `# Refine Tournament Protocol for: ${slug}

## Section to Refine: ${sectionName}

${context.section}

## Source Notes

${context.sources || "No sources available."}

## Evaluation Criteria

${context.criteria}

## Agent Prompts

### Critic (constructive, fresh agent)
${criticPrompt(context.criteria)}

### Adversary (destructive, fresh agent — must cite evidence for objections)
${adversaryPrompt(context.criteria)}

### Reviser (fresh agent)
${reviserPrompt(context.criteria)}

### Synthesizer (fresh agent)
${synthesizerPrompt()}

### Judge (3-${config.judgeCount} fresh agents, each sees shuffled anonymous proposals)
${judgePrompt(context.criteria)}

## Tournament Rules

1. Each round: critic → adversary → reviser → synthesizer → judges
2. Critic receives: the section + criteria
3. Adversary receives: the section + source notes. Must cite evidence for objections.
4. Reviser receives: section (A) + critique + adversary challenges → produces revision (B)
5. Synthesizer receives: A + B → produces synthesis (AB)
6. Judges receive: A, B, AB in RANDOMIZED ORDER with anonymous labels (Proposal 1, 2, 3)
7. Each judge outputs: RANK: 1st=N, 2nd=N, 3rd=N
8. Scoring: Borda count (1st=2pts, 2nd=1pt, 3rd=0pt)
9. Winner becomes new incumbent
10. If incumbent (A) wins ${config.convergenceK} consecutive rounds → CONVERGE
11. Tiebreak favors incumbent
12. Maximum ${config.maxPasses} rounds

## After Convergence

Run: bun run lab refine apply ${slug} --section "${sectionName}"
Then provide the final refined section text via stdin.
`;
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

export async function applyRefine(
	labRoot: string,
	slug: string,
	sectionName: string,
	refinedSection: string,
	logContent?: string,
): Promise<void> {
	const hubPath = join(labRoot, "topics", slug, `${slug}.md`);
	if (!existsSync(hubPath)) {
		throw new Error(`hub not found: ${hubPath}`);
	}

	const hubContent = await Bun.file(hubPath).text();
	const updated = replaceSectionInHub(hubContent, sectionName, refinedSection);
	await Bun.write(hubPath, updated);

	if (logContent) {
		const logPath = join(labRoot, "topics", slug, "refine-log.md");
		await Bun.write(logPath, logContent);
	}
}
