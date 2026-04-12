# Research Lab Conventions

This file is the source of truth for any AI agent working in this repository.
Read this before making changes to research content.

## Claim markers

Claims in Findings sections use inline markers to indicate evidence status:

| Marker | Meaning |
|---|---|
| *(unsupported)* | no evidence at all |
| *(single-source)* | one source, needs corroboration |
| *(hypothesis)* | reasoned inference, not directly provable |
| *(contradicted)* | sources disagree, must resolve before distilling |
| [[source-link]] | verified, the link is the proof |

Usage:

    - JR pass is 50,000 yen [[sources/jr-pass-guide|JR Pass Guide]]
    - Shinjuku has the most transit options *(single-source)*
    - Budget 15,000 yen per day for food *(unsupported)*
    - Matter protocol should work for this *(hypothesis)*
    - Capsule hotels are cheaper near stations *(contradicted)*

Block-level markers use Obsidian callouts: > [!hypothesis], > [!contradicted], etc.

## Frontmatter

Every .md file under topics/ requires these fields:

    type: hub | source | note | computation
    title: "..."
    status: sketch | working | distilled
    created: YYYY-MM-DD
    updated: YYYY-MM-DD

Source files may add: url, author, accessed.
Hub files may add: slug, tags, aliases.

## File structure

    sketch/                   rough ideas without a topic
    topics/<slug>/            one folder per topic
      <slug>.md               hub note
      sources/                one file per evidence source
      computations/           deterministic scripts and output files
    topics/index.md           master catalog
    archive/                  inactive topics

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

    bare claim (no marker, no link)     sketch: ignore   working: warn    distilled: error
    *(unsupported)*                     sketch: ignore   working: warn    distilled: error
    *(single-source)*                   sketch: ignore   working: info    distilled: warn
    *(contradicted)*                    sketch: ignore   working: warn    distilled: error
    *(hypothesis)*                      passes at all stages

## Context loading for AI agents

When working on a topic, load in this order:
1. Hub note — always read first
2. Source frontmatter (title, url, key points) — as an index
3. Full source text — only for sources linked from claims being checked
4. Computation outputs — when claims reference computed data
5. Related topic hubs — when cross-references exist

## CLI commands

Run bun run lab help for full command reference.
