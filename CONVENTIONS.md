# Research Lab Conventions

This file is generated from TypeScript definitions. Run `bun run lab conventions` to regenerate.

## Claim markers

| Marker | Meaning |
|---|---|
| *(unsupported)* | no evidence at all |
| *(single-source)* | one source, needs corroboration |
| *(hypothesis)* | reasoned inference, not directly provable |
| *(contradicted)* | sources disagree on this claim |
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

    unsupported                    sketch: ignore   working: warn     distilled: error
    single-source                  sketch: ignore   working: info     distilled: warn
    hypothesis                     sketch: ignore   working: ignore   distilled: ignore
    contradicted                   sketch: ignore   working: warn     distilled: error
    bare-claim                     sketch: ignore   working: warn     distilled: error

## Available domains

    software
    travel
    pharmacy

Set a topic's domain in hub frontmatter: `domain: software`

## Context loading for AI agents

1. Hub note - always read first
2. Source frontmatter (title, url, key points) - as an index
3. Full source text - only for sources linked from claims being checked
4. Computation outputs - when claims reference computed data
5. Related topic hubs - when cross-references exist

## Tools

Reusable scripts live in tools/ at repo root. Unlike topic-local computations, tools work across multiple topics (e.g., a drive-matrix calculator usable by any trip research).

Run a tool:

    bun run lab tool <topic-slug> <tool-name> [-- args...]

Output is captured to the topic's computations/ folder with provenance.

List tools:

    bun run lab tools

## Writing a tool

Tools are Effect-native. Use `defineTool` from `src/tool-runner.ts`:

    import { Effect, Option, Schema } from "effect"
    import { defineTool, fetchJson, readJsonFile } from "../src/tool-runner"

    const Args = Schema.Struct({
      "my-file": Schema.optional(Schema.String),
    })

    function program(args: typeof Args.Type) {
      const e = Effect.gen(function* () {
        const file = Option.getOrElse(
          Option.fromNullishOr(args["my-file"]),
          () => "computations/default.json",
        )
        // ... yield* readJsonFile / fetchJson / etc.
        return "markdown output string"
      })
      return e
    }

    export default await defineTool({ name: "my-tool", args: Args, run: program })

Rules enforced by linteffect (covers tools/ in lint and lint:effect):
- No `const x = "string"` at module scope - use defaults inline in `Option.getOrElse(() => "...")`
- No `Effect.succeed("literal")` - compose values into Effects only at yield sites
- `program` must assign `Effect.gen(...)` to a local before returning
- No nested Effect calls - assign inner Effects to variables first

## API keys for tools

Keys live in .env at the repo root (gitignored). See .env.example for the template.

Known keys (defined in src/env.ts EnvSchema):

    OPENROUTESERVICE_API_KEY
    HERE_API_KEY

Tools access keys via typed helpers from src/env.ts:

    import { requireKey, env } from "../src/env"

    const apiKey = requireKey("OPENROUTESERVICE_API_KEY", { tool: "drive-matrix" })
    const optional = env.HERE_API_KEY

Adding a new key: add to EnvSchema in src/env.ts, add to .env.example, add value to .env. TypeScript enforces known keys at compile time.

## CLI commands

Run bun run lab help for full command reference.
