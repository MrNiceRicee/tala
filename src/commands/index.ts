import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseFrontmatter } from "../parser/frontmatter";

export interface IndexResult {
	topicCount: number;
	path: string;
}

interface TopicEntry {
	title: string;
	slug: string;
	status: string;
}

function today(): string {
	return new Date().toISOString().split("T")[0];
}

export async function refreshIndex(labRoot: string): Promise<IndexResult> {
	const topicsDir = join(labRoot, "topics");
	const indexPath = join(topicsDir, "index.md");
	const entries: TopicEntry[] = [];

	if (!existsSync(topicsDir)) {
		return { topicCount: 0, path: indexPath };
	}

	const dirs = await readdir(topicsDir, { withFileTypes: true });
	for (const dir of dirs.sort((a, b) => a.name.localeCompare(b.name))) {
		if (!dir.isDirectory() || dir.name === "_template") continue;

		const hubPath = join(topicsDir, dir.name, `${dir.name}.md`);
		if (!existsSync(hubPath)) continue;

		const raw = await Bun.file(hubPath).text();
		const parsed = parseFrontmatter(raw);

		if (parsed.ok) {
			entries.push({
				title: parsed.value.data.title as string,
				slug: dir.name,
				status: parsed.value.data.status as string,
			});
		}
	}

	const grouped: Record<string, TopicEntry[]> = {};
	for (const entry of entries) {
		const group = entry.status;
		if (!grouped[group]) grouped[group] = [];
		grouped[group].push(entry);
	}

	const statusOrder = ["working", "sketch", "distilled"];
	const date = today();

	let content = `---
type: index
title: Topics Index
slug: topics-index
created: ${date}
updated: ${date}
---

# Topics Index

`;

	for (const status of statusOrder) {
		const topics = grouped[status];
		if (!topics || topics.length === 0) continue;

		const heading = status.charAt(0).toUpperCase() + status.slice(1);
		content += `## ${heading}\n\n`;
		for (const t of topics) {
			content += `- [[${t.slug}/${t.slug}|${t.title}]]\n`;
		}
		content += "\n";
	}

	await Bun.write(indexPath, content);

	return { topicCount: entries.length, path: indexPath };
}
