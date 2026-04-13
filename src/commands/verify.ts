import { existsSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { runClaudeAgent } from "../orchestrator/agent";
import { loadTopicCriteria } from "../orchestrator/criteria";
import {
	verifierCheckPrompt,
	verifierSearchPrompt,
} from "../orchestrator/prompts";
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

export async function runVerify(
	labRoot: string,
	slug: string,
	options: { rounds: number; visible?: boolean },
): Promise<{
	claimsChecked: number;
	markersChanged: number;
	roundsCompleted: number;
}> {
	let totalChecked = 0;
	let totalChanged = 0;
	let roundsCompleted = 0;
	const topicDir = join(labRoot, "topics", slug);

	for (let round = 1; round <= options.rounds; round++) {
		console.log(`verify round ${round}/${options.rounds}...`);
		const claims = await extractClaimsForVerification(labRoot, slug);
		const criteria = await loadTopicCriteria(labRoot, slug);
		let changedThisRound = 0;

		for (const claim of claims.withSources) {
			const sourcePath = join(topicDir, `${claim.sourceTarget}.md`);
			if (!existsSync(sourcePath)) continue;
			const sourceText = await Bun.file(sourcePath).text();
			const systemPrompt = verifierCheckPrompt(criteria);
			const input = `Claim: "${claim.text}"\n\nSource content:\n${sourceText}`;

			const result = await Effect.runPromise(
				runClaudeAgent({ mode: "print", systemPrompt, input, cwd: topicDir }),
			);
			totalChecked++;
			if (result.output.includes("CONTRADICTED")) {
				changedThisRound++;
				console.log(`  CONTRADICTED: ${claim.text.slice(0, 60)}`);
			} else if (result.output.includes("PARTIAL")) {
				console.log(`  PARTIAL: ${claim.text.slice(0, 60)}`);
			}
		}

		if (claims.needingCorroboration.length > 0) {
			const claimTexts = claims.needingCorroboration.map((c) => c.text);
			const systemPrompt = verifierSearchPrompt(criteria, claimTexts);
			await Effect.runPromise(
				runClaudeAgent({
					mode: "interactive",
					systemPrompt,
					input: `Search for evidence for these ${claimTexts.length} claims. Work in the topic directory.`,
					cwd: topicDir,
					visible: options.visible,
				}),
			);
		}

		totalChanged += changedThisRound;
		roundsCompleted = round;
		if (changedThisRound === 0 && claims.needingCorroboration.length === 0) {
			console.log(`round ${round}: no changes, stopping early`);
			break;
		}
	}

	return {
		claimsChecked: totalChecked,
		markersChanged: totalChanged,
		roundsCompleted,
	};
}
