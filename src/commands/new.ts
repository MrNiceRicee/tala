import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface CreateTopicResult {
	success: boolean;
	slug: string;
	path: string;
	error?: string;
}

export function slugify(text: string): string {
	return (
		text
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "") || "topic"
	);
}

function today(): string {
	return new Date().toISOString().split("T")[0];
}

function generateHub(title: string, slug: string): string {
	const date = today();
	return `---
type: hub
title: ${title}
slug: ${slug}
status: working
tags: []
created: ${date}
updated: ${date}
---

# ${title}

## Intent



## Questions

-

## Findings



## Open

-

## Related

-
`;
}

export async function createTopic(
	labRoot: string,
	title: string,
): Promise<CreateTopicResult> {
	const slug = slugify(title);
	const topicDir = join(labRoot, "topics", slug);

	if (existsSync(topicDir)) {
		return {
			success: false,
			slug,
			path: topicDir,
			error: `topic already exists: ${topicDir}`,
		};
	}

	await mkdir(topicDir, { recursive: true });
	await mkdir(join(topicDir, "sources"), { recursive: true });
	await mkdir(join(topicDir, "computations"), { recursive: true });

	const hubPath = join(topicDir, `${slug}.md`);
	await Bun.write(hubPath, generateHub(title, slug));

	return { success: true, slug, path: topicDir };
}
