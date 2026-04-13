import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { Either } from "effect";
import { parseFrontmatter } from "../parser/frontmatter";
import { parseMarkdown } from "../parser/markdown";
import { CLAIM_MARKERS, MARKER_SEVERITY, type SeverityLevel } from "../schema";

export type Severity = SeverityLevel;

function isSeverityLevel(value: unknown): value is SeverityLevel {
	return value === "error" || value === "warn" || value === "info" || value === "ignore"
}

function getSeverity(marker: string, status: string): SeverityLevel {
	const entry = MARKER_SEVERITY[marker]
	if (!entry) return "ignore"
	const value = entry[status]
	return isSeverityLevel(value) ? value : "ignore"
}

export interface ValidationIssue {
	severity: Severity;
	rule: string;
	file: string;
	line?: number;
	message: string;
}

interface NoteInfo {
	path: string;
	relativePath: string;
	data: Record<string, unknown>;
	content: string;
}

function getString(data: Record<string, unknown>, key: string): string | undefined {
	const value = data[key]
	return typeof value === "string" ? value : undefined
}

async function readNotes(
	topicDir: string,
	subdir?: string,
): Promise<NoteInfo[]> {
	const dir = subdir ? join(topicDir, subdir) : topicDir;
	if (!existsSync(dir)) return [];

	const notes: NoteInfo[] = [];
	const files = await readdir(dir, { withFileTypes: true });

	for (const file of files) {
		if (!file.isFile() || !file.name.endsWith(".md")) continue;
		const filePath = join(dir, file.name);
		const raw = await Bun.file(filePath).text();
		const parsed = parseFrontmatter(raw);

		if (Either.isRight(parsed)) {
			notes.push({
				path: filePath,
				relativePath: subdir ? `${subdir}/${file.name}` : file.name,
				data: parsed.right.data,
				content: parsed.right.content,
			});
		} else {
			notes.push({
				path: filePath,
				relativePath: subdir ? `${subdir}/${file.name}` : file.name,
				data: {},
				content: raw,
			});
		}
	}

	return notes;
}

const allMarkerLabels = Object.values(CLAIM_MARKERS).map((m) => m.label)
const anyMarkerPattern = new RegExp(
	`\\*\\((${allMarkerLabels.join("|")})\\)\\*`,
)

function checkClaimsInFindings(
	note: NoteInfo,
	status: string,
): ValidationIssue[] {
	if (status === "sketch") return []

	const issues: ValidationIssue[] = []
	const md = parseMarkdown(note.content)
	const findings = md.sections.get("Findings")
	if (!findings) return []

	const lines = findings.split("\n")

	for (const line of lines) {
		const trimmed = line.trim()
		if (!trimmed.startsWith("- ") || trimmed === "- " || trimmed === "-")
			continue

		const claim = trimmed.slice(2)
		const hasWikilink = /\[\[.+\]\]/.test(claim)
		const hasMarker = anyMarkerPattern.test(claim)

		if (!hasWikilink && !hasMarker) {
			const severity = getSeverity("bare-claim", status)
			if (severity !== "ignore") {
				issues.push({
					severity,
					rule: "bare-claim",
					file: note.relativePath,
					message: `bare claim in Findings: "${claim.slice(0, 60)}${claim.length > 60 ? "..." : ""}"`,
				})
			}
		}

		if (/\*\(contradicted\)\*/.test(claim)) {
			const severity = getSeverity("contradicted", status)
			if (severity !== "ignore") {
				issues.push({
					severity,
					rule: "contradicted-claim",
					file: note.relativePath,
					message: `contradicted claim in Findings: "${claim.slice(0, 60)}${claim.length > 60 ? "..." : ""}"`,
				})
			}
		}
	}

	return issues
}

export async function validateTopic(
	labRoot: string,
	slug: string,
): Promise<ValidationIssue[]> {
	const topicDir = join(labRoot, "topics", slug);
	const issues: ValidationIssue[] = [];

	// structural: hub exists
	const hubPath = join(topicDir, `${slug}.md`);
	if (!existsSync(hubPath)) {
		issues.push({
			severity: "error",
			rule: "hub-exists",
			file: `${slug}.md`,
			message: `hub note missing: expected ${slug}.md`,
		});
		return issues;
	}

	// read all notes
	const rootNotes = await readNotes(topicDir);
	const sourceNotes = await readNotes(topicDir, "sources");
	const allNotes = [...rootNotes, ...sourceNotes];

	// structural: frontmatter valid
	for (const note of allNotes) {
		if (Object.keys(note.data).length === 0) {
			issues.push({
				severity: "error",
				rule: "frontmatter-valid",
				file: note.relativePath,
				message: "missing or invalid frontmatter",
			});
		}
	}

	// structural: sources/ only contains type: source
	for (const note of sourceNotes) {
		if (note.data.type && note.data.type !== "source") {
			issues.push({
				severity: "error",
				rule: "source-type",
				file: note.relativePath,
				message: `file in sources/ has type "${note.data.type}", expected "source"`,
			});
		}
	}

	// structural: wikilinks resolve (working and distilled only)
	for (const note of allNotes) {
		const status = getString(note.data, "status");
		if (status !== "working" && status !== "distilled") continue;

		const md = parseMarkdown(note.content);
		for (const link of md.wikilinks) {
			const candidates = [
				join(topicDir, `${link.target}.md`),
				join(topicDir, link.target),
				join(topicDir, `${link.target}/`),
			];
			const resolves = candidates.some((c) => existsSync(c));
			if (!resolves) {
				issues.push({
					severity: "error",
					rule: "link-resolves",
					file: note.relativePath,
					line: link.lineNumber,
					message: `broken wikilink: [[${link.target}]]`,
				});
			}
		}
	}

	// structural: orphan notes (flat .md files in topic root must be linked from hub)
	const hubNote = rootNotes.find((n) => n.relativePath === `${slug}.md`);
	if (hubNote) {
		const hubMd = parseMarkdown(hubNote.content);
		const linkedTargets = new Set(hubMd.wikilinks.map((l) => l.target));

		for (const note of rootNotes) {
			if (note.relativePath === `${slug}.md`) continue;
			const noteBasename = note.relativePath.replace(/\.md$/, "");
			const isLinked =
				linkedTargets.has(noteBasename) ||
				linkedTargets.has(`./${note.relativePath}`) ||
				linkedTargets.has(note.relativePath);
			if (!isLinked) {
				issues.push({
					severity: "error",
					rule: "orphan-note",
					file: note.relativePath,
					message: "note not linked from hub",
				});
			}
		}
	}

	// content: claims in findings
	for (const note of allNotes) {
		const status = getString(note.data, "status") ?? "sketch"
		issues.push(...checkClaimsInFindings(note, status))
	}

	// content: empty required hub sections
	if (hubNote) {
		const hubStatus = getString(hubNote.data, "status") ?? "sketch";
		if (hubStatus !== "sketch") {
			const hubMd = parseMarkdown(hubNote.content);
			const requiredSections = ["Intent", "Questions"];
			const sectionSeverity: Severity =
				hubStatus === "distilled" ? "error" : "warn";

			for (const section of requiredSections) {
				const sectionContent = hubMd.sections.get(section);
				const isEmpty =
					!sectionContent ||
					sectionContent.trim() === "" ||
					sectionContent.trim() === "-";
				if (isEmpty) {
					issues.push({
						severity: sectionSeverity,
						rule: "empty-hub-section",
						file: `${slug}.md`,
						message: `${section} section is empty`,
					});
				}
			}
		}
	}

	// content: stale files (updated date older than threshold)
	const STALE_AFTER_DAYS = 60;

	for (const note of allNotes) {
		const updated = getString(note.data, "updated");
		if (!updated) continue;

		const updatedDate = new Date(updated);
		const now = new Date();
		const daysSince = Math.floor(
			(now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24),
		);

		if (daysSince > STALE_AFTER_DAYS) {
			const status = getString(note.data, "status");
			issues.push({
				severity: status === "sketch" ? "info" : "warn",
				rule: "stale-file",
				file: note.relativePath,
				message: `not updated in ${daysSince} days (last: ${updated})`,
			});
		}
	}

	return issues;
}

export async function validateAll(
	labRoot: string,
): Promise<Map<string, ValidationIssue[]>> {
	const topicsDir = join(labRoot, "topics");
	const results = new Map<string, ValidationIssue[]>();

	if (!existsSync(topicsDir)) return results;

	const dirs = await readdir(topicsDir, { withFileTypes: true });
	for (const dir of dirs) {
		if (!dir.isDirectory() || dir.name === "_template") continue;
		const issues = await validateTopic(labRoot, dir.name);
		if (issues.length > 0) {
			results.set(dir.name, issues);
		}
	}

	return results;
}
