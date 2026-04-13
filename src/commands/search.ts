import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseFrontmatter } from "../parser/frontmatter";

export interface SearchHit {
	file: string;
	title: string;
	status: string;
	line: number;
	context: string;
}

const statusRank: Record<string, number> = {
	distilled: 0,
	working: 1,
	sketch: 2,
};

async function searchDir(
	dir: string,
	basePath: string,
	query: string,
): Promise<SearchHit[]> {
	const hits: SearchHit[] = [];
	if (!existsSync(dir)) return hits;

	const files = await readdir(dir, { withFileTypes: true });

	for (const file of files) {
		const filePath = join(dir, file.name);
		if (file.isDirectory()) {
			hits.push(
				...(await searchDir(filePath, `${basePath}/${file.name}`, query)),
			);
			continue;
		}
		if (!file.name.endsWith(".md")) continue;

		const raw = await Bun.file(filePath).text();
		const parsed = parseFrontmatter(raw);
		const title = parsed.ok ? (parsed.value.data.title as string) : file.name;
		const status = parsed.ok ? (parsed.value.data.status as string) : "sketch";

		const lines = raw.split("\n");
		const lowerQuery = query.toLowerCase();

		for (let i = 0; i < lines.length; i++) {
			if (lines[i].toLowerCase().includes(lowerQuery)) {
				hits.push({
					file: `${basePath}/${file.name}`,
					title,
					status,
					line: i + 1,
					context: lines[i].trim().slice(0, 120),
				});
			}
		}
	}

	return hits;
}

export async function search(
	labRoot: string,
	query: string,
): Promise<SearchHit[]> {
	const topicsDir = join(labRoot, "topics");
	const hits = await searchDir(topicsDir, "topics", query);

	return hits.sort(
		(a, b) => (statusRank[a.status] ?? 3) - (statusRank[b.status] ?? 3),
	);
}
