import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { hubPath as resolveHubPath, topicDir } from "../config";
import { loadTopicCriteria } from "../orchestrator/criteria";
import { gathererPrompt } from "../orchestrator/prompts";
import { parseFrontmatter } from "../parser/frontmatter";
import { parseMarkdown } from "../parser/markdown";

export interface GatherContext {
	questions: string;
	existingSources: string;
	criteria: string;
	topicTitle: string;
}

export async function buildGatherContext(
	labRoot: string,
	slug: string,
): Promise<GatherContext> {
	const hubPath = resolveHubPath(labRoot, slug);
	let questions = "";
	let topicTitle = slug;

	if (existsSync(hubPath)) {
		const raw = await Bun.file(hubPath).text();
		const parsed = parseFrontmatter(raw);
		if (parsed.ok) {
			const title = parsed.value.data.title;
			if (typeof title === "string") {
				topicTitle = title;
			}
			const md = parseMarkdown(parsed.value.content);
			questions = md.sections.get("Questions") ?? "";
		}
	}

	const sourcesDir = join(topicDir(labRoot, slug), "sources");
	const existingTitles: string[] = [];
	if (existsSync(sourcesDir)) {
		const files = await readdir(sourcesDir);
		for (const file of files) {
			if (!file.endsWith(".md")) continue;
			const raw = await Bun.file(join(sourcesDir, file)).text();
			const parsed = parseFrontmatter(raw);
			if (parsed.ok) {
				const title = parsed.value.data.title;
				if (typeof title === "string") {
					existingTitles.push(title);
				}
			}
		}
	}

	const criteria = await loadTopicCriteria(labRoot, slug);
	return {
		questions,
		existingSources: existingTitles.join(", "),
		topicTitle,
		criteria,
	};
}

export async function prepareGather(
	labRoot: string,
	slug: string,
): Promise<string> {
	const context = await buildGatherContext(labRoot, slug);
	const systemPrompt = gathererPrompt(context.criteria);

	return `# Gather Context for: ${context.topicTitle}

## System Prompt

${systemPrompt}

## Topic

${context.topicTitle}

## Questions to Research

${context.questions || "(no questions yet)"}

## Existing Sources (avoid duplicates)

${context.existingSources || "None yet."}

## Working Directory

topics/${slug}/

## Instructions

1. Search for sources related to the questions above
2. For each source found, create a file in topics/${slug}/sources/ with frontmatter:
   type: source, title, url, accessed, status: working, created, updated
3. Extract key points into each source note
4. Add new claims to the hub Findings section with *(unsupported)* or *(single-source)* markers
5. Add new questions to the hub Questions section if gaps emerge
6. Do not modify existing claims or their markers
7. Follow CONVENTIONS.md
`;
}
