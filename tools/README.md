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

Tools access keys via the shared helper:

    import { getKey } from "../src/env"
    const apiKey = getKey("OPENROUTESERVICE_API_KEY", { tool: "drive-matrix" })

`getKey` throws a helpful error if the key is missing. Use `getKeyOptional` if a key is optional.
