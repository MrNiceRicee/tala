import type { ValidationIssue, Severity } from "./rules"

const severityOrder: Record<Severity, number> = { error: 0, warn: 1, info: 2 }

export function formatReport(results: Map<string, ValidationIssue[]>): string {
	if (results.size === 0) return ""

	const lines: string[] = []

	for (const [topic, issues] of results) {
		lines.push(`topics/${topic}/`)

		const sorted = [...issues].sort(
			(a, b) => severityOrder[a.severity] - severityOrder[b.severity],
		)

		for (const issue of sorted) {
			const loc = issue.line ? `${issue.file}:${issue.line}` : issue.file
			lines.push(`  ${issue.severity} [${issue.rule}] ${loc}: ${issue.message}`)
		}

		lines.push("")
	}

	return lines.join("\n")
}

export function worstSeverity(
	results: Map<string, ValidationIssue[]>,
): Severity | null {
	let worst: Severity | null = null
	for (const issues of results.values()) {
		for (const issue of issues) {
			if (issue.severity === "error") return "error"
			if (issue.severity === "warn") worst = "warn"
			if (issue.severity === "info" && worst === null) worst = "info"
		}
	}
	return worst
}
