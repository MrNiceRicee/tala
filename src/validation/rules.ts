import { join } from "node:path"
import { readdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import { Either } from "effect"
import { parseFrontmatter } from "../parser/frontmatter"
import { parseMarkdown } from "../parser/markdown"

export type Severity = "error" | "warn" | "info"

export interface ValidationIssue {
	severity: Severity
	rule: string
	file: string
	line?: number
	message: string
}

interface NoteInfo {
	path: string
	relativePath: string
	data: Record<string, unknown>
	content: string
}

async function readNotes(topicDir: string, subdir?: string): Promise<NoteInfo[]> {
	const dir = subdir ? join(topicDir, subdir) : topicDir
	if (!existsSync(dir)) return []

	const notes: NoteInfo[] = []
	const files = await readdir(dir, { withFileTypes: true })

	for (const file of files) {
		if (!file.isFile() || !file.name.endsWith(".md")) continue
		const filePath = join(dir, file.name)
		const raw = await Bun.file(filePath).text()
		const parsed = parseFrontmatter(raw)

		if (Either.isRight(parsed)) {
			notes.push({
				path: filePath,
				relativePath: subdir ? `${subdir}/${file.name}` : file.name,
				data: parsed.right.data,
				content: parsed.right.content,
			})
		} else {
			notes.push({
				path: filePath,
				relativePath: subdir ? `${subdir}/${file.name}` : file.name,
				data: {},
				content: raw,
			})
		}
	}

	return notes
}

function checkBareClaimsInFindings(
	note: NoteInfo,
	status: string,
): ValidationIssue[] {
	if (status === "sketch") return []

	const issues: ValidationIssue[] = []
	const md = parseMarkdown(note.content)
	const findings = md.sections.get("Findings")
	if (!findings) return []

	const lines = findings.split("\n")
	const severity: Severity = status === "distilled" ? "error" : "warn"

	for (const line of lines) {
		const trimmed = line.trim()
		if (!trimmed.startsWith("- ") || trimmed === "- " || trimmed === "-") continue

		const claim = trimmed.slice(2)
		const hasWikilink = /\[\[.+\]\]/.test(claim)
		const hasMarker = /\*\((hypothesis|unverified)\)\*/.test(claim)

		if (!hasWikilink && !hasMarker) {
			issues.push({
				severity,
				rule: "bare-claim",
				file: note.relativePath,
				message: `bare claim in Findings: "${claim.slice(0, 60)}${claim.length > 60 ? "..." : ""}"`,
			})
		}
	}

	return issues
}

export async function validateTopic(
	labRoot: string,
	slug: string,
): Promise<ValidationIssue[]> {
	const topicDir = join(labRoot, "topics", slug)
	const issues: ValidationIssue[] = []

	// structural: hub exists
	const hubPath = join(topicDir, `${slug}.md`)
	if (!existsSync(hubPath)) {
		issues.push({
			severity: "error",
			rule: "hub-exists",
			file: `${slug}.md`,
			message: `hub note missing: expected ${slug}.md`,
		})
		return issues
	}

	// read all notes
	const rootNotes = await readNotes(topicDir)
	const sourceNotes = await readNotes(topicDir, "sources")
	const allNotes = [...rootNotes, ...sourceNotes]

	// structural: frontmatter valid
	for (const note of allNotes) {
		if (Object.keys(note.data).length === 0) {
			issues.push({
				severity: "error",
				rule: "frontmatter-valid",
				file: note.relativePath,
				message: "missing or invalid frontmatter",
			})
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
			})
		}
	}

	// structural: wikilinks resolve (working and distilled only)
	for (const note of allNotes) {
		const status = note.data.status as string
		if (status !== "working" && status !== "distilled") continue

		const md = parseMarkdown(note.content)
		for (const link of md.wikilinks) {
			const candidates = [
				join(topicDir, `${link.target}.md`),
				join(topicDir, link.target),
				join(topicDir, `${link.target}/`),
			]
			const resolves = candidates.some((c) => existsSync(c))
			if (!resolves) {
				issues.push({
					severity: "error",
					rule: "link-resolves",
					file: note.relativePath,
					line: link.lineNumber,
					message: `broken wikilink: [[${link.target}]]`,
				})
			}
		}
	}

	// content: bare claims in findings
	for (const note of allNotes) {
		const status = (note.data.status as string) ?? "sketch"
		issues.push(...checkBareClaimsInFindings(note, status))
	}

	return issues
}

export async function validateAll(
	labRoot: string,
): Promise<Map<string, ValidationIssue[]>> {
	const topicsDir = join(labRoot, "topics")
	const results = new Map<string, ValidationIssue[]>()

	if (!existsSync(topicsDir)) return results

	const dirs = await readdir(topicsDir, { withFileTypes: true })
	for (const dir of dirs) {
		if (!dir.isDirectory() || dir.name === "_template") continue
		const issues = await validateTopic(labRoot, dir.name)
		if (issues.length > 0) {
			results.set(dir.name, issues)
		}
	}

	return results
}
