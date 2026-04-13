import { CLAIM_MARKERS } from "../schema";

function helpMarkers(): string {
	const lines = ["claim markers:", ""];
	for (const marker of Object.values(CLAIM_MARKERS)) {
		lines.push(`  *(${marker.label})*`.padEnd(26) + marker.description);
	}
	lines.push(
		`${"  [[source-link]]".padEnd(26)}verified — the link is the proof`,
	);
	lines.push("");
	lines.push("usage in markdown:");
	lines.push("  - Hotels average 12,000 yen *(unsupported)*");
	lines.push(
		"  - JR pass is 50,000 yen [[sources/jr-pass-guide|JR Pass Guide]]",
	);
	lines.push("");
	lines.push("validation:");
	lines.push("  sketch    -> markers ignored");
	lines.push("  working   -> unsupported warns, contradicted warns");
	lines.push(
		"  distilled -> unsupported errors, contradicted errors, single-source warns",
	);
	return lines.join("\n");
}

function helpCommands(): string {
	return [
		"commands:",
		"",
		'  lab new "Title"               create a new research topic',
		"  lab index                      regenerate the topics index",
		"  lab validate [slug]            validate structure and content",
		'  lab search "query"             full-text search across topics',
		"  lab check                      show staleness report",
		"  lab compute <slug> <script>    run script, capture output",
		"    [-- args...]                 forward args to the script",
		"  lab gather <slug>              collect sources for a topic",
		"    [--rounds N] [--visible]     rounds and visibility options",
		"  lab verify <slug>              check and corroborate claims",
		"    [--rounds N] [--visible]     rounds and visibility options",
		"  lab conventions                regenerate CONVENTIONS.md",
		"  lab help [topic]               show conventions and usage",
		"",
		"help topics: markers, commands, conventions, frontmatter, lifecycle",
	].join("\n");
}

function helpConventions(): string {
	return [
		"conventions:",
		"",
		"  one folder per topic under topics/",
		"  hub note named <slug>.md",
		"  sources in sources/, one per file",
		"  computations in computations/, scripts + .output.md",
		"  every .md has frontmatter: type, title, status, created, updated",
		"  claims link to evidence inline (Wikipedia-style)",
		"  unproven claims use markers: *(unsupported)*, *(hypothesis)*, etc.",
		"",
		"  see CONVENTIONS.md for full reference",
	].join("\n");
}

function helpFrontmatter(): string {
	return [
		"frontmatter (required on every note):",
		"",
		"  type: hub | source | note | computation",
		'  title: "human-readable name"',
		"  status: sketch | working | distilled",
		"  created: YYYY-MM-DD",
		"  updated: YYYY-MM-DD",
		"",
		"optional for sources:",
		'  url: "https://..."',
		'  author: "..."',
		"  accessed: YYYY-MM-DD",
		"",
		"optional for hubs:",
		"  slug: topic-slug",
		"  tags: [research, topic]",
	].join("\n");
}

function helpLifecycle(): string {
	return [
		"note lifecycle:",
		"",
		"  sketch     raw capture, no rules beyond required frontmatter",
		"  working    claims should be labeled, links checked",
		"  distilled  claims must have evidence or explicit markers",
		"",
		"research flow:",
		"  1. conversation with AI about what to research",
		'  2. lab new "Title" to create the topic skeleton',
		"  3. fill hub with intent, questions, initial claims",
		"  4. lab gather to collect sources (coming soon)",
		"  5. lab verify to check and corroborate claims (coming soon)",
		"  6. lab refine to tournament-harden claims (coming soon)",
		"  7. lab validate to confirm everything passes",
	].join("\n");
}

const HELP_TOPICS: Record<string, () => string> = {
	markers: helpMarkers,
	commands: helpCommands,
	conventions: helpConventions,
	frontmatter: helpFrontmatter,
	lifecycle: helpLifecycle,
};

export function runHelp(topic?: string): string {
	if (!topic) {
		return [
			"research lab cli",
			"",
			helpCommands(),
			"",
			"run lab help <topic> for details on a specific topic",
		].join("\n");
	}

	const fn = HELP_TOPICS[topic];
	if (!fn) {
		return `unknown help topic: "${topic}"\navailable: ${Object.keys(HELP_TOPICS).join(", ")}`;
	}

	return fn();
}
