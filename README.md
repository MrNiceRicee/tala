# Research Lab

A markdown-first research system for gathering knowledge and making informed decisions across any domain.

## What this is

A durable research environment where a human and AI collaborator work together on complex topics. Two modes:

1. **Curiosity deep dives** — exploring topics outside your domain
2. **Project knowledge bases** — building understanding for active work

Every claim needs proof or an explicit label. The system fights hallucination drift by design.

## Core rules

- one folder per topic under `topics/`
- hub note named after the topic slug: `topics/<slug>/<slug>.md`
- sources live in `topics/<slug>/sources/`, one file per source
- computations live in `topics/<slug>/computations/`, scripts + outputs
- reusable cross-topic scripts live in `tools/` at the repo root
- every note has YAML frontmatter with `type`, `title`, `status`, `created`, `updated`
- proven claims link to evidence inline; unproven claims use `*(unsupported)*`, `*(single-source)*`, `*(hypothesis)*`, or `*(contradicted)*`

See `CONVENTIONS.md` for full rules and `bun run lab help` for the CLI.

## Folder layout

- `sketch/` — raw captures and rough ideas without a topic yet *(gitignored content)*
- `topics/` — one directory per research topic *(gitignored content)*
- `topics/index.md` — master catalog, regenerated via `lab index`
- `archive/` — inactive or finished work *(gitignored content)*
- `tools/` — personal reusable scripts across topics *(gitignored content)*
- `.env` — API keys for tools *(gitignored, see `.env.example` for the template)*
- `src/` — CLI source (Bun + TypeScript + EffectTS v4)

The tool is shareable. The research content stays local.

## Commands

```
lab new "Title"        create a new topic
lab gather <slug>      output research context for the agent
lab verify <slug>      check + corroboration context
lab refine <slug>      tournament-refine protocol (prepare + apply)
lab validate [slug]    structural + content validation
lab search "query"     full-text search
lab check              staleness report
lab compute <slug> <script>    run a topic-local deterministic script
lab tool <slug> <name>         run a reusable tool from tools/
lab tools              list available tools
lab index              regenerate topics catalog
lab conventions        regenerate CONVENTIONS.md from code
lab help [topic]       show conventions and usage
```

## Stack

Bun + TypeScript + EffectTS v4 (beta). Markdown files as durable storage. Obsidian-compatible links and frontmatter. Biome + linteffect for code quality.
