import { validateAll } from "../validation/rules"

export async function runCheck(labRoot: string): Promise<{
	report: string
	issueCount: number
}> {
	const results = await validateAll(labRoot)

	let issueCount = 0
	const lines: string[] = []

	for (const [topic, issues] of results) {
		const relevant = issues.filter(
			(i) =>
				i.rule === "bare-claim" ||
				i.rule === "stale-file" ||
				i.severity === "info",
		)
		if (relevant.length === 0) continue

		lines.push(`topics/${topic}/`)
		for (const issue of relevant) {
			lines.push(`  ${issue.severity} ${issue.file}: ${issue.message}`)
			issueCount++
		}
		lines.push("")
	}

	return {
		report: lines.join("\n"),
		issueCount,
	}
}
