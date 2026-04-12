import { formatReport, worstSeverity } from "../validation/report";
import { validateAll, validateTopic } from "../validation/rules";

export interface ValidationResult {
	totalIssues: number;
	report: string;
	exitCode: number;
}

export async function runValidation(
	labRoot: string,
	slug?: string,
): Promise<ValidationResult> {
	const results = slug
		? new Map([[slug, await validateTopic(labRoot, slug)]])
		: await validateAll(labRoot);

	for (const [key, issues] of results) {
		if (issues.length === 0) results.delete(key);
	}

	let totalIssues = 0;
	for (const issues of results.values()) {
		totalIssues += issues.length;
	}

	const report = formatReport(results);
	const worst = worstSeverity(results);
	const exitCode = worst === "error" ? 1 : 0;

	return { totalIssues, report, exitCode };
}
