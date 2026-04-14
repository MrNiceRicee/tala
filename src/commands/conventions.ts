import { DOMAIN_CRITERIA } from "../orchestrator/criteria";
import { CLAIM_MARKERS, MARKER_SEVERITY } from "../schema";

export function generateConventions(): string {
	const markerTable = Object.values(CLAIM_MARKERS)
		.map((m) => `| *(${m.label})* | ${m.description} |`)
		.join("\n");

	const severityRows = Object.entries(MARKER_SEVERITY)
		.map(([marker, levels]) => {
			const sketch = levels.sketch ?? "ignore";
			const working = levels.working ?? "ignore";
			const distilled = levels.distilled ?? "ignore";
			return `    ${marker.padEnd(30)} sketch: ${sketch.padEnd(8)} working: ${working.padEnd(8)} distilled: ${distilled}`;
		})
		.join("\n");

	const domainList = Object.keys(DOMAIN_CRITERIA)
		.map((d) => `    ${d}`)
		.join("\n");

	return `# Research Lab Conventions

This file is generated from TypeScript definitions. Run \`bun run lab conventions\` to regenerate.

## Claim markers

| Marker | Meaning |
|---|---|
${markerTable}
| [[source-link]] | verified, the link is the proof |

Block-level markers use Obsidian callouts: > [!hypothesis], > [!contradicted], etc.

## Frontmatter

Every .md file under topics/ requires these fields:

    type: hub | source | note | computation
    title: "..."
    status: sketch | working | distilled
    created: YYYY-MM-DD
    updated: YYYY-MM-DD

Source files may add: url, author, accessed.
Hub files may add: slug, tags, aliases, domain.

## File structure

    sketch/                   rough ideas without a topic
    topics/<slug>/            one folder per topic
      <slug>.md               hub note
      sources/                one file per evidence source
      computations/           deterministic scripts and output files
      criteria.md             topic-specific evaluation criteria (optional)
    topics/index.md           master catalog
    archive/                  inactive topics
    tools/                    personal reusable scripts (gitignored)
      *.ts                    drop any tool here, run via lab tool

## Hub note sections

    Intent      why this topic exists
    Questions   what you are trying to answer
    Findings    distilled claims with evidence links or markers
    Open        unresolved items, hypotheses to investigate
    Related     cross-topic wikilinks

## Note lifecycle

    sketch      raw capture, minimal rules
    working     being developed, claims should be labeled
    distilled   source of truth, claims must have evidence or explicit markers

## Validation severity

${severityRows}

## Available domains

${domainList}

Set a topic's domain in hub frontmatter: \`domain: software\`

## Context loading for AI agents

1. Hub note — always read first
2. Source frontmatter (title, url, key points) — as an index
3. Full source text — only for sources linked from claims being checked
4. Computation outputs — when claims reference computed data
5. Related topic hubs — when cross-references exist

## Tools

Reusable scripts live in tools/ at repo root. Unlike topic-local computations, tools work across multiple topics (e.g., a drive-matrix calculator usable by any trip research).

Run a tool:

    bun run lab tool <topic-slug> <tool-name> [-- args...]

Output is captured to the topic's computations/ folder with provenance.

List tools:

    bun run lab tools

## CLI commands

Run bun run lab help for full command reference.
`;
}
