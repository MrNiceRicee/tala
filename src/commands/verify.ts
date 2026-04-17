import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadTopicCriteria } from "../orchestrator/criteria";
import { verifierSearchPrompt } from "../orchestrator/prompts";
import { parseFrontmatter } from "../parser/frontmatter";
import { extractWikilinks, parseMarkdown } from "../parser/markdown";

interface ClaimWithSource {
	text: string;
	sourceTarget: string;
	lineNumber: number;
}

interface ClaimNeedingCorroboration {
	text: string;
	marker: string;
	lineNumber: number;
}

export interface VerificationClaims {
	withSources: ClaimWithSource[];
	needingCorroboration: ClaimNeedingCorroboration[];
}

export async function extractClaimsForVerification(
	labRoot: string,
	slug: string,
): Promise<VerificationClaims> {
	const hubPath = join(labRoot, "topics", slug, `${slug}.md`);
	const withSources: ClaimWithSource[] = [];
	const needingCorroboration: ClaimNeedingCorroboration[] = [];

	if (!existsSync(hubPath)) return { withSources, needingCorroboration };

	const raw = await Bun.file(hubPath).text();
	const parsed = parseFrontmatter(raw);
	if (!parsed.ok) return { withSources, needingCorroboration };

	const md = parseMarkdown(parsed.value.content);
	const findings = md.sections.get("Findings");
	if (!findings) return { withSources, needingCorroboration };

	const lines = findings.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const trimmed = lines[i].trim();
		if (!trimmed.startsWith("- ") || trimmed === "- ") continue;
		const claim = trimmed.slice(2);
		const wikilinks = extractWikilinks(claim);

		if (wikilinks.length > 0) {
			withSources.push({
				text: claim,
				sourceTarget: wikilinks[0].target,
				lineNumber: i + 1,
			});
		}

		if (/\*\(unsupported\)\*/.test(claim)) {
			needingCorroboration.push({
				text: claim,
				marker: "unsupported",
				lineNumber: i + 1,
			});
		} else if (/\*\(single-source\)\*/.test(claim)) {
			needingCorroboration.push({
				text: claim,
				marker: "single-source",
				lineNumber: i + 1,
			});
		}
	}

	return { withSources, needingCorroboration };
}

export interface SourceCheckResult {
	claim: string;
	source: string;
	verdict: "supported" | "no-source-file";
}

export async function runSourceCheck(
	labRoot: string,
	slug: string,
): Promise<SourceCheckResult[]> {
	const claims = await extractClaimsForVerification(labRoot, slug);
	const results: SourceCheckResult[] = [];
	const topicDir = join(labRoot, "topics", slug);

	for (const claim of claims.withSources) {
		const sourcePath = join(topicDir, `${claim.sourceTarget}.md`);
		if (!existsSync(sourcePath)) {
			results.push({
				claim: claim.text,
				source: claim.sourceTarget,
				verdict: "no-source-file",
			});
		} else {
			results.push({
				claim: claim.text,
				source: claim.sourceTarget,
				verdict: "supported",
			});
		}
	}

	return results;
}

export async function prepareVerify(
	labRoot: string,
	slug: string,
): Promise<string> {
	const claims = await extractClaimsForVerification(labRoot, slug);
	const criteria = await loadTopicCriteria(labRoot, slug);
	const sourceChecks = await runSourceCheck(labRoot, slug);

	const claimTexts = claims.needingCorroboration.map((c) => c.text);
	const systemPrompt =
		claimTexts.length > 0 ? verifierSearchPrompt(criteria, claimTexts) : "";

	const sourceCheckReport = sourceChecks
		.map((r) => `- ${r.verdict}: "${r.claim.slice(0, 60)}" → ${r.source}`)
		.join("\n");

	return `# Verify Context for: ${slug}

## Source-Content Check (automated)

${sourceCheckReport || "No claims with source links found."}

## Claims Needing Corroboration

${claimTexts.length > 0 ? claimTexts.map((c, i) => `${i + 1}. ${c}`).join("\n") : "All claims are verified or have no sources to check."}

${systemPrompt ? `## System Prompt for Corroboration Search\n\n${systemPrompt}` : ""}

## Working Directory

topics/${slug}/

## Instructions

${
	claimTexts.length > 0
		? `1. For each claim above, search for corroborating or contradicting evidence
2. If you find a source, create a source note in topics/${slug}/sources/
3. Update claim markers in the hub based on what you find
4. Follow CONVENTIONS.md`
		: "No corroboration search needed - all claims are addressed."
}
`;
}
