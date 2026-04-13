import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { defaultExecutor } from "../orchestrator/agent";
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
	const hubPath = join(labRoot, "topics", slug, `${slug}.md`);
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

	const sourcesDir = join(labRoot, "topics", slug, "sources");
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

export async function runGather(
	labRoot: string,
	slug: string,
	options: { rounds: number; visible?: boolean },
): Promise<{ sourcesAdded: number; roundsCompleted: number }> {
	let totalSourcesAdded = 0;
	let roundsCompleted = 0;
	const topicDir = join(labRoot, "topics", slug);

	for (let round = 1; round <= options.rounds; round++) {
		const context = await buildGatherContext(labRoot, slug);
		const systemPrompt = gathererPrompt(context.criteria);
		const input = [
			`Topic: ${context.topicTitle}`,
			"",
			"Questions to research:",
			context.questions || "(no questions yet)",
			"",
			context.existingSources
				? `Existing sources (avoid duplicates): ${context.existingSources}`
				: "No existing sources yet.",
		].join("\n");

		console.log(`gather round ${round}/${options.rounds}...`);

		await Effect.runPromise(
			defaultExecutor({
				mode: "interactive",
				systemPrompt,
				input,
				cwd: topicDir,
				visible: options.visible,
			}),
		);

		const afterContext = await buildGatherContext(labRoot, slug);
		const beforeCount = context.existingSources
			? context.existingSources.split(", ").filter(Boolean).length
			: 0;
		const afterCount = afterContext.existingSources
			? afterContext.existingSources.split(", ").filter(Boolean).length
			: 0;
		const added = afterCount - beforeCount;

		totalSourcesAdded += added;
		roundsCompleted = round;

		if (added === 0) {
			console.log(`round ${round}: no new sources found, stopping early`);
			break;
		}
		console.log(`round ${round}: ${added} new source(s) added`);
	}

	return { sourcesAdded: totalSourcesAdded, roundsCompleted };
}
