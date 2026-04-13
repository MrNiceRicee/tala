# Research Lab

Read CONVENTIONS.md before making any changes to research content.

## Stack

- Bun + TypeScript + EffectTS v4 (beta)
- unified + remark-parse for markdown AST
- gray-matter for frontmatter
- Biome for linting

## CLI

Run `bun run lab help` for all commands and usage.

## Code rules

- no type casting (`as` assertions) — use type guards or Schema decoding
- claim markers defined in `src/schema.ts` (CLAIM_MARKERS) — single source of truth
- validation severity from `MARKER_SEVERITY` lookup table — not hardcoded if/else
- frontmatter parsed via `parseFrontmatter()` returning `ParseResult` discriminated union
- no `Either` — use `{ ok: true, value } | { ok: false, error }` pattern
