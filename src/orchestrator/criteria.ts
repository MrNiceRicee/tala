import { join } from "node:path"
import { existsSync } from "node:fs"
import { Either } from "effect"
import { parseFrontmatter } from "../parser/frontmatter"

export interface CriteriaSet {
	[category: string]: readonly string[]
}

export const GLOBAL_CRITERIA: CriteriaSet = {
	evidence: [
		"claims must cite specific sources",
		"numerical data requires computation or citation",
		"contradictions between sources must be flagged",
	],
	quality: [
		"no fabricated citations",
		"distinguish facts from inference",
		"mark uncertainty explicitly",
	],
}

export const DOMAIN_CRITERIA: Record<string, CriteriaSet> = {
	software: {
		security: ["injection attack vectors", "authentication bypass risks", "input validation coverage"],
		correctness: ["follows established conventions", "low cyclomatic complexity", "edge cases identified"],
	},
	travel: {
		accuracy: ["prices verified with dates noted", "seasonal availability flagged", "currency and exchange rates cited"],
	},
	pharmacy: {
		rigor: ["clinical trial references required", "dosage claims need official source", "drug interaction data from authoritative databases"],
	},
}

export function mergeCriteria(domain?: string, topicCriteria?: CriteriaSet): CriteriaSet {
	const merged: Record<string, string[]> = {}
	for (const [category, items] of Object.entries(GLOBAL_CRITERIA)) {
		merged[category] = [...items]
	}
	if (domain && DOMAIN_CRITERIA[domain]) {
		for (const [category, items] of Object.entries(DOMAIN_CRITERIA[domain])) {
			merged[category] = merged[category] ? [...merged[category], ...items] : [...items]
		}
	}
	if (topicCriteria) {
		for (const [category, items] of Object.entries(topicCriteria)) {
			merged[category] = merged[category] ? [...merged[category], ...items] : [...items]
		}
	}
	return merged
}

export function renderCriteria(criteria: CriteriaSet): string {
	const lines: string[] = []
	for (const [category, items] of Object.entries(criteria)) {
		lines.push(`${category}:`)
		for (const item of items) { lines.push(`  - ${item}`) }
		lines.push("")
	}
	return lines.join("\n")
}

function parseTopicCriteriaFile(content: string): CriteriaSet {
	const criteria: Record<string, string[]> = {}
	let currentCategory: string | null = null
	for (const line of content.split("\n")) {
		const headingMatch = line.match(/^##\s+(.+)$/)
		if (headingMatch) {
			currentCategory = headingMatch[1].trim().toLowerCase()
			criteria[currentCategory] = []
			continue
		}
		if (currentCategory && line.trim().startsWith("- ")) {
			criteria[currentCategory].push(line.trim().slice(2))
		}
	}
	return criteria
}

export async function loadTopicCriteria(labRoot: string, slug: string): Promise<string> {
	const hubPath = join(labRoot, "topics", slug, `${slug}.md`)
	let domain: string | undefined
	if (existsSync(hubPath)) {
		const raw = await Bun.file(hubPath).text()
		const parsed = parseFrontmatter(raw)
		if (Either.isRight(parsed)) {
			const domainValue = parsed.right.data.domain
			if (typeof domainValue === "string") { domain = domainValue }
		}
	}
	let topicCriteria: CriteriaSet | undefined
	const criteriaPath = join(labRoot, "topics", slug, "criteria.md")
	if (existsSync(criteriaPath)) {
		const raw = await Bun.file(criteriaPath).text()
		const parsed = parseFrontmatter(raw)
		const content = Either.isRight(parsed) ? parsed.right.content : raw
		topicCriteria = parseTopicCriteriaFile(content)
	}
	const merged = mergeCriteria(domain, topicCriteria)
	return renderCriteria(merged)
}
