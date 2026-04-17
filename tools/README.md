# Tools

Reusable scripts that work across topics. Stays local (gitignored) because tools are personal - API keys, preferences, specific data sources.

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

## Writing a tool

Tools use `defineTool` from `src/tool-runner.ts` and must be Effect-native - no try/catch, no if-statements, no ternaries.

Minimal scaffold:

```ts
import { Effect, Option, Schema } from "effect";
import { requireKey } from "../src/env";
import { defineTool, fetchJsonCached, readJsonFile } from "../src/tool-runner";

const CACHE_TTL_MINUTES = 7 * 24 * 60;

const Args = Schema.Struct({
  "my-file": Schema.optional(Schema.String),
});

function program(args: typeof Args.Type) {
  const e = Effect.gen(function* () {
    const file = Option.getOrElse(
      Option.fromNullishOr(args["my-file"]),
      () => "computations/default.json",
    );
    // ... read files, fetch APIs, build output string
    return "markdown output";
  });
  return e;
}

defineTool(
  {
    name: "my-tool",
    description: "one-line summary, shown by `tala get tools` and help output",
    args: Args,
    env: ["MY_API_KEY"],                   // optional, enumerated by future `tala env sync`
    cache: { ttlMinutes: CACHE_TTL_MINUTES }, // optional, surfaced via `tala get tools <name>`
    run: program,
  },
  import.meta,
);
```

Required vs optional on `defineTool`:
- Required: `name`, `args`, `run`
- Optional: `description`, `env`, `cache`

Always set `description`. `tala get tools` treats it as the tool's identity card; without it you get a bare `-`.

Set `env` whenever the tool calls `requireKey`. Tooling enumerates this to regenerate `.env.example` and warn on missing keys.

Set `cache` when the tool uses `fetchJsonCached` so the TTL is visible via `tala get tools <name>`, making cache policy auditable without reading the source.

Key rules (enforced by linteffect):
- Args schema: use `Schema.optional(Schema.String)` for optional fields; apply defaults with `Option.getOrElse` in the program body.
- No `const x = "string"` at module scope (`no-string-sentinel-const`).
- No `Effect.succeed("literal")` (`no-string-sentinel-return`).
- `program` must assign `Effect.gen(...)` to a local variable before returning (`no-effect-wrapper-alias`).
- Nest Effect calls flat: assign inner Effects to variables before passing to outer ones (`no-nested-effect-call`).
- Helpers: `readJsonFile(path, Schema)`, `fetchJson(url, init, Schema)`, `fetchJsonCached(url, init, Schema, { ttlMinutes, cacheKey })`.

linteffect covers `tools/` in the `lint` and `lint:effect` scripts.

## API keys

Keys go in `.env` at the repo root (gitignored). See `.env.example` for the template.

Known keys are defined in `EnvSchema` in `src/env.ts`. Adding a new key:
1. Add it to `EnvSchema` in `src/env.ts`
2. Add it to `.env.example` (tracked template)
3. Add the value to `.env` (your local file)

Tools access keys via the shared helpers:

    import { requireKey, env } from "../src/env"

    // required - throws with a helpful message if missing
    const apiKey = requireKey("OPENROUTESERVICE_API_KEY", { tool: "drive-matrix" })

    // optional - read directly from the typed env object
    const optional = env.HERE_API_KEY  // string | undefined

TypeScript only allows keys defined in `EnvSchema`. Unknown keys are caught at compile time.
