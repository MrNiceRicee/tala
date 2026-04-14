# Tools

Reusable scripts that work across topics. Stays local (gitignored) because tools are personal — API keys, preferences, specific data sources.

## Usage

Drop any executable `.ts` file here. Run via:

    bun run lab tool <topic-slug> <tool-name> [-- args...]

Output is captured to `topics/<topic-slug>/computations/<tool-name>.output.md` with provenance.

List available tools:

    bun run lab tools

## Example

    tools/drive-matrix.ts

    bun run lab tool oahu-trip drive-matrix -- --points "waikiki,kailua,north-shore"

Output captured to `topics/oahu-trip/computations/drive-matrix.output.md` citing the tool and args used.

## API keys

Keys go in `.env` at the repo root (gitignored). See `.env.example` for the template.

Known keys are defined in `EnvSchema` in `src/env.ts`. Adding a new key:
1. Add it to `EnvSchema` in `src/env.ts`
2. Add it to `.env.example` (tracked template)
3. Add the value to `.env` (your local file)

Tools access keys via the shared helpers:

    import { requireKey, env } from "../src/env"

    // required — throws with a helpful message if missing
    const apiKey = requireKey("OPENROUTESERVICE_API_KEY", { tool: "drive-matrix" })

    // optional — read directly from the typed env object
    const optional = env.HERE_API_KEY  // string | undefined

TypeScript only allows keys defined in `EnvSchema`. Unknown keys are caught at compile time.
