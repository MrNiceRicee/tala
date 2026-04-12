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
- every note has YAML frontmatter with `type`, `title`, `status`, `created`, `updated`
- proven claims link to evidence inline; unproven claims use `*(hypothesis)*` or `*(unverified)*`

## Folder layout

- `sketch/` — raw captures and rough ideas without a topic yet
- `topics/` — one directory per research topic
- `topics/index.md` — master catalog of all topics
- `archive/` — inactive or finished work
- `scripts/` — CLI tooling (Bun + EffectTS v4)

## Stack

Bun + TypeScript + EffectTS v4 (beta) for the CLI. Markdown files as durable storage. Obsidian-compatible links and frontmatter.
