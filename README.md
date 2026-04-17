```text
  _        _
 | |_ __ _| | __ _
 | __/ _` | |/ _` |
 | || (_| | | (_| |
  \__\__,_|_|\__,_|
```

*tagalog for both* note *and* star - *the fixed reference your thinking orients to.*

Claim-grounded research lab. Write topics with explicit claim markers, cross-check sources, run deterministic tools on your data, and ship knowledge bases an agent (or a human) can trust.

## Prerequisites

[Bun](https://bun.sh) v1.3 or later.

```sh
curl -fsSL https://bun.sh/install | bash
```

## Install

Run without installing:

```sh
bunx @mrnicericee/tala init
```

Or install globally:

```sh
bun add -g @mrnicericee/tala
```

## Quick Start

```sh
mkdir my-research && cd my-research
tala init                           # wizard: where topics/tools live, commit or ignore
tala new "caching strategies"       # creates topics/caching-strategies/
$EDITOR topics/caching-strategies/caching-strategies.md
tala validate                       # structure + claim-marker discipline
tala verify caching-strategies      # emit cross-check protocol for an agent
tala tool caching-strategies benchmark   # runs ./tools/benchmark.ts on the topic
```

## Commands

| command                                  | what it does                                              |
|------------------------------------------|-----------------------------------------------------------|
| `tala init`                              | scaffold `.tala/config.json`, `topics/`, `tools/`, `.env` |
| `tala new "Title"`                       | create a new topic (hub + sources/ + notes/ + comps)      |
| `tala get`                               | list resources (topics, tools, cache, config, schema)     |
| `tala get <resource> [<name>]`           | inspect a resource - see `--claims`, `--full`, `--format` |
| `tala env sync`                          | regenerate `.env.example` from tool metadata              |
| `tala env check`                         | verify required env keys are set (exits 1 on missing)     |
| `tala index`                             | regenerate the topics index                               |
| `tala validate [slug]`                   | structure, frontmatter, claim markers, link resolution    |
| `tala search "query"`                    | full-text search across topics                            |
| `tala check`                             | staleness report                                          |
| `tala gather <slug>`                     | emit gather context for an agent to fill                  |
| `tala verify <slug>`                     | emit cross-check protocol for claims in a topic           |
| `tala tool <slug> <name>`                | run `./tools/<name>.ts` against a topic, save output      |
| `tala refine <slug>`                     | tournament-refine a section                               |
| `tala conventions`                       | regenerate `AGENTS.md` from the convention definitions    |

### `tala get` - read resources

```sh
tala get                                        # resource catalog
tala get topics                                 # list topics
tala get topics --status working                # filter list by status
tala get topics <slug>                          # topic summary
tala get topics <slug> --full                   # full hub markdown
tala get topics <slug> --claims                 # claims table
tala get topics <slug> --claims --marker unsupported
tala get topics <slug> --sources
tala get topics <slug> --computations
tala get topics <slug> --format json            # machine-readable summary
tala get tools                                  # list tools + descriptions
tala get tools <name>                           # tool args, env, cache policy
tala get cache                                  # .cache/ entries with fresh/stale state
tala get cache <hash> --fresh                   # only show if still valid
tala get config                                 # resolved config (defaults vs overrides)
tala get schema                                 # list built-in framework schemas
tala get schema claim-markers                   # enum of valid markers
```

### `tala env` - environment key management

Scans registered tools for their declared `env[]` arrays and keeps `.env.example` in sync.

```sh
tala env sync     # write required keys to `<envFile>.example`
tala env check    # report missing / present keys; exit 1 on any missing
```

`envFile` defaults to `./.tala/.env` (override via `.tala/config.json` if you prefer the repo root).

Precedence at startup: shell env > `envFile` values > defaults. The CLI never overwrites an already-set `Bun.env` entry.

Pipe JSON to `jq` to triage claims:

```sh
tala get topics <slug> --format json | jq '.claimCounts'
tala get topics <slug> --claims --marker unsupported --format json | jq
```

## Concepts

- **Topics** - a folder of `topics/<slug>/` with a hub `.md`, `sources/`, `notes/`, and `computations/`. Hubs state *intent*, *questions*, *findings*; sources cite evidence; notes hold derivations; computations are tool outputs with provenance frontmatter (`tool:`, `args:`, `ran_at:`).
- **Claim markers** - every factual statement carries its epistemic status. `*(unsupported)*` / `*(single-source)*` / `*(hypothesis)*` / `*(contradicted)*` / `[[source-link]]`. `tala validate` enforces them.
- **Tools** - project-specific, Effect-native TypeScript files in `./tools/`. Register with `defineTool({...}, import.meta)`. Run via `tala tool <slug> <name>`. Outputs land in `topics/<slug>/computations/<name>.output.md`.
- **HTTP cache** - `fetchJsonCached` keys requests by `sha256(method + url + body)`, writes to `./.cache/`. `expiresAt` precomputed per entry. Cache misses fail open.

## Stack

Bun · TypeScript · Effect v4 (beta) · unified/remark · gray-matter · Biome · Clack.

## Sibling

[`liham`](https://github.com/MrNiceRicee/liham) - terminal markdown previewer. Pairs well with `tala`: `liham topics/<slug>/<slug>.md` to read, `tala validate` to verify.

## License

MIT
